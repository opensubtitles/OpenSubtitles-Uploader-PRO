import React from 'react';
import { VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS, ARCHIVE_EXTENSIONS } from '../utils/constants.js';

export const DropZone = ({
  isDragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  browserCapabilities,
  hasFiles,
  onClearFiles,
  colors,
  isDark,
  onFileSelect,
  onDirectorySelect,
}) => {
  // Default to light theme colors if not provided
  const themeColors = colors || {
    cardBackground: '#fff',
    border: '#ccc',
    success: '#9EC068',
    text: '#000',
    textSecondary: '#454545',
  };

  const hoverBg = isDark ? '#3a3a3a' : '#DCF2B8';
  const normalBg = themeColors.cardBackground;

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-12 mb-6 text-center transition-all duration-300 shadow-sm`}
      style={{
        borderColor: isDragOver ? themeColors.success : themeColors.border,
        backgroundColor: isDragOver ? hoverBg : normalBg,
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
        color: themeColors.text,
      }}
      onMouseEnter={e => {
        if (!isDragOver) {
          e.target.style.borderColor = themeColors.success;
          e.target.style.backgroundColor = hoverBg;
        }
      }}
      onMouseLeave={e => {
        if (!isDragOver) {
          e.target.style.borderColor = themeColors.border;
          e.target.style.backgroundColor = normalBg;
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold" style={{ color: themeColors.text || '#000' }}>
          Drop your media files or folders here
        </h3>
        <p style={{ color: themeColors.textSecondary || '#454545' }}>
          Supports recursive folder scanning for video files (
          {VIDEO_EXTENSIONS.slice(0, 5).join(', ')}, etc.), subtitle files (
          {SUBTITLE_EXTENSIONS.slice(0, 5).join(', ')}, etc.),
          <br />
          and archives (.zip, .rar, .7z, .tar, etc. - max 100 MB)
        </p>
        <p className="text-sm font-medium" style={{ color: themeColors.link || '#185DA0' }}>
          📁 Drag entire movie folders - automatically finds and pairs video files with subtitles
        </p>
        <div className="flex justify-center space-x-6 mt-6">
          <div className="text-center">
            <div className="text-2xl mb-1">🎬</div>
            <div className="text-xs" style={{ color: themeColors.textMuted || '#808080' }}>
              Video Files
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">📝</div>
            <div className="text-xs" style={{ color: themeColors.textMuted || '#808080' }}>
              Subtitles
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">📁</div>
            <div className="text-xs" style={{ color: themeColors.textMuted || '#808080' }}>
              Folders
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-1">📦</div>
            <div className="text-xs" style={{ color: themeColors.textMuted || '#808080' }}>
              Archives
            </div>
          </div>
        </div>

        {/* File Selection Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          {/* Select Files */}
          <input
            type="file"
            id="file-input"
            multiple
            accept={`${VIDEO_EXTENSIONS.join(',')},${SUBTITLE_EXTENSIONS.join(',')},${ARCHIVE_EXTENSIONS.join(',')}`}
            onChange={onFileSelect}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="file-input"
            className="px-6 py-3 rounded-lg text-white font-semibold cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
            style={{
              backgroundColor: themeColors.link || '#2878C0',
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = themeColors.linkHover || '#185DA0';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = themeColors.link || '#2878C0';
              e.target.style.transform = 'translateY(0)';
            }}
            title={hasFiles ? 'Add more files to the existing selection' : 'Select files to upload'}
          >
            📄 {hasFiles ? 'Add More Files' : 'Select Files'}
          </label>

          {/* Select Directory */}
          <input
            type="file"
            id="directory-input"
            webkitdirectory="true"
            multiple
            onChange={onDirectorySelect}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="directory-input"
            className="px-6 py-3 rounded-lg text-white font-semibold cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
            style={{
              backgroundColor: themeColors.link || '#2878C0',
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = themeColors.linkHover || '#185DA0';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = themeColors.link || '#2878C0';
              e.target.style.transform = 'translateY(0)';
            }}
            title={hasFiles ? 'Add more folders to the existing selection' : 'Select a folder to upload'}
          >
            📁 {hasFiles ? 'Add More Folders' : 'Select Folder'}
          </label>
        </div>
      </div>

      {hasFiles && (
        <button
          onClick={onClearFiles}
          className="absolute top-4 right-4 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
          style={{
            backgroundColor: themeColors.link || '#2878C0',
          }}
          onMouseEnter={e => {
            e.target.style.backgroundColor = themeColors.linkHover || '#185DA0';
          }}
          onMouseLeave={e => {
            e.target.style.backgroundColor = themeColors.link || '#2878C0';
          }}
        >
          Clear All
        </button>
      )}
    </div>
  );
};
