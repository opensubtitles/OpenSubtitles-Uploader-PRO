import React from 'react';
import { formatFileSize } from '../utils/fileUtils.js';
import { MetadataTags } from './MetadataTags.jsx';
import { MovieDisplay } from './MovieDisplay.jsx';
import { SubtitleUploadOptions, SubtitleUploadOptionsPanel } from './SubtitleUploadOptions.jsx';
import { MovieSearch } from './MovieSearch.jsx';
import { VideoMetadataDisplay } from './VideoMetadataDisplay.jsx';
import { openExternal } from '../utils/urlUtils.jsx';

// Inline component to avoid setState during render issues
const VideoMetadataInline = React.memo(({ filePath, getVideoMetadata, isMetadataLoading, getMetadataError }) => {
  const metadata = React.useMemo(() => {
    try {
      return getVideoMetadata ? getVideoMetadata(filePath) : null;
    } catch (err) {
      console.warn('Error getting video metadata:', err);
      return null;
    }
  }, [getVideoMetadata, filePath]);
  
  const isLoading = React.useMemo(() => {
    try {
      return isMetadataLoading ? isMetadataLoading(filePath) : false;
    } catch (err) {
      console.warn('Error getting metadata loading state:', err);
      return false;
    }
  }, [isMetadataLoading, filePath]);
  
  const error = React.useMemo(() => {
    try {
      return getMetadataError ? getMetadataError(filePath) : null;
    } catch (err) {
      console.warn('Error getting metadata error:', err);
      return null;
    }
  }, [getMetadataError, filePath]);
  
  if (isLoading) {
    return <span title="Extracting video metadata...">📹 Extracting metadata...</span>;
  }
  
  if (error) {
    return <span title={`Metadata extraction failed: ${error}`}>⚠️ Metadata failed</span>;
  }
  
  if (metadata) {
    return (
      <>
        {metadata.durationFormatted && metadata.durationFormatted !== 'unknown' && (
          <span title={`Duration: ${metadata.durationFormatted}`}>⏱️ {metadata.durationFormatted}</span>
        )}
        {metadata.fps && (
          <span title={`Frame Rate: ${metadata.fps} FPS`}>📽️ {metadata.fps} FPS</span>
        )}
        {metadata.resolution && metadata.resolution !== 'unknown' && (
          <span title={`Resolution: ${metadata.resolution}`}>📺 {metadata.resolution}</span>
        )}
        {metadata.movieframes && (
          <span title={`Movie Frames: ${metadata.movieframes}`}>🎞️ {metadata.movieframes}</span>
        )}
        {metadata.videoCodec && metadata.videoCodec !== 'unknown' && (
          <span title={`Video Codec: ${metadata.videoCodec}`}>🎬 {metadata.videoCodec}</span>
        )}
        {metadata.bitrate && (
          <span title={`Bitrate: ${Math.round(metadata.bitrate / 1000)} kbps`}>📊 {Math.round(metadata.bitrate / 1000)} kbps</span>
        )}
      </>
    );
  }
  
  return null;
});

