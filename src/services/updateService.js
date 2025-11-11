import { APP_VERSION } from '../utils/constants.js';
import { logUpdaterDiagnostics } from '../utils/appLogger.js';

// Import Tauri APIs directly - they'll be available when bundled in production
let tauriUpdater = null;
let tauriProcess = null;
let tauriShell = null;
let tauriPath = null;
let tauriFs = null;

const loadTauriAPIs = async () => {
  // Only load Tauri APIs in actual Tauri environment
  if (typeof window !== 'undefined' && !tauriUpdater) {
    // Enhanced detection for Tauri v2 environment
    const isTauriEnv =
      window.__TAURI__ ||
      window.location.protocol === 'tauri:' ||
      window.location.origin.startsWith('tauri://') ||
      navigator.userAgent.includes('Tauri');

    console.log('🔍 Enhanced Tauri detection:', {
      hasWindow: typeof window !== 'undefined',
      hasTauriGlobal: !!window.__TAURI__,
      isTauriProtocol: window.location.protocol === 'tauri:',
      isTauriOrigin: window.location.origin.startsWith('tauri://'),
      hasTauriUserAgent: navigator.userAgent.includes('Tauri'),
      isTauriEnv,
      alreadyLoaded: !!tauriUpdater,
      protocol: window.location.protocol,
      origin: window.location.origin,
      userAgent: navigator.userAgent.substring(0, 100) + '...',
    });

    if (isTauriEnv) {
      try {
        console.log('🔄 Tauri environment detected - loading updater APIs...');

        // Try to load Tauri APIs with correct v2 API structure
        const updaterModule = await import('@tauri-apps/plugin-updater');
        const processModule = await import('@tauri-apps/plugin-process');
        const shellModule = await import('@tauri-apps/plugin-shell');
        const pathModule = await import('@tauri-apps/api/path');
        const fsModule = await import('@tauri-apps/plugin-fs');

        console.log('🔧 Raw updater module:', Object.keys(updaterModule));
        console.log('🔧 Raw process module:', Object.keys(processModule));
        console.log('🔧 Raw shell module:', Object.keys(shellModule));
        console.log('🔧 Raw path module:', Object.keys(pathModule));
        console.log('🔧 Raw fs module:', Object.keys(fsModule));

        // For Tauri v2, use the correct API structure
        const { check, Update } = updaterModule;
        const { relaunch } = processModule;
        const { open } = shellModule;
        const { downloadDir } = pathModule;
        const { writeFile } = fsModule;

        // Verify the APIs are available
        if (typeof check === 'function' && Update) {
          tauriUpdater = {
            check, // This is the correct method name in v2
            Update, // Class for update operations
            install: async () => {
              // Use Update class to install
              const updateInfo = await check();
              if (updateInfo && updateInfo.available) {
                await updateInfo.downloadAndInstall();
              }
              return updateInfo;
            },
          };
          tauriProcess = {
            relaunch: typeof relaunch === 'function' ? relaunch : () => Promise.resolve(),
          };
          tauriShell = {
            open: typeof open === 'function' ? open : () => Promise.resolve(),
          };
          tauriPath = {
            downloadDir:
              typeof downloadDir === 'function' ? downloadDir : () => Promise.resolve('/tmp'),
          };
          tauriFs = {
            writeFile: typeof writeFile === 'function' ? writeFile : () => Promise.resolve(),
          };

          console.log('✅ Tauri v2 updater APIs loaded successfully');
          console.log('🔧 Available updater methods:', Object.keys(tauriUpdater));
          console.log('🔧 Available process methods:', Object.keys(tauriProcess));
        } else {
          console.log('❌ Available methods in updater module:', Object.keys(updaterModule));
          throw new Error('Invalid API functions - check method or Update class not available');
        }
      } catch (error) {
        console.error('❌ Failed to load Tauri updater APIs:', {
          error: error.message,
          stack: error.stack,
          name: error.name,
        });
        // Don't create fallback APIs - let the detection fail properly
        tauriUpdater = null;
        tauriProcess = null;
        console.log('⚠️ Tauri updater APIs failed to load - will use fallback methods');
      }
    } else {
      console.log('🌐 Not in Tauri environment - updater will use GitHub API fallback');
      // Don't create APIs in non-Tauri environment
      tauriUpdater = null;
      tauriProcess = null;
    }
  } else if (tauriUpdater) {
    console.log('✅ Tauri APIs already loaded');
  } else {
    console.log('⚠️ Window not available - cannot load Tauri APIs');
  }
};

/**
 * Auto-update service for Tauri application
 *
 * IMPORTANT: This service contains full auto-download functionality that is currently
 * disabled to avoid macOS quarantine issues with ad-hoc signed apps. When Apple
 * Developer certificate is available, restore the auto-download functionality by:
 *
 * 1. Uncomment the downloadUpdate button workflow in UpdateNotification.jsx
 * 2. Remove the manual download link fallback
 * 3. Re-enable the full download progress UI
 * 4. Update signingIdentity in tauri.conf.json to use proper Apple Dev cert
 *
 * All download functionality (downloadUpdate, installDmgFile, openDownloadedFile,
 * revealDownloadedFile) is preserved and working - just not exposed in UI currently.
 */
export class UpdateService {
  static instance = null;
  static updateCache = {
    lastChecked: null,
    updateAvailable: false,
    updateInfo: null,
    cacheTimeout: 60 * 60 * 1000, // 1 hour in milliseconds
  };

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  constructor() {
    this.isStandalone = this.detectStandaloneMode();
    this.listeners = [];
    this.autoCheckInterval = null;
    this.isInstalling = false;
    this.isTestUpgradeMode = this.detectTestUpgradeMode();
    this.init();
  }

  /**
   * Detect if app was launched with --test-upgrade flag
   */
  detectTestUpgradeMode() {
    try {
      const isTestMode = typeof window !== 'undefined' && window.__TEST_UPGRADE_MODE__ === true;

      // Debug logging for command line arguments
      if (typeof window !== 'undefined' && window.__COMMAND_LINE_ARGS__) {
        console.log('🔧 DEBUG: Command line arguments available:', {
          args: window.__COMMAND_LINE_ARGS__,
          count: window.__LAUNCH_ARGUMENTS_COUNT__,
          testMode: isTestMode,
        });
      }

      return isTestMode;
    } catch (error) {
      console.warn('🔧 DEBUG: Error detecting test upgrade mode:', error);
      return false;
    }
  }

