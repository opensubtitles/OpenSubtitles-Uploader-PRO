import React from 'react';
import { areTitlesSimilar, formatImdbId, getImdbUrl } from '../utils/fileUtils.js';
import { MetadataTags } from './MetadataTags.jsx';

export const MovieDisplay = ({
  videoPath,
  movieGuesses,
  featuresByImdbId,
  featuresLoading,
  guessItData,
  movieUpdateLoading,
  onOpenMovieSearch,
  fetchFeaturesByImdbId, // New prop for fetching episode-specific features
  associatedSubtitles, // Array of subtitle file paths for this movie
  getUploadEnabled, // Function to check if subtitle is enabled for upload
  onToggleUpload, // Function to toggle subtitle upload status
  colors, // Theme colors
  isDark, // Dark mode flag
  hideSelectAllCheckbox = false, // Hide the "All Selected" checkbox
  getGuessItProcessingStatus, // Function to get GuessIt processing status
  getFormattedTags, // Function to get formatted GuessIt tags
  isOrphanedSubtitle = false, // Flag to show if this is for orphaned subtitle
  orphanedSubtitlesFps = {}, // FPS settings for orphaned subtitles
  onOrphanedSubtitlesFpsChange, // Function to handle FPS changes
}) => {
  // SAFE: Separate state for enhanced episode data to avoid setState during render
  const [enhancedEpisodeData, setEnhancedEpisodeData] = React.useState(null);

  // FPS dropdown state management
  const [fpsDropdownOpen, setFpsDropdownOpen] = React.useState({});
  const [fpsSearchTerm, setFpsSearchTerm] = React.useState({});

  // FPS options for orphaned subtitles
  const fpsOptions = [
    { value: '', label: 'Select FPS' },
    { value: '23.976', label: '23.976 FPS - NTSC Film' },
    { value: '24', label: '24 FPS - Cinema' },
    { value: '25', label: '25 FPS - PAL' },
    { value: '29.97', label: '29.97 FPS - NTSC' },
    { value: '30', label: '30 FPS - True NTSC' },
    { value: '47.952', label: '47.952 FPS - Double NTSC' },
    { value: '48', label: '48 FPS - HFR' },
    { value: '50', label: '50 FPS - PAL HFR' },
    { value: '59.94', label: '59.94 FPS - NTSC HFR' },
    { value: '60', label: '60 FPS - True HFR' },
    { value: '100', label: '100 FPS - Double PAL' },
    { value: '119.88', label: '119.88 FPS - Double NTSC' },
    { value: '120', label: '120 FPS - UHFR' },
  ];

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
  // BASIC: Calculate checkbox state for all associated subtitles
  const getMovieCheckboxState = React.useMemo(() => {
    if (!associatedSubtitles || associatedSubtitles.length === 0) {
      return { checked: false, indeterminate: false };
    }

    const enabledCount = associatedSubtitles.filter(
      subtitle => getUploadEnabled && getUploadEnabled(subtitle)
    ).length;

    if (enabledCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (enabledCount === associatedSubtitles.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  }, [associatedSubtitles, getUploadEnabled]);

  // Handle movie checkbox change
  const handleMovieCheckboxChange = React.useCallback(
    checked => {
      if (!associatedSubtitles || !onToggleUpload) return;

      // Toggle all associated subtitles to the new state
      associatedSubtitles.forEach(subtitle => {
        onToggleUpload(subtitle, checked);
      });
    },
    [associatedSubtitles, onToggleUpload]
  );

  // DISABLED: Find specific episode in features data (causes setState during render)
  const findEpisodeMatch = (featuresData, guessItData) => {
    // Disabled to prevent setState during render issues
    return null;
  };

  // SAFE: Get movie data (with basic episode support, no /features processing)
  const getBestMovieData = React.useMemo(() => {
    const movieData = movieGuesses?.[videoPath];

    // If movieData already has episode info (from GuessIt processing), use it directly
    if (movieData && movieData.kind === 'episode') {
      return movieData;
    }

    // Otherwise return basic movie data
    return movieData;
  }, [movieGuesses, videoPath]);

  const movieData = movieGuesses?.[videoPath];
  const bestMovieData = getBestMovieData;
  const originalMovieData = movieData;

  // SAFE: Handle episode data properly (prefer enhanced data if available)
  const finalMovieData = enhancedEpisodeData || getBestMovieData;
  const featuresData = originalMovieData?.imdbid
    ? featuresByImdbId?.[originalMovieData.imdbid]
    : null;

  // SAFE: Get episode-specific features data if available
  const episodeFeaturesData =
    finalMovieData?.kind === 'episode' && finalMovieData.imdbid
      ? featuresByImdbId?.[finalMovieData.imdbid]
      : null;

  // SAFE: useEffect for episode-specific features fetching (avoids setState during render)
  React.useEffect(() => {
    // Only fetch episode features if we have episode data and IMDb ID
    if (finalMovieData?.kind === 'episode' && finalMovieData.imdbid && fetchFeaturesByImdbId) {
      // Check if we already have episode features data
      if (!featuresByImdbId[finalMovieData.imdbid]) {
        console.log(
          `Fetching episode features for IMDb ID: ${formatImdbId(finalMovieData.imdbid)}`
        );
        fetchFeaturesByImdbId(finalMovieData.imdbid);
      }
    }
  }, [finalMovieData?.imdbid, finalMovieData?.kind, fetchFeaturesByImdbId, featuresByImdbId]);

  // SAFE: useEffect for episode title enhancement (runs after render)
  React.useEffect(() => {
    const movieData = movieGuesses?.[videoPath];
    const featuresData = movieData?.imdbid ? featuresByImdbId?.[movieData.imdbid] : null;
    const guessItVideoData = guessItData?.[videoPath];

    // Handle manually selected episodes - check if features data shows this is an episode
    if (
      movieData?.reason === 'User selected' &&
      featuresData?.data?.[0]?.attributes?.feature_type === 'Episode'
    ) {
      const episodeAttrs = featuresData.data[0].attributes;

      // Create enhanced episode data from features API response
      const enhancedData = {
        ...movieData,
        imdbid: movieData.imdbid, // Keep the episode IMDB ID for upload
        title: `${episodeAttrs.parent_title} - S${(episodeAttrs.season_number || 0).toString().padStart(2, '0')}E${(episodeAttrs.episode_number || 0).toString().padStart(2, '0')} - ${episodeAttrs.title}`,
        year: episodeAttrs.year || movieData.year,
        kind: 'episode',
        season: episodeAttrs.season_number,
        episode: episodeAttrs.episode_number,
        episode_title: episodeAttrs.title,
        show_title: episodeAttrs.parent_title,
        parent_imdb_id: episodeAttrs.parent_imdb_id,
        feature_id: episodeAttrs.feature_id,
        reason: 'User selected episode with features API data',
      };

      setEnhancedEpisodeData(enhancedData);
      return;
    }

    // Clear enhanced episode data when movie data changes to non-episode
    if (
      movieData?.reason === 'User selected' &&
      featuresData?.data?.[0]?.attributes?.feature_type !== 'Episode'
    ) {
      setEnhancedEpisodeData(null);
      return;
    }

    // Only process if we have all the required data and it's a TV series (for auto-detected episodes)
    if (
      movieData &&
      featuresData &&
      guessItVideoData &&
      typeof guessItVideoData === 'object' &&
      movieData.reason !== 'User selected'
    ) {
      // Check if this is a TV show with episode info
      if (
        featuresData?.data?.[0]?.attributes?.feature_type === 'Tvshow' &&
        featuresData?.data?.[0]?.attributes?.seasons &&
        guessItVideoData.season &&
        guessItVideoData.episode
      ) {
        const attributes = featuresData.data[0].attributes;
        const seasonNumber = parseInt(guessItVideoData.season);
        const episodeNumber = parseInt(guessItVideoData.episode);

        if (!isNaN(seasonNumber) && !isNaN(episodeNumber)) {
          // Find the matching season
          const season = attributes.seasons.find(s => s.season_number === seasonNumber);
          if (season?.episodes) {
            // Find the matching episode
            const episode = season.episodes.find(e => e.episode_number === episodeNumber);
            if (episode) {
              // Create enhanced episode data
              const enhancedData = {
                ...movieData,
                imdbid: episode.feature_imdb_id?.toString() || movieData.imdbid,
                title: `${attributes.title} - S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')} - ${episode.title}`,
                year: attributes.year,
                kind: 'episode',
                season: seasonNumber,
                episode: episodeNumber,
                episode_title: episode.title,
                show_title: attributes.title,
                feature_id: episode.feature_id,
                reason: 'Episode enhanced with features API data',
              };

              setEnhancedEpisodeData(enhancedData);
            }
          }
        }
      }
    }
  }, [movieGuesses, videoPath, featuresByImdbId, guessItData]);

  // Handle click outside for FPS dropdowns
  React.useEffect(() => {
    const handleClickOutside = event => {
      // Close all open FPS dropdowns if clicking outside
      const hasOpenDropdowns = Object.values(fpsDropdownOpen).some(open => open);
      if (hasOpenDropdowns && !event.target.closest('.fps-dropdown-container')) {
        setFpsDropdownOpen({});
        setFpsSearchTerm({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fpsDropdownOpen]);

  // Helper functions for FPS dropdowns
  const toggleFpsDropdown = key => {
    setFpsDropdownOpen(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setFpsSearchTerm(prev => ({ ...prev, [key]: '' }));
  };

  const handleFpsSelect = (key, value) => {
    if (onOrphanedSubtitlesFpsChange) {
      onOrphanedSubtitlesFpsChange(key, value);
    }
    setFpsDropdownOpen(prev => ({ ...prev, [key]: false }));
    setFpsSearchTerm(prev => ({ ...prev, [key]: '' }));
  };

  const handleFpsSearch = (key, value) => {
    setFpsSearchTerm(prev => ({ ...prev, [key]: value }));
  };

  // Searchable FPS dropdown component
  const SearchableFpsDropdown = ({ dropdownKey, currentValue }) => (
    <div className="fps-dropdown-container relative">
      <button
        type="button"
        onClick={() => toggleFpsDropdown(dropdownKey)}
        className="rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 min-w-[200px] text-left flex items-center justify-between"
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
          {currentValue
            ? fpsOptions.find(fps => fps.value === currentValue)?.label || `${currentValue} FPS`
            : 'Select FPS'}
        </span>
        <span className="ml-2">▼</span>
      </button>

      {fpsDropdownOpen[dropdownKey] && (
        <div
          className="absolute top-full left-0 mt-1 rounded shadow-lg z-10 min-w-full max-h-60 overflow-hidden"
          style={{
            backgroundColor: themeColors.cardBackground || (isDark ? '#2a2a2a' : '#fff'),
            border: `1px solid ${themeColors.border}`,
          }}
        >
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
            <input
              type="text"
              placeholder="Type to search FPS..."
              value={fpsSearchTerm[dropdownKey] || ''}
              onChange={e => handleFpsSearch(dropdownKey, e.target.value)}
              className="w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1"
              style={{
                backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                color: themeColors.text,
                borderColor: themeColors.border,
              }}
              onFocus={e => {
                e.target.style.borderColor = themeColors.success;
                e.target.style.boxShadow = `0 0 0 1px ${themeColors.success}`;
              }}
              onBlur={e => {
                e.target.style.borderColor = themeColors.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* FPS options */}
          <div className="max-h-48 overflow-y-auto">
            {fpsOptions
              .filter(fps => {
                const searchTerm = fpsSearchTerm[dropdownKey] || '';
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (
                  fps.label.toLowerCase().includes(search) || fps.value.toString().includes(search)
                );
              })
              .map(fps => (
                <button
                  key={fps.value}
                  type="button"
                  onClick={() => handleFpsSelect(dropdownKey, fps.value)}
                  className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor:
                      currentValue === fps.value ? themeColors.success : 'transparent',
                    color: currentValue === fps.value ? '#fff' : themeColors.text,
                  }}
                >
                  {fps.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  // SAFE: Render logic after all hooks to prevent "Rendered fewer hooks than expected" error
  const renderContent = () => {
    if (!movieData) {
      return null;
    }

    if (movieData === 'guessing') {
      return (
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin"></div>
          <span>Identifying movie...</span>
        </span>
      );
    }

    if (movieData === 'error') {
      return (
        <div className="space-y-2" id={`movie-${videoPath.replace(/[^a-zA-Z0-9]/g, '-')}`}>
          <div
            className="rounded-lg p-3"
            style={{
              backgroundColor: isDark ? '#3d1a1a' : '#fef2f2',
              border: `1px solid ${themeColors.error}`,
            }}
          >
            <span className="flex items-center gap-1" style={{ color: themeColors.error }}>
              <span>❌</span>
              <span className="font-semibold">Movie identification failed</span>
            </span>
            <div className="text-xs mt-1" style={{ color: themeColors.error }}>
              Unable to identify this video automatically
            </div>
          </div>
        </div>
      );
    }

    if (movieData === 'no-match') {
      return (
        <div className="space-y-2" id={`movie-${videoPath.replace(/[^a-zA-Z0-9]/g, '-')}`}>
          <div
            className="rounded-lg p-3"
            style={{
              backgroundColor: isDark ? '#3d1a1a' : '#fef2f2',
              border: `1px solid ${themeColors.error}`,
            }}
          >
            <span className="flex items-center gap-1" style={{ color: themeColors.error }}>
              <span>🚫</span>
              <span className="font-semibold">No movie match found</span>
              <button
                onClick={() => onOpenMovieSearch(videoPath)}
                className="ml-2 text-xs px-2 py-1 rounded border transition-colors"
                style={{
                  color: themeColors.link,
                  borderColor: themeColors.link,
                }}
                onMouseEnter={e => {
                  e.target.style.color = themeColors.linkHover;
                  e.target.style.borderColor = themeColors.linkHover;
                }}
                onMouseLeave={e => {
                  e.target.style.color = themeColors.link;
                  e.target.style.borderColor = themeColors.link;
                }}
                title="Search for movie manually"
              >
                🔍 Search Movie
              </button>
            </span>
            <div className="text-xs mt-1" style={{ color: themeColors.error }}>
              This video needs manual movie identification for upload
            </div>
          </div>
        </div>
      );
    }

    if (typeof finalMovieData === 'object' && finalMovieData && !movieUpdateLoading[videoPath]) {
      // Check if we have a valid IMDb ID for upload
      const uploadImdbId =
        finalMovieData?.kind === 'episode' && finalMovieData.imdbid
          ? finalMovieData.imdbid
          : originalMovieData.imdbid;

      const hasValidImdbId = !!uploadImdbId;

      // Check features loading and error states
      const isMainFeaturesLoading =
        originalMovieData?.imdbid && featuresLoading?.[originalMovieData.imdbid];
      const isEpisodeFeaturesLoading =
        finalMovieData?.imdbid && featuresLoading?.[finalMovieData.imdbid];
      const isFeaturesLoading = isMainFeaturesLoading || isEpisodeFeaturesLoading;

      const mainFeaturesHasError =
        originalMovieData?.imdbid && featuresByImdbId?.[originalMovieData.imdbid]?.error;
      const episodeFeaturesHasError =
        finalMovieData?.imdbid && featuresByImdbId?.[finalMovieData.imdbid]?.error;

      return (
        <div
          className="rounded p-4 border mt-2"
          style={{
            backgroundColor: themeColors.cardBackground,
            borderColor: hasValidImdbId ? themeColors.border : themeColors.error,
            borderLeft: hasValidImdbId
              ? `3px solid ${themeColors.link}`
              : `3px solid ${themeColors.error}`,
          }}
          id={`movie-${videoPath.replace(/[^a-zA-Z0-9]/g, '-')}`}
        >
          <div className="flex gap-4">
            {/* Movie Poster - Always show with fixed size to prevent layout shift */}
            <div className="flex-shrink-0">
              <div className="relative w-16 h-24 rounded border border-gray-300 bg-gray-100 overflow-hidden">
                {/* Loading placeholder - always show initially */}
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
                  <div className="text-gray-500 text-xs text-center">
                    <div className="w-8 h-8 mx-auto mb-1 bg-gray-300 rounded flex items-center justify-center">
                      🎬
                    </div>
                    Loading...
                  </div>
                </div>

                {/* Actual image - prefer episode poster, fallback to series poster */}
                {(() => {
                  // Only show image if we have a valid IMDB ID and image URL
                  if (!finalMovieData.imdbid) return null;

                  // Use episode poster if available, otherwise use series poster
                  const posterData = episodeFeaturesData?.data?.[0]?.attributes?.img_url
                    ? episodeFeaturesData
                    : featuresData;
                  const imgUrl = posterData?.data?.[0]?.attributes?.img_url;

                  if (imgUrl) {
                    return (
                      <img
                        src={(() => {
                          // Check if img_url contains "no-poster" and use fallback
                          if (imgUrl.includes('no-poster')) {
                            return 'https://static.opensubtitles.org/gfx/empty_cover.jpg';
                          }

                          // Use original URL, add domain if relative
                          return imgUrl.startsWith('http')
                            ? imgUrl
                            : `https://www.opensubtitles.com${imgUrl}`;
                        })()}
                        alt={`${finalMovieData.title} Poster`}
                        className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300"
                        onError={e => {
                          // Keep the placeholder visible on error
                          e.target.style.display = 'none';
                        }}
                        onLoad={e => {
                          // Fade in the image and hide placeholder
                          e.target.style.opacity = '1';
                          if (e.target.previousElementSibling) {
                            e.target.previousElementSibling.style.display = 'none';
                          }
                        }}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Movie Information */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="font-semibold text-base mb-2" style={{ color: themeColors.text }}>
                <div className="flex items-center gap-2">
                  {/* Problem Icon or Type Icon */}
                  {!hasValidImdbId ? (
                    <span
                      title="No IMDb ID available for upload"
                      style={{ color: themeColors.error }}
                    >
                      🚫
                    </span>
                  ) : (
                    <span
                      title={
                        featuresData?.data?.[0]?.attributes?.feature_type
                          ? featuresData.data[0].attributes.feature_type.replace('_', ' ')
                          : (finalMovieData.kind || 'movie').replace('_', ' ')
                      }
                    >
                      {featuresData?.data?.[0]?.attributes?.feature_type === 'tv_series' ||
                      featuresData?.data?.[0]?.attributes?.feature_type === 'episode' ||
                      finalMovieData.kind === 'tv series' ||
                      finalMovieData.kind === 'episode'
                        ? '📺'
                        : '🎬'}
                    </span>
                  )}

                  {/* Main Title - shows episode-specific title with parent_title + original_title when available */}
                  <span>
                    {(() => {
                      // DISABLED: console.log to prevent setState during render
                      // console.log('Title formatting debug:', {
                      //   'hasEpisodeFeaturesData': !!episodeFeaturesData?.data?.[0]?.attributes,
                      //   'episodeFeaturesData': episodeFeaturesData,
                      //   'finalMovieData.kind': finalMovieData.kind,
                      //   'finalMovieData.season': finalMovieData.season,
                      //   'finalMovieData.episode': finalMovieData.episode,
                      //   'finalMovieData': finalMovieData
                      // });

                      // If we have episode-specific features data, use parent_title + season/episode + episode title
                      if (episodeFeaturesData?.data?.[0]?.attributes) {
                        const episodeAttrs = episodeFeaturesData.data[0].attributes;
                        const parentTitle = episodeAttrs.parent_title || 'Unknown Series';
                        const seasonEpisode = `S${(episodeAttrs.season_number || 0).toString().padStart(2, '0')}E${(episodeAttrs.episode_number || 0).toString().padStart(2, '0')}`;

                        // Use episode title (original_title if available, otherwise title, otherwise fallback)
                        let episodeTitle =
                          episodeAttrs.title || `Episode ${episodeAttrs.episode_number || '?'}`;
                        if (
                          episodeAttrs.original_title &&
                          episodeAttrs.original_title !== 'null' &&
                          episodeAttrs.original_title.trim() !== ''
                        ) {
                          episodeTitle = episodeAttrs.original_title;
                        }

                        return `${parentTitle} - ${seasonEpisode} - ${episodeTitle}`;
                      }

                      // If this is an episode with season/episode info from finalMovieData, format it properly
                      if (
                        finalMovieData.kind === 'episode' &&
                        finalMovieData.season &&
                        finalMovieData.episode
                      ) {
                        const seasonEpisode = `S${finalMovieData.season.toString().padStart(2, '0')}E${finalMovieData.episode.toString().padStart(2, '0')}`;
                        const showTitle = finalMovieData.show_title || finalMovieData.title;
                        const episodeTitle =
                          finalMovieData.episode_title || `Episode ${finalMovieData.episode}`;
                        // DISABLED: console.log to prevent setState during render
                        // console.log('Using finalMovieData:', { seasonEpisode, showTitle, episodeTitle });
                        return `${showTitle} - ${seasonEpisode} - ${episodeTitle}`;
                      }

                      // Otherwise use the finalMovieData title as-is
                      const mainTitle = finalMovieData.title;
                      // DISABLED: console.log to prevent setState during render
                      // console.log('Using basic title:', mainTitle);
                      return mainTitle;
                    })()}
                    {finalMovieData.year && ` (${finalMovieData.year})`}
                  </span>

                  {/* Change Movie Button */}
                  <button
                    onClick={() => onOpenMovieSearch(videoPath)}
                    className="ml-2 text-xs px-2 py-1 rounded border transition-colors"
                    style={{
                      color: themeColors.textSecondary,
                      borderColor: themeColors.border,
                    }}
                    onMouseEnter={e => {
                      e.target.style.color = themeColors.link;
                      e.target.style.borderColor = themeColors.link;
                    }}
                    onMouseLeave={e => {
                      e.target.style.color = themeColors.textSecondary;
                      e.target.style.borderColor = themeColors.border;
                    }}
                    title="Change movie identification"
                    disabled={movieUpdateLoading[videoPath]}
                  >
                    ✏️ Change
                  </button>

                  {/* Movie Checkbox - Select/Deselect All Subtitles */}
                  {associatedSubtitles &&
                    associatedSubtitles.length > 0 &&
                    !hideSelectAllCheckbox && (
                      <div className="ml-auto flex items-center">
                        <label
                          className="flex items-center cursor-pointer group"
                          title="Select/deselect all subtitles for this movie"
                        >
                          <input
                            type="checkbox"
                            checked={getMovieCheckboxState.checked}
                            ref={el => {
                              if (el) {
                                el.indeterminate = getMovieCheckboxState.indeterminate;
                              }
                            }}
                            onChange={e => handleMovieCheckboxChange(e.target.checked)}
                            className="w-4 h-4 rounded focus:ring-2"
                            style={{
                              accentColor: themeColors.link,
                              backgroundColor: themeColors.cardBackground,
                              borderColor: themeColors.border,
                            }}
                          />
                          <span
                            className="ml-2 text-xs font-medium"
                            style={{ color: themeColors.link }}
                          >
                            {(() => {
                              const state = getMovieCheckboxState;
                              if (state.indeterminate) return 'Partial';
                              if (state.checked) return 'All Selected';
                              return 'None Selected';
                            })()}
                          </span>
                        </label>
                      </div>
                    )}
                </div>

                {/* Alternative Title (show original title if different from main title) */}
                {(() => {
                  const mainTitle = bestMovieData.title;
                  const originalTitle = featuresData?.data?.[0]?.attributes?.original_title;

                  // Show original title if it's different from the main title
                  const showOriginal =
                    originalTitle && mainTitle && !areTitlesSimilar(originalTitle, mainTitle);

                  return (
                    showOriginal && (
                      <div
                        className="text-sm font-normal mt-1"
                        style={{ color: themeColors.textSecondary }}
                      >
                        {originalTitle}
                      </div>
                    )
                  );
                })()}
              </div>

              {/* Features Loading State */}
              {isFeaturesLoading && (
                <div
                  className="flex items-center gap-2 text-sm mb-2"
                  style={{ color: themeColors.textSecondary }}
                >
                  <div
                    className="w-3 h-3 border rounded-full animate-spin"
                    style={{ borderColor: themeColors.link, borderTopColor: 'transparent' }}
                  ></div>
                  <span>Loading features...</span>
                </div>
              )}

              {/* Features Error State */}
              {(mainFeaturesHasError || episodeFeaturesHasError) && (
                <div
                  className="rounded-lg p-2 mb-2"
                  style={{
                    backgroundColor: isDark ? '#4a3a00' : '#fffbf0',
                    border: `1px solid ${themeColors.warning}`,
                  }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2" style={{ color: themeColors.warning }}>
                      <span>⚠️</span>
                      <span>Warning: Could not load movie features</span>
                    </div>
                    <button
                      onClick={() => {
                        // BASIC: Retry fetching features
                        if (mainFeaturesHasError && originalMovieData.imdbid) {
                          fetchFeaturesByImdbId(originalMovieData.imdbid);
                        }
                        if (
                          episodeFeaturesHasError &&
                          bestMovieData.imdbid &&
                          bestMovieData.imdbid !== originalMovieData.imdbid
                        ) {
                          fetchFeaturesByImdbId(bestMovieData.imdbid);
                        }
                      }}
                      disabled={isFeaturesLoading}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                      style={{
                        backgroundColor: isFeaturesLoading
                          ? isDark
                            ? '#666'
                            : '#ccc'
                          : themeColors.warning,
                        color: isFeaturesLoading
                          ? isDark
                            ? '#999'
                            : '#666'
                          : isDark
                            ? '#000'
                            : '#fff',
                        cursor: isFeaturesLoading ? 'not-allowed' : 'pointer',
                        opacity: isFeaturesLoading ? '0.7' : '1',
                      }}
                      onMouseEnter={e => {
                        if (!isFeaturesLoading) {
                          e.target.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isFeaturesLoading) {
                          e.target.style.opacity = '1';
                        }
                      }}
                      title={
                        isFeaturesLoading ? 'Loading features...' : 'Retry loading movie features'
                      }
                    >
                      {isFeaturesLoading ? (
                        <>
                          <div
                            className="w-3 h-3 rounded-full animate-spin"
                            style={{
                              borderTop: '2px solid transparent',
                              borderRight: `2px solid ${isDark ? '#999' : '#666'}`,
                              borderBottom: `2px solid ${isDark ? '#999' : '#666'}`,
                              borderLeft: `2px solid ${isDark ? '#999' : '#666'}`,
                            }}
                          ></div>
                          <span>Loading</span>
                        </>
                      ) : (
                        <>
                          <span>🔄</span>
                          <span>Retry</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-xs mt-1" style={{ color: themeColors.warning }}>
                    {mainFeaturesHasError &&
                      `Main features: ${featuresByImdbId[originalMovieData.imdbid]?.error}`}
                    {episodeFeaturesHasError &&
                      `Episode features: ${featuresByImdbId[finalMovieData.imdbid]?.error}`}
                  </div>
                </div>
              )}

              {/* Movie Identification Source */}
              {bestMovieData?.reason && bestMovieData.reason.includes('Directory match') && (
                <div
                  className="rounded-lg p-2 mb-2"
                  style={{
                    backgroundColor: isDark ? '#1a2332' : '#f0f8ff',
                    border: `1px solid ${themeColors.link}`,
                  }}
                >
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: themeColors.linkHover }}
                  >
                    <span>📁</span>
                    <span>Identified from directory name</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: themeColors.link }}>
                    {bestMovieData.reason}
                  </div>
                </div>
              )}

              {/* Features API Details */}
              {featuresData?.data?.[0]?.attributes ? (
                <div className="space-y-1 text-xs">
                  {/* Show Episode IMDb first (for upload) if available, otherwise TV IMDb */}
                  {finalMovieData.kind === 'episode' && finalMovieData.imdbid ? (
                    <>
                      {/* Episode IMDb and TV Series IMDb on same line */}
                      <div>
                        <span className="font-semibold" style={{ color: themeColors.success }}>
                          🎯 Upload IMDb:
                        </span>{' '}
                        <a
                          href={getImdbUrl(finalMovieData.imdbid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono font-bold"
                          style={{ color: themeColors.success }}
                          onMouseEnter={e => (e.target.style.color = themeColors.success)}
                          onMouseLeave={e => (e.target.style.color = themeColors.success)}
                        >
                          {formatImdbId(finalMovieData.imdbid)}
                        </a>
                        <span className="text-xs ml-2" style={{ color: themeColors.success }}>
                          (Episode)
                        </span>
                        <span style={{ color: themeColors.textMuted }}> • </span>
                        <span style={{ color: themeColors.link }}>TV Series:</span>{' '}
                        <a
                          href={getImdbUrl(
                            finalMovieData.parent_imdb_id || originalMovieData.imdbid
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono"
                          style={{ color: themeColors.linkHover }}
                          onMouseEnter={e => (e.target.style.color = themeColors.link)}
                          onMouseLeave={e => (e.target.style.color = themeColors.linkHover)}
                        >
                          {formatImdbId(finalMovieData.parent_imdb_id || originalMovieData.imdbid)}
                        </a>
                      </div>

                      {/* FPS Dropdown for orphaned subtitles */}
                      {isOrphanedSubtitle && onOrphanedSubtitlesFpsChange && (
                        <div className="mt-2">
                          <SearchableFpsDropdown
                            dropdownKey={videoPath}
                            currentValue={orphanedSubtitlesFps[videoPath] || ''}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    /* Main content IMDb - Primary for upload */
                    <>
                      <div>
                        <span className="font-semibold" style={{ color: '#28a745' }}>
                          🎯 Upload IMDb:
                        </span>{' '}
                        <a
                          href={getImdbUrl(originalMovieData.imdbid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono font-bold"
                          style={{ color: themeColors.success }}
                          onMouseEnter={e => (e.target.style.color = themeColors.success)}
                          onMouseLeave={e => (e.target.style.color = themeColors.success)}
                        >
                          {formatImdbId(originalMovieData.imdbid)}
                        </a>
                        <span className="text-xs ml-2" style={{ color: '#28a745' }}>
                          (
                          {(() => {
                            const featureType = featuresData?.data?.[0]?.attributes?.feature_type;
                            if (featureType) {
                              // Convert feature_type to display format
                              switch (featureType.toLowerCase()) {
                                case 'movie':
                                  return 'Movie';
                                case 'tvshow':
                                case 'tv_series':
                                  return 'TV Series';
                                case 'episode':
                                  return 'Episode';
                                default:
                                  return featureType.replace('_', ' ');
                              }
                            }
                            // Fallback to bestMovieData kind
                            return bestMovieData.kind === 'tv series' ? 'TV Series' : 'Movie';
                          })()}
                          )
                        </span>
                      </div>

                      {/* FPS Dropdown for orphaned subtitles */}
                      {isOrphanedSubtitle && onOrphanedSubtitlesFpsChange && (
                        <div className="mt-2">
                          <SearchableFpsDropdown
                            dropdownKey={videoPath}
                            currentValue={orphanedSubtitlesFps[videoPath] || ''}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* Fallback to XML-RPC data only */
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {(bestMovieData.season && bestMovieData.season > 0) ||
                  (bestMovieData.episode && bestMovieData.episode > 0) ? (
                    <div>
                      {bestMovieData.season && bestMovieData.season > 0 && (
                        <>
                          <span style={{ color: themeColors.link }}>Season:</span>{' '}
                          <span style={{ color: themeColors.text }}>{bestMovieData.season}</span>
                        </>
                      )}
                      {bestMovieData.season &&
                        bestMovieData.episode &&
                        bestMovieData.season > 0 &&
                        bestMovieData.episode > 0 && (
                          <span style={{ color: themeColors.textMuted }}> • </span>
                        )}
                      {bestMovieData.episode && bestMovieData.episode > 0 && (
                        <>
                          <span style={{ color: themeColors.link }}>Episode:</span>{' '}
                          <span style={{ color: themeColors.text }}>{bestMovieData.episode}</span>
                        </>
                      )}
                    </div>
                  ) : null}

                  {/* Show Episode IMDb first (for upload) if available, otherwise TV IMDb */}
                  {finalMovieData.kind === 'episode' && finalMovieData.imdbid ? (
                    <>
                      {/* Episode IMDb and TV Series IMDb on same line */}
                      <div>
                        <span className="font-semibold" style={{ color: themeColors.success }}>
                          🎯 Upload IMDb:
                        </span>{' '}
                        <a
                          href={getImdbUrl(finalMovieData.imdbid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono font-bold"
                          style={{ color: themeColors.success }}
                          onMouseEnter={e => (e.target.style.color = themeColors.success)}
                          onMouseLeave={e => (e.target.style.color = themeColors.success)}
                        >
                          {formatImdbId(finalMovieData.imdbid)}
                        </a>
                        <span className="text-xs ml-2" style={{ color: themeColors.success }}>
                          (Episode)
                        </span>
                        <span style={{ color: themeColors.textMuted }}> • </span>
                        <span style={{ color: themeColors.link }}>TV Series:</span>{' '}
                        <a
                          href={getImdbUrl(
                            finalMovieData.parent_imdb_id || originalMovieData.imdbid
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono"
                          style={{ color: themeColors.linkHover }}
                          onMouseEnter={e => (e.target.style.color = themeColors.link)}
                          onMouseLeave={e => (e.target.style.color = themeColors.linkHover)}
                        >
                          {formatImdbId(finalMovieData.parent_imdb_id || originalMovieData.imdbid)}
                        </a>
                      </div>

                      {/* FPS Dropdown for orphaned subtitles */}
                      {isOrphanedSubtitle && onOrphanedSubtitlesFpsChange && (
                        <div className="mt-2">
                          <SearchableFpsDropdown
                            dropdownKey={videoPath}
                            currentValue={orphanedSubtitlesFps[videoPath] || ''}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    /* Main content IMDb - Primary for upload (fallback) */
                    <>
                      <div>
                        <span className="font-semibold" style={{ color: '#28a745' }}>
                          🎯 Upload IMDb:
                        </span>{' '}
                        <a
                          href={getImdbUrl(originalMovieData.imdbid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-mono font-bold"
                          style={{ color: themeColors.success }}
                          onMouseEnter={e => (e.target.style.color = themeColors.success)}
                          onMouseLeave={e => (e.target.style.color = themeColors.success)}
                        >
                          {formatImdbId(originalMovieData.imdbid)}
                        </a>
                        <span className="text-xs ml-2" style={{ color: '#28a745' }}>
                          ({bestMovieData.kind === 'tv series' ? 'TV Series' : 'Movie'})
                        </span>
                      </div>

                      {/* FPS Dropdown for orphaned subtitles */}
                      {isOrphanedSubtitle && onOrphanedSubtitlesFpsChange && (
                        <div className="mt-2">
                          <SearchableFpsDropdown
                            dropdownKey={videoPath}
                            currentValue={orphanedSubtitlesFps[videoPath] || ''}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* GuessIt Metadata Tags */}
          {getGuessItProcessingStatus && getFormattedTags && (
            <MetadataTags
              guessItData={guessItData}
              filePath={videoPath}
              getGuessItProcessingStatus={getGuessItProcessingStatus}
              getFormattedTags={getFormattedTags}
              compact={false}
              isDark={isDark}
            />
          )}
        </div>
      );
    }

    if (movieUpdateLoading[videoPath]) {
      return (
        <span className="flex items-center gap-1" style={{ color: themeColors.link }}>
          <div
            className="w-3 h-3 border rounded-full animate-spin"
            style={{ borderColor: themeColors.link, borderTopColor: 'transparent' }}
          ></div>
          <span>Updating movie information...</span>
        </span>
      );
    }

    return null;
  };

  // SAFE: Always call hooks first, then render content
  return renderContent();
};
