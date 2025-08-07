import { APP_VERSION } from '../utils/constants.js';

// Import Tauri APIs directly - they'll be available when bundled in production
let tauriUpdater = null;
let tauriProcess = null;

const loadTauriAPIs = async () => {
  // Only load Tauri APIs in actual Tauri environment
  if (typeof window !== 'undefined' && window.__TAURI__ && !tauriUpdater) {
    try {
      console.log('🔄 Tauri APIs available - window.__TAURI__ detected!');
      console.log('✅ Tauri environment confirmed');
      
      // Import the actual Tauri updater APIs
      const { checkUpdate, installUpdate, onUpdaterEvent } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      
      tauriUpdater = { 
        checkUpdate, 
        installUpdate, 
        onUpdaterEvent
      };
      tauriProcess = { 
        relaunch 
      };
      
      console.log('✅ Tauri updater APIs loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load Tauri updater APIs:', error);
      // Fallback to dummy objects if import fails
      tauriUpdater = { 
        checkUpdate: () => Promise.resolve({ shouldUpdate: false }), 
        installUpdate: () => Promise.resolve(), 
        onUpdaterEvent: () => {}
      };
      tauriProcess = { 
        relaunch: () => Promise.resolve() 
      };
      console.log('⚠️ Using fallback dummy updater APIs');
    }
  } else {
    console.log('🔍 Tauri API loading conditions:', {
      hasWindow: typeof window !== 'undefined',
      hasTauri: !!window.__TAURI__,
      alreadyLoaded: !!tauriUpdater
    });
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
    // In Tauri v2, detection might be different
    const hasTauriProtocol = window.location.protocol === 'tauri:';
    const hasTauriOrigin = window.location.origin.startsWith('tauri://');
    const hasTauriInUserAgent = navigator.userAgent.includes('Tauri');
    const hasTauriGlobal = window.__TAURI__ !== undefined;
    
    // Use protocol/origin as primary detection for Tauri v2
    const isStandalone = hasTauriProtocol || hasTauriOrigin;
    
    console.log('🔍 Standalone detection (v2):', {
      isStandalone,
      hasTauriProtocol,
      hasTauriOrigin,
      hasTauriInUserAgent,
      hasTauriGlobal,
      protocol: window.location.protocol,
      origin: window.location.origin,
      userAgent: navigator.userAgent
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
      
      if (!tauriUpdater) {
        throw new Error('Tauri updater not available');
      }

      const updateInfo = await tauriUpdater.checkUpdate();
      const hasUpdate = updateInfo.shouldUpdate || false;

      console.log('🔄 Tauri update check result:', { 
        hasUpdate, 
        currentVersion: APP_VERSION, 
        manifest: updateInfo.manifest 
      });

      const result = {
        shouldUpdate: hasUpdate,
        currentVersion: APP_VERSION,
        latestVersion: updateInfo.manifest?.version || 'unknown',
        releaseNotes: updateInfo.manifest?.body || 'No release notes available',
        publishedAt: updateInfo.manifest?.date || null,
        manifest: updateInfo.manifest
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
      console.error('❌ Tauri update check failed:', error);
      
      // Update cache with error
      cache.lastChecked = now;
      cache.updateAvailable = false;
      cache.updateInfo = null;

      this.notifyListeners({
        type: 'update_check_error',
        error: error.message
      });

      return {
        updateAvailable: false,
        error: error.message,
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
   * Install available update
   * @returns {Promise<Object>} Install result
   */
  async installUpdate() {
    if (!this.isStandalone) {
      return {
        success: false,
        error: 'Not running as standalone app'
      };
    }

    if (this.isInstalling) {
      return {
        success: false,
        error: 'Update installation already in progress'
      };
    }

    try {
      this.isInstalling = true;
      console.log('📦 Installing update...');

      this.notifyListeners({
        type: 'update_install_start'
      });

      if (!tauriUpdater) {
        throw new Error('Tauri updater not available');
      }
      
      await tauriUpdater.installUpdate();
      
      console.log('✅ Update installed successfully');
      
      this.notifyListeners({
        type: 'update_install_complete'
      });

      return {
        success: true,
        message: 'Update installed successfully'
      };
    } catch (error) {
      console.error('❌ Update installation failed:', error);
      
      this.notifyListeners({
        type: 'update_install_error',
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