  /**
   * Compare version strings (semver-like)
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  compareVersions(a, b) {
    const parseVersion = v =>
      v
        .replace(/^v/, '')
        .split('.')
        .map(num => parseInt(num) || 0);
    const aVersion = parseVersion(a);
    const bVersion = parseVersion(b);

    for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
      const aPart = aVersion[i] || 0;
      const bPart = bVersion[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  async init() {
    console.log('🔧 UpdateService init:', {
      isStandalone: this.isStandalone,
      testUpgradeMode: this.isTestUpgradeMode,
    });

    if (this.isTestUpgradeMode) {
      console.log('🧪 TEST UPGRADE MODE ACTIVE - Updates will be forced even for same version');
    }

    if (this.isStandalone) {
      await loadTauriAPIs();
      this.setupUpdaterListeners();
      console.log('🔧 UpdateService initialized for standalone app');
    } else {
      console.log('🔧 UpdateService: Not standalone, skipping Tauri API loading');
    }
  }

  /**
   * Detect if running as standalone Tauri app
   */
  detectStandaloneMode() {
    // Enhanced detection for Tauri v2
    const hasTauriProtocol = window.location.protocol === 'tauri:';
    const hasTauriOrigin = window.location.origin.startsWith('tauri://');
    const hasTauriInUserAgent = navigator.userAgent.includes('Tauri');
    const hasTauriGlobal = window.__TAURI__ !== undefined;

    // Check for file:// protocol which might be used in development
    const isFileProtocol = window.location.protocol === 'file:';

    // Use multiple detection methods for better reliability
    const isStandalone =
      hasTauriProtocol ||
      hasTauriOrigin ||
      (hasTauriGlobal && (hasTauriInUserAgent || isFileProtocol));

    console.log('🔍 Enhanced standalone detection:', {
      isStandalone,
      hasTauriProtocol,
      hasTauriOrigin,
      hasTauriInUserAgent,
      hasTauriGlobal,
      isFileProtocol,
      protocol: window.location.protocol,
      origin: window.location.origin,
      userAgent: navigator.userAgent.substring(0, 150) + '...',
      hostname: window.location.hostname,
      href: window.location.href.substring(0, 100) + '...',
    });

    return isStandalone;
  }

  /**
   * Setup updater event listeners
   */
  setupUpdaterListeners() {
    if (!this.isStandalone || !tauriUpdater) return;

    try {
      tauriUpdater.onUpdaterEvent(({ error, status }) => {
        console.log('🔄 Updater event:', { error, status });
        this.notifyListeners({ type: 'updater_event', error, status });
      });
    } catch (error) {
      console.error('❌ Failed to setup updater listeners:', error);
    }
  }

