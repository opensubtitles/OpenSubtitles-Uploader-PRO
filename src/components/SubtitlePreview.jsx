import React, { useEffect } from 'react';

export const SubtitlePreview = ({ subtitle, content, onClose, colors, isDark }) => {
  // Default to light theme colors if not provided
  const themeColors = colors || {
    cardBackground: '#fff',
    background: '#f4f4f4',
    border: '#ccc',
    text: '#000',
    textSecondary: '#454545',
    textMuted: '#808080',
    link: '#2878C0',
    linkHover: '#185DA0',
  };

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg p-6 max-w-4xl w-full max-h-[80vh] flex flex-col shadow-2xl"
        style={{ backgroundColor: themeColors.cardBackground }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-4 pb-4"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          <h3 className="text-lg font-semibold" style={{ color: themeColors.text }}>
            Subtitle Preview: {subtitle.name}
          </h3>
          <button
            onClick={onClose}
            className="text-2xl font-bold transition-colors"
            style={{ color: themeColors.textMuted }}
            onMouseEnter={e => (e.target.style.color = themeColors.textSecondary)}
            onMouseLeave={e => (e.target.style.color = themeColors.textMuted)}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: '400px' }}>
          <div
            className="p-4 rounded text-sm font-mono h-full"
            style={{
              backgroundColor: isDark ? '#1e1e1e' : '#f4f4f4',
              color: themeColors.text,
              border: `1px solid ${themeColors.border}`,
              overflowY: 'scroll',
              scrollbarWidth: 'auto',
              height: '100%',
              maxHeight: '500px',
            }}
          >
            <pre className="whitespace-pre-wrap" style={{ margin: 0, color: themeColors.text }}>
              {content || 'Loading subtitle content...'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-white px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: themeColors.link,
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = themeColors.linkHover;
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = themeColors.link;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
