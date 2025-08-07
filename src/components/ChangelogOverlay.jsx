import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../utils/constants.js';

const ChangelogOverlay = ({ isOpen, onClose, colors, isDark }) => {
  const [changelog, setChangelog] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChangelog = async () => {
    setLoading(true);
    setError(null);

    try {
      let changelogUrl;
      
      // Try to fetch from the same domain first (for web version)
      if (window.location.protocol === 'https:' || window.location.protocol === 'http:') {
        changelogUrl = '/CHANGELOG.md';
      } else {
        // For Tauri/desktop app, fetch from GitHub
        changelogUrl = 'https://raw.githubusercontent.com/opensubtitles/opensubtitles-uploader-pro/main/CHANGELOG.md';
      }

      const response = await fetch(changelogUrl);
      
      if (!response.ok) {
        // Fallback to GitHub if local fetch fails
        if (changelogUrl === '/CHANGELOG.md') {
          const fallbackResponse = await fetch('https://raw.githubusercontent.com/opensubtitles/opensubtitles-uploader-pro/main/CHANGELOG.md');
          if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch changelog: ${fallbackResponse.status}`);
          }
          const fallbackText = await fallbackResponse.text();
          setChangelog(fallbackText);
        } else {
          throw new Error(`Failed to fetch changelog: ${response.status}`);
        }
      } else {
        const text = await response.text();
        setChangelog(text);
      }
    } catch (err) {
      console.error('Failed to fetch changelog:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !changelog) {
      fetchChangelog();
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
              <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                Changelog
              </h2>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Version {APP_VERSION} - What's new and improved
              </p>
            </div>
          </div>
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