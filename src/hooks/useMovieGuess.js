import { useState, useCallback, useRef, useEffect } from 'react';
import { XmlRpcService } from '../services/api/xmlrpc.js';
import { OpenSubtitlesApiService } from '../services/api/openSubtitlesApi.js';
import { MovieHashService } from '../services/movieHash.js';
import { OfflineGuessItService } from '../services/offlineGuessItService.js';
import { detectVideoFileInfo, getBestMovieDetectionName } from '../utils/fileUtils.js';

/**
 * Custom hook for movie guessing and hash calculation
 */
export const useMovieGuess = (addDebugInfo, setGuessItDataForFile) => {
  const [movieGuesses, setMovieGuesses] = useState({});
  const [featuresByImdbId, setFeaturesByImdbId] = useState({});
  const [featuresLoading, setFeaturesLoading] = useState({});

  // Track which files are currently being processed to prevent duplicates
  const processingFiles = useRef(new Set());
  const failedFiles = useRef(new Set());

  // Manually set a movie guess (for user selections)
  const setMovieGuess = useCallback((videoPath, movieGuess) => {
    setMovieGuesses(prev => ({
      ...prev,
      [videoPath]: movieGuess,
    }));
  }, []);

  // Calculate movie hash for a file
  const calculateHash = useCallback(
    async videoFile => {
      try {
        addDebugInfo(`Calculating movie hash for ${videoFile.name}`);
        const hash = await MovieHashService.calculateMovieHashWithRetry(
          videoFile.file,
          addDebugInfo
        );
        addDebugInfo(`Movie hash calculated: ${hash}`);
        return hash;
      } catch (error) {
        addDebugInfo(`Movie hash calculation failed for ${videoFile.name}: ${error.message}`);
        return 'error';
      }
    },
    [addDebugInfo]
  );

  // Use refs to track current state without causing dependency issues
  const featuresByImdbIdRef = useRef(featuresByImdbId);
  const featuresLoadingRef = useRef(featuresLoading);

  // Update refs when state changes
  useEffect(() => {
    featuresByImdbIdRef.current = featuresByImdbId;
  }, [featuresByImdbId]);

  useEffect(() => {
    featuresLoadingRef.current = featuresLoading;
  }, [featuresLoading]);

  // BASIC: Fetch features by IMDb ID (without episode detection)
  const fetchFeaturesByImdbId = useCallback(
    async imdbId => {
      if (!imdbId) return;

      try {
        // Check if we already have this data using refs
        if (featuresByImdbIdRef.current[imdbId]) {
          addDebugInfo(`Features already cached for IMDb ID: ${imdbId}`);
          return featuresByImdbIdRef.current[imdbId];
        }

        // Check if already loading using refs
        if (featuresLoadingRef.current[imdbId]) {
          addDebugInfo(`Features already loading for IMDb ID: ${imdbId}`);
          return;
        }

        addDebugInfo(`Fetching features for IMDb ID: ${imdbId}`);

        // Set loading state
        setFeaturesLoading(prev => ({
          ...prev,
          [imdbId]: true,
        }));

        const features = await OpenSubtitlesApiService.getFeaturesByImdbId(imdbId);

        setFeaturesByImdbId(prev => ({
          ...prev,
          [imdbId]: features,
        }));

        return features;
      } catch (error) {
        addDebugInfo(`Features fetch failed for IMDb ID ${imdbId}: ${error.message}`);
        setFeaturesByImdbId(prev => ({
          ...prev,
          [imdbId]: { error: error.message },
        }));
        return null;
      } finally {
        // Clear loading state
        setFeaturesLoading(prev => ({
          ...prev,
          [imdbId]: false,
        }));
      }
    },
    [addDebugInfo]
  );

  // Extract directory name from file path for fallback movie guessing
  const extractDirectoryName = useCallback(fullPath => {
    if (!fullPath) return null;

    // Split path and get directory parts (remove filename)
    const pathParts = fullPath.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;

    // Get the immediate parent directory name
    const directoryName = pathParts[pathParts.length - 2];

    // Clean up the directory name for better matching
    // Remove common patterns but keep years in parentheses
    const cleanedName = directoryName
      .replace(/\[.*?\]/g, '') // Remove content in brackets like [1080p] [WEBRip] [5.1] [YTS.MX]
      .replace(/\((?!\d{4})[^)]*\)/g, '') // Remove content in parentheses EXCEPT years (4 digits)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // If the cleaned name is too short, use original
    if (cleanedName.length < 3) {
      return directoryName;
    }

    return cleanedName;
  }, []);

  // Helper function to generate a movie key for deduplication
  const getMovieKey = useCallback(file => {
    // For files in the same directory with similar names, use the base movie name
    const pathParts = file.fullPath.split('/');
    const directory = pathParts.slice(0, -1).join('/');
    const fileName = file.name;

    // Remove common subtitle/audio/quality indicators and extensions
    const baseName = fileName
      .replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|srt|sub|ass|ssa|vtt)$/i, '') // Remove extensions
      .replace(
        /\.(en|eng|spanish|french|german|italian|czech|cz|sk|slovak|chinese|japanese|korean|russian|ru|pl|polish|de|fr|es|it|pt|nl|sv|no|da|fi|hu|hr|sr|bg|ro|el|tr|ar|he|hi|th|vi|id|ms|tl|uk|ca|eu|gl|cy|ga|mt|is|lv|lt|et|sl|mk|sq|bs|hr|sr|me|cs|sk)$/i,
        ''
      ) // Remove language codes
      .replace(
        /\.(720p|1080p|2160p|4k|hd|fhd|uhd|bluray|brrip|dvdrip|webrip|hdtv|web-dl|webdl|ac3|dts|aac|mp3|5\.1|7\.1|x264|x265|hevc|h264|h265|xvid|divx)$/i,
        ''
      ) // Remove quality/codec indicators
      .replace(/\.(cd1|cd2|disc1|disc2|part1|part2|pt1|pt2)$/i, '') // Remove disc/part indicators
      .trim();

    return `${directory}/${baseName}`;
  }, []);

  // SAFE: Create episode-specific movie data from GuessIt results (with proper async handling)
  const createEpisodeMovieData = useCallback(
    async (movieGuess, filePath, fileName) => {
      try {
        addDebugInfo(`🔍 Starting GuessIt episode detection for: ${fileName}`);

        // Use WASM GuessIt to extract episode information from filename
        const guessItData = await OfflineGuessItService.enhancedGuess(fileName);

        // Debug: Show raw GuessIt output
        addDebugInfo(`📊 GuessIt raw output for ${fileName}:`);
        addDebugInfo(JSON.stringify(guessItData, null, 2));

        // Debug: Show episode info specifically
        if (guessItData?.episode_info) {
          addDebugInfo(`📺 Episode info for ${fileName}:`);
          addDebugInfo(`   Season: ${guessItData.episode_info.season || 'not found'}`);
          addDebugInfo(`   Episode: ${guessItData.episode_info.episode || 'not found'}`);
          addDebugInfo(
            `   Episode Title: ${guessItData.episode_info.episode_title || 'not found'}`
          );
        } else {
          addDebugInfo(`⚠️ No episode_info found in GuessIt data for ${fileName}`);
          return; // Exit early if no episode info
        }

        if (!guessItData?.episode_info?.season || !guessItData?.episode_info?.episode) {
          addDebugInfo(`⚠️ No episode information found in filename: ${fileName}`);
          return; // Exit early if no episode info
        }

        const { season, episode } = guessItData.episode_info;
        const seriesTitle = movieGuess.title;
        const episodeTitle = guessItData.episode_info.episode_title || `Episode ${episode}`;

        addDebugInfo(
          `🔍 Creating episode data: ${seriesTitle} S${season}E${episode} - ${episodeTitle}`
        );

        // Create episode-specific movie data
        const episodeMovieData = {
          ...movieGuess,
          kind: 'episode',
          season: season,
          episode: episode,
          episode_title: episodeTitle,
          title: seriesTitle,
          show_title: seriesTitle,
          formatted_title:
            guessItData.formatted_title ||
            `${seriesTitle} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} - ${episodeTitle}`,
          series_imdb_id: movieGuess.imdbid,
          source: 'xmlrpc-enhanced-with-guessit-episode-data',
          guessit_data: guessItData,
          guessit_enhanced: true,
        };

        // SAFE: Update state asynchronously to avoid setState during render
        setTimeout(() => {
          setMovieGuesses(prev => ({
            ...prev,
            [filePath]: episodeMovieData,
          }));

          // Also update GuessIt data so tags display correctly
          if (setGuessItDataForFile) {
            setGuessItDataForFile(filePath, guessItData);
            addDebugInfo(`📋 Updated GuessIt data for tags display: ${fileName}`);
          }

          addDebugInfo(
            `✅ Created episode data for ${seriesTitle} S${season}E${episode} - ${episodeTitle}`
          );
        }, 100);
      } catch (error) {
        addDebugInfo(`❌ Episode data creation failed: ${error.message}`);
        addDebugInfo(`❌ Stack trace: ${error.stack}`);
      }
    },
    [addDebugInfo, setGuessItDataForFile]
  );

  // Guess movie from filename with state tracking and deduplication
  const guessMovie = useCallback(
    async videoFile => {
      const filePath = videoFile.fullPath;
      const movieKey = getMovieKey(videoFile);

      // Check if already processing or failed
      if (processingFiles.current.has(filePath)) {
        addDebugInfo(`Movie guess already in progress for ${videoFile.name}, skipping`);
        return;
      }

      if (failedFiles.current.has(filePath)) {
        addDebugInfo(`Movie guess previously failed for ${videoFile.name}, skipping`);
        return;
      }

      // Check if already completed for this specific file
      if (movieGuesses[filePath] && typeof movieGuesses[filePath] === 'object') {
        addDebugInfo(`Movie already identified for ${videoFile.name}, skipping`);
        return;
      }

      // Check if we already have movie data for the same movie (deduplication)
      const existingMovieData = Object.entries(movieGuesses).find(([path, data]) => {
        if (typeof data === 'object' && data !== null && data.imdbid) {
          const existingKey = getMovieKey({ fullPath: path, name: path.split('/').pop() });
          return existingKey === movieKey;
        }
        return false;
      });

      if (existingMovieData) {
        const [existingPath, existingData] = existingMovieData;
        addDebugInfo(
          `Reusing movie identification from similar file: ${videoFile.name} -> ${existingData.title} (${existingData.year})`
        );
        setMovieGuesses(prev => ({
          ...prev,
          [filePath]: {
            ...existingData,
            reason: `Reused from: ${existingPath.split('/').pop()}`,
          },
        }));

        // BASIC: Fetch features for reused data (without episode detection)
        if (existingData.imdbid) {
          setTimeout(() => fetchFeaturesByImdbId(existingData.imdbid), 0);
          addDebugInfo(`Basic features fetching enabled for reused data: ${videoFile.name}`);
        }
        return;
      }

      processingFiles.current.add(filePath);

      try {
        setMovieGuesses(prev => ({
          ...prev,
          [filePath]: 'guessing',
        }));

        // First attempt: try with the actual filename
        let movieGuess = await XmlRpcService.guessMovieFromStringWithRetry(
          videoFile.name,
          addDebugInfo
        );

        // Check if we got a valid movie guess (not just an empty response)
        const isValidMovieGuess =
          movieGuess &&
          movieGuess.title &&
          movieGuess.title !== 'undefined' &&
          movieGuess.title.trim() !== '';

        // Fallback attempt: if no match found OR invalid response, try with directory name
        if (!isValidMovieGuess) {
          const directoryName = extractDirectoryName(videoFile.fullPath);
          if (directoryName && directoryName !== videoFile.name) {
            addDebugInfo(
              `Primary guess failed, trying directory name fallback: "${directoryName}"`
            );
            movieGuess = await XmlRpcService.guessMovieFromStringWithRetry(
              directoryName,
              addDebugInfo
            );

            if (movieGuess) {
              // Mark that this was identified from directory
              movieGuess.reason = `Directory match: ${directoryName}`;
              addDebugInfo(
                `Movie identified from directory name: ${movieGuess.title} (${movieGuess.year})`
              );
            }
          }
        }

        // Final validation - check if we have a valid result
        const finalValidMovieGuess =
          movieGuess &&
          movieGuess.title &&
          movieGuess.title !== 'undefined' &&
          movieGuess.title.trim() !== '';

        // Add subtitle detection reason if this file has one
        if (finalValidMovieGuess && videoFile.detectionReason === 'parent-directory') {
          movieGuess.reason = `Subtitle parent directory: ${videoFile.name.replace(/\.[^/.]+$/, '')}`;
        }

        setMovieGuesses(prev => ({
          ...prev,
          [filePath]: finalValidMovieGuess ? movieGuess : 'no-match',
        }));

        if (finalValidMovieGuess) {
          addDebugInfo(`🎬 ${movieGuess.title} (${movieGuess.year})`);

          // SAFE: Fetch features if we have an IMDb ID and start episode detection for TV series
          if (movieGuess.imdbid) {
            setTimeout(() => fetchFeaturesByImdbId(movieGuess.imdbid), 0);

            // For TV series, schedule episode detection after a delay
            if (movieGuess.kind === 'tv series') {
              setTimeout(() => {
                createEpisodeMovieData(movieGuess, filePath, videoFile.name).catch(error => {
                  addDebugInfo(`Episode detection failed for ${videoFile.name}: ${error.message}`);
                });
              }, 1500); // Longer delay to ensure initial state is settled
            }
          }
        } else {
          addDebugInfo(`No valid movie match found for ${videoFile.name} or its directory`);
        }
      } catch (error) {
        addDebugInfo(`Movie guess failed for ${videoFile.name}: ${error.message}`);
        failedFiles.current.add(filePath);
        setMovieGuesses(prev => ({
          ...prev,
          [filePath]: 'error',
        }));
      } finally {
        processingFiles.current.delete(filePath);
      }
    },
    [
      addDebugInfo,
      fetchFeaturesByImdbId,
      movieGuesses,
      extractDirectoryName,
      getMovieKey,
      createEpisodeMovieData,
    ]
  );

  // Process complete movie analysis (hash + guess + file info)
  const processMovieGuess = useCallback(
    async videoFile => {
      const filePath = videoFile.fullPath;

      // Prevent duplicate processing
      if (processingFiles.current.has(filePath + '_processing')) {
        addDebugInfo(`Movie processing already in progress for ${videoFile.name}, skipping`);
        return;
      }

      processingFiles.current.add(filePath + '_processing');

      try {
        addDebugInfo(`Processing video file: ${videoFile.name}`);

        // Only start movie guess, don't wait for it
        setTimeout(() => {
          guessMovie(videoFile).catch(error => {
            addDebugInfo(`Delayed movie guess failed for ${videoFile.name}: ${error.message}`);
          });
        }, 100);

        addDebugInfo(`Initiated movie guess for ${videoFile.name}`);
      } catch (error) {
        addDebugInfo(`Error initiating movie processing for ${videoFile.name}: ${error.message}`);
        throw error;
      } finally {
        processingFiles.current.delete(filePath + '_processing');
      }
    },
    [addDebugInfo, guessMovie]
  );

  // Process movie guess for subtitle files (orphaned subtitles)
  const processSubtitleMovieGuess = useCallback(
    async subtitleFile => {
      const filePath = subtitleFile.fullPath;

      // Prevent duplicate processing
      if (processingFiles.current.has(filePath + '_processing')) {
        addDebugInfo(
          `Subtitle movie processing already in progress for ${subtitleFile.name}, skipping`
        );
        return;
      }

      processingFiles.current.add(filePath + '_processing');

      try {
        // Get the best name for movie detection (use parent directory for generic names)
        const detectionName = getBestMovieDetectionName(subtitleFile);
        const originalName = subtitleFile.name.replace(/\.[^/.]+$/, ''); // Remove extension

        // Log what name we're using for detection
        if (detectionName !== originalName) {
          addDebugInfo(
            `Using parent directory "${detectionName}" for generic subtitle "${originalName}"`
          );
        }

        // Use the same approach as video files - just call guessMovie directly
        // This will use XML-RPC which already handles episodes correctly
        const modifiedSubtitleFile = {
          ...subtitleFile,
          name: detectionName + '.srt', // Add .srt extension for processing
          detectionReason: detectionName !== originalName ? 'parent-directory' : 'filename',
        };

        // Start movie guess for subtitle - same as video file processing
        setTimeout(() => {
          guessMovie(modifiedSubtitleFile).catch(error => {
            addDebugInfo(`Subtitle movie guess failed for ${subtitleFile.name}: ${error.message}`);
          });
        }, 100);

        addDebugInfo(
          `🎬 ${subtitleFile.name}${detectionName !== originalName ? ` -> ${detectionName}` : ''}`
        );
      } catch (error) {
        addDebugInfo(
          `Error initiating movie processing for subtitle ${subtitleFile.name}: ${error.message}`
        );
        throw error;
      } finally {
        processingFiles.current.delete(filePath + '_processing');
      }
    },
    [addDebugInfo, guessMovie]
  );

  // Clear processing state for a file
  const clearProcessingState = useCallback(filePath => {
    processingFiles.current.delete(filePath);
    processingFiles.current.delete(filePath + '_processing');
    failedFiles.current.delete(filePath);
  }, []);

  // Clear all state (for fresh file drops)
  const clearAllState = useCallback(() => {
    setMovieGuesses({});
    setFeaturesByImdbId({});
    setFeaturesLoading({});
    processingFiles.current.clear();
    failedFiles.current.clear();
  }, []);

  // Get processing status
  const getProcessingStatus = useCallback(
    filePath => {
      return {
        isProcessing: processingFiles.current.has(filePath),
        hasFailed: failedFiles.current.has(filePath),
        isComplete: movieGuesses[filePath] && typeof movieGuesses[filePath] === 'object',
      };
    },
    [movieGuesses]
  );

  return {
    movieGuesses,
    featuresByImdbId,
    featuresLoading,
    processMovieGuess,
    processSubtitleMovieGuess, // New function for subtitle movie guessing
    calculateHash,
    guessMovie,
    fetchFeaturesByImdbId,
    clearProcessingState,
    clearAllState,
    getProcessingStatus,
    setMovieGuess, // New function for manual movie setting
  };
};
