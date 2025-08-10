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
    const isTauriEnv = window.__TAURI__ || 
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
      userAgent: navigator.userAgent.substring(0, 100) + '...'
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
            }
          };
          tauriProcess = { 
            relaunch: typeof relaunch === 'function' ? relaunch : () => Promise.resolve()
          };
          tauriShell = {
            open: typeof open === 'function' ? open : () => Promise.resolve()
          };
          tauriPath = {
            downloadDir: typeof downloadDir === 'function' ? downloadDir : () => Promise.resolve('/tmp')
          };
          tauriFs = {
            writeFile: typeof writeFile === 'function' ? writeFile : () => Promise.resolve()
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
          name: error.name
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
 */
export class UpdateService {
  static instance = null;
  static updateCache = {
    lastChecked: null,
    updateAvailable: false,
    updateInfo: null,
    cacheTimeout: 60 * 60 * 1000 // 1 hour in milliseconds
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
    this.init();
  }

  /**
   * Compare version strings (semver-like)
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  compareVersions(a, b) {
    const parseVersion = (v) => v.replace(/^v/, '').split('.').map(num => parseInt(num) || 0);
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
    console.log('🔧 UpdateService init:', { isStandalone: this.isStandalone });
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
    const isStandalone = hasTauriProtocol || hasTauriOrigin || 
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
      href: window.location.href.substring(0, 100) + '...'
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
    if (!force && cache.lastChecked && (now - cache.lastChecked) < cache.cacheTimeout) {
      console.log('📦 Using cached Tauri update check result');
      return {
        updateAvailable: cache.updateAvailable,
        updateInfo: cache.updateInfo,
        cached: true
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
        windowTauriKeys: window.__TAURI__ ? Object.keys(window.__TAURI__) : 'N/A'
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
      const hasUpdate = updateInfo !== null && updateInfo !== undefined;

      console.log('🔄 Tauri update check result:', { 
        hasUpdate, 
        currentVersion: APP_VERSION, 
        updateInfo: updateInfo,
        fullResponse: updateInfo
      });

      const result = {
        shouldUpdate: hasUpdate,
        currentVersion: APP_VERSION,
        latestVersion: hasUpdate ? updateInfo.version : APP_VERSION,
        releaseNotes: hasUpdate ? (updateInfo.body || 'No release notes available') : 'No update available',
        publishedAt: hasUpdate ? updateInfo.date : null,
        updateData: updateInfo
      };

      // Update cache
      cache.lastChecked = now;
      cache.updateAvailable = hasUpdate;
      cache.updateInfo = result;

      // Notify listeners
      this.notifyListeners({
        type: 'update_check_complete',
        updateAvailable: hasUpdate,
        updateInfo: result
      });

      return {
        updateAvailable: hasUpdate,
        updateInfo: result,
        cached: false
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
        errorKeys: error ? Object.keys(error) : 'N/A'
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
        error: errorMessage
      });

      return {
        updateAvailable: false,
        error: errorMessage,
        errorType: 'tauri_updater_error'
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
    if (!force && cache.lastChecked && (now - cache.lastChecked) < cache.cacheTimeout) {
      console.log('📦 Using cached update check result');
      return {
        updateAvailable: cache.updateAvailable,
        updateInfo: cache.updateInfo,
        cached: true
      };
    }

    try {
      console.log('🔄 Checking for updates via GitHub API...');
      
      // Add timeout and better error handling for Tauri environment
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://api.github.com/repos/opensubtitles/opensubtitles-uploader-pro/releases/latest', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenSubtitles Uploader PRO Update Checker'
        },
        signal: controller.signal,
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name;
      const currentVersion = `v${APP_VERSION}`;

      const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

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
          downloadUrl: asset.browser_download_url
        }))
      };

      console.log('🔄 Update check result:', { hasUpdate, currentVersion, latestVersion });

      // Update cache
      cache.lastChecked = now;
      cache.updateAvailable = hasUpdate;
      cache.updateInfo = updateInfo;

      // Notify listeners
      this.notifyListeners({
        type: 'update_check_complete',
        updateAvailable: hasUpdate,
        updateInfo: updateInfo
      });

      return {
        updateAvailable: hasUpdate,
        updateInfo: updateInfo,
        cached: false
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
      } else if (error.message.includes('Load failed') || error.message.includes('Failed to fetch')) {
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
          error: userMessage
        });
      }

      return {
        updateAvailable: false,
        error: userMessage,
        errorType: errorType
      };
    }
  }

  /**
   * Download and install update with progress tracking
   * @returns {Promise<Object>} Download result
   */
  async downloadUpdate() {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app'
      };
    }

    const cache = UpdateService.updateCache;
    if (!cache.updateAvailable || !cache.updateInfo || !cache.updateInfo.updateData) {
      return {
        success: false,
        error: 'No update available'
      };
    }

    if (this.isInstalling) {
      return {
        success: false,
        error: 'Download already in progress'
      };
    }

    try {
      this.isInstalling = true;
      console.log('📦 Starting update download with progress tracking...');

      this.notifyListeners({
        type: 'update_download_start'
      });

      if (!tauriUpdater) {
        throw new Error('Tauri updater not available');
      }

      // Get the update info
      const updateInfo = await tauriUpdater.check();
      if (!updateInfo) {
        throw new Error('No update available to download');
      }

      console.log('🔄 Starting downloadAndInstall with progress tracking...');

      // Use Tauri v2's downloadAndInstall with progress callback
      let downloadedBytes = 0;
      let totalBytes = 0;
      let downloadPath = null;

      const result = await updateInfo.downloadAndInstall((progressEvent) => {
        console.log('📊 Download progress event:', progressEvent);

        switch (progressEvent.event) {
          case 'Started':
            totalBytes = progressEvent.data.contentLength || 0;
            console.log(`📦 Download started: ${totalBytes} bytes`);
            
            this.notifyListeners({
              type: 'update_download_progress',
              progress: 0,
              downloaded: 0,
              total: totalBytes,
              status: 'started'
            });
            break;

          case 'Progress':
            downloadedBytes += progressEvent.data.chunkLength || 0;
            const progressPercent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
            
            console.log(`📈 Download progress: ${downloadedBytes}/${totalBytes} (${progressPercent.toFixed(1)}%)`);
            
            this.notifyListeners({
              type: 'update_download_progress',
              progress: progressPercent,
              downloaded: downloadedBytes,
              total: totalBytes,
              status: 'downloading'
            });
            break;

          case 'Finished':
            console.log('✅ Download completed');
            
            this.notifyListeners({
              type: 'update_download_progress',
              progress: 100,
              downloaded: totalBytes,
              total: totalBytes,
              status: 'finished'
            });
            break;

          default:
            console.log('📡 Unknown download event:', progressEvent);
            break;
        }
      });

      // For Tauri v2, we can't get the exact download path from downloadAndInstall
      // But we know the typical locations for each OS
      const tempPath = this.getUpdateTempPath();
      
      console.log('✅ Update downloaded and ready for installation');
      console.log('📁 Update saved to system temp directory:', tempPath);
      
      this.notifyListeners({
        type: 'update_download_complete',
        filePath: tempPath,
        fileName: this.getUpdateFileName(),
        showPath: true,
        canReveal: true
      });

      return {
        success: true,
        message: 'Update downloaded successfully and ready for installation',
        filePath: tempPath,
        fileName: this.getUpdateFileName(),
        showPath: true,
        canReveal: true
      };
    } catch (error) {
      console.error('❌ Update download failed:', error);
      
      this.notifyListeners({
        type: 'update_download_error',
        error: error.message
      });

      return {
        success: false,
        error: error.message
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
   * Open downloaded file or reveal in file explorer
   * @param {string} filePath - Path to the downloaded file
   * @returns {Promise<Object>} Open result
   */
  async openDownloadedFile(filePath) {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app'
      };
    }

    try {
      console.log('📂 Opening downloaded file:', filePath);

      if (!tauriShell) {
        throw new Error('Tauri shell not available');
      }
      
      // For update temp files, we need to open the temp directory since
      // the exact file path may not be accessible directly
      const platform = this.getCurrentPlatform();
      let pathToOpen = filePath;
      
      if (filePath.includes('<update_file>')) {
        // Open the temp directory instead
        pathToOpen = this.getTempDirectory();
      }
      
      await tauriShell.open(pathToOpen);
      
      console.log('✅ File/Directory opened successfully');
      
      return {
        success: true,
        message: 'File opened successfully'
      };
    } catch (error) {
      console.error('❌ Failed to open file:', error);
      
      return {
        success: false,
        error: error.message
      };
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
        error: 'Not running as standalone app'
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

      // Execute the reveal command
      const { Command } = await import('@tauri-apps/plugin-shell');
      const cmd = new Command(command, args);
      const result = await cmd.execute();

      if (result.code !== 0) {
        throw new Error(`Reveal command failed: ${result.stderr || 'Unknown error'}`);
      }
      
      console.log('✅ File revealed successfully in file manager');
      
      return {
        success: true,
        message: 'File revealed in file manager'
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
          parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || 
                      filePath.substring(0, filePath.lastIndexOf('\\'));
        }
        
        if (parentPath) {
          await tauriShell.open(parentPath);
          
          return {
            success: true,
            message: 'Opened parent directory (reveal not supported)'
          };
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
      
      return {
        success: false,
        error: error.message
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
    this.autoCheckInterval = setInterval(() => {
      this.checkForUpdates(false);
    }, 60 * 60 * 1000); // 1 hour
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
      cacheValid: cache.lastChecked && (Date.now() - cache.lastChecked) < cache.cacheTimeout
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
      cacheTimeout: 60 * 60 * 1000
    };
    console.log('🗑️ Update cache cleared');
  }
}

// Export singleton instance
export const updateService = UpdateService.getInstance();