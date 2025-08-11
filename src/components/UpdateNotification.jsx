import React, { useState } from 'react';
import { useAppUpdate } from '../hooks/useAppUpdate.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

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
                {typeof window !== 'undefined' && window.__TEST_UPGRADE_MODE__ && (
                  <p className="text-xs mt-1 font-semibold text-yellow-500">🧪 TEST MODE - Update forced for testing</p>
                )}
                {isExpanded && updateInfo?.releaseNotes && (
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
            // Standalone app - show download workflow
            <>
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
              
              {isDownloading && (
                <>
                  <div className="w-full">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Downloading update...
                      </div>
                      <div className="text-xs">
                        {downloadProgress > 0 && `${Math.round(downloadProgress)}%`}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className={`w-full bg-gray-200 rounded-full h-2 ${isDark ? 'bg-gray-700' : ''}`}>
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(downloadProgress, 100)}%` }}
                      ></div>
                    </div>
                    
                    {/* Download Info */}
                    {totalBytes > 0 && (
                      <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {formatFileSize(downloadedBytes)} of {formatFileSize(totalBytes)}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {downloadedFilePath && downloadedFileName && (
                <>
                  <div className="w-full mb-3">
                    <div className={`text-xs ${warning ? (isDark ? 'text-yellow-400' : 'text-yellow-600') : (isDark ? 'text-green-400' : 'text-green-700')} mb-2 flex items-center`}>
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {warning ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                      {warning ? 'Update downloaded with validation warning' : 'Update downloaded successfully!'}
                    </div>
                    
                    {warning && (
                      <div className={`text-xs ${isDark ? 'text-yellow-300' : 'text-yellow-700'} mb-2 p-2 rounded ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-100'} border-l-2 ${isDark ? 'border-yellow-500' : 'border-yellow-400'}`}>
                        ⚠️ {warning}
                      </div>
                    )}
                    
                    <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                      <div className="font-medium">{downloadedFileName}</div>
                      {downloadedFileSize > 0 && (
                        <div className="mt-1">
                          <span className="font-medium">Size:</span> {formatFileSize(downloadedFileSize)}
                        </div>
                      )}
                      {showPath && (
                        <div className="mt-1">
                          <span className="font-medium">Location:</span> 
                          <div className={`mt-1 p-2 rounded text-xs ${isDark ? 'bg-gray-800 text-green-400' : 'bg-green-50 text-green-700'} border-l-2 ${isDark ? 'border-green-500' : 'border-green-400'}`}>
                            📁 {downloadedFilePath}
                            {typeof window !== 'undefined' && window.__TEST_UPGRADE_MODE__ && (
                              <div className="mt-1 text-xs opacity-75">
                                {downloadedFileName && downloadedFileName.toLowerCase().includes('.dmg') 
                                  ? '✅ Real DMG installer downloaded from GitHub releases - click "Open DMG" to install'
                                  : '✅ Real file downloaded from GitHub - buttons will work with actual file'
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleOpenFile}
                      className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                        isDark
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {downloadedFileName && downloadedFileName.toLowerCase().includes('.dmg') 
                        ? '📦 Open DMG' 
                        : '🚀 Install Now'
                      }
                    </button>
                    
                    {canReveal && (
                      <button
                        onClick={handleRevealFile}
                        className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                          isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        📁 Show in {navigator.platform.includes('Mac') ? 'Finder' : 'Explorer'}
                      </button>
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
                  </div>
                </>
              )}
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