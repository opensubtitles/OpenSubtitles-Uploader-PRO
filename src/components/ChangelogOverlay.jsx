import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../utils/constants.js';

const ChangelogOverlay = ({ isOpen, onClose, colors, isDark }) => {
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const detectEnvironment = () => {
    // Check if running in Tauri (desktop app)
    const isTauri = window.__TAURI__ || 
                   window.location.protocol === 'tauri:' || 
                   window.location.origin.startsWith('tauri://') ||
                   navigator.userAgent.includes('Tauri');
    
    return {
      isTauri,
      isWeb: !isTauri
    };
  };

  const fetchChangelog = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    const env = detectEnvironment();
    
    try {
      let changelogContent = '';
      
      if (env.isTauri) {
        // In Tauri app - can fetch directly from GitHub
        const timestamp = new Date().getTime();
        const changelogUrl = `https://raw.githubusercontent.com/opensubtitles/opensubtitles-uploader-pro/main/CHANGELOG.md?t=${timestamp}`;
        
        console.log(`📋 Fetching changelog from GitHub (Tauri): ${changelogUrl}`);

        const response = await fetch(changelogUrl, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.status} ${response.statusText}`);
        }
        
        changelogContent = await response.text();
        
      } else {
        // In web browser - use GitHub API to avoid CORS issues
        console.log('📋 Fetching changelog via GitHub API (Web)');
        
        const apiUrl = 'https://api.github.com/repos/opensubtitles/opensubtitles-uploader-pro/contents/CHANGELOG.md';
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'OpenSubtitles-Uploader-PRO'
          }
        });
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // GitHub API returns base64 encoded content
        if (data.content && data.encoding === 'base64') {
          changelogContent = atob(data.content);
        } else {
          throw new Error('Invalid content format from GitHub API');
        }
      }
      
      // Verify we got actual content
      if (!changelogContent || changelogContent.trim().length === 0) {
        throw new Error('Received empty changelog content');
      }
      
      console.log(`✅ Changelog fetched successfully (${changelogContent.length} characters)`);
      setChangelog(changelogContent);
      setLastFetched(new Date());
      
    } catch (err) {
      console.error('❌ Failed to fetch changelog:', err);
      
      // Provide fallback with basic changelog if available
      const fallbackChangelog = `# Changelog

## Version ${APP_VERSION}

Unable to fetch the latest changelog from GitHub.

**Possible reasons:**
- Network connectivity issues
- CORS restrictions in web browser
- GitHub API rate limiting

**To view the complete changelog:**
- [View on GitHub](https://github.com/opensubtitles/opensubtitles-uploader-pro/blob/main/CHANGELOG.md)

**Environment:** ${env.isTauri ? 'Desktop App' : 'Web Browser'}

**Error details:** ${err.message}`;
      
      setChangelog(fallbackChangelog);
      setError(null); // Don't show error since we have fallback content
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Always fetch fresh changelog when overlay opens
      // This ensures users see the latest changes
      fetchChangelog(true);
    }
  }, [isOpen]);

  // Simple markdown renderer for changelog
  const renderMarkdown = (text) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <h3 key={index} className="text-lg font-semibold mt-4 mb-2" 
                style={{ color: isDark ? '#e5e5e5' : colors.textPrimary }}>
              {line.replace('### ', '')}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={index} className="text-xl font-bold mt-6 mb-3 pb-2" 
                style={{ 
                  color: isDark ? '#f0f0f0' : colors.textPrimary, 
                  borderBottom: `1px solid ${colors.border}` 
                }}>
              {line.replace('## ', '')}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={index} className="text-2xl font-bold mt-8 mb-4" 
                style={{ color: isDark ? '#f5f5f5' : colors.textPrimary }}>
              {line.replace('# ', '')}
            </h1>
          );
        }
        
        // Lists
        if (line.startsWith('- ')) {
          return (
            <li key={index} className="ml-4 mb-1 list-disc list-inside" 
                style={{ color: isDark ? '#d1d1d1' : colors.textPrimary }}>
              {line.replace('- ', '')}
            </li>
          );
        }
        
        // Links
        if (line.includes('[') && line.includes('](')) {
          const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
          const parts = line.split(linkRegex);
          return (
            <p key={index} className="mb-2" style={{ color: isDark ? '#d1d1d1' : colors.textPrimary }}>
              {parts.map((part, i) => {
                if (i % 3 === 1) {
                  // This is link text
                  const url = parts[i + 1];
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline transition-colors"
                      style={{ color: isDark ? '#60a5fa' : colors.primary }}
                    >
                      {part}
                    </a>
                  );
                } else if (i % 3 === 2) {
                  // This is the URL, skip it
                  return null;
                } else {
                  // Regular text
                  return part;
                }
              })}
            </p>
          );
        }
        
        // Horizontal rule
        if (line.trim() === '---') {
          return <hr key={index} className="my-6" style={{ borderColor: colors.border }} />;
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <div key={index} className="mb-2"></div>;
        }
        
        // Regular paragraphs
        return (
          <p key={index} className="mb-2" style={{ color: isDark ? '#d1d1d1' : colors.textPrimary }}>
            {line}
          </p>
        );
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" 
         style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}>
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden"
           style={{ backgroundColor: colors.cardBackground }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b"
             style={{ borderBottomColor: colors.border }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-xl font-bold" style={{ color: isDark ? '#f5f5f5' : colors.textPrimary }}>
                Changelog
              </h2>
              <p className="text-sm" style={{ color: isDark ? '#d1d1d1' : colors.textSecondary }}>
                Version {APP_VERSION} - What's new and improved
              </p>
              {lastFetched && (
                <p className="text-xs" style={{ color: isDark ? '#a3a3a3' : colors.textSecondary }}>
                  Last updated: {lastFetched.toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchChangelog(true)}
              disabled={loading}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-80 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
              title="Refresh changelog"
            >
              {loading ? '⏳' : '🔄'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-80 hover:scale-105"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : colors.border,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]" 
             style={{
               backgroundColor: isDark ? colors.background : colors.cardBackground,
               scrollbarWidth: 'thin',
               scrollbarColor: `${colors.border} ${colors.cardBackground}`
             }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2"
                     style={{ borderColor: colors.primary }}></div>
                <span style={{ color: colors.textSecondary }}>Loading changelog...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                ⚠️ Failed to load changelog
              </div>
              <p className="mb-4" style={{ color: colors.textSecondary }}>
                {error}
              </p>
              <button
                onClick={fetchChangelog}
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{ 
                  backgroundColor: colors.primary,
                  color: 'white'
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {changelog && !loading && !error && (
            <div className="max-w-none leading-relaxed" 
                 style={{ color: isDark ? '#d1d1d1' : colors.textPrimary }}>
              {renderMarkdown(changelog)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-opacity-50"
             style={{ 
               borderTopColor: colors.border,
               backgroundColor: colors.background 
             }}>
          <div className="flex items-center justify-between">
            <a
              href="https://github.com/opensubtitles/opensubtitles-uploader-pro/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: colors.primary }}
            >
              📦 View releases on GitHub
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ 
                backgroundColor: colors.primary,
                color: 'white'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangelogOverlay;