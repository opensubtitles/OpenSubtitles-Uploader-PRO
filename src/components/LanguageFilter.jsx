import React, { useMemo } from 'react';

export const LanguageFilter = ({
  files,
  selectedLanguages,
  onLanguageToggle,
  getSubtitleLanguage,
  combinedLanguages,
  colors,
  isDark
}) => {
  // Group subtitles by current language (manual selection or detected)
  const languageStats = useMemo(() => {
    const stats = new Map();

    files.forEach(file => {
      if (file.isSubtitle) {
        // Get current language (manually selected or auto-detected)
        const langCode = getSubtitleLanguage(file);
        if (!langCode) return; // Skip if no language

        // Get language name from combined languages
        const langInfo = combinedLanguages[langCode.toLowerCase()];
        const langName = langInfo?.name || langInfo?.languageName || langCode.toUpperCase();

        if (!stats.has(langCode)) {
          stats.set(langCode, {
            code: langCode,
            name: langName,
            count: 0,
            files: []
          });
        }

        const entry = stats.get(langCode);
        entry.count++;
        entry.files.push(file.fullPath);
      }
    });

    // Sort by count (descending)
    return Array.from(stats.values()).sort((a, b) => b.count - a.count);
  }, [files, getSubtitleLanguage, combinedLanguages]);

  if (languageStats.length === 0) {
    return null;
  }

  const themeColors = colors || {
    cardBackground: '#fff',
    border: '#e2e8f0',
    text: '#000',
    textSecondary: '#454545',
    success: '#9EC068',
  };

  return (
    <div
      className="rounded-lg p-6 mb-6 mt-6"
      style={{
        backgroundColor: themeColors.cardBackground,
        border: `1px solid ${themeColors.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-lg font-semibold"
          style={{ color: themeColors.text }}
        >
          📝 Filter by Language
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Select all languages
              const allLangs = new Set(languageStats.map(l => l.code));
              onLanguageToggle(allLangs);
            }}
            className="text-sm px-3 py-1 rounded transition-colors"
            style={{
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              color: themeColors.text,
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = isDark ? '#4b5563' : '#e5e7eb';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = isDark ? '#374151' : '#f3f4f6';
            }}
          >
            Select All
          </button>
          <button
            onClick={() => {
              // Deselect all languages
              onLanguageToggle(new Set());
            }}
            className="text-sm px-3 py-1 rounded transition-colors"
            style={{
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
              color: themeColors.text,
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = isDark ? '#4b5563' : '#e5e7eb';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = isDark ? '#374151' : '#f3f4f6';
            }}
          >
            Deselect All
          </button>
        </div>
      </div>

      <div
        className="text-sm mb-3"
        style={{ color: themeColors.textSecondary }}
      >
        Select which languages to upload. Unchecked languages will be skipped.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {languageStats.map(lang => {
          const isSelected = selectedLanguages.has(lang.code);

          return (
            <label
              key={lang.code}
              className="flex items-center gap-2 p-3 rounded cursor-pointer transition-all"
              style={{
                backgroundColor: isSelected
                  ? (isDark ? '#1f2937' : '#f0fdf4')
                  : (isDark ? '#111827' : '#f9fafb'),
                border: `2px solid ${isSelected ? themeColors.success : themeColors.border}`,
                opacity: isSelected ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.opacity = '0.6';
                }
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  const newSelected = new Set(selectedLanguages);
                  if (isSelected) {
                    newSelected.delete(lang.code);
                  } else {
                    newSelected.add(lang.code);
                  }
                  onLanguageToggle(newSelected);
                }}
                className="w-4 h-4"
                style={{
                  accentColor: themeColors.success,
                }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="font-medium truncate"
                  style={{ color: themeColors.text }}
                  title={lang.name}
                >
                  {lang.name}
                </div>
                <div
                  className="text-xs"
                  style={{ color: themeColors.textSecondary }}
                >
                  {lang.count} {lang.count === 1 ? 'subtitle' : 'subtitles'}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
