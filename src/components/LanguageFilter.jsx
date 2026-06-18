import React, { useMemo } from 'react';

export const LanguageFilter = ({
  files,
  selectedLanguages,
  onLanguageToggle,
  getSubtitleLanguage,
  combinedLanguages,
  // Per-subtitle upload state — lets the filter reflect changes the user
  // makes on individual track checkboxes (forum post #54986 item 4: cascade
  // was one-way, this makes it bidirectional).
  getUploadEnabled,
  onToggleUpload,
  colors,
  isDark
}) => {
  // Group subtitles by current language (manual selection or detected).
  // Each language entry also tracks how many of its subs are currently
  // enabled for upload, so the checkbox can render checked / indeterminate
  // / unchecked off real state instead of the language-only Set.
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
            enabledCount: 0,
            files: []
          });
        }

        const entry = stats.get(langCode);
        entry.count++;
        entry.files.push(file.fullPath);
        if (getUploadEnabled?.(file.fullPath)) {
          entry.enabledCount++;
        }
      }
    });

    // Sort by count (descending)
    const sorted = Array.from(stats.values()).sort((a, b) => b.count - a.count);

    // Debug logging
    console.log('📊 LanguageFilter: Language statistics', {
      totalLanguages: sorted.length,
      totalSubtitles: sorted.reduce((sum, lang) => sum + lang.count, 0),
      languages: sorted.map(lang => ({
        code: lang.code,
        name: lang.name,
        count: lang.count,
      })),
    });

    return sorted;
  }, [files, getSubtitleLanguage, combinedLanguages, getUploadEnabled]);

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
              // Select all languages + enable every subtitle so the file list
              // matches what the filter advertises.
              const allLangs = new Set(languageStats.map(l => l.code));
              onLanguageToggle(allLangs);
              if (typeof onToggleUpload === 'function') {
                for (const lang of languageStats) {
                  for (const fullPath of lang.files) {
                    onToggleUpload(fullPath, true);
                  }
                }
              }
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
              // Deselect all languages + disable every subtitle so the file
              // list matches what the filter advertises.
              onLanguageToggle(new Set());
              if (typeof onToggleUpload === 'function') {
                for (const lang of languageStats) {
                  for (const fullPath of lang.files) {
                    onToggleUpload(fullPath, false);
                  }
                }
              }
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
          // Bidirectional state — the language tile reflects the union of:
          //  (a) language-level filter set (selectedLanguages), and
          //  (b) per-subtitle upload toggles (getUploadEnabled).
          // If the caller wired getUploadEnabled, we compute the effective
          // state from real per-sub flags so unchecking individual tracks
          // is mirrored here. Otherwise we fall back to the legacy Set.
          const hasPerSubState =
            typeof getUploadEnabled === 'function' && lang.count > 0;
          const allEnabled = hasPerSubState
            ? lang.enabledCount === lang.count
            : selectedLanguages.has(lang.code);
          const someEnabled = hasPerSubState
            ? lang.enabledCount > 0 && lang.enabledCount < lang.count
            : false;
          const isSelected = allEnabled;

          return (
            <label
              key={lang.code}
              className="flex items-center gap-2 p-3 rounded cursor-pointer transition-all"
              style={{
                backgroundColor: isSelected
                  ? (isDark ? '#1f2937' : '#f0fdf4')
                  : (isDark ? '#111827' : '#f9fafb'),
                border: `2px solid ${isSelected ? themeColors.success : themeColors.border}`,
                opacity: isSelected || someEnabled ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (!isSelected && !someEnabled) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected && !someEnabled) {
                  e.currentTarget.style.opacity = '0.6';
                }
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                ref={el => {
                  if (el) el.indeterminate = someEnabled && !isSelected;
                }}
                onChange={() => {
                  const newChecked = !(isSelected || someEnabled);
                  const newSelected = new Set(selectedLanguages);
                  if (newChecked) {
                    newSelected.add(lang.code);
                  } else {
                    newSelected.delete(lang.code);
                  }
                  console.log(
                    `${newChecked ? '✅' : '🔲'} LanguageFilter: ${newChecked ? 'Checked' : 'Unchecked'} ` +
                      `"${lang.name}" (${lang.code}) - ${lang.count} subtitles affected`
                  );
                  onLanguageToggle(newSelected);
                  // Cascade to per-subtitle toggles so the file list rows
                  // and this filter never drift out of sync (forum #54986).
                  if (typeof onToggleUpload === 'function') {
                    for (const fullPath of lang.files) {
                      onToggleUpload(fullPath, newChecked);
                    }
                  }
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
                  {hasPerSubState && lang.enabledCount !== lang.count
                    ? `${lang.enabledCount} of ${lang.count} ${lang.count === 1 ? 'subtitle' : 'subtitles'}`
                    : `${lang.count} ${lang.count === 1 ? 'subtitle' : 'subtitles'}`}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};
