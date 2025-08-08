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
    downloadedFilePath,
    downloadedFilename,
    downloadUpdate,
    openDownloadedFile,
    error
  } = useAppUpdate();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showConfirmDownload, setShowConfirmDownload] = useState(false);

  // Don't show if no update available or dismissed
  if (!updateAvailable || isDismissed) {
    return null;
  }

  const handleDownloadUpdate = async () => {
    const result = await downloadUpdate();
    if (result.success) {
      console.log('✅ Update downloaded:', result.filePath);
    }
  };

  const handleOpenDownloadedFile = async () => {
    if (downloadedFilePath) {
      const result = await openDownloadedFile(downloadedFilePath);
      if (result.success) {
        console.log('✅ File opened successfully');
      }
    }
  };

  const handleConfirmDownload = () => {
    setShowConfirmDownload(false);
    handleDownloadUpdate();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md rounded-lg shadow-lg border ${
      isDark 
        ? 'bg-blue-900/95 border-blue-700 text-white' 
        : 'bg-blue-50 border-blue-200 text-blue-900'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-blue-900'}`}>
                Update Available
              </h3>
              <div className={`mt-1 text-sm ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                <p>Version {updateInfo?.latestVersion} is available</p>
                <p className="text-xs mt-1">You're currently using v{updateInfo?.currentVersion}</p>
                {isExpanded && updateInfo?.releaseNotes && (
                  <div className="mt-2 p-2 rounded bg-black bg-opacity-20">
                    <p className="text-xs font-medium mb-1">Release Notes:</p>
                    <p className="text-xs whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
                  </div>
                )}
              </div>
              
              {error && (
                <div className={`mt-2 text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                  Error: {error}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className={`ml-4 inline-flex text-sm ${
              isDark 
                ? 'text-blue-300 hover:text-blue-100' 
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
            // Standalone app - show download and open buttons
            !isDownloading ? (
              downloadedFilePath ? (
                // File has been downloaded - show open file button
                <>
                  <div className={`text-xs px-3 py-1 rounded font-medium ${
                    isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                  }`}>
                    ✅ Downloaded: {downloadedFilename}
                  </div>
                  
                  <button
                    onClick={handleOpenDownloadedFile}
                    className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                      isDark
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    📂 Open File
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
              ) : (
                // No file downloaded yet - show download button
                <>
                  {showConfirmDownload ? (
                    // Confirmation dialog
                    <div className="flex flex-col gap-2 w-full">
                      <div className={`text-xs ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        Download update to your Downloads folder?
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmDownload}
                          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                            isDark
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          Yes, Download
                        </button>
                        <button
                          onClick={() => setShowConfirmDownload(false)}
                          className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                            isDark
                              ? 'bg-gray-600 hover:bg-gray-700 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal buttons
                    <>
                      <button
                        onClick={() => setShowConfirmDownload(true)}
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
                </>
              )
            ) : (
              // Downloading in progress
              <>
                <div className="flex items-center text-xs">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading update...
                </div>
              </>
            )
          ) : (
            // Web/browser app - show download links (unchanged)
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