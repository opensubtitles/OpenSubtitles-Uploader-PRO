import React, { useState } from 'react';
import { useAppUpdate } from '../hooks/useAppUpdate.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { getChangelogSummary } from '../utils/changelogUtils.js';

/**
 * Update notification component
 */
const UpdateNotification = () => {
  const { isDark } = useTheme();
  const {
    isStandalone,
    updateAvailable,
    updateInfo,
    isDownloading,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    downloadStatus,
    downloadedFilePath,
    downloadedFileName,
    downloadedFileSize,
    showPath,
    canReveal,
    warning,
    downloadUpdate,
    openDownloadedFile,
    revealDownloadedFile,
    error
  } = useAppUpdate();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Get platform-specific download URL
  const getPlatformDownloadUrl = () => {
    if (!updateInfo || !updateInfo.latestVersion) return null;

    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    const version = updateInfo.latestVersion;

    // Determine platform
    let platformType = 'unknown';
    let fileExtension = '';
    let fileName = '';

    if (platform.includes('mac') || userAgent.includes('mac')) {
      platformType = 'macOS';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_universal.dmg`;
      fileExtension = '.dmg';
    } else if (platform.includes('win') || userAgent.includes('windows')) {
      platformType = 'Windows';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_x64-setup.exe`;
      fileExtension = '.exe';
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      platformType = 'Linux';
      fileName = `OpenSubtitles.Uploader.PRO_${version}_amd64.AppImage`;
      fileExtension = '.AppImage';
    }

    const directUrl = `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/v${version}/${fileName}`;
    
    return {
      url: directUrl,
      fileName,
      platformType,
      fileExtension
    };
  };

  const downloadInfo = getPlatformDownloadUrl();

  // Get changelog summary for what's new
  const changelogSummary = updateInfo?.currentVersion && updateInfo?.latestVersion 
    ? getChangelogSummary(updateInfo.currentVersion, updateInfo.latestVersion)
    : null;

  // Don't show if no update available or dismissed
  if (!updateAvailable || isDismissed) {
    return null;
  }

  const handleDownloadUpdate = async () => {
    const result = await downloadUpdate();
    if (result.success) {
      setIsExpanded(true);
    }
  };

  const handleOpenFile = async () => {
    if (downloadedFilePath) {
      // Check if it's a DMG file for special handling
      const isDmgFile = downloadedFileName && downloadedFileName.toLowerCase().includes('.dmg');
      
      if (isDmgFile) {
        // For DMG files, use the install function which will mount and open the DMG
        console.log('📦 DMG file detected, using installation method');
        await openDownloadedFile(downloadedFilePath);
      } else {
        // For other files, use regular file opening
        await openDownloadedFile(downloadedFilePath);
      }
    }
  };

  const handleRevealFile = async () => {
    if (downloadedFilePath) {
      await revealDownloadedFile(downloadedFilePath);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md rounded-lg shadow-lg border ${
      isDark 
        ? 'bg-gray-900/95 border-gray-700 text-white shadow-xl' 
        : 'bg-blue-50 border-blue-200 text-blue-900'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className={`h-6 w-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-blue-900'}`}>
                Update Available
              </h3>
              <div className={`mt-1 text-sm ${isDark ? 'text-gray-300' : 'text-blue-700'}`}>
                <p>Version {updateInfo?.latestVersion} is available</p>
                <p className="text-xs mt-1">You're currently using v{updateInfo?.currentVersion}</p>
                {changelogSummary?.hasChanges && (
                  <p className="text-xs mt-1 text-green-400">
                    ✨ {changelogSummary.releaseCount} new release{changelogSummary.releaseCount > 1 ? 's' : ''} with updates
                  </p>
                )}
                {typeof window !== 'undefined' && window.__TEST_UPGRADE_MODE__ && (
                  <p className="text-xs mt-1 font-semibold text-yellow-500">🧪 TEST MODE - Update forced for testing</p>
                )}
                {isExpanded && downloadInfo && (
                  <div className={`mt-2 p-2 rounded ${isDark ? 'bg-gray-800' : 'bg-blue-50'}`}>
                    <p className="text-xs font-medium mb-1">Download Info:</p>
                    <p className="text-xs">
                      <span className="font-medium">Platform:</span> {downloadInfo.platformType}<br/>
                      <span className="font-medium">File:</span> {downloadInfo.fileName}<br/>
                      <span className="font-medium">Type:</span> {downloadInfo.fileExtension === '.dmg' ? 'DMG Installer' : 
                        downloadInfo.fileExtension === '.exe' ? 'Windows Installer' : 
                        downloadInfo.fileExtension === '.AppImage' ? 'Linux AppImage' : 'Installer'}
                    </p>
                  </div>
                )}
                {isExpanded && changelogSummary?.hasChanges && (
                  <div className={`mt-2 p-2 rounded ${isDark ? 'bg-gray-800' : 'bg-black bg-opacity-20'}`}>
                    <p className="text-xs font-medium mb-2">
                      ✨ What's New {changelogSummary.releaseCount > 1 ? `(${changelogSummary.releaseCount} releases)` : ''}:
                    </p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {changelogSummary.releases.map((release, index) => (
                        <div key={release.version} className={`${index > 0 ? 'pt-2 border-t border-gray-600' : ''}`}>
                          <p className="text-xs font-medium text-blue-400 mb-1">
                            {release.version}
                          </p>
                          <div className="text-xs text-gray-300 leading-relaxed">
                            {release.body.split('\n').slice(0, 4).map((line, lineIndex) => (
                              line.trim() && (
                                <p key={lineIndex} className="mb-1">
                                  {line.trim()}
                                </p>
                              )
                            ))}
                            {release.body.split('\n').length > 4 && (
                              <p className="text-gray-500 italic">...</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {isExpanded && updateInfo?.releaseNotes && !changelogSummary?.hasChanges && (
                  <div className={`mt-2 p-2 rounded ${isDark ? 'bg-gray-800' : 'bg-black bg-opacity-20'}`}>
                    <p className="text-xs font-medium mb-1">Release Notes:</p>
                    <p className="text-xs whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className={`mt-2 text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  Error: {error}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className={`ml-4 inline-flex text-sm ${
              isDark 
                ? 'text-gray-400 hover:text-gray-200' 
                : 'text-blue-500 hover:text-blue-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isStandalone ? (
            // Standalone app - show download links (MANUAL DOWNLOAD MODE - no quarantine issues)
            // TODO: When Apple Dev certificate is available, restore auto-download functionality
            // by changing this back to the downloadUpdate button workflow below
            <>
              {/* FUTURE AUTO-DOWNLOAD (when Apple Dev cert available):
              {!isDownloading && !downloadedFilePath && (
                <>
                  <button
                    onClick={handleDownloadUpdate}
                    className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                      isDark
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    📥 Download Update
                  </button>
              */}
              
              {/* CURRENT: Direct download link for user's OS to avoid quarantine issues */}
              {downloadInfo ? (
                <a
                  href={downloadInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                    isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title={`Download ${downloadInfo.fileName}`}
                >
                  📥 Download for {downloadInfo.platformType}
                </a>
              ) : (
                <a
                  href={updateInfo?.releaseUrl || `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/tag/v${updateInfo?.latestVersion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                    isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  📥 Download Update
                </a>
              )}
                  
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                {isExpanded ? 'Less Info' : 'More Info'}
              </button>
              
              {/* FUTURE: Restore download progress UI when auto-download is re-enabled
              {isDownloading && (
                <div className="w-full">
                  [Progress bar and download status UI]
                </div>
              )}
              
              {downloadedFilePath && downloadedFileName && (
                <div className="flex flex-wrap gap-2">
                  [Downloaded file actions: Open DMG, Reveal in Finder]
                </div>
              )}
              */}
            </>
          ) : (
            // Web/browser app - show download links
            <>
              {updateInfo?.releaseUrl && (
                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                    isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  📥 Download Update
                </a>
              )}
              
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                {isExpanded ? 'Less Info' : 'More Info'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;