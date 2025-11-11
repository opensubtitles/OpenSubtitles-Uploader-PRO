import React from 'react';
import { GuessItService } from '../services/guessItService.js';

export const MetadataTags = ({
  guessItData,
  filePath,
  getGuessItProcessingStatus,
  getFormattedTags,
  compact = false, // Optional prop for compact display
  isDark = false, // Add isDark prop
  video = null, // Add video prop for MKV extraction status
}) => {
  const status = getGuessItProcessingStatus(filePath);
  const tags = getFormattedTags(filePath);

  // Show loading state
  if (status.isProcessing || guessItData[filePath] === 'processing') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <div
          className="w-3 h-3 border rounded-full animate-spin"
          style={{ borderColor: '#2878C0', borderTopColor: 'transparent' }}
        ></div>
        <span className="text-xs" style={{ color: '#2878C0' }}>
          Extracting metadata...
        </span>
      </div>
    );
  }

  // Show error state
  if (status.hasFailed || guessItData[filePath] === 'error') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: '#808080' }}>
          ❌ Metadata extraction failed
        </span>
      </div>
    );
  }

  // Show no data state
  if (guessItData[filePath] === 'no-data') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: '#2878C0' }}>
          ⚠️ No metadata available
        </span>
      </div>
    );
  }

  // Helper function to create MKV extraction badge
  const createMkvExtractionBadge = () => {
    if (!video?.hasMkvSubtitleExtraction) return null;

    const status = video.mkvExtractionStatus;
    let badgeContent = null;

    switch (status) {
      case 'pending':
        badgeContent = {
          label: 'MKV',
          value: 'Pending',
          backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#fef3c7',
          color: isDark ? '#fbbf24' : '#d97706',
          borderColor: isDark ? '#f59e0b' : '#f59e0b',
        };
        break;
      case 'detecting':
        badgeContent = {
          label: 'MKV',
          value: 'Detecting...',
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
          color: isDark ? '#60a5fa' : '#2563eb',
          borderColor: isDark ? '#3b82f6' : '#3b82f6',
        };
        break;
      case 'extracting_all':
        badgeContent = {
          label: 'MKV',
          value: `Extracting ${video.extractedCount || 0}/${video.streamCount || 0}`,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
          color: isDark ? '#60a5fa' : '#2563eb',
          borderColor: isDark ? '#3b82f6' : '#3b82f6',
        };
        break;
      case 'completed':
        badgeContent = {
          label: 'MKV',
          value: `✓ ${video.extractedCount || 0}/${video.streamCount || 0} Extracted`,
          backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
          color: isDark ? '#4ade80' : '#16a34a',
          borderColor: isDark ? '#22c55e' : '#22c55e',
        };
        break;
      case 'no_streams':
      case 'no_subtitles':
        badgeContent = {
          label: 'MKV',
          value: 'No Subtitles',
          backgroundColor: isDark ? 'rgba(107, 114, 128, 0.2)' : '#f3f4f6',
          color: isDark ? '#9ca3af' : '#6b7280',
          borderColor: isDark ? '#6b7280' : '#9ca3af',
        };
        break;
      case 'error':
        badgeContent = {
          label: 'MKV',
          value: 'Error',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2',
          color: isDark ? '#f87171' : '#dc2626',
          borderColor: isDark ? '#ef4444' : '#ef4444',
        };
        break;
      default:
        return null;
    }

    return (
      <span
        key="mkv-extraction"
        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border transition-all hover:scale-105"
        style={{
          backgroundColor: badgeContent.backgroundColor,
          color: badgeContent.color,
          borderColor: badgeContent.borderColor,
        }}
        title={`MKV Subtitle Extraction: ${badgeContent.value}`}
      >
        <span className="font-semibold">{badgeContent.label}:</span>
        <span className="ml-1 truncate max-w-32">{badgeContent.value}</span>
      </span>
    );
  };

  // Show tags if we have data
  if (tags.length > 0) {
    // Filter out title and year for compact mode (already shown elsewhere)
    const displayTags = compact ? tags.filter(tag => !['title', 'year'].includes(tag.key)) : tags;

    // Limit number of tags in compact mode
    const finalTags = compact && displayTags.length > 8 ? displayTags.slice(0, 8) : displayTags;

    return (
      <div className="mt-2">
        <div className="flex flex-wrap gap-1">
          {/* Add MKV extraction badge first if available */}
          {createMkvExtractionBadge()}
          {finalTags.map(tag => {
            const tagStyles = GuessItService.getTagColorStyles(tag.color, isDark);

            // Defensive fallback in case tagStyles is undefined
            const safeStyles = tagStyles || {
              backgroundColor: isDark ? 'rgba(75, 85, 99, 0.5)' : '#e5e7eb',
              color: isDark ? '#d1d5db' : '#000000',
              borderColor: isDark ? '#4b5563' : '#9ca3af',
            };

            return (
              <span
                key={tag.key}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border transition-all hover:scale-105"
                style={{
                  backgroundColor: safeStyles.backgroundColor,
                  color: safeStyles.color,
                  borderColor: safeStyles.borderColor,
                  // Force important to override any CSS conflicts
                  ...safeStyles,
                }}
                title={`${tag.label}: ${tag.value}`}
              >
                <span className="font-semibold">{tag.label}:</span>
                <span className="ml-1 truncate max-w-24">{tag.value}</span>
              </span>
            );
          })}
          {compact && displayTags.length > 8 && (
            <span
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: isDark ? 'rgba(75, 85, 99, 0.5)' : '#f9fafb',
                color: isDark ? '#d1d5db' : '#6b7280',
                borderColor: isDark ? '#4b5563' : '#d1d5db',
              }}
              title={`${displayTags.length - 8} more properties available`}
            >
              +{displayTags.length - 8} more
            </span>
          )}
        </div>
      </div>
    );
  }

  // Show MKV extraction badge even if no other tags
  const mkvBadge = createMkvExtractionBadge();
  if (mkvBadge) {
    return (
      <div className="mt-2">
        <div className="flex flex-wrap gap-1">{mkvBadge}</div>
      </div>
    );
  }

  return null;
};
