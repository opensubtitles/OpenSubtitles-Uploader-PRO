import { extract } from 'archive-wasm';
import {
  VIDEO_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  ARCHIVE_MIME_TYPES,
} from '../utils/constants.js';

/**
 * Archive Processing Service
 * Handles extraction and processing of archive files using archive-wasm
 * Supports: ZIP, 7z, TAR, RAR, LHA, CAB, ISO, CPIO, and compressed files
 */
export class ArchiveProcessingService {
  // Maximum archive file size in bytes (100 MB)
  static MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

  /**
   * Check if a file is an archive file
   * @param {File} file - The file to check
   * @returns {boolean} - True if the file is an archive file
   */
  static isArchiveFile(file) {
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    // Check by extension
    const isArchiveByExtension = ARCHIVE_EXTENSIONS.some(ext => fileName.endsWith(ext));

    // Check by MIME type
    const isArchiveByMimeType = ARCHIVE_MIME_TYPES.includes(fileType);

    return isArchiveByExtension || isArchiveByMimeType;
  }

  /**
   * Validate archive file size
   * @param {File} file - The archive file to validate
   * @returns {object} - Object with isValid boolean and error message
   */
  static validateArchiveSize(file) {
    if (file.size > this.MAX_ARCHIVE_SIZE) {
      const maxSizeMB = (this.MAX_ARCHIVE_SIZE / 1024 / 1024).toFixed(0);
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      return {
        isValid: false,
        error: `Archive file "${file.name}" is too large (${fileSizeMB} MB). Maximum allowed size is ${maxSizeMB} MB.`,
      };
    }
    return { isValid: true, error: null };
  }

