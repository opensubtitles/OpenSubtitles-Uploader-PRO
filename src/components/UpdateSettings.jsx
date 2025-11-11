import React from 'react';
import { useAppUpdate } from '../hooks/useAppUpdate.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

/**
 * Update settings component for configuration panel
 */
const UpdateSettings = () => {
  const { isDark } = useTheme();
  const {
    isStandalone,
    updateAvailable,
    updateInfo,
    isChecking,
    error,
    lastChecked,
    autoCheckEnabled,
    currentVersion,
    checkForUpdates,
    startAutoUpdates,
    stopAutoUpdates,
    clearUpdateCache,
    getLastCheckedFormatted,
  } = useAppUpdate();

  // Don't render anything when not in standalone mode (browser)
  if (!isStandalone) {
    return null;
  }

  const handleCheckForUpdates = async () => {
    await checkForUpdates(true); // Force check
  };

  // Get platform-specific download URL (same as UpdateNotification popup)
  const getPlatformDownloadUrl = () => {
    if (!updateInfo || !updateInfo.latestVersion) return null;

    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    const version = updateInfo.latestVersion;

    // Determine platform
    let platformType = 'unknown';
    let fileName = '';

    if (platform.includes('mac') || userAgent.includes('mac')) {
      platformType = 'macOS';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_universal.dmg`;
    } else if (platform.includes('win') || userAgent.includes('windows')) {
      platformType = 'Windows';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_x64-setup.exe`;
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      platformType = 'Linux';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_amd64.AppImage`;
    }

    const directUrl = `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/v${version}/${fileName}`;

    return {
      url: directUrl,
      fileName,
      platformType,
    };
  };

  const downloadInfo = getPlatformDownloadUrl();

  const handleMoreInfo = () => {
    // Open GitHub release page in browser (same as UpdateNotification popup)
    const releaseUrl = `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/tag/v${updateInfo?.latestVersion}`;

    if (typeof window !== 'undefined') {
      // For both standalone and web apps, open in external browser
      if (window.__TAURI__) {
        // Tauri app - open in external browser using Tauri v2 plugin
        import('@tauri-apps/plugin-shell')
          .then(({ open }) => {
            open(releaseUrl);
          })
          .catch(error => {
            console.warn(
              'Failed to open external browser via Tauri shell, falling back to window.open:',
              error
            );
            window.open(releaseUrl, '_blank', 'noopener,noreferrer');
          });
      } else {
        // Web app - open in new tab
        window.open(releaseUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleToggleAutoUpdates = () => {
    if (autoCheckEnabled) {
      stopAutoUpdates();
    } else {
      startAutoUpdates();
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Auto-Update Settings
      </h3>

      {/* Current Version */}
      <div className="mb-4">
        <label
          className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Current Version
        </label>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {currentVersion}
        </div>
      </div>

      {/* Auto-Update Toggle */}
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={autoCheckEnabled}
            onChange={handleToggleAutoUpdates}
            className="sr-only"
          />
          <div
            className={`relative w-10 h-6 rounded-full transition-colors ${
              autoCheckEnabled ? 'bg-blue-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                autoCheckEnabled ? 'transform translate-x-4' : ''
              }`}
            ></div>
          </div>
          <span
            className={`ml-3 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Automatic update checks (every hour)
          </span>
        </label>
      </div>

      {/* Last Checked */}
      <div className="mb-4">
        <label
          className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Last Checked
        </label>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {getLastCheckedFormatted()}
        </div>
      </div>

      {/* Update Status */}
      {updateAvailable && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            isDark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <div className={`font-medium text-sm mb-1 ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
            Update Available: {updateInfo?.manifest?.version}
          </div>
          {updateInfo?.body && (
            <div className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              {updateInfo.body.slice(0, 150)}...
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className={`font-medium text-sm mb-1 ${isDark ? 'text-red-200' : 'text-red-800'}`}>
            Update Error
          </div>
          <div className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCheckForUpdates}
          disabled={isChecking}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isChecking
              ? isDark
                ? 'bg-gray-600 text-gray-400'
                : 'bg-gray-300 text-gray-500'
              : isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isChecking ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 inline"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Checking...
            </>
          ) : (
            'Check for Updates'
          )}
        </button>

        {updateAvailable && downloadInfo && (
          <a
            href={downloadInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors inline-block ${
              isDark
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            title={`Download ${downloadInfo.fileName} for ${downloadInfo.platformType}`}
          >
            Download Update
          </a>
        )}

        {updateAvailable && !downloadInfo && (
          <a
            href={
              updateInfo?.releaseUrl ||
              `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/tag/v${updateInfo?.latestVersion}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors inline-block ${
              isDark
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            Download Update
          </a>
        )}

        {updateAvailable && (
          <button
            onClick={handleMoreInfo}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-gray-600 hover:bg-gray-700 text-white'
                : 'bg-gray-400 hover:bg-gray-500 text-white'
            }`}
            title={`View release notes for v${updateInfo?.latestVersion} on GitHub`}
          >
            More Info
          </button>
        )}

        <button
          onClick={clearUpdateCache}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isDark
              ? 'bg-gray-600 hover:bg-gray-700 text-white'
              : 'bg-gray-400 hover:bg-gray-500 text-white'
          }`}
        >
          Clear Update Check
        </button>
      </div>

      {/* Info Text */}
      <div className={`mt-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
        Updates are checked automatically every hour when enabled. Manual checks will always fetch
        the latest information.
      </div>
    </div>
  );
};

export default UpdateSettings;
