import React from 'react';

export const StatsPanel = ({
  pairedFiles,
  files,
  orphanedSubtitles = [],
  getUploadEnabled,
  colors,
  isDark,
}) => {
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
    success: '#9EC068',
    error: '#dc3545',
    warning: '#ffc107',
  };

  const successfulPairs = pairedFiles.filter(p => p.video && p.subtitles.length > 0);
  const totalMatchedSubtitles = successfulPairs.reduce((acc, p) => acc + p.subtitles.length, 0);
  const totalVideos = files.filter(f => f.isVideo).length;

  // Calculate upload statistics using the same logic as UploadButton
  // Get subtitles from paired files
  const pairedSubtitles = pairedFiles.flatMap(pair => pair.subtitles || []);

  // Combine paired and orphaned subtitles
  const allAvailableSubtitles = [...pairedSubtitles, ...orphanedSubtitles];

  // Count enabled/disabled based on available subtitles only
  const enabledSubtitles = allAvailableSubtitles.filter(subtitle =>
    getUploadEnabled(subtitle.fullPath)
  );
  const disabledSubtitles = allAvailableSubtitles.length - enabledSubtitles.length;

  // Debug logging
  console.log('📈 StatsPanel: Subtitle counts', {
    totalAvailable: allAvailableSubtitles.length,
    enabled: enabledSubtitles.length,
    disabled: disabledSubtitles,
    pairedSubtitles: pairedSubtitles.length,
    orphanedSubtitles: orphanedSubtitles.length,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <div
        className="rounded-lg p-4 text-center shadow-sm"
        style={{
          backgroundColor: themeColors.cardBackground,
          borderLeft: `4px solid ${themeColors.linkHover}`,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        <div className="text-2xl font-bold" style={{ color: themeColors.linkHover }}>
          {successfulPairs.length}
        </div>
        <div className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
          Videos with Subtitles
        </div>
      </div>

      <div
        className="rounded-lg p-4 text-center shadow-sm"
        style={{
          backgroundColor: themeColors.cardBackground,
          borderLeft: `4px solid ${themeColors.success}`,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        <div className="text-2xl font-bold" style={{ color: themeColors.success }}>
          {enabledSubtitles.length}
        </div>
        <div className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
          Ready to Upload
        </div>
      </div>

      <div
        className="rounded-lg p-4 text-center shadow-sm"
        style={{
          backgroundColor: themeColors.cardBackground,
          borderLeft: `4px solid ${themeColors.textMuted}`,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        <div className="text-2xl font-bold" style={{ color: themeColors.textMuted }}>
          {disabledSubtitles}
        </div>
        <div className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
          Skipped
        </div>
      </div>

      <div
        className="rounded-lg p-4 text-center shadow-sm"
        style={{
          backgroundColor: themeColors.cardBackground,
          borderLeft: `4px solid ${themeColors.link}`,
          border: `1px solid ${themeColors.border}`,
        }}
      >
        <div className="text-2xl font-bold" style={{ color: themeColors.link }}>
          {totalVideos}
        </div>
        <div className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
          Total Videos
        </div>
      </div>
    </div>
  );
};
