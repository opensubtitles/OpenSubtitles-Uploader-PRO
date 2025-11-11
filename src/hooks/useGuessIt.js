import { useState, useCallback, useRef } from 'react';
import { GuessItService } from '../services/guessItService.js';
import { OfflineGuessItService } from '../services/offlineGuessItService.js';

/**
 * Custom hook for GuessIt metadata extraction
 * Priority: WASM offline > XML-RPC data > API fallback
 */
export const useGuessIt = addDebugInfo => {
  const [guessItData, setGuessItData] = useState({});

  // Track which files are currently being processed
  const processingFiles = useRef(new Set());
  const failedFiles = useRef(new Set());

  // Extract GuessIt data from movie guess results
  const extractGuessItFromMovieData = useCallback(
    (movieData, filePath, filename) => {
      if (movieData && movieData.guessit) {
        addDebugInfo(`GuessIt metadata found in XML-RPC response for: ${filename}`);

        setGuessItData(prev => ({
          ...prev,
          [filePath]: movieData.guessit,
        }));

        addDebugInfo(`🔧 ${filename}: ${movieData.guessit.title || 'Unknown'}`);
        return true;
      }
      return false;
    },
    [addDebugInfo]
  );

  // Process file metadata extraction (Priority: WASM offline > XML-RPC data > API fallback)
  const processGuessIt = useCallback(
    async (videoFile, movieGuesses = {}) => {
      const filePath = videoFile.fullPath;

      // Check if already processing or failed
      if (processingFiles.current.has(filePath)) {
        addDebugInfo(`GuessIt already in progress for ${videoFile.name}, skipping`);
        return;
      }

      if (failedFiles.current.has(filePath)) {
        addDebugInfo(`GuessIt previously failed for ${videoFile.name}, skipping`);
        return;
      }

      // Check if already completed
      if (guessItData[filePath] && typeof guessItData[filePath] === 'object') {
        addDebugInfo(`GuessIt already completed for ${videoFile.name}, skipping`);
        return;
      }

      // First priority: Check if we have GuessIt data from XML-RPC movie guess
      const movieData = movieGuesses[filePath];
      if (movieData && typeof movieData === 'object' && movieData.guessit) {
        extractGuessItFromMovieData(movieData, filePath, videoFile.name);
        return;
      }

      processingFiles.current.add(filePath);

      try {
        // Set processing status
        setGuessItData(prev => ({
          ...prev,
          [filePath]: 'processing',
        }));

        let metadata = null;

        // Second priority: Try offline WASM GuessIt first
        try {
          addDebugInfo(`🔧 Trying offline WASM GuessIt for: ${videoFile.name}`);
          metadata = await OfflineGuessItService.enhancedGuess(videoFile.name);
          addDebugInfo(`✅ Offline WASM GuessIt succeeded for: ${videoFile.name}`);
        } catch (wasmError) {
          addDebugInfo(
            `⚠️ Offline WASM GuessIt failed for ${videoFile.name}: ${wasmError.message}`
          );

          // Third priority: Fallback to API call
          try {
            addDebugInfo(`🌐 Falling back to API GuessIt for: ${videoFile.name}`);
            metadata = await GuessItService.guessFileMetadataWithRetry(
              videoFile.name,
              addDebugInfo
            );
            addDebugInfo(`✅ API GuessIt succeeded for: ${videoFile.name}`);
          } catch (apiError) {
            addDebugInfo(`❌ API GuessIt also failed for ${videoFile.name}: ${apiError.message}`);
            throw apiError;
          }
        }

        setGuessItData(prev => ({
          ...prev,
          [filePath]: metadata || 'no-data',
        }));

        if (metadata) {
          addDebugInfo(
            `GuessIt metadata extracted for ${videoFile.name}: ${metadata.title || 'Unknown'}`
          );
        } else {
          addDebugInfo(`No GuessIt metadata extracted for ${videoFile.name}`);
        }
      } catch (error) {
        addDebugInfo(`GuessIt failed for ${videoFile.name}: ${error.message}`);
        failedFiles.current.add(filePath);
        setGuessItData(prev => ({
          ...prev,
          [filePath]: 'error',
        }));
      } finally {
        processingFiles.current.delete(filePath);
      }
    },
    [addDebugInfo, guessItData, extractGuessItFromMovieData]
  );

  // Clear processing state for a file
  const clearGuessItProcessingState = useCallback(filePath => {
    processingFiles.current.delete(filePath);
    failedFiles.current.delete(filePath);
  }, []);

  // Clear all state (for fresh file drops)
  const clearAllGuessItState = useCallback(() => {
    setGuessItData({});
    processingFiles.current.clear();
    failedFiles.current.clear();
  }, []);

  // Get processing status
  const getGuessItProcessingStatus = useCallback(
    filePath => {
      return {
        isProcessing: processingFiles.current.has(filePath),
        hasFailed: failedFiles.current.has(filePath),
        isComplete: guessItData[filePath] && typeof guessItData[filePath] === 'object',
      };
    },
    [guessItData]
  );

  // Get formatted tags for a file
  const getFormattedTags = useCallback(
    filePath => {
      const data = guessItData[filePath];
      if (!data || typeof data !== 'object') {
        return [];
      }

      return GuessItService.formatMetadataAsTags(data);
    },
    [guessItData]
  );

  // Set GuessIt data externally (for episode enhancement)
  const setGuessItDataForFile = useCallback((filePath, data) => {
    setGuessItData(prev => ({
      ...prev,
      [filePath]: data,
    }));
  }, []);

  return {
    guessItData,
    processGuessIt,
    clearGuessItProcessingState,
    clearAllGuessItState,
    getGuessItProcessingStatus,
    getFormattedTags,
    extractGuessItFromMovieData,
    setGuessItDataForFile, // New function for external updates
  };
};