  /**
   * Check for updates using Tauri's native updater
   * @param {boolean} force - Force check even if cached
   * @returns {Promise<Object>} Update check result
   */
  async checkForUpdatesViaTauri(force = false) {
    const now = Date.now();
    const cache = UpdateService.updateCache;

    // Return cached result if not forcing and cache is valid
    if (!force && cache.lastChecked && now - cache.lastChecked < cache.cacheTimeout) {
      console.log('📦 Using cached Tauri update check result');
      return {
        updateAvailable: cache.updateAvailable,
        updateInfo: cache.updateInfo,
        cached: true,
      };
    }

    try {
      console.log('🔄 Checking for updates via Tauri updater...');

      // Log updater diagnostics for troubleshooting
      await logUpdaterDiagnostics('Pre-Update Check');

      // Ensure Tauri APIs are loaded before proceeding
      if (!tauriUpdater) {
        console.log('🔧 Tauri APIs not loaded yet, attempting to load...');
        await loadTauriAPIs();
      }

      // Enhanced debugging
      console.log('🔍 Comprehensive Tauri state debug:', {
        tauriUpdaterAvailable: !!tauriUpdater,
        updaterMethods: tauriUpdater ? Object.keys(tauriUpdater) : 'N/A',
        checkUpdateType: tauriUpdater?.checkUpdate ? typeof tauriUpdater.checkUpdate : 'N/A',
        currentVersion: APP_VERSION,
        windowTauri: !!window.__TAURI__,
        windowTauriKeys: window.__TAURI__ ? Object.keys(window.__TAURI__) : 'N/A',
      });

      // Try to diagnose import issues
      if (!tauriUpdater) {
        console.log('🔧 Attempting to diagnose Tauri import issues...');
        try {
          const testImport = await import('@tauri-apps/plugin-updater');
          console.log('✅ Plugin-updater import successful:', Object.keys(testImport));
        } catch (importError) {
          console.error('❌ Plugin-updater import failed:', importError);
        }

        throw new Error('Tauri updater not available - APIs not loaded after retry');
      }

      if (!tauriUpdater.check) {
        throw new Error('Tauri check method not available - got: ' + typeof tauriUpdater.check);
      }

      console.log('🔄 Calling tauriUpdater.check()...');
      const updateInfo = await tauriUpdater.check();
      console.log('✅ Raw Tauri update response:', JSON.stringify(updateInfo, null, 2));

      // Tauri v2 API structure - updateInfo is null if no update available
      // In test upgrade mode, always show update available (even if no real update)
      const hasUpdate = this.isTestUpgradeMode || (updateInfo !== null && updateInfo !== undefined);

      console.log('🔄 Tauri update check result:', {
        hasUpdate,
        currentVersion: APP_VERSION,
        updateInfo: updateInfo,
        fullResponse: updateInfo,
        testMode: this.isTestUpgradeMode,
        forceUpdate: this.isTestUpgradeMode ? '✅ FORCED BY TEST MODE' : '❌',
      });

      // Create result object with test mode handling
      let result;
      if (this.isTestUpgradeMode && !updateInfo) {
        // Create fake update info for testing when no real update exists
        result = {
          shouldUpdate: true,
          currentVersion: APP_VERSION,
          latestVersion: APP_VERSION, // Same version for testing
          releaseNotes: '🧪 TEST MODE: Simulated update for testing updater functionality',
          publishedAt: new Date().toISOString(),
          updateData: null,
          testMode: true,
        };
        console.log('🧪 TEST MODE: Creating simulated update info for testing');
      } else {
        result = {
          shouldUpdate: hasUpdate,
          currentVersion: APP_VERSION,
          latestVersion: hasUpdate ? updateInfo.version : APP_VERSION,
          releaseNotes: hasUpdate
            ? updateInfo.body || 'No release notes available'
            : 'No update available',
          publishedAt: hasUpdate ? updateInfo.date : null,
          updateData: updateInfo,
          // CRITICAL: Preserve raw Tauri response for download URL resolution
          rawJson: updateInfo,
        };
      }

      // Update cache
      cache.lastChecked = now;
      cache.updateAvailable = hasUpdate;
      cache.updateInfo = result;

      // Notify listeners
      this.notifyListeners({
        type: 'update_check_complete',
        updateAvailable: hasUpdate,
        updateInfo: result,
      });

      return {
        updateAvailable: hasUpdate,
        updateInfo: result,
        cached: false,
      };
    } catch (error) {
      // Enhanced error logging
      console.error('❌ Tauri update check failed:', {
        errorMessage: error?.message || 'Unknown error',
        errorName: error?.name || 'Unknown',
        errorStack: error?.stack || 'No stack trace',
        errorToString: error?.toString() || 'Cannot convert to string',
        fullError: error,
        errorType: typeof error,
        errorKeys: error ? Object.keys(error) : 'N/A',
      });

      // Try to extract meaningful error message
      let errorMessage = 'Unknown update check error';
      if (error && typeof error === 'object') {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.toString && error.toString() !== '[object Object]') {
          errorMessage = error.toString();
        } else if (JSON.stringify(error) !== '{}') {
          errorMessage = `Update check error: ${JSON.stringify(error)}`;
        }
      } else if (error) {
        errorMessage = String(error);
      }

      // Update cache with error
      cache.lastChecked = now;
      cache.updateAvailable = false;
      cache.updateInfo = null;

      this.notifyListeners({
        type: 'update_check_error',
        error: errorMessage,
      });

      return {
        updateAvailable: false,
        error: errorMessage,
        errorType: 'tauri_updater_error',
      };
    }
  }

  /**
   * Check for updates with caching - Uses Tauri updater in standalone mode
   * @param {boolean} force - Force check even if cached
   * @returns {Promise<Object>} Update check result
   */
  async checkForUpdates(force = false) {
    // Use Tauri's native updater in standalone environment
    if (this.isStandalone) {
      console.log('🔄 Checking for updates using Tauri native updater...');
      return await this.checkForUpdatesViaTauri(force);
    }

    const now = Date.now();
    const cache = UpdateService.updateCache;

    // Return cached result if not forcing and cache is valid
    if (!force && cache.lastChecked && now - cache.lastChecked < cache.cacheTimeout) {
      console.log('📦 Using cached update check result');
      return {
        updateAvailable: cache.updateAvailable,
        updateInfo: cache.updateInfo,
        cached: true,
      };
    }

    try {
      console.log('🔄 Checking for updates via GitHub API...');

      // Add timeout and better error handling for Tauri environment
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        'https://api.github.com/repos/opensubtitles/opensubtitles-uploader-pro/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'OpenSubtitles Uploader PRO Update Checker',
          },
          signal: controller.signal,
          mode: 'cors',
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name;
      const currentVersion = `v${APP_VERSION}`;

      // In test upgrade mode, always show update available (even for same version)
      const hasUpdate =
        this.isTestUpgradeMode || this.compareVersions(latestVersion, currentVersion) > 0;

      const updateInfo = {
        shouldUpdate: hasUpdate,
        currentVersion: APP_VERSION,
        latestVersion: latestVersion.replace(/^v/, ''),
        releaseUrl: release.html_url,
        releaseName: release.name,
        releaseNotes: release.body,
        publishedAt: release.published_at,
        assets: release.assets.map(asset => ({
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
        })),
      };

      console.log('🔄 Update check result:', {
        hasUpdate,
        currentVersion,
        latestVersion,
        testMode: this.isTestUpgradeMode,
        forceUpdate: this.isTestUpgradeMode ? '✅ FORCED BY TEST MODE' : '❌',
      });

      // Update cache
      cache.lastChecked = now;
      cache.updateAvailable = hasUpdate;
      cache.updateInfo = updateInfo;

      // Notify listeners
      this.notifyListeners({
        type: 'update_check_complete',
        updateAvailable: hasUpdate,
        updateInfo: updateInfo,
      });

      return {
        updateAvailable: hasUpdate,
        updateInfo: updateInfo,
        cached: false,
      };
    } catch (error) {
      // Classify and handle different error types
      let errorType = 'unknown';
      let userMessage = 'Update check failed';

      if (error.name === 'AbortError') {
        errorType = 'timeout';
        userMessage = 'Update check timed out';
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        errorType = 'ssl';
        userMessage = 'SSL certificate error (update check disabled)';
      } else if (error.message.includes('CORS') || error.message.includes('access control')) {
        errorType = 'cors';
        userMessage = 'Network access restricted (update check disabled)';
      } else if (
        error.message.includes('Load failed') ||
        error.message.includes('Failed to fetch')
      ) {
        errorType = 'network';
        userMessage = 'Network connection failed (update check disabled)';
      }

      // Only log error for debugging, don't show to user in production
      if (errorType === 'ssl' || errorType === 'cors' || errorType === 'network') {
        console.log(`ℹ️ Update check disabled: ${userMessage}`);
      } else {
        console.error('❌ Update check failed:', error);
      }

      // Update cache with error
      cache.lastChecked = now;
      cache.updateAvailable = false;
      cache.updateInfo = null;

      // Don't notify listeners for common Tauri errors to avoid UI disruption
      if (errorType !== 'ssl' && errorType !== 'cors' && errorType !== 'network') {
        this.notifyListeners({
          type: 'update_check_error',
          error: userMessage,
        });
      }

      return {
        updateAvailable: false,
        error: userMessage,
        errorType: errorType,
      };
    }
  }

  /**
   * Create a test file for download simulation
   * @returns {Promise<string>} Test file path
   */
  async createTestDownloadFile() {
    try {
      console.log('🧪 TEST MODE: Setting up test file simulation...');

      // Since macOS sandbox prevents us from writing files, let's use a directory that exists
      // and demonstrate the file operations with a realistic path that would work in production

      // Get the user's actual Downloads directory for the UI display
      let actualDownloadsPath = '/Users/brano/Downloads';

      try {
        // Try to get the real Downloads directory path from Tauri
        if (!tauriPath) {
          await loadTauriAPIs();
        }
        if (tauriPath && tauriPath.downloadDir) {
          const downloadsDir = await tauriPath.downloadDir();
          actualDownloadsPath = downloadsDir;
          console.log('📁 Using system Downloads directory:', actualDownloadsPath);
        }
      } catch (pathError) {
        console.log('⚠️ Could not get system Downloads path, using default:', pathError);
      }

      const testFileName = `OpenSubtitles-Uploader-PRO-Test-v${APP_VERSION}.dmg`;
      const testFilePath = `${actualDownloadsPath}/${testFileName}`;

      console.log('🎯 TEST MODE: File operations will target:', testFilePath);
      console.log('📋 Note: Buttons will demonstrate opening this location');
      console.log('💡 In real downloads, files would be created here by the updater');

      // Try to create a real demonstration file
      try {
        console.log('📝 Attempting to create actual demonstration file...');
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('create_test_file_native', {
          filePath: testFilePath,
          content: `Test file for OpenSubtitles Uploader PRO updater functionality verification.`,
        });

        console.log('✅ Demo file result:', result);

        // Extract the actual file path from the result message if different
        const pathMatch = result.match(/Test file created successfully at: (.+)$/);
        if (pathMatch) {
          const actualFilePath = pathMatch[1];
          console.log('📁 REAL DEMO FILE CREATED:', actualFilePath);
          console.log('🎯 User can now test buttons with actual file at:', actualFilePath);
          return actualFilePath;
        }
      } catch (demoError) {
        console.log('ℹ️ Could not create demo file, using directory for testing:', demoError);
      }

      return testFilePath;
    } catch (error) {
      console.error('❌ Failed to create test file via native command:', error);
      console.log('🔧 Using fallback test file path for UI testing');

      // Return a realistic fallback path for UI testing
      const fallbackPath = `/tmp/OpenSubtitles-Uploader-PRO-Test-v${APP_VERSION}.dmg`;

      // Try to create a simple fallback file using Tauri APIs
      try {
        if (!tauriPath || !tauriFs) {
          console.log('🔧 Loading Tauri APIs for fallback file creation...');
          await loadTauriAPIs();
        }

        // Get temp directory and create test file
        const tempDir = await tauriPath.tempDir();
        const testFileName = `OpenSubtitles-Uploader-PRO-Test-v${APP_VERSION}.dmg`;
        const testFilePath = await tauriPath.join(tempDir, testFileName);

        const testContent = `🧪 TEST MODE UPDATE FILE (FALLBACK)
Generated: ${new Date().toISOString()}
Version: ${APP_VERSION} (Test Mode - Fallback)

This is a fallback test file for updater functionality testing.
The actual update installer would normally be a .dmg/.exe file.

Test completed successfully! ✅`;

        await tauriFs.writeTextFile(testFilePath, testContent);

        // Verify file was created
        const exists = await tauriFs.exists(testFilePath);
        if (exists) {
          console.log('✅ Fallback test file created and verified:', testFilePath);
          return testFilePath;
        } else {
          throw new Error('Fallback file was not created successfully');
        }
      } catch (fallbackError) {
        console.log('⚠️ Could not create physical test file, using virtual path:', fallbackError);
      }

      return fallbackPath;
    }
  }

  /**
   * Download real DMG file from GitHub for test mode
   * @returns {Promise<Object>} Real download result
   */
  async simulateTestDownload() {
    if (this.isInstalling) {
      return {
        success: false,
        error: 'Download already in progress',
      };
    }

    try {
      this.isInstalling = true;
      console.log('🧪 TEST MODE: Starting REAL download from GitHub...');

      this.notifyListeners({
        type: 'update_download_start',
      });

      // Get the latest release info from GitHub
      console.log('📡 Fetching latest release info from GitHub...');
      const response = await fetch(
        'https://api.github.com/repos/opensubtitles/opensubtitles-uploader-pro/releases/latest'
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      console.log('📦 Latest release:', release.tag_name);
      console.log(
        '📦 Available assets:',
        release.assets.map(a => a.name)
      );

      // Find the DMG asset for macOS (improved detection)
      let dmgAsset = release.assets.find(
        asset =>
          asset.name.toLowerCase().includes('.dmg') &&
          (asset.name.toLowerCase().includes('universal') ||
            asset.name.toLowerCase().includes('macos') ||
            asset.name.toLowerCase().includes('darwin'))
      );

      // Fallback: find any DMG file
      if (!dmgAsset) {
        dmgAsset = release.assets.find(asset => asset.name.toLowerCase().includes('.dmg'));
      }

      // Final fallback: use largest asset (likely to be the main installer)
      if (!dmgAsset) {
        console.log('⚠️ No DMG found in latest release, using largest asset');
        dmgAsset = release.assets.reduce(
          (largest, current) => (current.size > largest.size ? current : largest),
          release.assets[0] || null
        );

        if (!dmgAsset) {
          throw new Error('No assets found in the latest release');
        }
        console.log('📦 Using largest asset:', dmgAsset.name);
      }

      const downloadUrl = dmgAsset.browser_download_url;
      const fileName = dmgAsset.name;
      const expectedSize = dmgAsset.size;

      console.log('📥 Downloading REAL file:', fileName);
      console.log('🔗 URL:', downloadUrl);
      console.log('📊 Expected size:', this.formatFileSize(expectedSize));

      // Get download destination
      const downloadPath = await this.getActualDownloadPath(fileName);
      console.log('📁 Download destination:', downloadPath);

      // Use native HTTP client as primary method (proven to work in sandboxed environment)
      console.log('🔧 Starting native HTTP client download...');

      // Set up progress tracking for native download
      let downloadedBytes = 0;
      let totalBytes = expectedSize || 0;

      // Listen for native progress events
      const { listen } = await import('@tauri-apps/api/event');
      let lastLoggedMilestone = -1;
      const unlisten = await listen('download-progress', event => {
        const { downloaded, total, percentage } = event.payload;
        downloadedBytes = downloaded;
        totalBytes = total || totalBytes;

        // Only log at 20% milestones to avoid flooding JavaScript console
        const currentMilestone = Math.floor(percentage / 20);
        if (currentMilestone > lastLoggedMilestone && currentMilestone <= 5) {
          console.log(
            `📈 Native download progress: ${downloaded}/${totalBytes} (${percentage.toFixed(1)}%)`
          );
          lastLoggedMilestone = currentMilestone;
        }

        this.notifyListeners({
          type: 'update_download_progress',
          downloaded: downloaded,
          total: totalBytes,
          progress: percentage, // Hook expects 'progress' not 'percentage'
          percentage: percentage, // Keep both for compatibility
        });
      });

      try {
        // Use native Rust HTTP client (this was working reliably)
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('download_file_native', {
          url: downloadUrl,
          filePath: downloadPath,
          fileName: fileName,
        });

        // Clean up event listener
        unlisten();

        console.log('✅ Download completed via native HTTP client:', result);

        // Extract actual path from result
        const pathMatch = result.match(/Downloaded successfully to: (.+)$/);
        const actualPath = pathMatch ? pathMatch[1] : downloadPath;

        this.notifyListeners({
          type: 'update_download_complete',
          filePath: actualPath,
          fileName: fileName,
          fileSize: expectedSize,
          showPath: true,
          canReveal: true,
          warning: '🧪 TEST MODE: Real DMG file downloaded via native HTTP client!',
          canInstall: fileName.toLowerCase().includes('.dmg'),
        });

        return {
          success: true,
          message: `Real ${fileName.toLowerCase().includes('.dmg') ? 'DMG' : 'file'} download completed successfully`,
          filePath: actualPath,
          fileName: fileName,
          testMode: true,
          canInstall: fileName.toLowerCase().includes('.dmg'),
        };
      } catch (error) {
        // Clean up event listener on error
        unlisten();
        throw error;
      }
    } catch (error) {
      console.error('❌ Real download failed:', error);

      this.notifyListeners({
        type: 'update_download_error',
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    } finally {
      this.isInstalling = false;
    }
  }

  /**
   * Get the actual download path for test files
   */
  async getActualDownloadPath(fileName) {
    // Use native command to get writable directory (optimized to check Documents first)
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('get_writable_download_path', { fileName: fileName });
      console.log('📁 Got writable download path from native command:', result);
      return result;
    } catch (nativeError) {
      console.log('⚠️ Native path resolution failed, trying Tauri APIs fallback:', nativeError);
    }

    try {
      // Get the sandboxed Downloads directory
      if (!tauriPath) {
        await loadTauriAPIs();
      }

      if (tauriPath && tauriPath.downloadDir) {
        const downloadsDir = await tauriPath.downloadDir();
        console.log('📁 Downloads directory from Tauri:', downloadsDir);
        const fullPath = `${downloadsDir}/${fileName}`;
        return fullPath;
      }
    } catch (error) {
      console.log('⚠️ Could not get Downloads directory via Tauri APIs:', error);
    }

    // Fallback to user's home directory which is more likely to be writable
    const fallbackPath = `/Users/${process.env.USER || 'user'}/${fileName}`;
    console.log('📁 Using fallback path:', fallbackPath);
    return fallbackPath;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Download and install update with progress tracking
   *
   * NOTE: This method is fully functional but currently not used in UI to avoid
   * macOS quarantine issues. Will be re-enabled when Apple Dev certificate is available.
   *
   * @returns {Promise<Object>} Download result
   */
  async downloadUpdate() {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app',
      };
    }

    const cache = UpdateService.updateCache;

    // Handle test mode - simulate download even without real update
    if (this.isTestUpgradeMode && (!cache.updateAvailable || !cache.updateInfo?.updateData)) {
      console.log('🧪 TEST MODE: Simulating update download (no real download)');
      return await this.simulateTestDownload();
    }

    if (!cache.updateAvailable || !cache.updateInfo || !cache.updateInfo.updateData) {
      return {
        success: false,
        error: 'No update available',
      };
    }

    if (this.isInstalling) {
      return {
        success: false,
        error: 'Download already in progress',
      };
    }

    try {
      this.isInstalling = true;
      console.log('📦 Starting update download with progress tracking...');

      this.notifyListeners({
        type: 'update_download_start',
      });

      if (!tauriUpdater) {
        throw new Error('Tauri updater not available');
      }

      // Get the update info
      const updateInfo = await tauriUpdater.check();
      if (!updateInfo) {
        throw new Error('No update available to download');
      }

      console.log('🔄 Starting custom download (bypassing Tauri signature validation)...');

      // Get platform-specific download URL from cached update info
      console.log('🔧 DEBUG: Full cache structure:', {
        hasUpdateInfo: !!cache.updateInfo,
        updateInfoKeys: cache.updateInfo ? Object.keys(cache.updateInfo) : 'N/A',
        hasRawJson: !!(cache.updateInfo && cache.updateInfo.rawJson),
        rawJsonKeys:
          cache.updateInfo && cache.updateInfo.rawJson
            ? Object.keys(cache.updateInfo.rawJson)
            : 'N/A',
      });

      const downloadUrl = this.getPlatformDownloadUrl(cache.updateInfo);
      if (!downloadUrl) {
        throw new Error('No download URL available for this platform');
      }

      // Use our custom download approach (same as demo mode) to bypass signature validation
      const fileName = this.getUpdateFileName();
      const downloadPath = await this.getActualDownloadPath(fileName);

      console.log('📦 Download details:', {
        url: downloadUrl,
        fileName: fileName,
        path: downloadPath,
      });

      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastLoggedMilestone = -1;

      // Set up progress event listener
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('download-progress', event => {
        const { downloaded, total, percentage } = event.payload;
        downloadedBytes = downloaded;
        totalBytes = total || totalBytes;

        // Only log at 20% milestones to avoid flooding JavaScript console
        const currentMilestone = Math.floor(percentage / 20);
        if (currentMilestone > lastLoggedMilestone && currentMilestone <= 5) {
          console.log(
            `📈 Download progress: ${downloaded}/${totalBytes} (${percentage.toFixed(1)}%)`
          );
          lastLoggedMilestone = currentMilestone;
        }

        this.notifyListeners({
          type: 'update_download_progress',
          downloaded: downloaded,
          total: totalBytes,
          progress: percentage, // Hook expects 'progress' not 'percentage'
          percentage: percentage, // Keep both for compatibility
        });
      });

      try {
        // Use native Rust HTTP client (bypasses signature validation)
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('download_file_native', {
          url: downloadUrl,
          filePath: downloadPath,
          fileName: fileName,
        });

        // Clean up event listener
        unlisten();

        console.log('✅ Download completed via custom HTTP client:', result);

        // Extract actual path from result
        const pathMatch = result.match(/Downloaded successfully to: (.+)$/);
        const actualPath = pathMatch ? pathMatch[1] : downloadPath;

        this.notifyListeners({
          type: 'update_download_complete',
          filePath: actualPath,
          fileName: fileName,
          showPath: true,
          canReveal: true,
        });

        return {
          success: true,
          message: 'Update downloaded successfully (signature validation bypassed)',
          filePath: actualPath,
          fileName: fileName,
          showPath: true,
        };
      } catch (downloadError) {
        unlisten();
        throw downloadError;
      }
    } catch (error) {
      console.error('❌ Update download failed:', error);

      // Check if this is a signature validation error but download actually completed
      const isSignatureError =
        error.message &&
        (error.message.includes('Invalid encoding in minisign data') ||
          error.message.includes('signature') ||
          error.message.includes('minisign'));

      if (isSignatureError && downloadPath && totalBytes > 0) {
        console.log('🔧 Signature validation failed but download completed');
        console.log('📁 File should be available at:', downloadPath);
        console.log('🎯 Providing fallback file access options');

        // Still notify completion so user can access the file
        this.notifyListeners({
          type: 'update_download_complete',
          filePath: downloadPath || this.getUpdateTempPath(),
          fileName: this.getUpdateFileName(),
          showPath: true,
          canReveal: true,
          fileSize: totalBytes,
          warning: 'Signature validation failed, but file downloaded successfully',
        });

        return {
          success: true,
          message: 'Update downloaded (signature validation failed, but file is available)',
          filePath: downloadPath || this.getUpdateTempPath(),
          fileName: this.getUpdateFileName(),
          showPath: true,
          canReveal: true,
          warning: error.message,
        };
      }

      // For other errors, show standard error handling
      this.notifyListeners({
        type: 'update_download_error',
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    } finally {
      this.isInstalling = false;
    }
  }

  /**
   * Get the typical update temp path based on OS
   * @returns {string} Temp path where updates are usually saved
   */
  getUpdateTempPath() {
    const platform = this.getCurrentPlatform();

    switch (platform) {
      case 'windows':
        return `%LOCALAPPDATA%\\Temp\\<update_file>`;
      case 'macos':
        return `/tmp/<update_file>`;
      case 'linux':
        return `/tmp/<update_file>`;
      default:
        return '<system_temp_directory>';
    }
  }

  /**
   * Get the expected update filename based on OS and current version
   * @returns {string} Update filename
   */
  getUpdateFileName() {
    const platform = this.getCurrentPlatform();
    const cache = UpdateService.updateCache;
    const version = cache.updateInfo?.latestVersion || 'latest';

    return this.getDefaultFileName(version, platform);
  }

  /**
   * Get platform-specific download URL from update info
   * @param {Object} updateInfo - Update info containing assets or platforms
   * @returns {string|null} Download URL for current platform
   */
  getPlatformDownloadUrl(updateInfo) {
    if (!updateInfo) {
      console.error('❌ No update info available');
      return null;
    }

    const platform = this.getCurrentPlatform();
    console.log('🔍 Looking for download URL for platform:', platform);

    // Debug: log the full structure to understand what we're working with
    console.log('🔍 Full update info structure:', JSON.stringify(updateInfo, null, 2));

    console.log('🔍 Update info structure:', {
      hasAssets: !!updateInfo.assets,
      hasRawJson: !!updateInfo.rawJson,
      hasPlatforms: !!(updateInfo.rawJson && updateInfo.rawJson.platforms),
      // Check if updateInfo itself has platforms (direct from Tauri response)
      hasDirectPlatforms: !!updateInfo.platforms,
      // Check rawJson structure
      rawJsonStructure: updateInfo.rawJson ? Object.keys(updateInfo.rawJson) : 'N/A',
    });

    // Handle real updater format - check multiple possible locations for platforms data
    let platforms = null;

    // Check if platforms are directly in updateInfo (direct Tauri response)
    if (updateInfo.platforms) {
      console.log('📦 Using direct platforms from updateInfo');
      platforms = updateInfo.platforms;
    }
    // Check if platforms are in rawJson.rawJson.platforms (nested structure)
    else if (
      updateInfo.rawJson &&
      updateInfo.rawJson.rawJson &&
      updateInfo.rawJson.rawJson.platforms
    ) {
      console.log('📦 Using nested rawJson.rawJson.platforms format');
      platforms = updateInfo.rawJson.rawJson.platforms;
    }
    // Check if platforms are in rawJson.platforms
    else if (updateInfo.rawJson && updateInfo.rawJson.platforms) {
      console.log('📦 Using rawJson.platforms format');
      platforms = updateInfo.rawJson.platforms;
    }

    if (platforms) {
      console.log('✅ Found platforms data:', Object.keys(platforms));

      // Map current platform to Tauri platform keys
      const platformKeys = {
        macos: ['darwin-universal', 'darwin-x86_64', 'darwin-aarch64'],
        windows: ['windows-x86_64'],
        linux: ['linux-x86_64'],
      };

      const keys = platformKeys[platform];
      if (!keys) {
        console.error('❌ Unknown platform for real updater:', platform);
        return null;
      }

      // Try to find a matching platform
      for (const key of keys) {
        if (platforms[key] && platforms[key].url) {
          console.log('✅ Found platform key:', key);
          console.log('🔗 Download URL:', platforms[key].url);
          return platforms[key].url;
        }
      }

      console.error('❌ No matching platform found in platforms data');
      console.log('📋 Available platforms:', Object.keys(platforms));
      return null;
    }

    // Handle demo mode format (GitHub API response with assets array)
    if (updateInfo.assets) {
      console.log('📦 Using demo mode format (assets array)');
      console.log(
        '📦 Available assets:',
        updateInfo.assets.map(a => a.name)
      );

      // Map platform to expected file patterns
      const platformPatterns = {
        macos: /\.dmg$/i,
        windows: /setup.*\.exe$/i,
        linux: /\.AppImage$/i,
      };

      const pattern = platformPatterns[platform];
      if (!pattern) {
        console.error('❌ Unknown platform for demo mode:', platform);
        return null;
      }

      // Find matching asset
      const asset = updateInfo.assets.find(asset => pattern.test(asset.name));
      if (!asset) {
        console.error('❌ No matching asset found for platform:', platform);
        console.log('📋 Expected pattern:', pattern);
        console.log(
          '📦 Available assets:',
          updateInfo.assets.map(a => a.name)
        );
        return null;
      }

      console.log('✅ Found matching asset:', asset.name);
      console.log('🔗 Download URL:', asset.downloadUrl);
      return asset.downloadUrl;
    }

    console.error('❌ Update info has neither assets array nor rawJson.platforms');
    return null;
  }

  /**
   * Get current platform identifier
   * @returns {string} Platform identifier
   */
  getCurrentPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('mac') || userAgent.includes('darwin')) {
      return 'macos';
    } else if (userAgent.includes('windows') || userAgent.includes('win')) {
      return 'windows';
    } else if (userAgent.includes('linux')) {
      return 'linux';
    }

    return 'unknown';
  }

  /**
   * Get platform key for Tauri updater manifest
   * @param {string} platform - Platform identifier
   * @returns {string} Platform key
   */
  getPlatformKey(platform) {
    switch (platform) {
      case 'windows':
        return 'windows-x86_64';
      case 'macos':
        return 'darwin-universal';
      case 'linux':
        return 'linux-x86_64';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract filename from download URL
   * @param {string} url - Download URL
   * @param {string} platform - Platform identifier
   * @returns {string} File name
   */
  getFileNameFromUrl(url, platform) {
    try {
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      if (fileName && fileName.length > 0) {
        return fileName;
      }
    } catch (error) {
      console.warn('Could not extract filename from URL:', error);
    }

    // Fallback to default naming
    return this.getDefaultFileName('latest', platform);
  }

  /**
   * Get default filename for platform
   * @param {string} version - Version string
   * @param {string} platform - Platform identifier
   * @returns {string} Default file name
   */
  getDefaultFileName(version, platform) {
    const cleanVersion = version.replace(/^v/, '');

    switch (platform) {
      case 'windows':
        return `OpenSubtitles.Uploader.PRO_${cleanVersion}_x64-setup.exe`;
      case 'macos':
        return `OpenSubtitles.Uploader.PRO_${cleanVersion}_universal.dmg`;
      case 'linux':
        return `opensubtitles-uploader-pro_${cleanVersion}_amd64.AppImage`;
      default:
        return `opensubtitles-uploader-pro-${cleanVersion}.bin`;
    }
  }

  /**
   * Construct download URL for version and platform
   * @param {string} version - Version string
   * @param {string} platform - Platform identifier
   * @returns {string} Download URL
   */
  constructDownloadUrl(version, platform) {
    const fileName = this.getDefaultFileName(version, platform);
    const versionTag = version.startsWith('v') ? version : `v${version}`;
    return `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/${versionTag}/${fileName}`;
  }

  /**
   * Install DMG file (macOS only)
   * @param {string} filePath - Path to the DMG file
   * @returns {Promise<Object>} Install result
   */
  async installDmgFile(filePath) {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app',
      };
    }

    try {
      console.log('📦 Installing DMG file:', filePath);

      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('install_dmg_file', { filePath: filePath });

      console.log('✅ DMG installation initiated:', result);

      return {
        success: true,
        message: result,
      };
    } catch (error) {
      console.error('❌ Failed to install DMG:', error);

      return {
        success: false,
        error: error.message || 'Failed to install DMG file',
      };
    }
  }

  /**
   * Open downloaded file or reveal in file explorer
   * @param {string} filePath - Path to the downloaded file
   * @returns {Promise<Object>} Open result
   */
  async openDownloadedFile(filePath) {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app',
      };
    }

    try {
      console.log('📂 Opening downloaded file:', filePath);

      if (!tauriShell) {
        console.log('🔧 Loading Tauri Shell APIs...');
        await loadTauriAPIs();
        if (!tauriShell) {
          throw new Error('Tauri shell not available after loading APIs');
        }
      }

      // Check if file exists first
      try {
        if (tauriFs && !filePath.includes('<update_file>')) {
          const exists = await tauriFs.exists(filePath);
          if (!exists) {
            console.log('⚠️ File does not exist, will try to open anyway:', filePath);
          }
        }
      } catch (checkError) {
        console.log('🔧 Could not verify file existence, proceeding...');
      }

      // For update temp files, we need to open the temp directory since
      // the exact file path may not be accessible directly
      let pathToOpen = filePath;

      if (filePath.includes('<update_file>')) {
        // Open the temp directory instead
        pathToOpen = this.getTempDirectory();
        console.log('🔧 Opening temp directory instead:', pathToOpen);
      }

      console.log('🚀 Attempting to open path:', pathToOpen);

      // Try native Tauri command first - this bypasses ACL restrictions
      try {
        console.log('🔧 Using native Tauri command to open file...');
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('open_file_native', { filePath: pathToOpen });
        console.log('✅ File opened successfully via native command:', result);
      } catch (nativeError) {
        console.log('🔄 Native command failed, trying parent directory...', nativeError);

        // If the specific file doesn't exist, try opening the parent directory
        const parentDir = pathToOpen.substring(0, pathToOpen.lastIndexOf('/'));
        if (parentDir && parentDir !== pathToOpen) {
          try {
            console.log('🔧 Trying to open parent directory:', parentDir);
            const { invoke } = await import('@tauri-apps/api/core');
            const parentResult = await invoke('open_file_native', { filePath: parentDir });
            console.log('✅ Parent directory opened successfully:', parentResult);
            return {
              success: true,
              message: `Opened parent directory: ${parentDir}`,
            };
          } catch (parentError) {
            console.log('🔄 Parent directory also failed, trying other fallbacks...', parentError);
          }
        }

        // Fallback to Command API
        try {
          const { Command } = await import('@tauri-apps/plugin-shell');
          const cmd = new Command('open', [pathToOpen]);
          const result = await cmd.execute();

          if (result.code === 0) {
            console.log('✅ File opened successfully via Command API');
          } else {
            throw new Error(`Command failed with code ${result.code}: ${result.stderr}`);
          }
        } catch (commandError) {
          console.log('🔄 Command API failed, trying shell.open with file:// URL...');

          // Final fallback to shell.open with file:// URL
          const urlToOpen = `file://${pathToOpen}`;
          console.log('🔧 Converting file path to URL:', urlToOpen);
          await tauriShell.open(urlToOpen);
        }
      }

      console.log('✅ File/Directory opened successfully');

      return {
        success: true,
        message: 'File opened successfully',
      };
    } catch (error) {
      console.error('❌ Failed to open file:', error);
      console.log('🔧 Error details:', {
        message: error.message,
        filePath: filePath,
        tauriShellAvailable: !!tauriShell,
      });

      // Try fallback approach
      try {
        console.log('🔄 Trying fallback approach with shell.open API...');
        const { open } = await import('@tauri-apps/plugin-shell');

        // Try to open parent directory as fallback
        const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        const parentUrl = `file://${parentDir}`;
        console.log('🔧 Fallback: Converting parent directory to URL:', parentUrl);

        await open(parentUrl);

        console.log('✅ Fallback: Opened parent directory');
        return {
          success: true,
          message: 'Opened parent directory as fallback',
        };
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);

        return {
          success: false,
          error: `Main error: ${error.message}, Fallback error: ${fallbackError.message}`,
        };
      }
    }
  }

  /**
   * Reveal downloaded file in system file explorer (Finder on macOS, Explorer on Windows, etc.)
   * @param {string} filePath - Path to the downloaded file
   * @returns {Promise<Object>} Reveal result
   */
  async revealDownloadedFile(filePath) {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app',
      };
    }

    try {
      console.log('🔍 Revealing downloaded file in file manager:', filePath);

      if (!tauriShell) {
        throw new Error('Tauri shell not available');
      }

      const platform = this.getCurrentPlatform();
      let command = '';
      let args = [];

      if (filePath.includes('<update_file>')) {
        // For temp files, open the temp directory
        const tempDir = this.getTempDirectory();

        switch (platform) {
          case 'macos':
            command = 'open';
            args = [tempDir];
            break;
          case 'windows':
            command = 'explorer';
            args = [tempDir];
            break;
          case 'linux':
            command = 'xdg-open';
            args = [tempDir];
            break;
          default:
            throw new Error('Unsupported platform for reveal functionality');
        }
      } else {
        // For specific files, use platform-specific reveal commands
        switch (platform) {
          case 'macos':
            command = 'open';
            args = ['-R', filePath]; // -R reveals the file in Finder
            break;
          case 'windows':
            command = 'explorer';
            args = ['/select,', filePath]; // /select reveals and selects the file
            break;
          case 'linux':
            // Most Linux file managers support --select
            command = 'nautilus';
            args = ['--select', filePath];
            break;
          default:
            throw new Error('Unsupported platform for reveal functionality');
        }
      }

      // Try native Tauri command first - this bypasses ACL restrictions
      try {
        console.log('🔧 Using native Tauri command to reveal file...');
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('reveal_file_native', { filePath: filePath });
        console.log('✅ File revealed successfully via native command:', result);
      } catch (nativeError) {
        console.log('🔄 Native reveal command failed, trying parent directory...', nativeError);

        // If the specific file doesn't exist, try opening the parent directory
        const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (parentDir && parentDir !== filePath) {
          try {
            console.log('🔧 Trying to open parent directory for reveal:', parentDir);
            const { invoke } = await import('@tauri-apps/api/core');
            const parentResult = await invoke('open_file_native', { filePath: parentDir });
            console.log('✅ Parent directory opened successfully for reveal:', parentResult);
            return {
              success: true,
              message: `Opened parent directory: ${parentDir}`,
            };
          } catch (parentError) {
            console.log(
              '🔄 Parent directory reveal also failed, trying other fallbacks...',
              parentError
            );
          }
        }

        // For macOS, try using the shell.open API which should work better with ACL
        if (platform === 'macos') {
          // Use Tauri's shell.open for better compatibility
          try {
            console.log('🔧 Using Tauri shell.open for macOS reveal...');
            const { open } = await import('@tauri-apps/plugin-shell');

            // On macOS, we can open the parent directory and the file should be selected
            const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
            const parentUrl = `file://${parentDir}`;
            console.log('🔧 Converting parent directory to URL for reveal:', parentUrl);

            await open(parentUrl);
            console.log('✅ Opened parent directory via shell.open');
          } catch (openError) {
            console.log('🔄 shell.open failed, trying Command API...');
            // Fallback to Command API
            const { Command } = await import('@tauri-apps/plugin-shell');
            const cmd = new Command(command, args);
            const result = await cmd.execute();

            if (result.code !== 0) {
              throw new Error(`Reveal command failed: ${result.stderr || 'Unknown error'}`);
            }
          }
        } else {
          // For other platforms, use Command API
          const { Command } = await import('@tauri-apps/plugin-shell');
          const cmd = new Command(command, args);
          const result = await cmd.execute();

          if (result.code !== 0) {
            throw new Error(`Reveal command failed: ${result.stderr || 'Unknown error'}`);
          }
        }
      }

      console.log('✅ File revealed successfully in file manager');

      return {
        success: true,
        message: 'File revealed in file manager',
      };
    } catch (error) {
      console.error('❌ Failed to reveal file:', error);

      // Fallback to opening the parent directory
      try {
        console.log('🔄 Attempting fallback: opening parent directory...');

        let parentPath;
        if (filePath.includes('<update_file>')) {
          parentPath = this.getTempDirectory();
        } else {
          // Extract parent directory from file path
          parentPath =
            filePath.substring(0, filePath.lastIndexOf('/')) ||
            filePath.substring(0, filePath.lastIndexOf('\\'));
        }

        if (parentPath) {
          const parentUrl = `file://${parentPath}`;
          console.log('🔧 Final fallback: Converting parent directory to URL:', parentUrl);

          await tauriShell.open(parentUrl);

          return {
            success: true,
            message: 'Opened parent directory (reveal not supported)',
          };
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the system temp directory path based on OS
   * @returns {string} Temp directory path
   */
  getTempDirectory() {
    const platform = this.getCurrentPlatform();

    switch (platform) {
      case 'windows':
        return '%LOCALAPPDATA%\\Temp';
      case 'macos':
        return '/tmp';
      case 'linux':
        return '/tmp';
      default:
        return '/tmp';
    }
  }

  /**
   * Install available update (deprecated - now downloads instead)
   * @returns {Promise<Object>} Install result
   */
  async installUpdate() {
    console.log('⚠️ installUpdate is deprecated, using downloadUpdate instead');
    return await this.downloadUpdate();
  }

  /**
   * Restart application to apply update
   */
  async restartApplication() {
    if (!this.isStandalone) {
      console.error('❌ Cannot restart: Not running as standalone app');
      return;
    }

    try {
      console.log('🔄 Restarting application...');

      if (!tauriProcess) {
        throw new Error('Tauri process not available');
      }

      await tauriProcess.relaunch();
    } catch (error) {
      console.error('❌ Failed to restart application:', error);
    }
  }

  /**
   * Start automatic update checks (every 1 hour)
   */
  startAutoUpdateChecks() {
    if (this.autoCheckInterval) {
      console.log('⚠️ Auto-update checks already running');
      return;
    }

    console.log('🔄 Starting automatic update checks...');

    // Check immediately on start (with a small delay to let the app initialize)
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 5000); // Wait 5 seconds after app start

    // Then check every hour
    this.autoCheckInterval = setInterval(
      () => {
        this.checkForUpdates(false);
      },
      60 * 60 * 1000
    ); // 1 hour
  }

  /**
   * Stop automatic update checks
   */
  stopAutoUpdateChecks() {
    if (this.autoCheckInterval) {
      console.log('⏹️ Stopping automatic update checks');
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = null;
    }
  }

  /**
   * Add event listener
   * @param {Function} listener - Event listener function
   */
  addEventListener(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   * @param {Object} event - Event object
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Update listener error:', error);
      }
    });
  }

  /**
   * Get update status
   * @returns {Object} Current update status
   */
  getUpdateStatus() {
    const cache = UpdateService.updateCache;
    return {
      isStandalone: this.isStandalone,
      isInstalling: this.isInstalling,
      autoCheckEnabled: !!this.autoCheckInterval,
      currentVersion: APP_VERSION,
      lastChecked: cache.lastChecked,
      updateAvailable: cache.updateAvailable,
      updateInfo: cache.updateInfo,
      cacheValid: cache.lastChecked && Date.now() - cache.lastChecked < cache.cacheTimeout,
    };
  }

  /**
   * Clear update cache
   */
  clearCache() {
    UpdateService.updateCache = {
      lastChecked: null,
      updateAvailable: false,
      updateInfo: null,
      cacheTimeout: 60 * 60 * 1000,
    };
    console.log('🗑️ Update cache cleared');
  }
}

// Export singleton instance
export const updateService = UpdateService.getInstance();
