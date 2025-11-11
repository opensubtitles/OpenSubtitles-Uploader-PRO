import { useState, useEffect, useCallback } from 'react';
import { videoMetadataService } from '../services/videoMetadataService.js';
import { isVideoFile } from '../utils/fileUtils.js';

/**
 * Custom hook for video metadata extraction
 * Processes video files and extracts metadata including FPS, duration, and upload parameters
 */
export const useVideoMetadata = () => {
  const [videoMetadata, setVideoMetadata] = useState({});
  const [metadataLoading, setMetadataLoading] = useState({});
  const [metadataErrors, setMetadataErrors] = useState({});
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  // Initialize FFmpeg on mount
  useEffect(() => {
    let cancelled = false;

    const initFFmpeg = async () => {
      try {
        await videoMetadataService.loadFFmpeg();
        if (!cancelled) {
          setIsFFmpegLoaded(true);
        }
      } catch (error) {
        console.error('Failed to initialize FFmpeg:', error);
        if (!cancelled) {
          setMetadataErrors(prev => ({
            ...prev,
            _ffmpeg: `Failed to load FFmpeg: ${error.message}`,
          }));
        }
      }
    };

    initFFmpeg();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Extract metadata from a single video file
   * @param {File} file - Video file to process
   * @param {string} filePath - Unique identifier for the file
   * @returns {Promise<Object>} Extracted metadata
   */
  const extractVideoMetadata = useCallback(
    async (file, filePath) => {
      if (!isVideoFile(file)) {
        throw new Error('File is not a video format');
      }

      if (!isFFmpegLoaded) {
        throw new Error('FFmpeg not loaded yet');
      }

      try {
        setMetadataLoading(prev => ({ ...prev, [filePath]: true }));
        setMetadataErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[filePath];
          return newErrors;
        });

        const metadata = await videoMetadataService.extractMetadata(file);

        setVideoMetadata(prev => ({
          ...prev,
          [filePath]: metadata,
        }));

        return metadata;
      } catch (error) {
        console.error(`Failed to extract metadata for ${filePath}:`, error);

        setMetadataErrors(prev => ({
          ...prev,
          [filePath]: error.message,
        }));

        throw error;
      } finally {
        setMetadataLoading(prev => {
          const newLoading = { ...prev };
          delete newLoading[filePath];
          return newLoading;
        });
      }
    },
    [isFFmpegLoaded]
  );

  /**
   * Process multiple video files
   * @param {Object} pairedFiles - Object with file paths as keys and file objects as values
   * @param {Function} onProgress - Progress callback
   */
  const processVideoFiles = useCallback(
    async (pairedFiles, onProgress) => {
      if (!isFFmpegLoaded) {
        console.warn('FFmpeg not loaded yet, skipping video metadata extraction');
        return;
      }

      const videoFiles = Object.entries(pairedFiles).filter(([filePath, file]) =>
        isVideoFile(file)
      );

      if (videoFiles.length === 0) {
        return;
      }

      console.log(`📹 Processing ${videoFiles.length} video files for metadata extraction`);

      const processFile = async ([filePath, file], index) => {
        try {
          onProgress?.(index + 1, videoFiles.length, file.name);
          await extractVideoMetadata(file, filePath);
        } catch (error) {
          console.error(`Failed to process video metadata for ${filePath}:`, error);
        }
      };

      // Process files with small delay to prevent overwhelming the browser
      for (let i = 0; i < videoFiles.length; i++) {
        await processFile(videoFiles[i], i);

        // Small delay between files
        if (i < videoFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    },
    [isFFmpegLoaded, extractVideoMetadata]
  );

  /**
   * Get metadata for a specific file
   * @param {string} filePath - File path
   * @returns {Object|null} Metadata object or null if not found
   */
  const getVideoMetadata = useCallback(
    filePath => {
      return videoMetadata[filePath] || null;
    },
    [videoMetadata]
  );

  /**
   * Check if metadata is loading for a file
   * @param {string} filePath - File path
   * @returns {boolean} True if loading
   */
  const isMetadataLoading = useCallback(
    filePath => {
      return metadataLoading[filePath] || false;
    },
    [metadataLoading]
  );

  /**
   * Get metadata error for a file
   * @param {string} filePath - File path
   * @returns {string|null} Error message or null
   */
  const getMetadataError = useCallback(
    filePath => {
      return metadataErrors[filePath] || null;
    },
    [metadataErrors]
  );

  /**
   * Clear metadata for a file
   * @param {string} filePath - File path
   */
  const clearVideoMetadata = useCallback(filePath => {
    setVideoMetadata(prev => {
      const newMetadata = { ...prev };
      delete newMetadata[filePath];
      return newMetadata;
    });

    setMetadataLoading(prev => {
      const newLoading = { ...prev };
      delete newLoading[filePath];
      return newLoading;
    });

    setMetadataErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[filePath];
      return newErrors;
    });
  }, []);

  /**
   * Clear all metadata
   */
  const clearAllVideoMetadata = useCallback(() => {
    setVideoMetadata({});
    setMetadataLoading({});
    setMetadataErrors({});
  }, []);

  /**
   * Get upload parameters for OpenSubtitles API
   * @param {string} filePath - File path
   * @returns {Object} Upload parameters for the video
   */
  const getUploadParameters = useCallback(
    filePath => {
      const metadata = videoMetadata[filePath];
      if (!metadata) {
        return {};
      }

      return {
        moviebytesize: metadata.moviebytesize,
        movietimems: metadata.movietimems,
        moviefps: metadata.moviefps,
        movieframes: metadata.movieframes,
        moviefilename: metadata.moviefilename,
      };
    },
    [videoMetadata]
  );

  return {
    // State
    videoMetadata,
    isFFmpegLoaded,

    // Actions
    extractVideoMetadata,
    processVideoFiles,
    clearVideoMetadata,
    clearAllVideoMetadata,

    // Getters
    getVideoMetadata,
    isMetadataLoading,
    getMetadataError,
    getUploadParameters,

    // Computed values
    hasAnyMetadata: Object.keys(videoMetadata).length > 0,
    loadingCount: Object.keys(metadataLoading).length,
    errorCount: Object.keys(metadataErrors).length,
    processedCount: Object.keys(videoMetadata).length,
  };
};
