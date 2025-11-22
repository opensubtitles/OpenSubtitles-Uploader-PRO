import React from 'react';
import { formatFileSize } from '../utils/fileUtils.js';
import { MetadataTags } from './MetadataTags.jsx';
import { MovieDisplay } from './MovieDisplay.jsx';
import { SubtitleUploadOptions, SubtitleUploadOptionsPanel } from './SubtitleUploadOptions.jsx';
import { MovieSearch } from './MovieSearch.jsx';
import { openExternal } from '../utils/urlUtils.jsx';

export const OrphanedSubtitles = ({
  orphanedSubtitles,
  movieGuesses,
  featuresByImdbId,
  featuresLoading,
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
  uploadStates,
  onToggleUpload,
  getUploadEnabled,
  onMovieChange,
  guessItData,
  getGuessItProcessingStatus,
  getFormattedTags,
  fetchFeaturesByImdbId,
  uploadResults,
  hashCheckResults,
  uploadOptions,
  onUpdateUploadOptions,
  config,
  colors,
  isDark,
  orphanedSubtitlesFps,
  onOrphanedSubtitlesFpsChange,
  validationErrors = [], // New prop for validation errors to highlight problematic subtitles
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

  // FPS options for orphaned subtitles
  const fpsOptions = [
    { value: '', label: 'Auto-detect FPS' },
    { value: '23.976', label: '23.976 fps - NTSC Film Transfer Rate' },
    { value: '24', label: '24 fps - Cinema Standard' },
    { value: '25', label: '25 fps - PAL Television Standard' },
    { value: '29.97', label: '29.97 fps - NTSC Television Standard' },
    { value: '30', label: '30 fps - True NTSC Rate' },
    { value: '47.952', label: '47.952 fps - Double NTSC Film Rate' },
    { value: '48', label: '48 fps - High Frame Rate (HFR)' },
    { value: '50', label: '50 fps - PAL High Frame Rate' },
    { value: '59.94', label: '59.94 fps - NTSC High Frame Rate' },
    { value: '60', label: '60 fps - True High Frame Rate' },
    { value: '100', label: '100 fps - Double PAL High Frame Rate' },
    { value: '119.88', label: '119.88 fps - Double NTSC High Frame Rate' },
    { value: '120', label: '120 fps - Ultra High Frame Rate (UHFR)' },
  ];

  if (!orphanedSubtitles || orphanedSubtitles.length === 0) {
    return null;
  }

  // Helper function to check if a subtitle has validation errors
  const hasSubtitleValidationError = (subtitlePath) => {
    return validationErrors.some(error => error.subtitlePath === subtitlePath);
  };

  // Calculate master checkbox state for uploadable orphaned subtitles (excluding those that exist in database)
  const getMasterCheckboxState = React.useMemo(() => {
    if (!orphanedSubtitles || orphanedSubtitles.length === 0) {
      return { checked: false, indeterminate: false };
    }

    // Filter out orphaned subtitles that exist in database
    const uploadableSubtitles = orphanedSubtitles.filter(subtitle => {
      const hashResult = hashCheckResults?.[subtitle.fullPath];
      const exists =
        hashResult &&
        (hashResult.exists === true ||
          hashResult.found === true ||
          hashResult.status === 'exists' ||
          (hashResult.data && hashResult.data.length > 0) ||
          hashResult === 'exists');
      return !exists; // Only include subtitles that don't exist
    });

    if (uploadableSubtitles.length === 0) {
      return { checked: false, indeterminate: false };
    }

    const enabledCount = uploadableSubtitles.filter(subtitle => {
      // Access uploadStates directly instead of calling getUploadEnabled
      return uploadStates[subtitle.fullPath] !== false;
    }).length;

    if (enabledCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (enabledCount === uploadableSubtitles.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  }, [orphanedSubtitles, uploadStates, hashCheckResults]);

  // Auto-disable upload for orphaned subtitles that exist in database
  React.useEffect(() => {
    if (!hashCheckResults) return;

    Object.entries(hashCheckResults).forEach(([subtitlePath, hashResult]) => {
      // Check if this is an orphaned subtitle and it exists in database
      const isOrphaned = orphanedSubtitles.some(sub => sub.fullPath === subtitlePath);
      const exists =
        hashResult &&
        (hashResult.exists === true ||
          hashResult.found === true ||
          hashResult.status === 'exists' ||
          (hashResult.data && hashResult.data.length > 0) ||
          hashResult === 'exists');

      if (isOrphaned && exists) {
        // Automatically disable upload for orphaned subtitles that exist
        const currentUploadState = uploadStates[subtitlePath];
        if (currentUploadState !== false) {
          // Only call onToggleUpload if it's currently enabled or undefined (would default to enabled)
          onToggleUpload(subtitlePath, false);
        }
      }
    });
  }, [hashCheckResults, orphanedSubtitles, uploadStates, onToggleUpload]);

  // Handle master checkbox toggle (only affect uploadable subtitles, not those that exist)
  const handleMasterToggle = React.useCallback(
    enabled => {
      orphanedSubtitles.forEach(subtitle => {
        const hashResult = hashCheckResults?.[subtitle.fullPath];
        const exists =
          hashResult &&
          (hashResult.exists === true ||
            hashResult.found === true ||
            hashResult.status === 'exists' ||
            (hashResult.data && hashResult.data.length > 0) ||
            hashResult === 'exists');

        // Only toggle uploadable subtitles (those that don't exist in database)
        if (!exists) {
          onToggleUpload(subtitle.fullPath, enabled);
        }
      });
    },
    [orphanedSubtitles, onToggleUpload, hashCheckResults]
  );

  const masterCheckboxState = getMasterCheckboxState;

  // Movie search state
  const [openMovieSearch, setOpenMovieSearch] = React.useState(null);
  const [movieSearchQuery, setMovieSearchQuery] = React.useState('');
  const [movieSearchResults, setMovieSearchResults] = React.useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = React.useState(false);
  const [movieUpdateLoading, setMovieUpdateLoading] = React.useState({});
  const [localUploadStates, setLocalUploadStates] = React.useState({});
  const [uploadOptionsExpanded, setUploadOptionsExpanded] = React.useState({});

  // Clear search state when closing
  const closeMovieSearch = () => {
    setOpenMovieSearch(null);
    setMovieSearchQuery('');
    setMovieSearchResults([]);
  };

  // Handle opening movie search - SAME AS MATCHED PAIRS
  const handleOpenMovieSearch = React.useCallback(
    subtitlePath => {
      setOpenMovieSearch(openMovieSearch === subtitlePath ? null : subtitlePath);
    },
    [openMovieSearch]
  );

  // Handle movie search input
  const handleMovieSearch = query => {
    setMovieSearchQuery(query);
  };

  // Utility function to extract IMDB ID from various input formats
  const extractImdbId = input => {
    if (!input) return null;

    // Remove whitespace
    const trimmed = input.trim();

    // Match full IMDB URLs: https://www.imdb.com/title/tt1133589/
    const urlMatch = trimmed.match(/imdb\.com\/title\/(tt\d+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Match tt + number format: tt1133589
    const ttMatch = trimmed.match(/^(tt\d+)$/i);
    if (ttMatch) {
      return ttMatch[1];
    }

    // Match just numbers (assuming IMDB ID without tt prefix): 1133589
    const numberMatch = trimmed.match(/^(\d{7,})$/);
    if (numberMatch) {
      return `tt${numberMatch[1]}`;
    }

    return null;
  };

  // Check if input looks like an IMDB ID
  const isImdbInput = input => {
    return extractImdbId(input) !== null;
  };

  // Handle movie selection from search results - SAME AS MATCHED PAIRS
  const handleMovieSelect = async (subtitlePath, movie) => {
    // Close search interface
    closeMovieSearch();

    // Set loading state
    setMovieUpdateLoading(prev => ({ ...prev, [subtitlePath]: true }));

    try {
      // Create new movie guess object - SAME MAPPING AS MATCHED PAIRS
      const newMovieGuess = {
        imdbid: movie.id,
        title: movie.name,
        year: movie.year,
        kind: movie.kind,
        reason: 'User selected',
      };

      // Call the parent component's movie change handler
      if (onMovieChange) {
        await onMovieChange(subtitlePath, newMovieGuess);
      }

      console.log('Movie updated successfully:', newMovieGuess);
    } catch (error) {
      console.error('Error updating movie:', error);
    } finally {
      // Clear loading state
      setMovieUpdateLoading(prev => ({ ...prev, [subtitlePath]: false }));
    }
  };

  // Debounced movie search - RE-ENABLED
  React.useEffect(() => {
    if (!movieSearchQuery.trim()) {
      setMovieSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setMovieSearchLoading(true);
      try {
        const query = movieSearchQuery.trim();
        const imdbId = extractImdbId(query);

        // If it's an IMDB ID input, search using the IMDB ID directly
        if (imdbId) {
          const response = await fetch(
            `https://www.opensubtitles.org/libs/suggest_imdb.php?m=${imdbId}`
          );
          const results = await response.json();
          setMovieSearchResults(results || []);
        } else {
          // Regular text search
          const response = await fetch(
            `https://www.opensubtitles.org/libs/suggest_imdb.php?m=${encodeURIComponent(query)}`
          );
          const results = await response.json();
          setMovieSearchResults(results || []);
        }
      } catch (error) {
        console.error('Movie search error:', error);
        setMovieSearchResults([]);
      } finally {
        setMovieSearchLoading(false);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(timeoutId);
  }, [movieSearchQuery]);

  // Click outside to close movie search
  React.useEffect(() => {
    const handleClickOutside = event => {
      if (openMovieSearch && !event.target.closest('[data-movie-search]')) {
        closeMovieSearch();
      }
    };

    if (openMovieSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMovieSearch]);

  // Handle local state changes from SubtitleUploadOptions
  const handleLocalStateChange = React.useCallback((subtitlePath, localStates) => {
    setLocalUploadStates(prev => ({
      ...prev,
      [subtitlePath]: localStates,
    }));
  }, []);

  // Handle upload options expansion toggle
  const handleUploadOptionsToggle = React.useCallback(subtitlePath => {
    setUploadOptionsExpanded(prev => ({
      ...prev,
      [subtitlePath]: !prev[subtitlePath],
    }));
  }, []);

  // DISABLED: Simplified movie guesses - no enhancement to prevent setState issues
  // const enhancedMovieGuesses = React.useMemo(() => {
  //   return movieGuesses || {};
  // }, [movieGuesses]);

  return (
    <div
      className="rounded-lg p-4 mb-6 shadow-sm"
      style={{
        backgroundColor: themeColors.cardBackground,
        border: `1px solid ${themeColors.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2" style={{ color: themeColors.text }}>
          <span>📝</span>
          <span>Orphaned Subtitles ({orphanedSubtitles.length})</span>
          <span
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: themeColors.warning + '20',
              color: themeColors.warning,
            }}
          >
            No matching video file
          </span>
        </h3>

        {/* Master checkbox for all orphaned subtitles */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={masterCheckboxState.checked}
            ref={input => {
              if (input) input.indeterminate = masterCheckboxState.indeterminate;
            }}
            onChange={e => handleMasterToggle(e.target.checked)}
            className="rounded"
            style={{
              accentColor: themeColors.link,
            }}
          />
          <span className="text-sm font-medium" style={{ color: themeColors.text }}>
            {masterCheckboxState.indeterminate
              ? 'Partial'
              : masterCheckboxState.checked
                ? 'All Selected'
                : 'None Selected'}
          </span>
        </label>
      </div>

      <div className="space-y-4">
        {orphanedSubtitles.map(subtitle => {
          const movieData = movieGuesses?.[subtitle.fullPath];
          const subtitleName = subtitle.name || subtitle.fullPath.split('/').pop();
          // DISABLED: Episode data to prevent setState issues
          // const guessItEpisodeData = guessItData?.[subtitle.fullPath];

          // Get upload enabled status directly from uploadStates (no useMemo needed)
          const isUploadEnabled = uploadStates[subtitle.fullPath] !== false;

          // DEBUG: Log checkbox state for this subtitle
          console.log(`🔍 OrphanedSubtitles checkbox state for ${subtitle.name}:`);
          console.log(
            `   - uploadStates[${subtitle.fullPath}] = ${uploadStates[subtitle.fullPath]}`
          );
          console.log(`   - isUploadEnabled = ${isUploadEnabled}`);

          // Debug logging causes setState during render - removed

          return (
            <div
              key={subtitle.fullPath}
              className="rounded-lg p-4 shadow-sm"
              style={{
                backgroundColor: themeColors.cardBackground,
                border: `1px solid ${themeColors.border}`,
              }}
            >
              <div className="space-y-3">
                {/* "Video" File Section (showing subtitle file info) */}
                <div>
                  <div
                    className="font-medium flex items-center gap-2"
                    style={{ color: themeColors.text }}
                  >
                    <span>{subtitleName}</span>
                    {subtitle.extractedFromMkv && (
                      <span
                        className="px-2 py-1 text-xs rounded font-medium"
                        style={{
                          backgroundColor: themeColors.success || '#9EC068',
                          color: '#fff',
                        }}
                        title={`Extracted from MKV: ${subtitle.originalMkvFile}`}
                      >
                        📹 MKV
                      </span>
                    )}
                    <span
                      className="text-xs px-2 py-1 rounded ml-2"
                      style={{
                        backgroundColor: themeColors.warning + '20',
                        color: themeColors.warning,
                      }}
                    >
                      Orphaned Subtitle
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: themeColors.textSecondary }}>
                    {(() => {
                      const fullPath = subtitle.fullPath;
                      const pathParts = fullPath.split('/');
                      const directoryParts = pathParts.slice(0, -1);

                      // Remove duplicate adjacent directories
                      if (
                        directoryParts.length >= 2 &&
                        directoryParts[directoryParts.length - 1] ===
                          directoryParts[directoryParts.length - 2]
                      ) {
                        directoryParts.pop();
                      }

                      const directoryPath =
                        directoryParts.length > 0 ? '/' + directoryParts.join('/') : '';
                      const hasDirectory = directoryPath.length > 0;

                      return (
                        <>
                          {hasDirectory && <span>{directoryPath} • </span>}
                          <span>{formatFileSize(subtitle.size)}</span>
                          <span> • Subtitle File • No matching video</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* GuessIt Metadata Tags - Temporarily disabled for testing */}
                {/*
                <MetadataTags
                  guessItData={guessItData}
                  filePath={subtitle.fullPath}
                  getGuessItProcessingStatus={getGuessItProcessingStatus}
                  getFormattedTags={getFormattedTags}
                  colors={themeColors}
                  isDark={isDark}
                />
                */}

                {/* Movie Display Component - BASIC version without episode detection */}
                <MovieDisplay
                  videoPath={subtitle.fullPath}
                  movieGuesses={movieGuesses || {}}
                  featuresByImdbId={featuresByImdbId || {}}
                  featuresLoading={featuresLoading || {}}
                  guessItData={guessItData}
                  movieUpdateLoading={movieUpdateLoading}
                  onOpenMovieSearch={handleOpenMovieSearch}
                  fetchFeaturesByImdbId={fetchFeaturesByImdbId}
                  associatedSubtitles={[subtitle.fullPath]}
                  getUploadEnabled={getUploadEnabled}
                  onToggleUpload={onToggleUpload}
                  colors={themeColors}
                  isDark={isDark}
                  hideSelectAllCheckbox={true}
                  isOrphanedSubtitle={true}
                  orphanedSubtitlesFps={orphanedSubtitlesFps}
                  onOrphanedSubtitlesFpsChange={onOrphanedSubtitlesFpsChange}
                />

                {/* Movie Search Component - Reusable */}
                <MovieSearch
                  isOpen={openMovieSearch === subtitle.fullPath}
                  onMovieChange={onMovieChange}
                  onClose={closeMovieSearch}
                  itemPath={subtitle.fullPath}
                  movieUpdateLoading={movieUpdateLoading}
                  themeColors={themeColors}
                  isDark={isDark}
                />

                {/* Subtitle Section - reusing same structure as MatchedPairs */}
                <div className="ml-8 space-y-2">
                  {(() => {
                    const subtitleElementId = `subtitle-${subtitle.fullPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
                    const hasError = hasSubtitleValidationError(subtitle.fullPath);

                    return (
                  <div
                    id={subtitleElementId}
                    className={`rounded p-3 border transition-all cursor-pointer shadow-sm ${
                      isUploadEnabled ? 'hover:shadow-md' : 'opacity-75 hover:opacity-90'
                    } ${hasError ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                    style={{
                      backgroundColor: hasError
                        ? (isDark ? '#3a1a1a' : '#fef2f2')
                        : themeColors.cardBackground,
                      borderColor: hasError
                        ? '#ef4444'
                        : (isUploadEnabled
                          ? isDark
                            ? '#4a6741'
                            : '#d4edda'
                          : themeColors.border),
                      borderLeft: hasError
                        ? '4px solid #ef4444'
                        : (isUploadEnabled
                          ? `3px solid ${themeColors.success}`
                          : `3px solid ${themeColors.border}`),
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
                      onToggleUpload(subtitle.fullPath, !isUploadEnabled);
                    }}
                  >
                    <div className="space-y-2">
                      {/* Line 1: Filename and upload checkbox */}
                      <div
                        className={`flex items-center justify-between gap-2 transition-colors`}
                        style={{
                          color: isUploadEnabled ? themeColors.text : themeColors.textMuted,
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-base font-medium">{subtitleName}</span>
                          {subtitle.extractedFromMkv && (
                            <span
                              className="px-2 py-1 text-xs rounded font-medium"
                              style={{
                                backgroundColor: themeColors.success || '#9EC068',
                                color: '#fff',
                              }}
                              title={`Extracted from MKV: ${subtitle.originalMkvFile}`}
                            >
                              📹 MKV
                            </span>
                          )}
                          {/* Upload option badges */}
                          <div className="flex gap-1">
                            {(uploadOptions?.[subtitle.fullPath]?.hearingimpaired === '1' ||
                              localUploadStates?.[subtitle.fullPath]?.localHearingImpairedValue ===
                                '1') && (
                              <span
                                className="text-xs px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: themeColors.info + '20',
                                  color: themeColors.info,
                                }}
                              >
                                🦻 HI
                              </span>
                            )}
                            {(uploadOptions?.[subtitle.fullPath]?.highdefinition === '1' ||
                              localUploadStates?.[subtitle.fullPath]?.localHdValue === '1') && (
                              <span
                                className="text-xs px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: themeColors.success + '20',
                                  color: themeColors.success,
                                }}
                              >
                                📺 HD
                              </span>
                            )}
                            {(uploadOptions?.[subtitle.fullPath]?.automatictranslation === '1' ||
                              localUploadStates?.[subtitle.fullPath]?.localAutoTranslationValue ===
                                '1') && (
                              <span
                                className="text-xs px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: themeColors.warning + '20',
                                  color: themeColors.warning,
                                }}
                              >
                                🤖 Auto
                              </span>
                            )}
                            {(uploadOptions?.[subtitle.fullPath]?.foreignpartsonly === '1' ||
                              localUploadStates?.[subtitle.fullPath]?.localForeignPartsValue ===
                                '1') && (
                              <span
                                className="text-xs px-1 py-0.5 rounded"
                                style={{
                                  backgroundColor: themeColors.link + '20',
                                  color: themeColors.link,
                                }}
                              >
                                🎭 Foreign
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Upload Toggle Checkbox - Moved to right side */}
                        <div className="flex items-center">
                          {(() => {
                            const hashResult = hashCheckResults?.[subtitle.fullPath];
                            const subtitleExists =
                              hashResult &&
                              (hashResult.exists === true ||
                                hashResult.found === true ||
                                hashResult.status === 'exists' ||
                                (hashResult.data && hashResult.data.length > 0) ||
                                hashResult === 'exists');

                            return (
                              <label
                                className={`flex items-center group ${subtitleExists ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isUploadEnabled}
                                  onChange={e => {
                                    if (!subtitleExists) {
                                      onToggleUpload(subtitle.fullPath, e.target.checked);
                                    }
                                  }}
                                  disabled={subtitleExists}
                                  className="w-4 h-4 rounded focus:ring-2"
                                  style={{
                                    accentColor: subtitleExists
                                      ? themeColors.textMuted
                                      : themeColors.success,
                                    backgroundColor: themeColors.cardBackground,
                                    borderColor: themeColors.border,
                                    opacity: subtitleExists ? 0.5 : 1,
                                  }}
                                />
                                <span
                                  className={`ml-1 text-xs font-medium transition-colors`}
                                  style={{
                                    color: subtitleExists
                                      ? themeColors.textMuted
                                      : isUploadEnabled
                                        ? themeColors.success
                                        : themeColors.textMuted,
                                    opacity: subtitleExists ? 0.5 : 1,
                                  }}
                                >
                                  {subtitleExists ? 'Exists' : isUploadEnabled ? 'Upload' : 'Skip'}
                                </span>
                              </label>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Line 2: Compact layout - Upload Options, Language dropdown, file info, and preview */}
                      {isUploadEnabled && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {/* Upload Options - First position */}
                          <div className="flex-shrink-0">
                            <SubtitleUploadOptions
                              subtitlePath={subtitle.fullPath}
                              uploadOptions={uploadOptions?.[subtitle.fullPath] || {}}
                              onUpdateOptions={onUpdateUploadOptions}
                              colors={themeColors}
                              isDark={isDark}
                              subtitleFile={subtitle}
                              onLocalStateChange={handleLocalStateChange}
                              compactMode={true}
                              isExpanded={
                                uploadOptionsExpanded[subtitle.fullPath] ??
                                config?.uploadOptionsExpanded ??
                                false
                              }
                              onToggleExpanded={() => handleUploadOptionsToggle(subtitle.fullPath)}
                              hashCheckResults={hashCheckResults}
                              config={config}
                            />
                          </div>

                          {/* Language Dropdown - Second position */}
                          <div className="relative flex-shrink-0" data-dropdown={subtitle.fullPath}>
                            <button
                              onClick={() => onToggleDropdown(subtitle.fullPath)}
                              className="rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 min-w-[180px] flex items-center justify-between min-h-[28px]"
                              style={{
                                backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                                color: themeColors.text,
                                border: `1px solid ${themeColors.border}`,
                              }}
                              onFocus={e => {
                                e.target.style.boxShadow = `0 0 0 1px ${themeColors.success}`;
                              }}
                              onBlur={e => {
                                e.target.style.boxShadow = 'none';
                              }}
                            >
                              <span>
                                {getSubtitleLanguage(subtitle) &&
                                combinedLanguages[getSubtitleLanguage(subtitle)]
                                  ? `${combinedLanguages[getSubtitleLanguage(subtitle)].flag} ${combinedLanguages[getSubtitleLanguage(subtitle)].displayName} (${combinedLanguages[getSubtitleLanguage(subtitle)].iso639?.toUpperCase()})`
                                  : 'Select upload language...'}
                              </span>
                              <span className="ml-2">▼</span>
                            </button>

                            {openDropdowns[subtitle.fullPath] && (
                              <div
                                className="absolute top-full left-0 mt-1 rounded shadow-lg z-10 min-w-[250px] max-h-60 overflow-hidden"
                                style={{
                                  backgroundColor: themeColors.cardBackground,
                                  border: `1px solid ${themeColors.border}`,
                                }}
                              >
                                {/* Search input */}
                                <div
                                  className="p-2"
                                  style={{ borderBottom: `1px solid ${themeColors.border}` }}
                                >
                                  <input
                                    type="text"
                                    placeholder="Type to search languages..."
                                    value={dropdownSearch[subtitle.fullPath] || ''}
                                    onChange={e =>
                                      onDropdownSearch(subtitle.fullPath, e.target.value)
                                    }
                                    className="w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1"
                                    style={{
                                      backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                                      color: themeColors.text,
                                      border: `1px solid ${themeColors.border}`,
                                    }}
                                    onFocus={e => {
                                      e.target.style.boxShadow = `0 0 0 1px ${themeColors.success}`;
                                    }}
                                    onBlur={e => {
                                      e.target.style.boxShadow = 'none';
                                    }}
                                    autoFocus
                                  />
                                </div>

                                {/* Language options */}
                                <div className="max-h-48 overflow-y-auto">
                                  {getLanguageOptionsForSubtitle(subtitle)
                                    .filter(lang => {
                                      const searchTerm = dropdownSearch[subtitle.fullPath] || '';
                                      if (!searchTerm) return true;
                                      return (
                                        lang.displayName
                                          .toLowerCase()
                                          .includes(searchTerm.toLowerCase()) ||
                                        lang.iso639
                                          ?.toLowerCase()
                                          .includes(searchTerm.toLowerCase())
                                      );
                                    })
                                    .map(lang => (
                                      <button
                                        key={lang.code}
                                        onClick={() =>
                                          onSubtitleLanguageChange(subtitle.fullPath, lang.code)
                                        }
                                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                        style={{ backgroundColor: 'transparent' }}
                                        onMouseEnter={e =>
                                          (e.target.style.backgroundColor = isDark
                                            ? '#444444'
                                            : '#f8f9fa')
                                        }
                                        onMouseLeave={e =>
                                          (e.target.style.backgroundColor = 'transparent')
                                        }
                                      >
                                        <span>{lang.flag}</span>
                                        <span style={{ color: themeColors.text }}>
                                          {lang.displayName}
                                        </span>
                                        <span style={{ color: themeColors.textSecondary }}>
                                          ({lang.iso639?.toUpperCase()})
                                        </span>
                                        {lang.isDetected && (
                                          <span
                                            className="ml-auto font-semibold"
                                            style={{ color: themeColors.success }}
                                          >
                                            {(lang.confidence * 100).toFixed(1)}%
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* File Info */}
                          <div
                            className={`flex items-center gap-2 text-sm transition-colors`}
                            style={{
                              color: isUploadEnabled
                                ? themeColors.textSecondary
                                : themeColors.textMuted,
                            }}
                          >
                            <span>{formatFileSize(subtitle.size)}</span>
                            <span>•</span>
                            <span>
                              {subtitle.detectedLanguage &&
                              typeof subtitle.detectedLanguage === 'object' &&
                              subtitle.detectedLanguage.file_kind
                                ? subtitle.detectedLanguage.file_kind
                                : 'Subtitle File'}
                            </span>
                            <span>•</span>
                            <span style={{ color: themeColors.warning }}>No matching video</span>
                          </div>

                          {/* Preview Button */}
                          <button
                            onClick={() => onSubtitlePreview(subtitle)}
                            className="text-sm underline transition-colors px-2 py-1 rounded"
                            style={{
                              color: isUploadEnabled ? themeColors.link : themeColors.textMuted,
                            }}
                            onMouseEnter={e => {
                              e.target.style.color = isUploadEnabled
                                ? themeColors.linkHover
                                : themeColors.textSecondary;
                            }}
                            onMouseLeave={e => {
                              e.target.style.color = isUploadEnabled
                                ? themeColors.link
                                : themeColors.textMuted;
                            }}
                          >
                            Preview
                          </button>
                        </div>
                      )}

                      {/* Upload Options Expanded Panel - Below the compact line */}
                      {isUploadEnabled &&
                        (uploadOptionsExpanded[subtitle.fullPath] ??
                          config?.uploadOptionsExpanded ??
                          false) && (
                          <SubtitleUploadOptionsPanel
                            subtitlePath={subtitle.fullPath}
                            uploadOptions={uploadOptions?.[subtitle.fullPath] || {}}
                            onUpdateOptions={onUpdateUploadOptions}
                            colors={themeColors}
                            isDark={isDark}
                            subtitleFile={subtitle}
                            onLocalStateChange={handleLocalStateChange}
                            hashCheckResults={hashCheckResults}
                            config={config}
                          />
                        )}

                      {/* CheckSubHash note - Completely separate line */}
                      {(() => {
                        const hashResult = hashCheckResults?.[subtitle.fullPath];

                        const shouldShow =
                          hashResult &&
                          (hashResult.exists === true ||
                            hashResult.found === true ||
                            hashResult.status === 'exists' ||
                            (hashResult.data && hashResult.data.length > 0) ||
                            hashResult === 'exists');

                        if (shouldShow) {
                          // Extract subtitle URL from CheckSubHash result
                          let subtitleUrl = null;

                          if (hashResult.subtitleUrl) {
                            subtitleUrl = hashResult.subtitleUrl;
                          } else if (hashResult.url) {
                            subtitleUrl = hashResult.url;
                          } else if (hashResult.link) {
                            subtitleUrl = hashResult.link;
                          } else if (hashResult.subtitleId) {
                            subtitleUrl = `https://www.opensubtitles.org/search/idsubtitlefile-${hashResult.subtitleId}`;
                          }

                          return (
                            <div className="mt-2 text-xs" style={{ color: themeColors.textMuted }}>
                              ✅ Subtitle already exists in database.{' '}
                              {subtitleUrl ? (
                                <a
                                  href={subtitleUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                  style={{ color: themeColors.link }}
                                  onMouseEnter={e => {
                                    e.target.style.color = themeColors.linkHover;
                                  }}
                                  onMouseLeave={e => {
                                    e.target.style.color = themeColors.link;
                                  }}
                                >
                                  View existing subtitle
                                </a>
                              ) : (
                                <span style={{ color: themeColors.textMuted }}>
                                  (No direct link available)
                                </span>
                              )}
                              <div
                                className="mt-1"
                                style={{ color: themeColors.textMuted, fontSize: '11px' }}
                              >
                                Upload automatically disabled - no additional metadata to contribute
                                without video file.
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Upload result status */}
                      {uploadResults[subtitle.fullPath] && (
                        <div className="mt-1">
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

                            // Reusing same upload result logic as MatchedPairs
                            if (result.status === '200 OK' && result.data && !result.alreadyindb) {
                              const isDirectUrl =
                                typeof result.data === 'string' &&
                                result.data.includes('opensubtitles.org');
                              return (
                                <div className="text-sm">
                                  <span className="text-green-400">
                                    🎉 Successfully Uploaded as NEW!
                                  </span>
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
                            } else if (result.alreadyindb === 1 || result.alreadyindb === '1') {
                              const subtitleData = result.data;
                              let subtitleId;

                              if (typeof subtitleData === 'string') {
                                subtitleId = subtitleData;
                              } else if (
                                typeof subtitleData === 'object' &&
                                subtitleData?.IDSubtitle
                              ) {
                                subtitleId = subtitleData.IDSubtitle;
                              }

                              const subtitleUrl = subtitleId
                                ? `https://www.opensubtitles.org/subtitles/${subtitleId}`
                                : null;

                              return (
                                <div className="text-sm">
                                  <span className="text-yellow-400">⚠️ Already in Database</span>
                                  {subtitleUrl && (
                                    <>
                                      <span className="text-gray-400"> - </span>
                                      <button
                                        className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                        title={`View existing subtitle on OpenSubtitles.org (ID: ${subtitleId})`}
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
                            } else if (result.status === '200 OK') {
                              const subtitleId =
                                typeof result.data === 'object'
                                  ? result.data?.IDSubtitle
                                  : result.data;
                              const subtitleUrl = subtitleId
                                ? `https://www.opensubtitles.org/subtitles/${subtitleId}`
                                : null;
                              return (
                                <div className="text-sm">
                                  <span className="text-green-400">🎉 Upload completed</span>
                                  {subtitleUrl && (
                                    <>
                                      <span className="text-gray-400"> - </span>
                                      <button
                                        className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                        title={`View subtitle on OpenSubtitles.org (ID: ${subtitleId})`}
                                        onClick={async e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          await openExternal(subtitleUrl);
                                        }}
                                      >
                                        View on OpenSubtitles.org
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-red-400 text-sm">
                                  ❌ Upload failed: {result.status || 'Unknown error'}
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}

                      {/* Disabled state message */}
                      {!isUploadEnabled && !uploadResults[subtitle.fullPath] && (
                        <div className="text-xs">
                          <div className="italic" style={{ color: themeColors.textMuted }}>
                            This subtitle will not be uploaded
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
