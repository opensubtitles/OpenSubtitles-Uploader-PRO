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
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    downloadStatus: 'idle', // 'idle', 'started', 'downloading', 'finished'
    downloadedFilePath: null,
    downloadedFileName: null,
    showPath: false,
    canReveal: false,
    error: null,
    lastChecked: null,
    autoCheckEnabled: false,
    currentVersion: null,
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
      currentVersion: status.currentVersion,
    }));
  }, []);

  // Setup update service listeners
  useEffect(() => {
    const removeListener = updateService.addEventListener(event => {
      switch (event.type) {
        case 'update_check_complete':
          setUpdateState(prev => ({
            ...prev,
            isChecking: false,
            updateAvailable: event.updateAvailable,
            updateInfo: event.updateInfo,
            error: null,
            lastChecked: Date.now(),
          }));
          break;

        case 'update_check_error':
          setUpdateState(prev => ({
            ...prev,
            isChecking: false,
            error: event.error,
            lastChecked: Date.now(),
          }));
          break;

        case 'update_download_start':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: true,
            downloadProgress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            downloadStatus: 'idle',
            error: null,
          }));
          break;

        case 'update_download_progress':
          setUpdateState(prev => ({
            ...prev,
            downloadProgress: event.progress || 0,
            downloadedBytes: event.downloaded || 0,
            totalBytes: event.total || 0,
            downloadStatus: event.status || 'downloading',
          }));
          break;

        case 'update_download_complete':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: false,
            downloadProgress: 100,
            downloadStatus: 'finished',
            downloadedFilePath: event.filePath,
            downloadedFileName: event.fileName,
            downloadedFileSize: event.fileSize || 0,
            showPath: event.showPath || false,
            canReveal: event.canReveal || false,
            warning: event.warning || null,
            error: null,
          }));
          break;

        case 'update_download_error':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: false,
            downloadProgress: 0,
            downloadStatus: 'idle',
            error: event.error,
          }));
          break;

        case 'update_install_start':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: true,
            error: null,
          }));
          break;

        case 'update_install_complete':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: false,
            error: null,
          }));
          break;

        case 'update_install_error':
          setUpdateState(prev => ({
            ...prev,
            isDownloading: false,
            error: event.error,
          }));
          break;

        case 'updater_event':
          console.log('🔄 Updater event received:', event);
          if (event.error) {
            setUpdateState(prev => ({
              ...prev,
              error: event.error,
              isInstalling: false,
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
          lastChecked: Date.now(),
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

  // Download update
  const downloadUpdate = useCallback(async () => {
    if (!updateState.isStandalone) {
      return { success: false, error: 'Not running as standalone app' };
    }

    const result = await updateService.downloadUpdate();
    return result;
  }, [updateState.isStandalone]);

  // Open downloaded file
  const openDownloadedFile = useCallback(
    async filePath => {
      if (!updateState.isStandalone) {
        return { success: false, error: 'Not running as standalone app' };
      }

      const result = await updateService.openDownloadedFile(filePath);
      return result;
    },
    [updateState.isStandalone]
  );

  // Reveal downloaded file in Finder/Explorer
  const revealDownloadedFile = useCallback(
    async filePath => {
      if (!updateState.isStandalone) {
        return { success: false, error: 'Not running as standalone app' };
      }

      const result = await updateService.revealDownloadedFile(filePath);
      return result;
    },
    [updateState.isStandalone]
  );

  // Install update (deprecated - now downloads)
  const installUpdate = useCallback(async () => {
    return await downloadUpdate();
  }, [downloadUpdate]);

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
      lastChecked: null,
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
    openDownloadedFile,
    revealDownloadedFile,
    installUpdate, // deprecated, now calls downloadUpdate
    restartApp,
    startAutoUpdates,
    stopAutoUpdates,
    clearUpdateCache,

    // Helpers
    getLastCheckedFormatted,
  };
};
