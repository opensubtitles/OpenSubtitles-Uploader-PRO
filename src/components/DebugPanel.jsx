import React, { useState, useEffect } from 'react';
import { CacheService } from '../services/cache.js';
import authService from '../services/authService.js';
import SystemInfo from './SystemInfo.jsx';
import '../styles/SystemInfo.css';

export const DebugPanel = ({ 
  debugMode, 
  debugInfo, 
  languagesLoading, 
  languagesError,
  movieGuesses,
  featuresByImdbId,
  hashCheckResults,
  hashCheckLoading,
  hashCheckProcessed,
  getHashCheckSummary,
  toggleDebugMode,
  clearAllCache,
  colors,
  isDark
}) => {
  const [cacheInfo, setCacheInfo] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Update cache info and session info when debug panel opens or cache is cleared
  useEffect(() => {
    const updateInfo = () => {
      setCacheInfo(CacheService.getCacheSize());
      setSessionInfo({
        hasSessionId: !!authService.getToken(),
        sessionId: authService.getToken() ? `${authService.getToken().substring(0, 8)}...` : null,
        isValid: authService.isLoggedIn()
      });
    };
    
    updateInfo();
    
    // Update info every 5 seconds when debug panel is open
    const interval = setInterval(updateInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  // Copy debug content to clipboard
  const copyToClipboard = async () => {
    try {
      let content = '=== DEBUG INFORMATION ===\n\n';
      
      // Add debug mode status
      content += `Debug mode: ${debugMode ? 'ON' : 'OFF'}\n`;
      content += `Timestamp: ${new Date().toISOString()}\n\n`;
      
      // Add session info
      if (sessionInfo) {
        content += `Session: ${sessionInfo.isValid ? 'Active' : 'None'}`;
        if (sessionInfo.isValid && sessionInfo.sessionId) {
          content += ` (${sessionInfo.sessionId})`;
        }
        content += '\n\n';
      }
      
      // Add cache info
      if (cacheInfo) {
        content += `Cache: ${cacheInfo.formattedSize}`;
        if (cacheInfo.itemCount > 0) {
          content += ` (${cacheInfo.itemCount} items)`;
        }
        content += '\n\n';
      }
      
      // Add debug log messages
      content += '=== DEBUG LOG MESSAGES ===\n';
      if (debugInfo.length === 0) {
        content += debugMode 
          ? 'No console messages yet. All browser console output will appear here.\n'
          : 'No debug info yet. Try dragging and dropping files.\n';
      } else {
        debugInfo.forEach((info, idx) => {
          content += `${idx + 1}. ${info}\n`;
        });
      }
      
      
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy debug info:', err);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  };

  // Default to light theme colors if not provided
  const themeColors = colors || {
    cardBackground: '#fff',
    border: '#ccc',
    text: '#000',
    textSecondary: '#454545',
    textMuted: '#808080',
    link: '#2878C0',
    linkHover: '#185DA0',
    success: '#9EC068',
    error: '#dc3545',
    info: '#17a2b8'
  };
  return (
    <details className="mt-6">
      <summary className="rounded-lg p-3 cursor-pointer text-sm flex items-center justify-between shadow-sm" 
               style={{
                 backgroundColor: themeColors.cardBackground,
                 border: `1px solid ${themeColors.border}`,
                 color: themeColors.textSecondary
               }}>
        <div className="flex items-center gap-2">
          <span style={{ color: themeColors.textMuted }}>🔧 Debug Information</span>
          {languagesLoading ? (
            <div className="flex items-center gap-2" style={{color: themeColors.link}}>
              <div className="w-3 h-3 rounded-full animate-spin" style={{
                borderTop: `2px solid transparent`,
                borderRight: `2px solid ${themeColors.link}`,
                borderBottom: `2px solid ${themeColors.link}`,
                borderLeft: `2px solid ${themeColors.link}`
              }}></div>
              <span>Loading...</span>
            </div>
          ) : languagesError ? (
            <span style={{color: themeColors.error}}>❌ Error</span>
          ) : null}
          <button
            onClick={copyToClipboard}
            className="ml-2 px-2 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: copySuccess ? themeColors.success : 'transparent',
              color: copySuccess ? 'white' : themeColors.textMuted,
              border: `1px solid ${copySuccess ? themeColors.success : themeColors.border}`,
              cursor: 'pointer',
              opacity: copySuccess ? 1 : 0.6
            }}
            title="Copy all debug information to clipboard"
          >
            {copySuccess ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
        <label 
          className="flex items-center gap-2 text-sm cursor-pointer select-none"
          style={{color: themeColors.textSecondary}}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={debugMode}
            onChange={toggleDebugMode}
            className="accent-blue-500"
            style={{accentColor: themeColors.link}}
          />
          Debug mode
        </label>
      </summary>
      
      <div className="rounded-lg p-4 mt-2 shadow-sm" 
           style={{
             backgroundColor: themeColors.cardBackground,
             border: `1px solid ${themeColors.border}`
           }}>
        <div className="rounded p-3 text-xs font-mono max-h-40 overflow-y-auto" 
             style={{
               backgroundColor: isDark ? '#1e1e1e' : '#f4f4f4',
               border: `1px solid ${themeColors.border}`
             }}>
          <div className="mb-2" style={{color: themeColors.textSecondary}}>
            Debug mode: <span style={{color: debugMode ? themeColors.success : themeColors.link, fontWeight: 'bold'}}>
              {debugMode ? "ON" : "OFF"}
            </span>
            <div className="text-xs mt-1" style={{color: themeColors.textMuted}}>
              {debugMode 
                ? "📋 Showing ALL console messages (for users without dev tools access)"
                : "🔧 Showing basic file processing messages"
              }
            </div>
          </div>
          
          {/* Debug data display - hidden from user */}
          {/* 
          {(Object.keys(movieGuesses).length > 0 || Object.keys(featuresByImdbId).length > 0) && (
            <div className="mb-2" style={{color: themeColors.textSecondary}}>
              {Object.keys(movieGuesses).length > 0 && (
                <>
                  <span className="font-bold" style={{color: themeColors.link}}>[DEBUG] movieGuesses:</span>
                  <pre className="whitespace-pre-wrap" style={{margin: 0, fontSize: '10px', color: themeColors.textMuted}}>
                    {JSON.stringify(movieGuesses, null, 2)}
                  </pre>
                </>
              )}
              {Object.keys(featuresByImdbId).length > 0 && (
                <>
                  <span className="font-bold" style={{color: themeColors.link}}>[DEBUG] featuresByImdbId:</span>
                  <pre className="whitespace-pre-wrap" style={{margin: 0, fontSize: '10px', color: themeColors.textMuted}}>
                    {JSON.stringify(featuresByImdbId, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
          */}
          
          {/* Debug log messages */}
          {debugInfo.length === 0 ? (
            <div style={{color: themeColors.textMuted}}>
              {debugMode 
                ? "No console messages yet. All browser console output will appear here."
                : "No debug info yet. Try dragging and dropping files."
              }
            </div>
          ) : (
            debugInfo.map((info, idx) => (
              <div key={idx} style={{color: themeColors.textSecondary, lineHeight: '1.3'}}>{info}</div>
            ))
          )}
        </div>
        
        {/* Cache Info and Session Info */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: themeColors.textSecondary }}>
              {cacheInfo && (
                <span>
                  📦 Cache: <span style={{ color: themeColors.link, fontWeight: 'bold' }}>
                    {cacheInfo.formattedSize}
                  </span>
                  {cacheInfo.itemCount > 0 && (
                    <span style={{ color: themeColors.textMuted }}>
                      {' '}({cacheInfo.itemCount} items)
                    </span>
                  )}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                clearAllCache();
                // Update cache info immediately after clearing
                setTimeout(() => setCacheInfo(CacheService.getCacheSize()), 100);
              }}
              className="text-white px-4 py-2 rounded-lg transition-colors text-sm"
              style={{
                backgroundColor: themeColors.link
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = themeColors.linkHover;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = themeColors.link;
              }}
              title="Delete all stored language and XML-RPC cache"
            >
              🗑️ Clear All Cache
            </button>
          </div>
          
          {/* Session Info */}
          <div className="text-sm" style={{ color: themeColors.textSecondary }}>
            {sessionInfo && (
              <span>
                🔐 Session: <span style={{ 
                  color: sessionInfo.isValid ? themeColors.success : themeColors.textMuted, 
                  fontWeight: 'bold' 
                }}>
                  {sessionInfo.isValid ? 'Active' : 'None'}
                </span>
                {sessionInfo.isValid && sessionInfo.sessionId && (
                  <span style={{ color: themeColors.textMuted }}>
                    {' '}({sessionInfo.sessionId})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        
        {/* System Information */}
        <div className="mt-4">
          <SystemInfo compact={true} />
        </div>
      </div>
    </details>
  );
};