export const MatchedPairs = ({ 
  pairedFiles,
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
  onMovieChange, // New prop for handling movie updates
  guessItData, // New prop for GuessIt data
  getGuessItProcessingStatus, // New prop for GuessIt status
  getFormattedTags, // New prop for formatted tags
  uploadStates, // New prop for upload states
  onToggleUpload, // New prop for upload toggle
  getUploadEnabled, // New prop for getting upload status
  fetchFeaturesByImdbId, // New prop for fetching features by IMDb ID
  uploadResults, // New prop for upload results
  hashCheckResults, // New prop for CheckSubHash results
  uploadOptions, // New prop for upload options
  onUpdateUploadOptions, // New prop for updating upload options
  config, // New prop for configuration settings
  colors, // Theme colors
  isDark, // Dark mode flag
  // Video metadata props
  getVideoMetadata, // Function to get video metadata
  isMetadataLoading, // Function to check if metadata is loading
  getMetadataError // Function to get metadata error
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
    warning: '#ffc107'
  };
  const successfulPairs = pairedFiles.filter(pair => pair.video && pair.subtitles.length > 0);

  // Movie search state - RE-ENABLED AFTER DEBUG MODE FIX
  const [openMovieSearch, setOpenMovieSearch] = React.useState(null);
  const [movieSearchQuery, setMovieSearchQuery] = React.useState('');
  const [movieSearchResults, setMovieSearchResults] = React.useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = React.useState(false);
  const [movieUpdateLoading, setMovieUpdateLoading] = React.useState({});
  const [localUploadStates, setLocalUploadStates] = React.useState({});
  const [uploadOptionsExpanded, setUploadOptionsExpanded] = React.useState({});  // RE-ENABLED

  // Clear search state when closing - RE-ENABLED
  const closeMovieSearch = () => {
    setOpenMovieSearch(null);
    setMovieSearchQuery('');
    setMovieSearchResults([]);
  };

  // Handle local state changes from SubtitleUploadOptions - RE-ENABLED
  const handleLocalStateChange = (subtitlePath, localStates) => {
    setLocalUploadStates(prev => ({
      ...prev,
      [subtitlePath]: localStates
    }));
  };

  // Handle upload options expansion toggle
  const handleUploadOptionsToggle = React.useCallback((subtitlePath) => {
    setUploadOptionsExpanded(prev => ({
      ...prev,
      [subtitlePath]: !prev[subtitlePath]
    }));
  }, []);

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
          const response = await fetch(`https://www.opensubtitles.org/libs/suggest_imdb.php?m=${imdbId}`);
          const results = await response.json();
          setMovieSearchResults(results || []);
        } else {
          // Regular text search
          const response = await fetch(`https://www.opensubtitles.org/libs/suggest_imdb.php?m=${encodeURIComponent(query)}`);
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

  // Utility function to extract IMDB ID from various input formats
  const extractImdbId = (input) => {
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
    
    // Match just numbers (assume it needs tt prefix): 1133589
    const numberMatch = trimmed.match(/^\d+$/);
    if (numberMatch) {
      return `tt${numberMatch[0]}`;
    }
    
    return null;
  };

  // Check if input looks like an IMDB ID
  const isImdbInput = (input) => {
    return extractImdbId(input) !== null;
  };

  // Get the best movie data (episode-specific if available, otherwise main show) - TEMPORARILY DISABLED
  const getBestMovieData = (videoPath) => {
    // Return basic movie data only to isolate setState during render issue
    return movieGuesses[videoPath];
  };

  // Handle movie search input - RE-ENABLED
  const handleMovieSearch = (query) => {
    setMovieSearchQuery(query);
  };

  // Handle movie selection - RE-ENABLED
  const handleMovieSelect = async (videoPath, movie) => {
    // Close search interface
    closeMovieSearch();

    // Set loading state
    setMovieUpdateLoading(prev => ({ ...prev, [videoPath]: true }));

    try {
      // Create new movie guess object
      const newMovieGuess = {
        imdbid: movie.id,
        title: movie.name,
        year: movie.year,
        kind: movie.kind,
        reason: 'User selected'
      };

      // Call the parent component's movie change handler
      if (onMovieChange) {
        await onMovieChange(videoPath, newMovieGuess);
      }

      console.log('Movie updated successfully:', newMovieGuess);
    } catch (error) {
      console.error('Error updating movie:', error);
    } finally {
      // Clear loading state
      setMovieUpdateLoading(prev => ({ ...prev, [videoPath]: false }));
    }
  };

  // Handle opening movie search - RE-ENABLED
  const handleOpenMovieSearch = React.useCallback((videoPath) => {
    setOpenMovieSearch(openMovieSearch === videoPath ? null : videoPath);
  }, [openMovieSearch]);


  // Close search when clicking outside - TEMPORARILY DISABLED
  // React.useEffect(() => {
  //   const handleClickOutside = (event) => {
  //     if (!event.target.closest('[data-movie-search]')) {
  //       closeMovieSearch();
  //     }
  //   };

  //   document.addEventListener('mousedown', handleClickOutside);
  //   return () => document.removeEventListener('mousedown', handleClickOutside);
  // }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-6 shadow-sm" 
           style={{
             backgroundColor: themeColors.cardBackground,
             border: `1px solid ${themeColors.border}`
           }}>
        <h2 className="text-2xl font-bold mb-4" style={{color: themeColors.text}}>
          Matched Pairs ({successfulPairs.length} successful matches)
        </h2>
        
        <div className="space-y-4">
          {successfulPairs.map((pair) => (
            <div key={pair.id} className="rounded-lg p-4 shadow-sm" 
                 style={{
                   backgroundColor: themeColors.cardBackground,
                   border: `1px solid ${themeColors.border}`
                 }}>
              <div className="space-y-3">
                
                {/* Video File */}
                <div>
                  <div className="font-medium" style={{color: themeColors.text}}>
                    {(() => {
                      const fullPath = pair.video.fullPath;
                      const pathParts = fullPath.split('/');
                      const directoryParts = pathParts.slice(0, -1);
                      
                      // Remove duplicate adjacent directories
                      if (directoryParts.length >= 2 && 
                          directoryParts[directoryParts.length - 1] === directoryParts[directoryParts.length - 2]) {
                        directoryParts.pop();
                      }
                      
                      const directoryPath = directoryParts.length > 0 ? '/' + directoryParts.join('/') : '';
                      const hasDirectory = directoryPath.length > 0;
                      
                      return hasDirectory ? directoryPath : pair.video.name;
                    })()}
                  </div>
                  <div className="text-sm flex items-center gap-2" style={{color: themeColors.textSecondary}}>
                    <span title={`File Size: ${formatFileSize(pair.video.size)}`}>📁 {formatFileSize(pair.video.size)}</span>
                    
                    {pair.video.movieHash && pair.video.movieHash !== 'error' && (
                      <span title={`Movie Hash: ${pair.video.movieHash}`}>🔗 {pair.video.movieHash}</span>
                    )}
                    
                    {pair.video.movieHash === 'error' && (
                      <span title="Hash calculation failed" style={{color: themeColors.textMuted}}>❌ Hash calculation failed</span>
                    )}
                    
                    {!pair.video.movieHash && (
                      <span title="Calculating hash..." style={{color: themeColors.link}}>🔗 Calculating hash...</span>
                    )}
                    
                    {/* Video Metadata Inline */}
                    <VideoMetadataInline
                      filePath={pair.video.fullPath}
                      getVideoMetadata={getVideoMetadata}
                      isMetadataLoading={isMetadataLoading}
                      getMetadataError={getMetadataError}
                    />
                    
                    {/* MKV Extraction Status */}
                    {pair.video.hasMkvSubtitleExtraction && pair.video.mkvExtractionStatus && (
                      <span>
                        {pair.video.mkvExtractionStatus === 'pending' && (
                          <span 
                            className="px-2 py-1 text-xs rounded font-medium flex items-center gap-1"
                            style={{
                              backgroundColor: themeColors.warning + '20' || '#ffc10720',
                              color: themeColors.warning || '#ffc107'
                            }}
                            title="MKV subtitle extraction will start..."
                          >
                            ⏳ MKV Pending
                          </span>
                        )}
                        {(pair.video.mkvExtractionStatus === 'detecting' || pair.video.mkvExtractionStatus === 'extracting' || pair.video.mkvExtractionStatus === 'extracting_all') && (
                          <span 
                            className="px-2 py-1 text-xs rounded font-medium flex items-center gap-1"
                            style={{
                              backgroundColor: themeColors.link + '20' || '#2878C020',
                              color: themeColors.link || '#2878C0'
                            }}
                            title={
                              pair.video.mkvExtractionStatus === 'detecting' 
                                ? "Detecting embedded subtitles in MKV..." 
                                : pair.video.mkvExtractionStatus === 'extracting_all' 
                                  ? `Extracting ${pair.video.extractedCount || 0}/${pair.video.streamCount || 0} subtitles from MKV...`
                                  : "Extracting embedded subtitles from MKV..."
                            }
                          >
                            <div className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                            {pair.video.mkvExtractionStatus === 'detecting' && 'Detecting...'}
                            {pair.video.mkvExtractionStatus === 'extracting_all' && `Extracting ${pair.video.extractedCount || 0}/${pair.video.streamCount || 0}`}
                            {pair.video.mkvExtractionStatus === 'extracting' && 'Extracting...'}
                          </span>
                        )}
                        {pair.video.mkvExtractionStatus === 'completed' && (
                          <span 
                            className="px-2 py-1 text-xs rounded font-medium"
                            style={{
                              backgroundColor: themeColors.success + '20' || '#9EC06820',
                              color: themeColors.success || '#9EC068'
                            }}
                            title={`Extracted ${pair.video.extractedCount || 0}/${pair.video.streamCount || 0} subtitle(s) from MKV`}
                          >
                            ✅ {pair.video.extractedCount || 0}/{pair.video.streamCount || 0} Extracted
                          </span>
                        )}
                        {(pair.video.mkvExtractionStatus === 'no_subtitles' || pair.video.mkvExtractionStatus === 'no_streams') && (
                          <span 
                            className="px-2 py-1 text-xs rounded font-medium"
                            style={{
                              backgroundColor: themeColors.textMuted + '20' || '#80808020',
                              color: themeColors.textMuted || '#808080'
                            }}
                            title="No embedded subtitles found in MKV"
                          >
                            📝 No Subtitles
                          </span>
                        )}
                        {pair.video.mkvExtractionStatus === 'error' && (
                          <span 
                            className="px-2 py-1 text-xs rounded font-medium"
                            style={{
                              backgroundColor: themeColors.error + '20' || '#dc354520',
                              color: themeColors.error || '#dc3545'
                            }}
                            title={`MKV extraction failed: ${pair.video.mkvExtractionError || 'Unknown error'}`}
                          >
                            ❌ Error
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* GuessIt Metadata Tags */}
                <MetadataTags
                  guessItData={guessItData}
                  filePath={pair.video.fullPath}
                  getGuessItProcessingStatus={getGuessItProcessingStatus}
                  getFormattedTags={getFormattedTags}
                  colors={themeColors}
                  isDark={isDark}
                  video={pair.video}
                />
                
                {/* Movie Display Component - BASIC version without episode detection */}
                <MovieDisplay
                  videoPath={pair.video.fullPath}
                  movieGuesses={movieGuesses}
                  featuresByImdbId={featuresByImdbId}
                  featuresLoading={featuresLoading}
                  guessItData={guessItData}
                  movieUpdateLoading={movieUpdateLoading}
                  onOpenMovieSearch={handleOpenMovieSearch}
                  fetchFeaturesByImdbId={fetchFeaturesByImdbId}
                  associatedSubtitles={pair.subtitles.map(sub => sub.fullPath)}
                  getUploadEnabled={getUploadEnabled}
                  onToggleUpload={onToggleUpload}
                  colors={themeColors}
                  isDark={isDark}
                />
                
                {/* Movie Search Interface for no-match and change movie - RE-ENABLED */}
                {openMovieSearch === pair.video.fullPath && (
                  <div className="mt-3 p-3 rounded-lg" 
                       style={{
                         backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                         border: `1px solid ${themeColors.border}`
                       }}
                       data-movie-search>
                        <div className="text-sm mb-2" style={{color: themeColors.text}}>
                          Search by movie title, IMDB ID, or IMDB URL:
                          <div className="text-xs mt-1" style={{color: themeColors.textSecondary}}>
                            Examples: "The Matrix", "tt0133093", "https://www.imdb.com/title/tt0133093/"
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Movie title, IMDB ID (tt0133093), or IMDB URL..."
                            value={movieSearchQuery}
                            onChange={(e) => handleMovieSearch(e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded border focus:outline-none focus:ring-1"
                            style={{
                              backgroundColor: themeColors.cardBackground,
                              color: themeColors.text,
                              borderColor: themeColors.border
                            }}
                            onFocus={(e) => {
                              e.target.style.boxShadow = `0 0 0 1px ${themeColors.link}`;  // isImdbInput disabled
                            }}
                            onBlur={(e) => {
                              e.target.style.boxShadow = 'none';
                            }}
                            autoFocus
                          />
                          {/* Visual indicator for IMDB input - DISABLED */}
                          {false && (
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <span className="text-xs px-2 py-1 rounded" 
                                    style={{
                                      color: themeColors.success, 
                                      backgroundColor: isDark ? '#1a3315' : '#f0f9e8', 
                                      border: `1px solid ${themeColors.success}`
                                    }}>
                                IMDB ID: {extractImdbId(movieSearchQuery)}
                              </span>
                            </div>
                          )}
                          
                          {/* Loading indicator - RE-ENABLED */}
                          {movieSearchLoading && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-20 p-3"
                                 style={{
                                   backgroundColor: themeColors.cardBackground,
                                   border: `1px solid ${themeColors.border}`
                                 }}>
                              <div className="flex items-center gap-2 text-sm" style={{color: themeColors.textSecondary}}>
                                <div className="w-4 h-4 border rounded-full animate-spin" style={{borderColor: themeColors.link, borderTopColor: 'transparent'}}></div>
                                <span>
                                  {isImdbInput(movieSearchQuery) 
                                    ? `Looking up IMDB ID: ${extractImdbId(movieSearchQuery)}...`
                                    : 'Searching movies...'
                                  }
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* No results message - DISABLED */}
                          {false && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-20 p-3"
                                 style={{
                                   backgroundColor: themeColors.cardBackground,
                                   border: `1px solid ${themeColors.border}`
                                 }}>
                              <div className="text-sm" style={{color: themeColors.textSecondary}}>
                                {isImdbInput(movieSearchQuery) 
                                  ? `No movie found for IMDB ID: ${extractImdbId(movieSearchQuery)}`
                                  : `No movies found for "${movieSearchQuery}"`
                                }
                              </div>
                            </div>
                          )}
                          
                          {/* Search Results Dropdown - RE-ENABLED */}
                          {!movieSearchLoading && movieSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded shadow-lg z-20 max-h-64 overflow-y-auto"
                                 style={{
                                   backgroundColor: themeColors.cardBackground,
                                   border: `1px solid ${themeColors.border}`
                                 }}>
                              {movieSearchResults.map((movie) => (
                                <button
                                  key={movie.id}
                                  onClick={() => handleMovieSelect(pair.video.fullPath, movie)}
                                  className="w-full text-left px-3 py-2 flex items-center gap-3 last:border-b-0"
                                  style={{
                                    backgroundColor: 'transparent',
                                    borderBottom: `1px solid ${themeColors.border}`
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = isDark ? '#444444' : '#f8f9fa'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                  disabled={movieUpdateLoading[pair.video.fullPath]}
                                >
                                  {movie.pic && (
                                    <img
                                      src={movie.pic}
                                      alt={movie.name}
                                      className="w-8 h-12 object-cover rounded"
                                      style={{border: `1px solid ${themeColors.border}`}}
                                      onError={(e) => e.target.style.display = 'none'}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate" style={{color: themeColors.text}}>
                                      {movie.name} ({movie.year})
                                    </div>
                                    <div className="text-xs capitalize flex items-center gap-2" style={{color: themeColors.textSecondary}}>
                                      <span>{movie.kind}</span>
                                      <span>•</span>
                                      <span>IMDb:</span>
                                      <a 
                                        href={`https://www.imdb.com/title/tt${movie.id}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                        style={{color: themeColors.link}}
                                        onMouseEnter={(e) => e.target.style.color = themeColors.linkHover}
                                        onMouseLeave={(e) => e.target.style.color = themeColors.link}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {movie.id}
                                      </a>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => closeMovieSearch()}
                            className="text-xs px-2 py-1"
                            style={{color: themeColors.textSecondary}}
                            onMouseEnter={(e) => e.target.style.color = themeColors.text}
                            onMouseLeave={(e) => e.target.style.color = themeColors.textSecondary}
                          >
                            Cancel
                          </button>
                    </div>
                  </div>
                )}
                
                {/* Subtitle Files */}
                <div className="ml-8 space-y-2">
                  {pair.subtitles.map((subtitle, idx) => (
                    <div 
                      key={idx} 
                      className={`rounded p-3 border transition-all cursor-pointer shadow-sm hover:shadow-md`}
                      style={{
                        backgroundColor: themeColors.cardBackground,
                        borderColor: themeColors.border,
                        borderLeft: `3px solid ${themeColors.border}`
                      }}
                      onClick={(e) => {
                        // Prevent toggle when clicking on interactive elements
                        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA' || 
                            e.target.closest('button, a, select, input, textarea, [role="button"], [data-interactive]')) {
                          return;
                        }
                        onToggleUpload(subtitle.fullPath, !getUploadEnabled(subtitle.fullPath));
                      }}
                    >
                      <div className="space-y-2">
                        {/* Line 1: Filename and upload checkbox */}
                        <div className={`flex items-center justify-between gap-2 transition-colors`}
                          style={{
                            color: themeColors.text
                          }}>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-base font-medium">
                              {(() => {
                                const videoDir = pair.video.fullPath.includes('/') ? 
                                  pair.video.fullPath.substring(0, pair.video.fullPath.lastIndexOf('/')) : '';
                                const subtitlePath = subtitle.fullPath;
                                
                                if (videoDir && subtitlePath.startsWith(videoDir)) {
                                  return subtitlePath.substring(videoDir.length);
                                } else {
                                  return subtitlePath;
                                }
                              })()}
                            </span>
                            {/* MKV Extraction Indicator */}
                            {subtitle.extractedFromMkv && (
                              <span 
                                className="px-2 py-1 text-xs rounded font-medium"
                                style={{
                                  backgroundColor: themeColors.success || '#9EC068',
                                  color: '#fff'
                                }}
                                title={`Extracted from MKV: ${subtitle.originalMkvFile}`}
                              >
                                📹 MKV
                              </span>
                            )}
                            {/* Upload option badges */}
                            <div className="flex gap-1">
                              {(uploadOptions?.[subtitle.fullPath]?.hearingimpaired === '1' || localUploadStates?.[subtitle.fullPath]?.localHearingImpairedValue === '1') && 
                                <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.info + '20', color: themeColors.info }}>🦻 HI</span>}
                              {(uploadOptions?.[subtitle.fullPath]?.highdefinition === '1' || localUploadStates?.[subtitle.fullPath]?.localHdValue === '1') && 
                                <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.success + '20', color: themeColors.success }}>📺 HD</span>}
                              {(uploadOptions?.[subtitle.fullPath]?.automatictranslation === '1' || localUploadStates?.[subtitle.fullPath]?.localAutoTranslationValue === '1') && 
                                <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.warning + '20', color: themeColors.warning }}>🤖 Auto</span>}
                              {(uploadOptions?.[subtitle.fullPath]?.foreignpartsonly === '1' || localUploadStates?.[subtitle.fullPath]?.localForeignPartsValue === '1') && 
                                <span className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: themeColors.link + '20', color: themeColors.link }}>🎭 Foreign</span>}
                            </div>
                          </div>

                          {/* Upload Toggle Checkbox - Moved to right side */}
                          <div className="flex items-center">
                            <label className="flex items-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={getUploadEnabled(subtitle.fullPath)}
                                onChange={(e) => onToggleUpload(subtitle.fullPath, e.target.checked)}
                                className="w-4 h-4 rounded focus:ring-2"
                                style={{
                                  accentColor: themeColors.success,
                                  backgroundColor: themeColors.cardBackground,
                                  borderColor: themeColors.border
                                }}
                              />
                              <span className={`ml-1 text-xs font-medium transition-colors`}
                                style={{
                                  color: themeColors.success
                                }}>
                                Upload
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Line 2: Compact layout - Upload Options, Language dropdown, file info, and preview */}
                        {true && (
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
                                pairedVideoFile={pair.video}
                                onLocalStateChange={handleLocalStateChange}
                                compactMode={true}
                                isExpanded={uploadOptionsExpanded[subtitle.fullPath] ?? config?.uploadOptionsExpanded ?? false}
                                onToggleExpanded={() => handleUploadOptionsToggle(subtitle.fullPath)}
                                config={config}
                                hashCheckResults={hashCheckResults}
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
                                  border: `1px solid ${themeColors.border}`
                                }}
                                onFocus={(e) => {
                                  e.target.style.boxShadow = `0 0 0 1px ${themeColors.success}`;
                                }}
                                onBlur={(e) => {
                                  e.target.style.boxShadow = 'none';
                                }}
                              >
                                <span>
                                  {(() => {
                                    const detectedLanguage = getSubtitleLanguage(subtitle);
                                    if (detectedLanguage && combinedLanguages[detectedLanguage]) {
                                      return `${combinedLanguages[detectedLanguage].flag} ${combinedLanguages[detectedLanguage].displayName} (${combinedLanguages[detectedLanguage].iso639?.toUpperCase()})`;
                                    }
                                    return 'Select upload language...';
                                  })()}
                                </span>
                                <span className="ml-2">▼</span>
                              </button>

                              {openDropdowns[subtitle.fullPath] && (
                                <div className="absolute top-full left-0 mt-1 rounded shadow-lg z-10 min-w-[250px] max-h-60 overflow-hidden"
                                     style={{
                                       backgroundColor: themeColors.cardBackground,
                                       border: `1px solid ${themeColors.border}`
                                     }}>
                                  {/* Search input */}
                                  <div className="p-2" style={{borderBottom: `1px solid ${themeColors.border}`}}>
                                    <input
                                      type="text"
                                      placeholder="Type to search languages..."
                                      value={dropdownSearch[subtitle.fullPath] || ''}
                                      onChange={(e) => onDropdownSearch(subtitle.fullPath, e.target.value)}
                                      className="w-full text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1"
                                      style={{
                                        backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                                        color: themeColors.text,
                                        border: `1px solid ${themeColors.border}`
                                      }}
                                      onFocus={(e) => {
                                        e.target.style.boxShadow = `0 0 0 1px ${themeColors.success}`;
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.boxShadow = 'none';
                                      }}
                                      autoFocus
                                    />
                                  </div>
                                  
                                  {/* Language options */}
                                  <div className="max-h-48 overflow-y-auto">
                                    {getLanguageOptionsForSubtitle(subtitle)
                                      .filter((lang) => {
                                        const searchTerm = dropdownSearch[subtitle.fullPath] || '';
                                        if (!searchTerm) return true;
                                        const search = searchTerm.toLowerCase();
                                        return (
                                          lang.displayName?.toLowerCase().includes(search) ||
                                          lang.iso639?.toLowerCase().includes(search) ||
                                          lang.languageName?.toLowerCase().includes(search)
                                        );
                                      })
                                      .map((lang) => (
                                        <button
                                          key={lang.code}
                                          onClick={() => {
                                            onSubtitleLanguageChange(subtitle.fullPath, lang.code);
                                            onToggleDropdown(subtitle.fullPath);
                                          }}
                                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2"
                                          style={{backgroundColor: 'transparent'}}
                                          onMouseEnter={(e) => e.target.style.backgroundColor = isDark ? '#444444' : '#f8f9fa'}
                                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                          <span>{lang.flag}</span>
                                          <span style={{color: themeColors.text}}>{lang.displayName}</span>
                                          <span style={{color: themeColors.textSecondary}}>({lang.iso639?.toUpperCase()})</span>
                                          {lang.isDetected && (
                                            <span className="ml-auto font-semibold" style={{color: themeColors.success}}>
                                              {(lang.confidence * 100).toFixed(1)}%
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* File Info - Third position */}
                            <div className="flex items-center gap-2 text-sm flex-shrink-0" style={{color: themeColors.textSecondary}}>
                              <span>{formatFileSize(subtitle.size)}</span>
                              <span>•</span>
                              <span>
                                {subtitle.detectedLanguage && 
                                 typeof subtitle.detectedLanguage === 'object' && 
                                 subtitle.detectedLanguage.file_kind
                                  ? subtitle.detectedLanguage.file_kind
                                  : 'Subtitle File'}
                              </span>
                          
                          {/* Language-specific subtitle count - TEMPORARILY DISABLED */}
                          {null}

                            </div>

                            {/* Preview Button - Fourth position */}
                            <button
                              onClick={() => onSubtitlePreview(subtitle)}
                              className="text-sm underline transition-colors px-2 py-1 rounded flex-shrink-0"
                              style={{
                                color: themeColors.link
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.color = themeColors.linkHover;
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.color = themeColors.link;
                              }}
                            >
                              Preview
                            </button>
                          </div>
                        )}

                        {/* Upload Options Expanded Panel - Below the compact line */}
                        {true && (uploadOptionsExpanded[subtitle.fullPath] ?? config?.uploadOptionsExpanded ?? false) && (
                          <SubtitleUploadOptionsPanel
                            subtitlePath={subtitle.fullPath}
                            uploadOptions={uploadOptions?.[subtitle.fullPath] || {}}
                            onUpdateOptions={onUpdateUploadOptions}
                            colors={themeColors}
                            isDark={isDark}
                            subtitleFile={subtitle}
                            pairedVideoFile={pair.video}
                            onLocalStateChange={handleLocalStateChange}
                            hashCheckResults={hashCheckResults}
                            config={config}
                          />
                        )}

                        {/* CheckSubHash note - Completely separate line */}
                        {(() => {
                          const hashResult = hashCheckResults?.[subtitle.fullPath];
                          const shouldShow = hashResult && (
                            hashResult.exists === true ||
                            hashResult.found === true ||
                            hashResult.status === 'exists' ||
                            (hashResult.data && hashResult.data.length > 0) ||
                            hashResult === 'exists'
                          );
                          
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
                                💡 Duplicate found, but still good to upload for additional metadata.{' '}
                                {subtitleUrl ? (
                                  <a
                                    href={subtitleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                    style={{ color: themeColors.link }}
                                    onMouseEnter={(e) => {
                                      e.target.style.color = themeColors.linkHover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.color = themeColors.link;
                                    }}
                                  >
                                    View existing subtitle
                                  </a>
                                ) : (
                                  <span style={{ color: themeColors.textMuted }}>(No direct link available)</span>
                                )}
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
                              
                              // Check for successful new upload (from UploadSubtitles after alreadyindb=0)
                              if (result.status === '200 OK' && result.data && !result.alreadyindb) {
                                // This is a successful new upload response
                                const isDirectUrl = typeof result.data === 'string' && result.data.includes('opensubtitles.org');
                                return (
                                  <div className="text-sm">
                                    <span className="text-green-400">🎉 Successfully Uploaded as NEW!</span>
                                    {isDirectUrl && (
                                      <>
                                        <span className="text-gray-400"> - </span>
                                        <button
                                          className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                          title="View newly uploaded subtitle on OpenSubtitles.org"
                                          onClick={(e) => {
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
                                // When alreadyindb=1, subtitle already exists in database (duplicate)
                                // result.data might be the IDSubtitle directly or a struct containing it
                                const subtitleData = result.data;
                                console.log('DEBUG: alreadyindb=1 subtitleData:', subtitleData);
                                console.log('DEBUG: subtitleData type:', typeof subtitleData);
                                
                                // Handle different data formats
                                let subtitleId, movieName, languageCode;
                                
                                if (typeof subtitleData === 'string') {
                                  // If data is just the IDSubtitle string
                                  subtitleId = subtitleData;
                                } else if (typeof subtitleData === 'object' && subtitleData?.IDSubtitle) {
                                  // If data is a struct with IDSubtitle field
                                  subtitleId = subtitleData.IDSubtitle;
                                  movieName = subtitleData.MovieName;
                                  languageCode = subtitleData.ISO639;
                                }
                                
                                console.log('DEBUG: extracted subtitleId:', subtitleId);
                                const subtitleUrl = subtitleId ? `https://www.opensubtitles.org/subtitles/${subtitleId}` : null;
                                console.log('DEBUG: constructed subtitleUrl:', subtitleUrl);
                                
                                return (
                                  <div className="text-sm">
                                    <span className="text-yellow-400">⚠️ Already in Database</span>
                                    {subtitleUrl && (
                                      <>
                                        <span className="text-gray-400"> - </span>
                                        <button
                                          className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                          title={`View existing subtitle on OpenSubtitles.org (ID: ${subtitleId})`}
                                          onClick={async (e) => {
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
                              } else if ((result.alreadyindb === 0 || result.alreadyindb === '0') && result.status === '200 OK') {
                                // When alreadyindb=0 AND status=200 OK, it means successful new upload
                                const subtitleUrl = typeof result.data === 'string' ? result.data : null;
                                return (
                                  <div className="text-sm">
                                    <span className="text-green-400">🎉 New subtitle uploaded successfully!</span>
                                    {subtitleUrl && (
                                      <>
                                        <span className="text-gray-400"> - </span>
                                        <button
                                          className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                          title="View uploaded subtitle on OpenSubtitles.org"
                                          onClick={async (e) => {
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
                              } else if ((result.alreadyindb === 0 || result.alreadyindb === '0') && result.status !== '200 OK') {
                                // When alreadyindb=0 but status is not 200 OK, it means upload in progress or failed
                                return (
                                  <div className="text-sm">
                                    <span className="text-yellow-400">📤 Subtitle is not uploaded, uploading...</span>
                                  </div>
                                );
                              } else if (result.status === '200 OK') {
                                // For other successful responses
                                const subtitleId = typeof result.data === 'object' ? result.data?.IDSubtitle : result.data;
                                const subtitleUrl = subtitleId ? `https://www.opensubtitles.org/subtitles/${subtitleId}` : null;
                                return (
                                  <div className="text-sm">
                                    <span className="text-green-400">🎉 Upload completed</span>
                                    {subtitleUrl && (
                                      <>
                                        <span className="text-gray-400"> - </span>
                                        <button
                                          className="text-blue-300 hover:text-blue-200 underline bg-transparent border-none cursor-pointer p-0 font-semibold inline"
                                          title={`View subtitle on OpenSubtitles.org (ID: ${subtitleId})`}
                                          onClick={async (e) => {
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


                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};