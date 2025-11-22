import React from 'react';
import { formatFileSize } from '../../utils/fileUtils.js';
import { openExternal } from '../../utils/urlUtils.jsx';

export const SubtitleFile = ({
  subtitle,
  combinedLanguages,
  subtitleLanguages,
  openDropdowns,
  dropdownSearch,
  onSubtitleLanguageChange,
  onToggleDropdown,
  onDropdownSearch,
  onSubtitlePreview,
  getSubtitleLanguage,
  getLanguageOptionsForSubtitle,
  uploadEnabled = true, // New prop for upload status
  onToggleUpload, // New prop for upload toggle callback
  uploadResults, // New prop for upload results
  hashCheckResults, // New prop for CheckSubHash results
  hasValidationError = false, // New prop for validation error highlighting
  colors,
  isDark,
}) => {
  // Generate unique ID for scrolling to this subtitle
  const subtitleElementId = `subtitle-${subtitle.fullPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const getFilteredLanguageOptions = (searchTerm = '') => {
    const options = getLanguageOptionsForSubtitle(subtitle);
    if (!searchTerm) return options;

    return options.filter(
      lang =>
        lang.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lang.iso639?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div
      id={subtitleElementId}
      className={`rounded-lg p-3 border transition-all cursor-pointer shadow-sm ${
        uploadEnabled ? 'hover:shadow-md' : 'opacity-75 hover:opacity-90'
      } ${hasValidationError ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
      style={{
        backgroundColor: hasValidationError
          ? (isDark ? '#3a1a1a' : '#fef2f2')
          : (colors?.cardBackground || '#fff'),
        borderColor: hasValidationError
          ? '#ef4444'
          : (uploadEnabled ? colors?.success || '#9EC068' : colors?.border || '#ccc'),
        borderLeft: hasValidationError
          ? '4px solid #ef4444'
          : (uploadEnabled
            ? `4px solid ${colors?.success || '#9EC068'}`
            : `4px solid ${colors?.border || '#ccc'}`),
      }}
      onClick={e => {
        // Prevent toggle when clicking on interactive elements
        if (
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'BUTTON' ||
          e.target.tagName === 'SELECT' ||
          e.target.tagName === 'A' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.closest(
            'button, a, select, input, textarea, [role="button"], [data-interactive]'
          )
        ) {
          return;
        }
        // Don't allow toggling for empty files or invalid small files
        if (subtitle.size === 0 || (subtitle.size < 512 && !uploadEnabled)) return;
        onToggleUpload && onToggleUpload(subtitle.fullPath, !uploadEnabled);
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ color: colors?.textSecondary || '#454545' }}
      >
        <span className="text-xl">💬</span>

        {/* Upload Toggle Checkbox */}
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={uploadEnabled}
              disabled={subtitle.size === 0 || (subtitle.size < 512 && !uploadEnabled)} // Disable checkbox for empty files and invalid small files
              onChange={e => onToggleUpload && onToggleUpload(subtitle.fullPath, e.target.checked)}
              className="w-4 h-4 rounded focus:ring-2"
              style={{
                accentColor: colors?.success || '#9EC068',
                backgroundColor: colors?.cardBackground || '#fff',
                borderColor: colors?.border || '#ccc',
                opacity: subtitle.size === 0 || (subtitle.size < 512 && !uploadEnabled) ? 0.5 : 1, // Dim disabled checkbox
              }}
            />
            <span
              className={`ml-2 text-xs font-medium transition-colors`}
              style={{
                color: uploadEnabled
                  ? colors?.success || '#9EC068'
                  : colors?.textMuted || '#808080',
              }}
            >
              {uploadEnabled ? 'Upload' : 'Skip'}
            </span>
          </label>
        </div>

        <div className="flex-1">
          <div
            className={`font-medium transition-colors flex items-center gap-2`}
            style={{
              color: uploadEnabled ? colors?.text || '#000' : colors?.textMuted || '#808080',
            }}
          >
            {subtitle.name}
            {subtitle.extractedFromMkv && (
              <span
                className="px-2 py-1 text-xs rounded font-medium"
                style={{
                  backgroundColor: colors?.success || '#9EC068',
                  color: '#fff',
                }}
                title={`Extracted from MKV: ${subtitle.originalMkvFile}`}
              >
                📹 MKV
              </span>
            )}
          </div>
          <div
            className={`text-sm flex items-center gap-4 mt-1 transition-colors`}
            style={{
              color: uploadEnabled
                ? colors?.textSecondary || '#454545'
                : colors?.textMuted || '#808080',
            }}
          >
            <span className={subtitle.size === 0 ? 'text-red-500 font-medium' : ''}>
              📏 {subtitle.size === 0 ? '0 Bytes (Empty File)' : formatFileSize(subtitle.size)}
            </span>

            {/* File Type/Kind */}
            <span className="flex items-center gap-1">
              <span>📄</span>
              <span>
                {subtitle.detectedLanguage &&
                typeof subtitle.detectedLanguage === 'object' &&
                subtitle.detectedLanguage.file_kind
                  ? subtitle.detectedLanguage.file_kind
                  : 'Subtitle File'}
              </span>
            </span>

            {/* Detected Language Status */}
            {subtitle.detectedLanguage === 'detecting' && (
              <span className="flex items-center gap-1" style={{ color: '#2878C0' }}>
                <div
                  className="w-3 h-3 border rounded-full animate-spin"
                  style={{ borderColor: '#2878C0', borderTopColor: 'transparent' }}
                ></div>
                <span>Detecting...</span>
              </span>
            )}

            {subtitle.detectedLanguage &&
              typeof subtitle.detectedLanguage === 'string' &&
              !['detecting', 'error'].includes(subtitle.detectedLanguage) && (
                <span className="flex items-center gap-1" style={{ color: '#808080' }}>
                  <span>❌</span>
                  <span>{subtitle.detectedLanguage}</span>
                </span>
              )}

            {/* Preview Button */}
            <button
              onClick={() => onSubtitlePreview(subtitle)}
              className={`text-xs underline transition-colors`}
              style={{
                color: uploadEnabled ? colors?.link || '#185DA0' : colors?.textMuted || '#808080',
              }}
              onMouseEnter={e => {
                e.target.style.color = uploadEnabled
                  ? colors?.linkHover || '#132979'
                  : colors?.textSecondary || '#454545';
              }}
              onMouseLeave={e => {
                e.target.style.color = uploadEnabled
                  ? colors?.link || '#185DA0'
                  : colors?.textMuted || '#808080';
              }}
            >
              Preview
            </button>
          </div>

          {/* Language Selection Dropdown - Only show if upload is enabled */}
          {uploadEnabled && (
            <div className="mt-2">
              <select
                value={getSubtitleLanguage(subtitle)}
                onChange={e => onSubtitleLanguageChange(subtitle.fullPath, e.target.value)}
                className="rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 min-w-[200px]"
                style={{
                  backgroundColor: isDark ? '#374151' : colors?.inputBackground || '#f4f4f4',
                  color: isDark ? '#f9fafb' : colors?.text || '#454545',
                  border: `1px solid ${colors?.border || '#ccc'}`,
                  focusRingColor: colors?.success || '#9EC068',
                }}
              >
                <option
                  value=""
                  style={{
                    backgroundColor: isDark ? '#374151' : '#fff',
                    color: isDark ? '#f9fafb' : '#454545',
                  }}
                >
                  Select upload language...
                </option>
                {getLanguageOptionsForSubtitle(subtitle).map(lang => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    style={{
                      backgroundColor: isDark ? '#374151' : '#fff',
                      color: isDark ? '#f9fafb' : '#454545',
                    }}
                  >
                    {lang.flag} {lang.displayName} ({lang.iso639?.toUpperCase()})
                    {lang.isDetected ? ` - ${(lang.confidence * 100).toFixed(1)}%` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload result status */}
          {uploadResults && uploadResults[subtitle.fullPath] && (
            <div className="mt-2">
              {(() => {
                const result = uploadResults[subtitle.fullPath];

                // Check for error responses first (anything that's not "200 OK")
                if (result.status && result.status !== '200 OK') {
                  return (
                    <div className="text-sm">
                      <span className="text-red-400">❌ Upload failed:</span>
                      <div className="text-red-300 text-xs mt-1 whitespace-pre-wrap">
                        {result.status}
                      </div>
                    </div>
                  );
                }

                // Check for successful new upload (from UploadSubtitles after alreadyindb=0)
                if (result.status === '200 OK' && result.data && !result.alreadyindb) {
                  // This is a successful new upload response
                  const isDirectUrl =
                    typeof result.data === 'string' && result.data.includes('opensubtitles.org');
                  return (
                    <div className="text-sm">
                      <span className="text-green-400">🎉 Successfully Uploaded as NEW!</span>
                      {isDirectUrl && (
                        <>
                          <span className="text-gray-400"> - </span>
                          <button
                            className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                            title="View newly uploaded subtitle on OpenSubtitles.org"
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open(result.data, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            View New Subtitle
                          </button>
                        </>
                      )}
                    </div>
                  );
                }

                // Check for alreadyindb=1 (subtitle already exists - duplicate)
                if (result.alreadyindb === 1 || result.alreadyindb === '1') {
                  // When alreadyindb=1, subtitle already exists in database (duplicate)
                  const subtitleUrl = result.data;

                  return (
                    <div className="text-sm">
                      <span className="text-yellow-400">⚠️ Already in Database</span>
                      {subtitleUrl && (
                        <>
                          <span className="text-gray-400"> - </span>
                          <button
                            className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                            title="View existing subtitle on OpenSubtitles.org"
                            onClick={async e => {
                              e.preventDefault();
                              e.stopPropagation();
                              await openExternal(subtitleUrl);
                            }}
                          >
                            View Existing Subtitle
                          </button>
                        </>
                      )}
                    </div>
                  );
                } else if (result.alreadyindb === 0 || result.alreadyindb === '0') {
                  // When alreadyindb=0, subtitle is not uploaded yet, show found existing subtitle info
                  const subtitleData = Array.isArray(result.data) ? result.data[0] : null;
                  const subtitleId = subtitleData?.IDSubtitle;

                  return (
                    <div className="text-sm">
                      <span className="text-orange-400">🔄 Found Existing</span>
                      {subtitleId && (
                        <>
                          <span className="text-gray-400"> - </span>
                          <button
                            className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                            title="View existing subtitle on OpenSubtitles.org"
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.open(
                                `https://www.opensubtitles.org/subtitles/${subtitleId}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }}
                          >
                            View Existing
                          </button>
                        </>
                      )}
                    </div>
                  );
                } else {
                  // For other cases, show generic success
                  return (
                    <div className="text-sm">
                      <span className="text-green-400">✅ Upload Complete</span>
                    </div>
                  );
                }
              })()}
            </div>
          )}

          {/* Empty file warning message */}
          {subtitle.size === 0 && (
            <div
              className="text-xs mt-2 p-2 rounded"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
            >
              <div className="font-medium">⚠️ Empty File (0 bytes)</div>
              <div className="italic">
                This subtitle file is empty and has been automatically excluded from upload.
              </div>
            </div>
          )}

          {/* Small file warning message */}
          {subtitle.size > 0 && subtitle.size < 512 && (
            <div
              className="text-xs mt-2 p-2 rounded"
              style={{
                backgroundColor: !uploadEnabled ? '#fee2e2' : '#fef3c7',
                color: !uploadEnabled ? '#dc2626' : '#d97706',
              }}
            >
              <div className="font-medium">⚠️ File Too Small ({subtitle.size} bytes)</div>
              <div className="italic">
                {!uploadEnabled
                  ? 'Files under 512 bytes require "Foreign Parts Only" to be checked in Upload Options.'
                  : 'Small file detected. If upload fails, mark as "Foreign Parts Only" in Upload Options.'}
              </div>
            </div>
          )}

          {/* Disabled state message */}
          {!uploadEnabled &&
            !uploadResults?.[subtitle.fullPath] &&
            subtitle.size > 0 &&
            subtitle.size >= 512 && (
              <div className="text-xs mt-2">
                <div className="italic" style={{ color: colors?.textMuted || '#808080' }}>
                  This subtitle will not be uploaded
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
