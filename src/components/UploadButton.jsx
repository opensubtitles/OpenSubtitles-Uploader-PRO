import React from 'react';

export const UploadButton = ({
  pairedFiles,
  orphanedSubtitles = [],
  movieGuesses,
  featuresByImdbId,
  guessItData,
  getSubtitleLanguage,
  getUploadEnabled,
  onUpload,
  uploadProgress,
  hashCheckResults,
  hashCheckLoading,
  hashCheckProcessed,
  getHashCheckSummary,
  colors,
  isDark
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
  // Validate all upload requirements
  const validateUpload = () => {
    const errors = [];
    const warnings = [];
    let readySubtitlesCount = 0;

    // Group enabled subtitles by video file
    const videoGroups = new Map();
    pairedFiles.forEach(pair => {
      if (pair.video && pair.subtitles.length > 0) {
        const enabledSubtitles = pair.subtitles.filter(subtitle => getUploadEnabled(subtitle.fullPath));
        if (enabledSubtitles.length > 0) {
          videoGroups.set(pair.video.fullPath, {
            video: pair.video,
            subtitles: enabledSubtitles,
            movieData: movieGuesses[pair.video.fullPath]
          });
        }
      }
    });

    // Handle orphaned subtitles
    const enabledOrphanedSubtitles = orphanedSubtitles.filter(subtitle => getUploadEnabled(subtitle.fullPath));
    enabledOrphanedSubtitles.forEach(subtitle => {
      const subtitleName = subtitle.name || subtitle.fullPath.split('/').pop();
      
      
      // Helper function to create clickable error for orphaned subtitles
      const createClickableError = (message, subtitlePath) => {
        const elementId = `movie-${subtitlePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        return { message, elementId, videoName: subtitleName };
      };

      // Track if this orphaned subtitle has blocking errors
      let hasBlockingErrors = false;

      // Check if movie is identified for this orphaned subtitle
      const movieData = movieGuesses[subtitle.fullPath];
      console.log(`   - Movie data:`, movieData);
      
      if (!movieData || movieData === 'guessing' || movieData === 'error' || movieData === 'no-match') {
        let statusText = '';
        if (movieData === 'guessing') statusText = ' (still identifying...)';
        else if (movieData === 'error') statusText = ' (identification failed)';
        else if (movieData === 'no-match') statusText = ' (no match found)';
        
        console.log(`   - ❌ BLOCKING ERROR: Movie not identified${statusText}`);
        errors.push(createClickableError(`"${subtitleName}": Subtitle movie not identified${statusText}`, subtitle.fullPath));
        hasBlockingErrors = true;
      }

      // Check if we have a valid IMDb ID for upload
      const bestMovieData = !hasBlockingErrors ? getBestMovieData(subtitle.fullPath, movieData) : null;
      const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
        ? bestMovieData.imdbid 
        : movieData?.imdbid;

      console.log(`   - Best movie data:`, bestMovieData);
      console.log(`   - Upload IMDb ID: ${uploadImdbId}`);

      if (!hasBlockingErrors && !uploadImdbId) {
        console.log(`   - ❌ BLOCKING ERROR: No IMDb ID available`);
        errors.push(createClickableError(`"${subtitleName}": No IMDb ID available for upload`, subtitle.fullPath));
        hasBlockingErrors = true;
      }

      // Check if subtitle has language selected
      const subtitleLanguage = getSubtitleLanguage(subtitle);
      console.log(`   - Subtitle language: ${subtitleLanguage}`);
      
      if (!hasBlockingErrors && !subtitleLanguage) {
        console.log(`   - ❌ BLOCKING ERROR: No language selected`);
        errors.push(createClickableError(`"${subtitleName}": Upload language must be selected`, subtitle.fullPath));
        hasBlockingErrors = true;
      }

      // Check if we have features data for the upload IMDb ID (warnings only)
      if (!hasBlockingErrors) {
        const featuresData = featuresByImdbId[uploadImdbId];
        if (!featuresData) {
          warnings.push(createClickableError(`"${subtitleName}": Features data not loaded for IMDb ${uploadImdbId}`, subtitle.fullPath));
        } else if (featuresData.error) {
          warnings.push(createClickableError(`"${subtitleName}": Features data error for IMDb ${uploadImdbId}: ${featuresData.error}`, subtitle.fullPath));
        } else if (!featuresData.data?.[0]?.attributes) {
          warnings.push(createClickableError(`"${subtitleName}": Features data format error for IMDb ${uploadImdbId}`, subtitle.fullPath));
        }
      }

      // Count this orphaned subtitle as ready only if no blocking errors occurred
      if (!hasBlockingErrors) {
        console.log(`   - ✅ READY FOR UPLOAD: No blocking errors`);
        readySubtitlesCount++;
      } else {
        console.log(`   - ❌ SKIPPED: Has blocking errors`);
      }
    });

    if (videoGroups.size === 0 && enabledOrphanedSubtitles.length === 0) {
      errors.push("No subtitles selected for upload");
      return { isValid: false, errors, warnings, readySubtitlesCount };
    }

    // Validate each video group
    videoGroups.forEach(({ video, subtitles, movieData }, videoPath) => {
      const videoName = video.name || videoPath.split('/').pop();
      
      // Helper function to create clickable error with navigation
      const createClickableError = (message, videoPath) => {
        const elementId = `movie-${videoPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        return { message, elementId, videoName };
      };

      // Track if this video group has blocking errors
      let hasBlockingErrors = false;

      // Check if movie is identified
      if (!movieData || movieData === 'guessing' || movieData === 'error' || movieData === 'no-match') {
        let statusText = '';
        if (movieData === 'guessing') statusText = ' (still identifying...)';
        else if (movieData === 'error') statusText = ' (identification failed)';
        else if (movieData === 'no-match') statusText = ' (no match found)';
        
        errors.push(createClickableError(`"${videoName}": Movie not identified${statusText}`, videoPath));
        hasBlockingErrors = true;
      }

      // Check if we have a valid IMDb ID for upload
      const bestMovieData = !hasBlockingErrors ? getBestMovieData(videoPath, movieData) : null;
      const uploadImdbId = bestMovieData?.kind === 'episode' && bestMovieData.imdbid 
        ? bestMovieData.imdbid 
        : movieData?.imdbid;

      if (!hasBlockingErrors && !uploadImdbId) {
        errors.push(createClickableError(`"${videoName}": No IMDb ID available for upload`, videoPath));
        hasBlockingErrors = true;
      }

      // Check if all subtitles have languages selected
      const subtitlesWithoutLanguage = subtitles.filter(subtitle => !getSubtitleLanguage(subtitle));
      if (!hasBlockingErrors && subtitlesWithoutLanguage.length > 0) {
        if (subtitlesWithoutLanguage.length === 1) {
          const subtitleName = subtitlesWithoutLanguage[0].name || subtitlesWithoutLanguage[0].fullPath.split('/').pop();
          errors.push(createClickableError(`"${videoName}": Subtitle "${subtitleName}" needs upload language selected`, videoPath));
        } else {
          errors.push(createClickableError(`"${videoName}": ${subtitlesWithoutLanguage.length} subtitles need upload languages selected`, videoPath));
        }
        hasBlockingErrors = true;
      }

      // Check if we have features data for the upload IMDb ID (warnings only)
      if (!hasBlockingErrors) {
        const featuresData = featuresByImdbId[uploadImdbId];
        if (!featuresData) {
          warnings.push(createClickableError(`"${videoName}": Features data not loaded for IMDb ${uploadImdbId}`, videoPath));
        } else if (featuresData.error) {
          warnings.push(createClickableError(`"${videoName}": Features data error for IMDb ${uploadImdbId}: ${featuresData.error}`, videoPath));
        } else if (!featuresData.data?.[0]?.attributes) {
          warnings.push(createClickableError(`"${videoName}": Features data format error for IMDb ${uploadImdbId}`, videoPath));
        }
      }

      // Count subtitles as ready only if no blocking errors occurred
      if (!hasBlockingErrors) {
        readySubtitlesCount += subtitles.length;
      }
    });

    // Calculate total enabled subtitles (including orphaned)
    const totalSubtitles = Array.from(videoGroups.values()).reduce((sum, group) => sum + group.subtitles.length, 0) + enabledOrphanedSubtitles.length;


    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      readySubtitlesCount,
      totalSubtitles
    };
  };

  // Helper function to get best movie data (same logic as in components)
  const getBestMovieData = (videoPath, movieData) => {
    const featuresData = movieData?.imdbid ? featuresByImdbId[movieData.imdbid] : null;
    const guessItVideoData = guessItData[videoPath];
    
    // Try to find episode match if we have GuessIt data
    if (movieData && featuresData && guessItVideoData && typeof guessItVideoData === 'object') {
      if (featuresData?.data?.[0]?.attributes?.seasons && guessItVideoData) {
        const attributes = featuresData.data[0].attributes;
        
        if (attributes.feature_type === 'Tvshow' && guessItVideoData.season && guessItVideoData.episode) {
          const seasonNumber = parseInt(guessItVideoData.season);
          const episodeNumber = parseInt(guessItVideoData.episode);

          if (!isNaN(seasonNumber) && !isNaN(episodeNumber)) {
            const season = attributes.seasons.find(s => s.season_number === seasonNumber);
            if (season?.episodes) {
              const episode = season.episodes.find(e => e.episode_number === episodeNumber);
              if (episode) {
                return {
                  imdbid: episode.feature_imdb_id?.toString(),
                  title: `${attributes.title} - S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')} - ${episode.title}`,
                  year: attributes.year,
                  kind: 'episode',
                  season: seasonNumber,
                  episode: episodeNumber,
                  episode_title: episode.title,
                  show_title: attributes.title,
                  feature_id: episode.feature_id,
                  reason: 'Episode matched from GuessIt data'
                };
              }
            }
          }
        }
      }
    }

    return movieData;
  };

  const validation = validateUpload();
  const { isValid, errors, warnings, readySubtitlesCount, totalSubtitles } = validation;

  const isUploading = uploadProgress?.isUploading || false;
  const uploadProgressPercent = uploadProgress?.total > 0 ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) : 0;

  const handleUpload = () => {
    if (isValid && !isUploading && onUpload) {
      onUpload(validation);
    }
  };

  // Function to scroll to problematic component
  const scrollToComponent = (elementId) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Add a temporary highlight effect
      element.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.5)';
      setTimeout(() => {
        element.style.boxShadow = '';
      }, 2000);
    }
  };

  return (
    <div className="rounded-lg p-6 mt-6 shadow-sm" 
         style={{
           backgroundColor: themeColors.cardBackground,
           border: `1px solid ${themeColors.border}`
         }}>
      <div className="space-y-4">
        {/* Upload Status Summary */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2" style={{color: themeColors.text}}>Ready to Upload</h3>
            <div className="text-sm space-y-1" style={{color: themeColors.textSecondary}}>
              <div>
                <span className="font-medium">{readySubtitlesCount}</span> of{" "}
                <span className="font-medium">{totalSubtitles}</span> selected subtitles ready
              </div>
              {isValid && (
                <div className="flex items-center gap-2" style={{color: themeColors.success}}>
                  <span>✅</span>
                  <span>All requirements met!</span>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <div className="relative">
            <button
              onClick={handleUpload}
              disabled={!isValid || isUploading || uploadProgress?.isComplete}
              className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 transform text-white relative overflow-hidden ${
                isValid && !isUploading && !uploadProgress?.isComplete
                  ? 'hover:scale-105 shadow-lg cursor-pointer'
                  : 'cursor-not-allowed opacity-75'
              }`}
              style={{
                backgroundColor: uploadProgress?.isComplete ? themeColors.success :
                                isValid && !isUploading ? themeColors.link : themeColors.textMuted
              }}
              onMouseEnter={(e) => {
                if (isValid && !isUploading && !uploadProgress?.isComplete) {
                  e.target.style.backgroundColor = themeColors.linkHover;
                }
              }}
              onMouseLeave={(e) => {
                if (isValid && !isUploading && !uploadProgress?.isComplete) {
                  e.target.style.backgroundColor = themeColors.link;
                } else if (uploadProgress?.isComplete) {
                  e.target.style.backgroundColor = themeColors.success;
                }
              }}
            >
              {/* Progress Bar Background */}
              {isUploading && (
                <div 
                  className="absolute inset-0 transition-all duration-300"
                  style={{
                    background: `linear-gradient(to right, ${themeColors.success} ${uploadProgressPercent}%, transparent ${uploadProgressPercent}%)`,
                    opacity: 0.3
                  }}
                />
              )}
              
              {/* Button Content */}
              <div className="relative z-10">
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>UPLOADING... {uploadProgressPercent}%</span>
                    <span className="px-2 py-1 rounded text-sm" style={{backgroundColor: 'rgba(255,255,255,0.2)'}}>
                      {uploadProgress.processed}/{uploadProgress.total}
                    </span>
                  </div>
                ) : uploadProgress?.isComplete ? (
                  <div className="flex items-center gap-3">
                    <span>✅</span>
                    <span>UPLOAD COMPLETE</span>
                    <span className="px-2 py-1 rounded text-sm" style={{backgroundColor: themeColors.success}}>
                      Done
                    </span>
                  </div>
                ) : isValid ? (
                  <div className="flex items-center gap-3">
                    <span>🚀</span>
                    <span>UPLOAD SUBTITLES</span>
                    <span className="px-2 py-1 rounded text-sm" style={{backgroundColor: '#185DA0'}}>
                      {readySubtitlesCount}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span>⚠️</span>
                    <span>REQUIREMENTS NOT MET</span>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="rounded-lg p-4" 
               style={{
                 backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
                 border: `1px solid ${themeColors.border}`
               }}>
            <h4 className="font-semibold mb-2 flex items-center gap-2" style={{color: themeColors.text}}>
              <span>❌</span>
              <span>Upload Requirements Not Met:</span>
            </h4>
            <ul className="space-y-1 text-sm" style={{color: themeColors.textSecondary}}>
              {errors.map((error, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-0.5" style={{color: themeColors.link}}>•</span>
                  {typeof error === 'string' ? (
                    <span>{error}</span>
                  ) : (
                    <button
                      onClick={() => scrollToComponent(error.elementId)}
                      className="text-left hover:underline transition-colors"
                      style={{color: themeColors.link}}
                      onMouseEnter={(e) => {
                        e.target.style.color = themeColors.linkHover;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = themeColors.link;
                      }}
                      title="Click to navigate to this component"
                    >
                      {error.message}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg p-4" 
               style={{
                 backgroundColor: isDark ? '#4a3a00' : '#fffbf0',
                 border: `1px solid ${themeColors.warning}`
               }}>
            <h4 className="font-semibold mb-2 flex items-center gap-2" style={{color: themeColors.warning}}>
              <span>⚠️</span>
              <span>Warnings:</span>
            </h4>
            <ul className="space-y-1 text-sm" style={{color: themeColors.warning}}>
              {warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-0.5" style={{color: themeColors.warning}}>•</span>
                  {typeof warning === 'string' ? (
                    <span>{warning}</span>
                  ) : (
                    <button
                      onClick={() => scrollToComponent(warning.elementId)}
                      className="text-left hover:underline transition-colors"
                      style={{color: themeColors.warning}}
                      onMouseEnter={(e) => {
                        e.target.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.opacity = '1';
                      }}
                      title="Click to navigate to this component"
                    >
                      {warning.message}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}



        {/* Upload Requirements Checklist */}
        {!isValid && (
          <div className="rounded-lg p-4" 
               style={{
                 backgroundColor: isDark ? '#2a3a4a' : '#f0f8ff',
                 border: `1px solid ${themeColors.link}`
               }}>
            <h4 className="font-semibold mb-3 flex items-center gap-2" 
                style={{color: themeColors.link}}>
              <span>📋</span>
              <span>Upload Requirements:</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span style={{color: totalSubtitles > 0 ? themeColors.success : themeColors.error}}>
                  {totalSubtitles > 0 ? "✅" : "❌"}
                </span>
                <span style={{color: themeColors.textSecondary}}>Select subtitles for upload</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{color: themeColors.textMuted}}>🎬</span>
                <span style={{color: themeColors.textSecondary}}>Movies must be identified</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{color: themeColors.textMuted}}>🔗</span>
                <span style={{color: themeColors.textSecondary}}>IMDb IDs must be available</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{color: themeColors.textMuted}}>🌍</span>
                <span style={{color: themeColors.textSecondary}}>Languages must be selected</span>
              </div>
            </div>
          </div>
        )}

        {/* Inline Upload Progress and Results */}
        {uploadProgress && (uploadProgress.isUploading || uploadProgress.isComplete) && (
          <div className="mt-6 rounded-lg p-6 border-2" 
               style={{
                 backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                 borderColor: uploadProgress.isComplete ? themeColors.success : themeColors.link
               }}>
            
            {/* Upload Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {uploadProgress.isUploading ? '⬆️' : uploadProgress.isComplete ? '✅' : '📤'}
                </span>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: themeColors.text }}>
                    {uploadProgress.isUploading ? 'Uploading Subtitles...' : 
                     uploadProgress.isComplete ? 'Upload Complete!' : 'Upload Progress'}
                  </h3>
                  <p className="text-sm" style={{ color: themeColors.textSecondary }}>
                    {uploadProgress.isUploading ? `Processing ${uploadProgress.processed} of ${uploadProgress.total} subtitles` :
                     uploadProgress.isComplete ? `Finished processing ${uploadProgress.total} subtitles` :
                     'Ready to upload'}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span style={{ color: themeColors.text }}>Overall Progress</span>
                <span style={{ color: themeColors.textSecondary }}>
                  {uploadProgress.total > 0 ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) : 0}%
                </span>
              </div>
              <div 
                className="w-full h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: isDark ? '#1a1a1a' : '#e0e0e0' }}
              >
                <div 
                  className="h-full transition-all duration-300 ease-out"
                  style={{ 
                    width: `${uploadProgress.total > 0 ? (uploadProgress.processed / uploadProgress.total) * 100 : 0}%`,
                    backgroundColor: uploadProgress.isComplete ? themeColors.success : themeColors.link
                  }}
                />
              </div>
              <div className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                {uploadProgress.processed} of {uploadProgress.total} subtitles processed
              </div>
            </div>

            {/* Current Processing (only during upload) */}
            {uploadProgress.isUploading && uploadProgress.currentSubtitle && (
              <div className="mb-6">
                <div className="text-sm font-medium mb-2" style={{ color: themeColors.text }}>
                  Currently Processing:
                </div>
                <div 
                  className="p-3 rounded-lg text-sm font-mono break-all"
                  style={{ 
                    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                    color: themeColors.textSecondary,
                    border: `1px solid ${themeColors.border}`
                  }}
                >
                  {uploadProgress.currentSubtitle}
                </div>
              </div>
            )}

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg" 
                   style={{ backgroundColor: isDark ? '#1a4a2a' : '#e8f5e8' }}>
                <div className="text-2xl font-bold" style={{ color: themeColors.success }}>
                  {uploadProgress.successful}
                </div>
                <div className="text-sm" style={{ color: themeColors.text }}>
                  Successfully Uploaded
                </div>
              </div>
              
              <div className="text-center p-4 rounded-lg" 
                   style={{ backgroundColor: isDark ? '#4a3a1a' : '#fff5e6' }}>
                <div className="text-2xl font-bold" style={{ color: themeColors.warning }}>
                  {uploadProgress.alreadyExists}
                </div>
                <div className="text-sm" style={{ color: themeColors.text }}>
                  Already in Database
                </div>
              </div>
              
              <div className="text-center p-4 rounded-lg" 
                   style={{ backgroundColor: isDark ? '#4a1a1a' : '#ffe6e6' }}>
                <div className="text-2xl font-bold" style={{ color: themeColors.error }}>
                  {uploadProgress.failed}
                </div>
                <div className="text-sm" style={{ color: themeColors.text }}>
                  Failed
                </div>
              </div>
            </div>

            {/* Detailed Results (when complete) */}
            {uploadProgress.isComplete && uploadProgress.results && uploadProgress.results.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-3" style={{ color: themeColors.text }}>
                  Upload Results
                </h4>
                <div 
                  className="max-h-64 overflow-y-auto space-y-2 p-3 rounded-lg"
                  style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${themeColors.border}` }}
                >
                  {uploadProgress.results.map((result, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded text-sm"
                      style={{ 
                        backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa',
                        borderLeft: `3px solid ${
                          result.status === 'success' ? themeColors.success :
                          result.status === 'exists' ? themeColors.warning :
                          themeColors.error
                        }`
                      }}
                    >
                      <span className="text-lg">
                        {result.status === 'success' ? '✅' :
                         result.status === 'exists' ? '⚠️' : '❌'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: themeColors.text }}>
                          {result.filename}
                        </div>
                        <div style={{ color: themeColors.textSecondary }}>
                          {result.message}
                        </div>
                        {result.url && (
                          <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs hover:underline mt-1 inline-block"
                            style={{ color: themeColors.link }}
                          >
                            View on OpenSubtitles.org
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading Animation (during upload) */}
            {uploadProgress.isUploading && (
              <div className="flex items-center justify-center space-x-2 py-4 mt-4">
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ 
                        backgroundColor: themeColors.link,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: '1s'
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm" style={{ color: themeColors.textSecondary }}>
                  Please wait, uploading subtitles...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};