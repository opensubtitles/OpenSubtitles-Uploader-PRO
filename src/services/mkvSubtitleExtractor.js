import { 
  VideoMetadataExtractor,
  extractMetadata, 
  extractSubtitle, 
  extractAllSubtitles as extractAllSubtitlesFromPackage, 
  getVideoInfo,
  cleanup
} from '@opensubtitles/video-metadata-extractor';
import JSZip from 'jszip';

/**
 * Service for extracting subtitles from MKV files using the OpenSubtitles video metadata extractor
 * Now using the official @opensubtitles/video-metadata-extractor package v1.8.1+
 * 
 * v1.8.1 Improvements:
 * - New simplified API functions (extractMetadata, extractSubtitle, extractAllSubtitles)
 * - Improved performance with 10MB chunks (reduced from 50MB)
 * - Better memory management and resource cleanup
 * - Enhanced support for large files up to 88GB
 */
export class MkvSubtitleExtractor {
  constructor() {
    this.extractor = null;
    this.isLoaded = false;
    this.loadingPromise = null;
    this.currentFile = null;
    this.cachedMetadata = new Map(); // Cache metadata to avoid redundant extraction
  }

  /**
   * Initialize VideoMetadataExtractor
   */
  async initialize() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.isLoaded) {
      return Promise.resolve();
    }

    this.loadingPromise = this._doInitialize();
    return this.loadingPromise;
  }

  async _doInitialize() {
    try {
      console.log('🎬 Initializing VideoMetadataExtractor v1.8.1...');
      
      this.extractor = new VideoMetadataExtractor({
        debug: false, // Disable verbose FFmpeg logging
        timeout: 60000, // Increased to 60 second timeout for FFmpeg loading
        logLevel: 'error', // Suppress chunk processing logs
        verbose: false, // Disable verbose output
        chunkSize: 10 * 1024 * 1024, // 10MB chunks (v1.8.1 optimization)
        metadataOnly: true, // Only extract metadata, not full file processing
        quickMode: true, // Use quick mode for faster extraction
        onProgress: (progress) => {
          // Only log significant progress milestones to reduce spam
          if (progress.progress % 25 === 0 || progress.progress === 100) {
            console.log(`📊 VideoMetadataExtractor: ${progress.progress}% - ${progress.text}`);
          }
        },
        onError: (error) => {
          console.error('❌ VideoMetadataExtractor error:', error.message);
        }
      });
      
      console.log('⏳ Initializing FFmpeg WebAssembly (this may take a moment)...');
      await this.extractor.initialize();

      this.isLoaded = true;
      console.log('✅ VideoMetadataExtractor ready');
    } catch (error) {
      console.error('❌ Failed to initialize VideoMetadataExtractor:', error.message);
      this.loadingPromise = null;
      throw new Error(`Failed to initialize VideoMetadataExtractor: ${error.message}`);
    }
  }

  /**
   * Detect subtitle tracks in MKV file using v1.8.1 native API (without extracting them)
   * @param {File} file - MKV file to detect subtitles in
   * @returns {Promise<Array>} Array of detected subtitle stream info
   */
  async detectSubtitleStreams(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Check supported formats
    if (!this.getSupportedFormats().includes(fileExtension)) {
      throw new Error(`File format not supported: ${file.name}`);
    }

    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`🎬 Starting v1.8.1 native subtitle detection for: ${file.name} (${fileSizeMB} MB)`);
    
    // Add file validation and debugging
    console.log(`🔍 File validation:`);
    console.log(`  - Name: ${file.name}`);
    console.log(`  - Size: ${file.size} bytes (${fileSizeMB} MB)`);
    console.log(`  - Type: ${file.type}`);
    console.log(`  - Last Modified: ${new Date(file.lastModified).toISOString()}`);
    console.log(`  - File instanceof File: ${file instanceof File}`);
    console.log(`  - File instanceof Blob: ${file instanceof Blob}`);
    
    // No file size restrictions - the v1.8.1 API handles large files properly
    console.log(`🚀 File size: ${fileSizeMB} MB - proceeding with v1.8.1 native extraction`);
    if (file.size > 1000 * 1024 * 1024) {
      console.log(`ℹ️ Large file - using optimized 10MB chunks for better performance`);
    }

    // Store file for later extraction
    this.currentFile = file;

    try {
      console.log(`🔍 Using v1.8.1 native extractMetadata API...`);
      
      // Check if we already have cached metadata for this file
      const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
      let metadata = this.cachedMetadata.get(fileKey);
      
      if (!metadata) {
        // Use the v1.8.1 native extractMetadata function directly (no class initialization needed)
        console.log(`🔄 Extracting metadata using v1.8.1 native API (not cached)...`);
        try {
          // Direct call to v1.8.1 native function - this should work without class setup
          metadata = await Promise.race([
            extractMetadata(file),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Native metadata extraction timeout after 120 seconds')), 120000)
            )
          ]);
          
          this.cachedMetadata.set(fileKey, metadata);
          console.log(`💾 Cached v1.8.1 native metadata for future use`);
          console.log(`📊 Native metadata contains ${metadata.streams ? metadata.streams.length : 0} streams`);
        } catch (error) {
          console.error(`❌ v1.8.1 native metadata extraction failed:`, error.message);
          console.log(`📊 Error details:`, {
            name: error.name,
            message: error.message,
            code: error.code || 'No code',
            stack: error.stack?.split('\n')[0] || 'No stack'
          });
          
          console.log(`💡 File size: ${fileSizeMB} MB - attempting fallback approach...`);
          
          console.log(`🔄 Attempting fallback to class-based approach...`);
          
          // Fallback to class-based approach if native API fails
          try {
            await this.initialize();
            metadata = await Promise.race([
              this.extractor.extractMetadata(file),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fallback metadata extraction timeout after 120 seconds')), 120000)
              )
            ]);
            
            this.cachedMetadata.set(fileKey, metadata);
            console.log(`💾 Cached fallback metadata for future use`);
            console.log(`📊 Fallback metadata contains ${metadata.streams ? metadata.streams.length : 0} streams`);
          } catch (fallbackError) {
            console.error(`❌ Both native and fallback metadata extraction failed:`, fallbackError.message);
            console.log(`🔍 Final error analysis for file: ${file.name}`);
            console.log(`  - File size: ${fileSizeMB} MB`);
            console.log(`  - Browser: ${navigator.userAgent.split(' ')[0]}`);
            console.log(`  - Available memory: ${navigator.deviceMemory || 'unknown'} GB`);
            console.log(`💡 This file may be too large or corrupted for browser-based extraction`);
            throw new Error(`Subtitle detection failed: ${fallbackError.message}`);
          }
        }
      } else {
        console.log(`✅ Using cached metadata (avoiding redundant extraction)`);
      }

      // Filter subtitle streams from metadata
      const subtitleStreams = metadata.streams.filter(stream => stream.codec_type === 'subtitle');
      
      if (subtitleStreams.length === 0) {
        console.log('📝 No subtitle streams detected');
        return [];
      }

      console.log(`✅ Found ${subtitleStreams.length} subtitle streams`);
      
      // Log stream details for debugging
      console.log(`📊 All streams in metadata: ${metadata.streams.length} total`);
      metadata.streams.forEach((stream, idx) => {
        if (idx < 5) { // Log first 5 streams to see the pattern
          console.log(`📋 Stream ${stream.index}: type=${stream.codec_type}, codec=${stream.codec_name}, lang=${stream.language || 'unknown'}`);
        }
      });
      
      console.log(`📋 Subtitle streams found:`);
      subtitleStreams.forEach((stream, idx) => {
        console.log(`📋 Subtitle ${idx + 1}: index=${stream.index}, codec=${stream.codec_name}, lang=${stream.language || 'unknown'}, forced=${stream.forced || false}`);
      });
      
      return subtitleStreams.map((stream) => ({
        id: `${file.name}_stream_${stream.index}`,
        streamIndex: stream.index,
        language: stream.language || 'unknown',
        codecName: stream.codec_name,
        title: `Stream ${stream.index} (${stream.language || 'unknown'}, ${stream.codec_name})`,
        originalFileName: file.name,
        canExtract: true,
        forced: stream.forced || false,
        default: stream.default || false
      }));

    } catch (error) {
      console.error('❌ Video subtitle detection failed:', error);
      throw new Error(`Subtitle detection failed: ${error.message}`);
    }
  }

  /**
   * Extract a single subtitle stream on demand
   * @param {string} streamId - ID of the stream to extract
   * @param {number} streamIndex - Stream index to extract
   * @param {string} language - Language of the stream
   * @param {string} originalFileName - Original video file name
   * @returns {Promise<Object>} Extracted subtitle file object
   */
  async extractSingleStream(_streamId, streamIndex, language, originalFileName) {
    if (!this.currentFile) {
      throw new Error('No video file available for extraction');
    }

    console.log(`🎯 Extracting stream ${streamIndex} using v1.8.1 API...`);

    try {
      // Use the new simplified extractSubtitle API
      let extractionResult;
      
      try {
        // First try with SRT format using the new API
        extractionResult = await Promise.race([
          extractSubtitle(this.currentFile, streamIndex, {
            format: 'srt',
            quick: true // Try quick extraction first
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Subtitle extraction timeout after 30 seconds for stream ${streamIndex}`)), 30000)
          )
        ]);
      } catch (srtError) {
        console.warn(`⚠️ SRT extraction failed for stream ${streamIndex}, trying VTT format:`, srtError.message);
        
        try {
          // Fallback to VTT format using the new API
          extractionResult = await Promise.race([
            extractSubtitle(this.currentFile, streamIndex, {
              format: 'vtt',
              quick: true
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`VTT extraction timeout after 30 seconds for stream ${streamIndex}`)), 30000)
            )
          ]);
        } catch (vttError) {
          console.warn(`⚠️ VTT extraction also failed for stream ${streamIndex}:`, vttError.message);
          throw new Error(`Both SRT and VTT extraction failed: ${srtError.message}`);
        }
      }
      
      console.log(`✅ Extracted stream ${streamIndex} (${extractionResult.size} bytes)`);
      
      // Check for empty subtitle data
      if (extractionResult.size === 0) {
        console.warn(`⚠️ Extracted subtitle is empty (0 bytes) for stream ${streamIndex}`);
        return null;
      }

      // Create subtitle file object
      const baseFileName = originalFileName.replace(/\.[^.]+$/, '');
      const langSuffix = language && language !== 'und' ? `_${language}` : '';
      const streamSuffix = `_stream${streamIndex}`;
      const subtitleFileName = `${baseFileName}${langSuffix}${streamSuffix}.srt`;
      
      const subtitleFile = new File([extractionResult.data], subtitleFileName, {
        type: 'text/plain'
      });

      return {
        file: subtitleFile,
        name: subtitleFileName,
        fullPath: subtitleFileName,
        size: subtitleFile.size,
        streamIndex,
        language,
        extractedFrom: originalFileName,
        preview: extractionResult.preview
      };

    } catch (error) {
      console.error(`❌ Failed to extract stream ${streamIndex}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0],
        streamIndex,
        language,
        originalFileName
      });
      throw new Error(`Subtitle extraction failed for stream ${streamIndex}: ${error.message}`);
    }
  }


  /**
   * Store the current file for extraction operations
   */
  setCurrentFile(file) {
    this.currentFile = file;
  }

  /**
   * Extract all subtitles from a video file
   * @param {Object} videoFile - Video file object with file property
   * @returns {Promise<Array>} Array of extracted subtitle files
   */
  async extractSubtitles(videoFile) {
    console.log(`🎬 Starting batch subtitle extraction for: ${videoFile.file.name}`);
    
    try {
      // First detect all subtitle streams
      const subtitleStreams = await this.detectSubtitleStreams(videoFile.file);
      
      if (subtitleStreams.length === 0) {
        console.log('📝 No subtitle streams found in video file');
        return [];
      }
      
      console.log(`🎯 Extracting ${subtitleStreams.length} subtitle streams...`);
      
      const extractedSubtitles = [];
      
      // Extract each subtitle stream
      for (let i = 0; i < subtitleStreams.length; i++) {
        const stream = subtitleStreams[i];
        console.log(`🔄 Extracting stream ${i + 1}/${subtitleStreams.length}: ${stream.title}`);
        
        try {
          const extractedSubtitle = await this.extractSingleStream(
            stream.id,
            stream.streamIndex, 
            stream.language,
            stream.originalFileName
          );
          
          if (extractedSubtitle) {
            extractedSubtitles.push(extractedSubtitle);
            console.log(`✅ Successfully extracted: ${extractedSubtitle.name}`);
          } else {
            console.warn(`⚠️ Skipped empty subtitle stream ${stream.streamIndex}`);
          }
        } catch (error) {
          console.error(`❌ Failed to extract stream ${stream.streamIndex}:`, error.message);
          // Continue with other streams instead of failing completely
        }
      }
      
      console.log(`🎉 Batch extraction completed: ${extractedSubtitles.length}/${subtitleStreams.length} subtitles extracted`);
      return extractedSubtitles;
      
    } catch (error) {
      console.error('❌ Batch subtitle extraction failed:', error);
      throw new Error(`Batch subtitle extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract all subtitles from a video file using the new v1.8.1 native API
   * @param {File} file - Video file to extract subtitles from
   * @returns {Promise<Object>} Object with extractedFiles array and zipBlob
   */
  async extractAllSubtitles(file) {
    console.log(`🎬 Starting extractAllSubtitles for: ${file.name} using v1.8.1 native API`);
    
    try {
      // Use the new native extractAllSubtitles function from the package
      console.log(`🚀 Trying native extractAllSubtitles() from package v1.8.1...`);
      
      const startTime = performance.now();
      const nativeResult = await Promise.race([
        extractAllSubtitlesFromPackage(file),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Native extraction timeout after 180 seconds')), 180000)
        )
      ]);
      
      const duration = performance.now() - startTime;
      console.log(`⏱️ Native extraction completed in ${duration.toFixed(2)}ms`);
      
      // Check if native result has the expected format and data
      if (nativeResult && 
          nativeResult.extractedFiles && 
          Array.isArray(nativeResult.extractedFiles) &&
          nativeResult.extractedFiles.length > 0) {
        
        console.log(`✅ Native extraction successful:`);
        console.log(`📚 Total Files: ${nativeResult.extractedFiles.length}`);
        console.log(`📦 ZIP Size: ${nativeResult.zipBlob ? nativeResult.zipBlob.size + ' bytes' : 'No ZIP'}`);
        
        // Log extracted files
        nativeResult.extractedFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.name} (${file.language || 'unknown'}) - ${file.size} bytes`);
        });
        
        return nativeResult;
      } else {
        console.warn('⚠️ Native extraction returned no results or unexpected format, falling back to legacy implementation');
        console.log('Native result:', nativeResult);
        return await this.extractAllSubtitlesLegacy(file);
      }
      
    } catch (error) {
      console.error('❌ Native extractAllSubtitles failed, falling back to legacy implementation:', error.message);
      return await this.extractAllSubtitlesLegacy(file);
    }
  }

  /**
   * Legacy implementation of extractAllSubtitles (fallback)
   * @param {File} file - Video file to extract subtitles from
   * @returns {Promise<Object>} Object with extractedFiles array and zipBlob
   */
  async extractAllSubtitlesLegacy(file) {
    console.log(`🔄 Using legacy extractAllSubtitles implementation for: ${file.name}`);
    
    try {
      // Set current file for extraction
      this.setCurrentFile(file);
      
      // First detect all subtitle streams (this will handle initialization if needed)
      const subtitleStreams = await this.detectSubtitleStreams(file);
      
      if (subtitleStreams.length === 0) {
        console.log('📝 No subtitle streams found');
        return {
          extractedFiles: [],
          zipBlob: null
        };
      }
      
      console.log(`🎯 Extracting all ${subtitleStreams.length} subtitle streams using legacy method...`);
      
      const extractedFiles = [];
      
      // Extract each subtitle stream
      for (let i = 0; i < subtitleStreams.length; i++) {
        const stream = subtitleStreams[i];
        console.log(`🔄 Extracting stream ${i + 1}/${subtitleStreams.length}: ${stream.title}`);
        
        try {
          const extractedSubtitle = await this.extractSingleStream(
            stream.id,
            stream.streamIndex, 
            stream.language,
            stream.originalFileName
          );
          
          if (extractedSubtitle && extractedSubtitle.file) {
            extractedFiles.push({
              file: extractedSubtitle.file,
              name: extractedSubtitle.name,
              language: extractedSubtitle.language || 'unknown',
              streamIndex: extractedSubtitle.streamIndex,
              size: extractedSubtitle.file.size,
              extractedFrom: extractedSubtitle.extractedFrom,
              preview: extractedSubtitle.preview
            });
            console.log(`✅ Successfully extracted: ${extractedSubtitle.name} (${extractedSubtitle.file.size} bytes)`);
          } else {
            console.warn(`⚠️ Skipped empty subtitle stream ${stream.streamIndex}`);
          }
        } catch (error) {
          console.error(`❌ Failed to extract stream ${stream.streamIndex}:`, error.message);
          // Continue with other streams instead of failing completely
        }
      }
      
      console.log(`🎉 Legacy batch extraction completed: ${extractedFiles.length}/${subtitleStreams.length} subtitles extracted`);
      
      // Create ZIP blob if we have extracted files
      let zipBlob = null;
      if (extractedFiles.length > 0) {
        try {
          zipBlob = await this.createZipFromSubtitles(extractedFiles);
          console.log(`📦 Created ZIP archive: ${zipBlob.size} bytes`);
        } catch (zipError) {
          console.warn(`⚠️ Failed to create ZIP archive:`, zipError.message);
          // Don't fail the whole operation if ZIP creation fails
        }
      }
      
      return {
        extractedFiles,
        zipBlob
      };
      
    } catch (error) {
      console.error('❌ Legacy extractAllSubtitles failed:', error);
      throw new Error(`Legacy extract all subtitles failed: ${error.message}`);
    }
  }

  /**
   * Create a ZIP archive from extracted subtitle files
   * @param {Array} extractedFiles - Array of extracted subtitle file objects
   * @returns {Promise<Blob>} ZIP file as Blob
   */
  async createZipFromSubtitles(extractedFiles) {
    console.log(`📦 Creating ZIP archive from ${extractedFiles.length} subtitle files...`);
    
    try {
      const zip = new JSZip();
      
      // Add each subtitle file to the ZIP
      for (const subtitleFile of extractedFiles) {
        if (subtitleFile.file && subtitleFile.name) {
          // Read file contents
          const fileContent = await subtitleFile.file.arrayBuffer();
          
          // Add to ZIP with the subtitle filename
          zip.file(subtitleFile.name, fileContent);
          console.log(`📁 Added to ZIP: ${subtitleFile.name} (${subtitleFile.size} bytes)`);
        }
      }
      
      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6 // Good balance between size and speed
        }
      });
      
      console.log(`✅ ZIP archive created: ${zipBlob.size} bytes`);
      return zipBlob;
      
    } catch (error) {
      console.error('❌ Failed to create ZIP archive:', error);
      throw new Error(`ZIP creation failed: ${error.message}`);
    }
  }

  /**
   * Get subtitle stream count without full extraction
   */
  async getSubtitleStreamCount(file) {
    try {
      const streams = await this.detectSubtitleStreams(file);
      return streams.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if the service is ready to extract subtitles
   */
  isReady() {
    return this.isLoaded && this.extractor && this.extractor.isInitialized();
  }

  /**
   * Get the current status of the service
   */
  getStatus() {
    if (this.loadingPromise && !this.isLoaded) {
      return 'loading';
    }
    if (this.isLoaded && this.extractor && this.extractor.isInitialized()) {
      return 'ready';
    }
    return 'not_initialized';
  }

  /**
   * Get video information using the new v1.8.1 getVideoInfo API
   * @param {File} file - Video file to get info for
   * @returns {Promise<Object>} Video information object
   */
  async getVideoInfo(file) {
    try {
      console.log(`📊 Getting video info for: ${file.name} using v1.8.1 API`);
      const videoInfo = await getVideoInfo(file);
      console.log(`✅ Video info retrieved:`, videoInfo);
      return videoInfo;
    } catch (error) {
      console.error(`❌ Failed to get video info:`, error.message);
      throw new Error(`Get video info failed: ${error.message}`);
    }
  }

  /**
   * Get supported file formats from the extractor
   */
  getSupportedFormats() {
    if (this.extractor) {
      return this.extractor.getSupportedFormats();
    }
    // Enhanced supported formats with v1.8.1 improvements
    return ['mkv', 'mp4', 'avi', 'mov', 'm4v', 'wmv', 'webm', 'ogv', '3gp', 'flv', 'ts', 'mts', 'm2ts'];
  }

  /**
   * Download extracted subtitles as ZIP file (for testing/user convenience)
   * @param {Blob} zipBlob - ZIP blob to download
   * @param {string} filename - Name for the downloaded file
   */
  downloadSubtitlesZip(zipBlob, filename = 'extracted_subtitles.zip') {
    if (!zipBlob) {
      console.warn('⚠️ No ZIP blob to download');
      return;
    }
    
    try {
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`📥 Downloaded: ${filename} (${zipBlob.size} bytes)`);
    } catch (error) {
      console.error('❌ Failed to download ZIP:', error);
    }
  }

  /**
   * Terminate the extractor and clean up resources
   */
  async terminate() {
    try {
      // Use the new cleanup function from v1.8.1 API
      await cleanup();
      console.log('✅ v1.8.1 API cleanup completed');
    } catch (error) {
      console.error('❌ Error during v1.8.1 API cleanup:', error.message);
    }
    
    // Legacy extractor cleanup (if still exists)
    if (this.extractor) {
      try {
        await this.extractor.terminate();
        console.log('✅ Legacy VideoMetadataExtractor terminated');
      } catch (error) {
        console.error('❌ Error terminating legacy VideoMetadataExtractor:', error.message);
      }
    }
    
    // Clear internal state
    this.extractor = null;
    this.isLoaded = false;
    this.loadingPromise = null;
    this.currentFile = null;
    this.cachedMetadata.clear(); // Clear metadata cache
  }
}

// Create and export the singleton instance
export const mkvSubtitleExtractor = new MkvSubtitleExtractor();