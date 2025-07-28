import React, { useState } from 'react';
import { formatFileSize, areTitlesSimilar } from '../../utils/fileUtils.js';
import { XmlRpcService } from '../../services/api/xmlrpc.js';

export const VideoFile = ({ video, movieGuess, features, onMovieChange, colors, isDark, isOrphanedSubtitle = false }) => {
  const [showMovieSearch, setShowMovieSearch] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  // Helper function to check if input is IMDb ID or URL
  const isImdbInput = (input) => {
    return input.match(/^(tt\d+|https?:\/\/.*imdb\.com.*\/title\/tt\d+)/i);
  };

  // Handle movie search
  const handleMovieSearch = async (query) => {
    setMovieSearchQuery(query);
    
    if (!query || query.length < 2) {
      setMovieSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      let results = [];
      
      // Check if it's an IMDb ID or URL
      if (isImdbInput(query)) {
        let imdbId = query;
        if (query.includes('imdb.com')) {
          const match = query.match(/\/title\/(tt\d+)/i);
          imdbId = match ? match[1] : query;
        }
        if (imdbId.startsWith('tt')) {
          imdbId = imdbId.substring(2);
        }
        
        // For IMDb ID input, try to get movie details
        try {
          const movieData = await XmlRpcService.guessMovieFromStringWithRetry(query);
          if (movieData && movieData.title) {
            results = [movieData];
          }
        } catch (error) {
          console.log('Direct IMDb lookup failed, trying search');
        }
      } else {
        // Regular search
        const searchResults = await XmlRpcService.searchMovies(query);
        results = searchResults || [];
      }
      
      setMovieSearchResults(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Movie search error:', error);
      setMovieSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle movie selection
  const handleMovieSelect = async (selectedMovie) => {
    try {
      if (onMovieChange) {
        await onMovieChange(video.fullPath, selectedMovie);
      }
      setShowMovieSearch(false);
      setMovieSearchQuery('');
      setMovieSearchResults([]);
    } catch (error) {
      console.error('Error selecting movie:', error);
    }
  };

  return (
    <div className="mb-3 rounded-lg p-3 shadow-sm" style={{backgroundColor: colors?.cardBackground || '#fff', border: `1px solid ${colors?.link || '#185DA0'}`, borderLeft: `4px solid ${colors?.link || '#185DA0'}`}}>
      <div className="flex items-center gap-3" style={{color: colors?.textSecondary || '#454545'}}>
        <span className="text-2xl">🎬</span>
        <div className="flex-1">
          <div className="font-semibold flex items-center gap-2" style={{color: colors?.text || '#000'}}>
            {video.name}
            {/* Always show MKV status if it's an MKV file */}
            {video.hasMkvSubtitleExtraction && (
              <span className="ml-2" key={`mkv-status-${video.mkvExtractionStatus}-${video.extractedCount}`}>
                {video.mkvExtractionStatus === 'pending' && (
                  <span 
                    className="px-2 py-1 text-xs rounded font-medium flex items-center gap-1"
                    style={{
                      backgroundColor: colors?.warning + '20' || '#ffc10720',
                      color: colors?.warning || '#ffc107'
                    }}
                    title="MKV subtitle extraction will start..."
                  >
                    ⏳ MKV Pending
                  </span>
                )}
                {(video.mkvExtractionStatus === 'detecting' || video.mkvExtractionStatus === 'extracting' || video.mkvExtractionStatus === 'extracting_all') && (
                  <span 
                    className="px-2 py-1 text-xs rounded font-medium flex items-center gap-1"
                    style={{
                      backgroundColor: colors?.link + '20' || '#2878C020',
                      color: colors?.link || '#2878C0'
                    }}
                    title={
                      video.mkvExtractionStatus === 'detecting' 
                        ? "Detecting embedded subtitles in MKV..." 
                        : video.mkvExtractionStatus === 'extracting_all' 
                          ? `Extracting ${video.extractedCount || 0}/${video.streamCount || 0} subtitles from MKV...`
                          : "Extracting embedded subtitles from MKV..."
                    }
                  >
                    <div className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                    {video.mkvExtractionStatus === 'detecting' && 'Detecting...'}
                    {video.mkvExtractionStatus === 'extracting_all' && `Extracting ${video.extractedCount || 0}/${video.streamCount || 0}`}
                    {video.mkvExtractionStatus === 'extracting' && 'Extracting...'}
                  </span>
                )}
                {video.mkvExtractionStatus === 'completed' && (
                  <span 
                    className="px-2 py-1 text-xs rounded font-medium"
                    style={{
                      backgroundColor: colors?.success + '20' || '#9EC06820',
                      color: colors?.success || '#9EC068'
                    }}
                    title={`Extracted ${video.extractedCount || 0}/${video.streamCount || 0} subtitle(s) from MKV`}
                  >
                    ✅ {video.extractedCount || 0}/{video.streamCount || 0} Extracted
                  </span>
                )}
                {(video.mkvExtractionStatus === 'no_subtitles' || video.mkvExtractionStatus === 'no_streams') && (
                  <span 
                    className="px-2 py-1 text-xs rounded font-medium"
                    style={{
                      backgroundColor: colors?.textMuted + '20' || '#80808020',
                      color: colors?.textMuted || '#808080'
                    }}
                    title="No embedded subtitles found in MKV"
                  >
                    📝 No Subtitles
                  </span>
                )}
                {video.mkvExtractionStatus === 'error' && (
                  <span 
                    className="px-2 py-1 text-xs rounded font-medium"
                    style={{
                      backgroundColor: colors?.error + '20' || '#dc354520',
                      color: colors?.error || '#dc3545'
                    }}
                    title={`MKV extraction failed: ${video.mkvExtractionError || 'Unknown error'}`}
                  >
                    ❌ Error
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="text-sm flex items-center gap-2 mt-1" style={{color: colors?.textSecondary || '#454545'}}>
            <span title={`File Size: ${formatFileSize(video.size)}`}>📁{formatFileSize(video.size)}</span>
            
            {/* Also show MKV status in the details line for extra visibility */}
            {video.hasMkvSubtitleExtraction && video.mkvExtractionStatus && video.mkvExtractionStatus !== 'pending' && (
              <span 
                className="px-1 py-0.5 text-xs rounded font-medium"
                style={{
                  backgroundColor: 
                    video.mkvExtractionStatus === 'completed' 
                      ? (colors?.success + '30' || '#9EC06830')
                      : (colors?.link + '30' || '#2878C030'),
                  color: 
                    video.mkvExtractionStatus === 'completed' 
                      ? (colors?.success || '#9EC068')
                      : (colors?.link || '#2878C0')
                }}
                title={`MKV Status: ${video.mkvExtractionStatus}`}
              >
                {video.mkvExtractionStatus === 'detecting' && '🔍 Detecting MKV streams'}
                {video.mkvExtractionStatus === 'extracting_all' && `🔄 Extracting ${video.extractedCount || 0}/${video.streamCount || 0}`}
                {video.mkvExtractionStatus === 'completed' && `✅ MKV: ${video.extractedCount || 0}/${video.streamCount || 0} extracted`}
                {video.mkvExtractionStatus === 'no_streams' && '📝 MKV: No subtitles'}
                {video.mkvExtractionStatus === 'error' && '❌ MKV: Error'}
              </span>
            )}
            
            {/* Only show movie hash for actual video files, not orphaned subtitles */}
            {!isOrphanedSubtitle && video.movieHash && video.movieHash !== 'error' && (
              <span title={`Movie Hash: ${video.movieHash}`}>🔗{video.movieHash}</span>
            )}
            
            {!isOrphanedSubtitle && video.movieHash === 'error' && (
              <span title="Hash calculation failed" style={{color: colors?.textMuted || '#808080'}}>
                <span>❌</span>
                <span className="text-xs">Hash calculation failed</span>
              </span>
            )}
            
            {!isOrphanedSubtitle && !video.movieHash && (
              <span title="Calculating hash..." style={{color: colors?.link || '#2878C0'}}>
                <div className="w-3 h-3 border rounded-full animate-spin" style={{borderColor: colors?.link || '#2878C0', borderTopColor: 'transparent'}}></div>
                <span className="text-xs">Calculating hash...</span>
              </span>
            )}
          </div>
          
          {/* Movie Guess Information */}
          {movieGuess && (
            <div className="text-sm mt-2" style={{color: colors?.textSecondary || '#6b7280'}}>
              {movieGuess === 'guessing' && (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 border rounded-full animate-spin" style={{borderColor: colors?.link || '#2878C0', borderTopColor: 'transparent'}}></div>
                  <span>Identifying movie...</span>
                </span>
              )}
              
              {movieGuess === 'error' && (
                <span className="flex items-center gap-1" style={{color: colors?.error || '#dc3545'}}>
                  <span>❌</span>
                  <span>Movie identification failed</span>
                </span>
              )}
              
              {movieGuess === 'no-match' && (
                <span className="flex items-center gap-1" style={{color: colors?.warning || '#ffc107'}}>
                  <span>❓</span>
                  <span>No movie match found</span>
                </span>
              )}
              
              {typeof movieGuess === 'object' && movieGuess && (
                <div className="rounded p-3 mt-2" style={{backgroundColor: colors?.background || '#f8f9fa', border: `1px solid ${colors?.border || '#ccc'}`}}>
                  {/* Change button for orphaned subtitles */}
                  {isOrphanedSubtitle && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium" style={{color: colors?.text}}>
                        Movie Identification
                      </div>
                      <button
                        onClick={() => setShowMovieSearch(!showMovieSearch)}
                        className="text-xs px-3 py-1 rounded transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          color: colors?.textSecondary || '#454545',
                          border: `1px solid ${colors?.border || '#ccc'}`
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = colors?.link || '#2878C0';
                          e.target.style.borderColor = colors?.link || '#2878C0';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = colors?.textSecondary || '#454545';
                          e.target.style.borderColor = colors?.border || '#ccc';
                        }}
                        title="Change movie identification"
                      >
                        ✏️ Change
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Movie Poster */}
                    {movieGuess.imdbid && features?.data?.[0]?.attributes?.img_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={(() => {
                            const imgUrl = features.data[0].attributes.img_url;
                            
                            // Check if img_url contains "no-poster" and use fallback
                            if (imgUrl.includes('no-poster')) {
                              return 'https://static.opensubtitles.org/gfx/empty_cover.jpg';
                            }
                            
                            // Use original URL, add domain if relative
                            return imgUrl.startsWith('http') 
                              ? imgUrl
                              : `https://www.opensubtitles.com${imgUrl}`;
                          })()}
                          alt={`${movieGuess.title} Poster`}
                          className="w-20 h-30 sm:w-24 sm:h-36 object-cover rounded"
                          style={{border: '1px solid #ccc', backgroundColor: '#f4f4f4'}}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Movie Information */}
                    <div className="flex-1 space-y-2">
                      {/* Main Title */}
                      <div className="font-semibold text-sm" style={{color: colors?.text || '#000'}}>
                        🎬 {features?.data?.[0]?.attributes?.original_title || movieGuess.title}
                        {(features?.data?.[0]?.attributes?.year || movieGuess.year) && 
                          ` (${features?.data?.[0]?.attributes?.year || movieGuess.year})`}
                      </div>
                      
                      {/* Movie Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {/* Features API data takes priority */}
                        {features?.data?.[0]?.attributes ? (
                          <>
                            {features.data[0].attributes.feature_type && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>Type:</span>{" "}
                                <span style={{color: colors?.text || '#000'}} className="capitalize">
                                  {features.data[0].attributes.feature_type.replace('_', ' ')}
                                </span>
                              </div>
                            )}
                            {(() => {
                              const mainTitle = movieGuess.title;
                              const originalTitle = features.data[0].attributes.original_title;
                              const englishTitle = features.data[0].attributes.title;
                              
                              // Show original title if it's different from the main title
                              const showOriginal = originalTitle && mainTitle && !areTitlesSimilar(originalTitle, mainTitle);
                              
                              console.log('Title debug (VideoFile):', {
                                mainTitle,
                                originalTitle,
                                englishTitle,
                                showOriginal,
                                mainTitleExists: !!mainTitle,
                                originalTitleExists: !!originalTitle
                              });
                              
                              return showOriginal && (
                                <div>
                                  <span style={{color: colors?.link || '#2878C0'}}>Original:</span>{" "}
                                  <span style={{color: colors?.text || '#000'}}>{originalTitle}</span>
                                </div>
                              );
                            })()}
                            {features.data[0].attributes.genres && features.data[0].attributes.genres.length > 0 && (
                              <div className="sm:col-span-2">
                                <span style={{color: colors?.link || '#2878C0'}}>Genres:</span>{" "}
                                <span style={{color: colors?.text || '#000'}}>
                                  {features.data[0].attributes.genres.slice(0, 3).join(', ')}
                                  {features.data[0].attributes.genres.length > 3 && '...'}
                                </span>
                              </div>
                            )}
                            {features.data[0].attributes.moviebyte_file_size && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>File Size:</span>{" "}
                                <span style={{color: colors?.text || '#000'}}>{(features.data[0].attributes.moviebyte_file_size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                              </div>
                            )}
                            {features.data[0].attributes.fps && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>FPS:</span>{" "}
                                <span style={{color: colors?.text || '#000'}}>{features.data[0].attributes.fps}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Fallback to XML-RPC data */
                          <>
                            {movieGuess.kind && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>Type:</span>{" "}
                                <span style={{color: colors?.text || '#000'}} className="capitalize">{movieGuess.kind.replace('_', ' ')}</span>
                              </div>
                            )}
                            {movieGuess.season && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>Season:</span>{" "}
                                <span style={{color: colors?.text || '#000'}}>{movieGuess.season}</span>
                              </div>
                            )}
                            {movieGuess.episode && (
                              <div>
                                <span style={{color: colors?.link || '#2878C0'}}>Episode:</span>{" "}
                                <span style={{color: colors?.text || '#000'}}>{movieGuess.episode}</span>
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Always show IMDb ID */}
                        <div className="sm:col-span-2">
                          <span style={{color: colors?.link || '#2878C0'}}>IMDb ID:</span>{" "}
                          <a 
                            href={`https://www.imdb.com/title/tt${movieGuess.imdbid}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-mono"
                            style={{color: colors?.link || '#2878C0'}}
                            onMouseEnter={(e) => e.target.style.color = colors?.linkHover || '#185DA0'}
                            onMouseLeave={(e) => e.target.style.color = colors?.link || '#2878C0'}
                          >
                            {movieGuess.imdbid}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Movie Search UI for orphaned subtitles */}
              {isOrphanedSubtitle && showMovieSearch && (
                <div className="mt-3 p-3 rounded" style={{backgroundColor: colors?.cardBackground || '#fff', border: `1px solid ${colors?.border || '#ccc'}`}}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{color: colors?.text}}>
                        Search for the correct movie
                      </label>
                      <input
                        type="text"
                        placeholder="Movie title, IMDB ID (tt0133093), or IMDB URL..."
                        value={movieSearchQuery}
                        onChange={(e) => handleMovieSearch(e.target.value)}
                        className="w-full text-sm px-3 py-2 rounded border focus:outline-none focus:ring-1"
                        style={{
                          backgroundColor: colors?.cardBackground || '#fff',
                          color: colors?.text || '#000',
                          borderColor: isImdbInput(movieSearchQuery) ? (colors?.success || '#9EC068') : (colors?.border || '#ccc'),
                          focusRingColor: colors?.link || '#2878C0'
                        }}
                      />
                    </div>

                    {/* Search Results */}
                    {isSearching && (
                      <div className="flex items-center gap-2 text-sm" style={{color: colors?.textSecondary}}>
                        <div className="w-3 h-3 border rounded-full animate-spin" style={{borderColor: colors?.link || '#2878C0', borderTopColor: 'transparent'}}></div>
                        <span>Searching...</span>
                      </div>
                    )}

                    {movieSearchResults.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <div className="text-sm font-medium" style={{color: colors?.text}}>
                          Search Results:
                        </div>
                        {movieSearchResults.map((movie, index) => (
                          <button
                            key={index}
                            onClick={() => handleMovieSelect(movie)}
                            className="w-full text-left p-3 rounded border transition-all hover:shadow-sm"
                            style={{
                              backgroundColor: colors?.background || '#f8f9fa',
                              borderColor: colors?.border || '#ccc'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = colors?.cardBackground || '#fff';
                              e.target.style.borderColor = colors?.link || '#2878C0';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = colors?.background || '#f8f9fa';
                              e.target.style.borderColor = colors?.border || '#ccc';
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="font-medium text-sm" style={{color: colors?.text}}>
                                  {movie.title} {movie.year && `(${movie.year})`}
                                </div>
                                <div className="text-xs mt-1" style={{color: colors?.textSecondary}}>
                                  IMDb: {movie.imdbid} | Kind: {movie.kind || 'movie'}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {movieSearchQuery && movieSearchResults.length === 0 && !isSearching && (
                      <div className="text-sm text-center py-3" style={{color: colors?.textMuted}}>
                        No movies found. Try a different search term.
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowMovieSearch(false);
                          setMovieSearchQuery('');
                          setMovieSearchResults([]);
                        }}
                        className="text-xs px-3 py-1 rounded transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          color: colors?.textSecondary || '#454545',
                          border: `1px solid ${colors?.border || '#ccc'}`
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = colors?.background || '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};