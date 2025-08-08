import { useState, useEffect, useCallback } from 'react';
import { updateService } from '../services/updateService.js';

/**
 * Custom hook for managing app updates
 */
export const useAppUpdate = () => {
  const [updateState, setUpdateState] = useState({
    isStandalone: false,
    updateAvailable: false,
    updateInfo: null,
    isChecking: false,
    isInstalling: false,
    error: null,
    lastChecked: null,
    autoCheckEnabled: false,
    currentVersion: null,
    downloadedFile: null,
    downloadedFileName: null
  });

  // Initialize state from update service
  useEffect(() => {
    const status = updateService.getUpdateStatus();
    setUpdateState(prev => ({
      ...prev,
      isStandalone: status.isStandalone,
      updateAvailable: status.updateAvailable,
      updateInfo: status.updateInfo,
      isInstalling: status.isInstalling,
      lastChecked: status.lastChecked,
      autoCheckEnabled: status.autoCheckEnabled,
      currentVersion: status.currentVersion
    }));
  }, []);

  // Setup update service listeners
  useEffect(() => {
    const removeListener = updateService.addEventListener((event) => {
      switch (event.type) {
        case 'update_check_complete':
          setUpdateState(prev => ({
            ...prev,
            isChecking: false,
            updateAvailable: event.updateAvailable,
            updateInfo: event.updateInfo,
            error: null,
            lastChecked: Date.now()
          }));
          break;

        case 'update_check_error':
          setUpdateState(prev => ({
            ...prev,
            isChecking: false,
            error: event.error,
            lastChecked: Date.now()
          }));
          break;

        case 'update_install_start':
        case 'update_download_start':
          setUpdateState(prev => ({
            ...prev,
            isInstalling: true,
            error: null
          }));
          break;

        case 'update_install_complete':
        case 'update_download_complete':
          setUpdateState(prev => ({
            ...prev,
            isInstalling: false,
            error: null,
            downloadedFile: event.filePath,
            downloadedFileName: event.fileName
          }));
          break;

        case 'update_install_error':
        case 'update_download_error':
          setUpdateState(prev => ({
            ...prev,
            isInstalling: false,
            error: event.error
          }));
          break;

        case 'updater_event':
          console.log('🔄 Updater event received:', event);
          if (event.error) {
            setUpdateState(prev => ({
              ...prev,
              error: event.error,
              isInstalling: false
            }));
          }
          break;

        default:
          break;
      }
    });

    return removeListener;
  }, []);

  // Check for updates manually - works for all environments now
  const checkForUpdates = useCallback(async (force = false) => {
    setUpdateState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const result = await updateService.checkForUpdates(force);
      
      if (!result.cached) {
        setUpdateState(prev => ({
          ...prev,
          updateAvailable: result.updateAvailable,
          updateInfo: result.updateInfo,
          error: result.error || null,
          lastChecked: Date.now()
        }));
      }

      return result;
    } catch (error) {
      console.error('❌ Update check failed:', error);
      return { updateAvailable: false, error: error.message };
    } finally {
      setUpdateState(prev => ({ ...prev, isChecking: false }));
    }
  }, []);

  // Download update (replaces install for safety)
  const downloadUpdate = useCallback(async () => {
    if (!updateState.isStandalone) {
      return { success: false, error: 'Not running as standalone app' };
    }

    const result = await updateService.downloadUpdate();
    return result;
  }, [updateState.isStandalone]);

  // Install update (now downloads only for safety)
  const installUpdate = useCallback(async () => {
    if (!updateState.isStandalone) {
      return { success: false, error: 'Not running as standalone app' };
    }

    const result = await updateService.installUpdate();
    return result;
  }, [updateState.isStandalone]);

  // Open Downloads folder
  const openDownloadsFolder = useCallback(async () => {
    if (!updateState.isStandalone) {
      return { success: false, error: 'Not running as standalone app' };
    }

    const result = await updateService.openDownloadsFolder();
    return result;
  }, [updateState.isStandalone]);

  // Run installer
  const runInstaller = useCallback(async (filePath) => {
    if (!updateState.isStandalone) {
      return { success: false, error: 'Not running as standalone app' };
    }

    const result = await updateService.runInstaller(filePath);
    return result;
  }, [updateState.isStandalone]);

  // Restart application
  const restartApp = useCallback(async () => {
    if (!updateState.isStandalone) {
      console.error('❌ Cannot restart: Not running as standalone app');
      return;
    }

    await updateService.restartApplication();
  }, [updateState.isStandalone]);

  // Start auto-update checks - now works for all environments
  const startAutoUpdates = useCallback(() => {
    updateService.startAutoUpdateChecks();
    setUpdateState(prev => ({ ...prev, autoCheckEnabled: true }));
  }, []);

  // Stop auto-update checks
  const stopAutoUpdates = useCallback(() => {
    updateService.stopAutoUpdateChecks();
    setUpdateState(prev => ({ ...prev, autoCheckEnabled: false }));
  }, []);

  // Clear update cache
  const clearUpdateCache = useCallback(() => {
    updateService.clearCache();
    setUpdateState(prev => ({
      ...prev,
      updateAvailable: false,
      updateInfo: null,
      error: null,
      lastChecked: null
    }));
  }, []);

  // Get formatted last checked time
  const getLastCheckedFormatted = useCallback(() => {
    if (!updateState.lastChecked) return 'Never';
    
    const now = Date.now();
    const diff = now - updateState.lastChecked;
    
    if (diff < 60 * 1000) return 'Just now';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} minutes ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} hours ago`;
    
    return new Date(updateState.lastChecked).toLocaleDateString();
  }, [updateState.lastChecked]);

  return {
    // State
    ...updateState,
    
    // Actions
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    openDownloadsFolder,
    runInstaller,
    restartApp,
    startAutoUpdates,
    stopAutoUpdates,
    clearUpdateCache,
    
    // Helpers
    getLastCheckedFormatted
  };
};