import { useCallback, useRef } from 'react';
import { OpenSubtitlesApiService } from '../services/api/openSubtitlesApi.js';

/**
 * Custom hook for language detection functionality
 */
export const useLanguageDetection = (addDebugInfo, updateFile) => {
  // Track which files are currently being processed to prevent duplicates
  const processingFiles = useRef(new Set());
  const failedFiles = useRef(new Set());

  const processLanguageDetection = useCallback(
    async subtitleFile => {
      const filePath = subtitleFile.fullPath;

      // Check if already processing or failed
      if (processingFiles.current.has(filePath)) {
        addDebugInfo(`Language detection already in progress for ${subtitleFile.name}, skipping`);
        return;
      }

      if (failedFiles.current.has(filePath)) {
        addDebugInfo(`Language detection previously failed for ${subtitleFile.name}, skipping`);
        return;
      }

      // Check if already completed (has detection result that's not 'detecting' or 'error')
      if (
        subtitleFile.detectedLanguage &&
        typeof subtitleFile.detectedLanguage === 'object' &&
        subtitleFile.detectedLanguage.language_code
      ) {
        addDebugInfo(`Language already detected for ${subtitleFile.name}, skipping`);
        return;
      }

      processingFiles.current.add(filePath);

      try {
        // Set detecting status
        updateFile(subtitleFile.fullPath, { detectedLanguage: 'detecting' });

        const detectedLanguage = await OpenSubtitlesApiService.detectLanguageWithRetry(
          subtitleFile,
          addDebugInfo
        );

        // Check if detected as text file (not a subtitle)
        if (
          detectedLanguage &&
          detectedLanguage.file_kind &&
          detectedLanguage.file_kind.toLowerCase().includes('text file')
        ) {
          addDebugInfo(`Removing ${subtitleFile.name} - detected as text file, not subtitle`);
          // Signal to remove this file (handled by parent component)
          updateFile(subtitleFile.fullPath, { shouldRemove: true });
          return;
        }

        addDebugInfo(`🔄 Updating file ${subtitleFile.name} with detected language`);
        updateFile(subtitleFile.fullPath, {
          detectedLanguage: detectedLanguage || 'error',
        });

        if (detectedLanguage) {
          addDebugInfo(
            `🔍 ${subtitleFile.name}: ${detectedLanguage.language_name} (${(detectedLanguage.confidence * 100).toFixed(1)}%)`
          );
        } else {
          addDebugInfo(`No language detected for ${subtitleFile.name}`);
        }
      } catch (error) {
        addDebugInfo(`Language detection failed for ${subtitleFile.name}: ${error.message}`);
        failedFiles.current.add(filePath);
        updateFile(subtitleFile.fullPath, { detectedLanguage: 'error' });
      } finally {
        processingFiles.current.delete(filePath);
      }
    },
    [addDebugInfo, updateFile]
  );

  // Clear processing state for a file
  const clearLanguageProcessingState = useCallback(filePath => {
    processingFiles.current.delete(filePath);
    failedFiles.current.delete(filePath);
  }, []);

  // Clear all state (for fresh file drops)
  const clearAllLanguageState = useCallback(() => {
    processingFiles.current.clear();
    failedFiles.current.clear();
  }, []);

  // Get processing status
  const getLanguageProcessingStatus = useCallback(filePath => {
    return {
      isProcessing: processingFiles.current.has(filePath),
      hasFailed: failedFiles.current.has(filePath),
    };
  }, []);

  return {
    processLanguageDetection,
    clearLanguageProcessingState,
    clearAllLanguageState,
    getLanguageProcessingStatus,
  };
};