  /**
   * Check if a filename is a valid media file
   * @param {string} filename - The filename to check
   * @returns {object} - Object with isVideo, isSubtitle, and isValid properties
   */
  static isValidMediaFile(filename) {
    const lowerName = filename.toLowerCase();

    // Skip system files and hidden files
    if (
      filename.startsWith('.') ||
      filename.includes('__MACOSX') ||
      filename.includes('.DS_Store')
    ) {
      return { isVideo: false, isSubtitle: false, isValid: false };
    }

    const isVideo = VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext.toLowerCase()));
    const isSubtitle = SUBTITLE_EXTENSIONS.some(ext => lowerName.endsWith(ext.toLowerCase()));

    return {
      isVideo,
      isSubtitle,
      isValid: isVideo || isSubtitle,
    };
  }

  /**
   * Extract and process an archive file
   * @param {File} archiveFile - The archive file to process
   * @param {Function} progressCallback - Callback for progress updates (optional)
   * @returns {Promise<Array>} - Array of processed file objects
   */
  static async processArchiveFile(archiveFile, progressCallback = null) {
    try {
      // Validate archive file size
      const sizeValidation = this.validateArchiveSize(archiveFile);
      if (!sizeValidation.isValid) {
        throw new Error(sizeValidation.error);
      }

      // Convert File to ArrayBuffer for archive-wasm
      const arrayBuffer = await archiveFile.arrayBuffer();
      const archiveData = new Uint8Array(arrayBuffer);

      const processedFiles = [];
      const allEntries = [];

      // First pass: collect all entries to calculate total count
      for (const entry of extract(archiveData)) {
        if (entry.type === 'FILE') {
          allEntries.push(entry);
        }
      }

      const totalFiles = allEntries.length;
      let processedCount = 0;

      // Process each file in the archive
      for (const entry of allEntries) {
        processedCount++;

        // Update progress if callback provided
        if (progressCallback) {
          progressCallback({
            current: processedCount,
            total: totalFiles,
            filename: entry.path,
            stage: 'extracting',
          });
        }

        // Check if it's a valid media file
        const fileType = this.isValidMediaFile(entry.path);
        if (!fileType.isValid) {
          continue;
        }

        try {
          // Create a File object from the extracted data
          const extractedFile = new File([entry.data], entry.path, {
            type: this.getMimeType(entry.path),
            lastModified: Date.now(),
          });

          // Create processed file object matching the expected structure
          const processedFile = {
            file: extractedFile,
            fullPath: entry.path,
            name: entry.path,
            size: extractedFile.size,
            type: extractedFile.type,
            lastModified: extractedFile.lastModified,
            isVideo: fileType.isVideo,
            isSubtitle: fileType.isSubtitle,
            extractedFrom: archiveFile.name, // Track which archive this came from
          };

          processedFiles.push(processedFile);
        } catch (fileError) {
          console.warn(`Error extracting file ${entry.path} from archive:`, fileError);
          continue;
        }
      }

      if (progressCallback) {
        progressCallback({
          current: totalFiles,
          total: totalFiles,
          filename: '',
          stage: 'complete',
        });
      }

      return processedFiles;
    } catch (error) {
      console.error('Error processing archive file:', error);
      throw new Error(`Failed to process archive file ${archiveFile.name}: ${error.message}`);
    }
  }

  /**
   * Process multiple archive files
   * @param {Array<File>} archiveFiles - Array of archive files to process
   * @param {Function} progressCallback - Callback for progress updates (optional)
   * @returns {Promise<Array>} - Array of all processed file objects
   */
  static async processMultipleArchiveFiles(archiveFiles, progressCallback = null) {
    const allProcessedFiles = [];

    for (let i = 0; i < archiveFiles.length; i++) {
      const archiveFile = archiveFiles[i];

      try {
        const processedFiles = await this.processArchiveFile(archiveFile, fileProgress => {
          if (progressCallback) {
            progressCallback({
              archiveIndex: i,
              totalArchives: archiveFiles.length,
              archiveName: archiveFile.name,
              fileProgress: fileProgress,
            });
          }
        });

        allProcessedFiles.push(...processedFiles);
      } catch (error) {
        console.error(`Error processing archive file ${archiveFile.name}:`, error);
        // Continue processing other archive files even if one fails
      }
    }

    return allProcessedFiles;
  }

  /**
   * Get MIME type for a filename
   * @param {string} filename - The filename
   * @returns {string} - MIME type
   */
  static getMimeType(filename) {
    const lowerName = filename.toLowerCase();

    // Video MIME types
    if (lowerName.endsWith('.mp4')) return 'video/mp4';
    if (lowerName.endsWith('.mkv')) return 'video/x-matroska';
    if (lowerName.endsWith('.avi')) return 'video/x-msvideo';
    if (lowerName.endsWith('.mov')) return 'video/quicktime';
    if (lowerName.endsWith('.webm')) return 'video/webm';
    if (lowerName.endsWith('.flv')) return 'video/x-flv';
    if (lowerName.endsWith('.wmv')) return 'video/x-ms-wmv';
    if (lowerName.endsWith('.mpeg') || lowerName.endsWith('.mpg')) return 'video/mpeg';

    // Subtitle MIME types
    if (lowerName.endsWith('.srt')) return 'text/srt';
    if (lowerName.endsWith('.vtt')) return 'text/vtt';
    if (lowerName.endsWith('.ass') || lowerName.endsWith('.ssa')) return 'text/x-ass';
    if (lowerName.endsWith('.sub')) return 'text/x-subtitle';
    if (lowerName.endsWith('.txt')) return 'text/plain';

    // Default
    return 'application/octet-stream';
  }

  /**
   * Get summary statistics for archive processing
   * @param {Array} processedFiles - Array of processed files
   * @returns {object} - Statistics object
   */
  static getProcessingStats(processedFiles) {
    const stats = {
      totalFiles: processedFiles.length,
      videoFiles: 0,
      subtitleFiles: 0,
      archiveSources: new Set(),
      filesByArchive: {},
    };

    processedFiles.forEach(file => {
      if (file.isVideo) stats.videoFiles++;
      if (file.isSubtitle) stats.subtitleFiles++;

      if (file.extractedFrom) {
        stats.archiveSources.add(file.extractedFrom);

        if (!stats.filesByArchive[file.extractedFrom]) {
          stats.filesByArchive[file.extractedFrom] = { videos: 0, subtitles: 0 };
        }

        if (file.isVideo) stats.filesByArchive[file.extractedFrom].videos++;
        if (file.isSubtitle) stats.filesByArchive[file.extractedFrom].subtitles++;
      }
    });

    stats.archiveSources = Array.from(stats.archiveSources);

    return stats;
  }

  // Legacy methods for backward compatibility
  static isZipFile(file) {
    return this.isArchiveFile(file);
  }

  static validateZipSize(file) {
    return this.validateArchiveSize(file);
  }

  static async processZipFile(file, progressCallback = null) {
    return this.processArchiveFile(file, progressCallback);
  }

  static async processMultipleZipFiles(files, progressCallback = null) {
    return this.processMultipleArchiveFiles(files, progressCallback);
  }
}

// Export with both names for backward compatibility
export { ArchiveProcessingService as ZipProcessingService };
