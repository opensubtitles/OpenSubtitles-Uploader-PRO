import { VideoMetadataExtractor } from '@opensubtitles/video-metadata-extractor';

/**
 * Service for extracting subtitles from MKV files using the OpenSubtitles video metadata extractor
 * Now using the official @opensubtitles/video-metadata-extractor package v1.7.2+
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
      console.log('🎬 Initializing VideoMetadataExtractor...');
      
      this.extractor = new VideoMetadataExtractor({
        debug: false, // Disable verbose FFmpeg logging
        timeout: 30000, // 30 second timeout
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
   * Detect subtitle tracks in MKV file (without extracting them)
   * @param {File} file - MKV file to detect subtitles in
   * @returns {Promise<Array>} Array of detected subtitle stream info
   */
  async detectSubtitleStreams(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // Check supported formats (initialize if needed)
    await this.initialize();
    
    if (!this.getSupportedFormats().includes(fileExtension)) {
      throw new Error(`File format not supported: ${file.name}`);
    }

    console.log(`🎬 Starting video subtitle detection for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Store file for later extraction
    this.currentFile = file;

    try {
      console.log(`🔍 Detecting subtitle streams...`);
      
      // Check if we already have cached metadata for this file
      const fileKey = `${file.name}_${file.size}_${file.lastModified}`;
      let metadata = this.cachedMetadata.get(fileKey);
      
      if (!metadata) {
        // Extract metadata using the new API and cache it
        console.log(`🔄 Extracting metadata (not cached)...`);
        metadata = await this.extractor.extractMetadata(file);
        this.cachedMetadata.set(fileKey, metadata);
        console.log(`💾 Cached metadata for future use`);
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
  async extractSingleStream(streamId, streamIndex, language, originalFileName) {
    if (!this.currentFile) {
      throw new Error('No video file available for extraction');
    }

    console.log(`🎯 Extracting stream ${streamIndex}...`);

    try {
      // Extract subtitle using the new API
      const extractionResult = await this.extractor.extractSubtitle(this.currentFile, streamIndex, {
        format: 'srt',
        quick: false, // Use full extraction for complete content
        timeout: 60000 // 60 second timeout
      });
      
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
      console.error(`❌ Failed to extract stream ${streamIndex}:`, error);
      throw new Error(`Subtitle extraction failed: ${error.message}`);
    }
  }


  /**
   * Store the current file for extraction operations
   */
  setCurrentFile(file) {
    this.currentFile = file;
  }

  /**
   * Extract all subtitles from a video file using cached metadata for efficiency  
   */
  async extractSubtitles(videoFile) {
    console.log(`🎬 Extracting subtitles from: ${videoFile.name}`);
    
    // Set the current file for extraction
    this.setCurrentFile(videoFile.file);
    
    try {
      // First, detect subtitle streams (this will use/create cached metadata)
      const streams = await this.detectSubtitleStreams(videoFile.file);
      
      if (streams.length === 0) {
        console.log(`📝 No subtitle streams found`);
        return [];
      }

      console.log(`🎯 Extracting ${streams.length} streams using individual extraction to avoid redundant metadata processing...`);
      
      const extractedSubtitles = [];
      
      // Extract each stream individually using the cached metadata
      for (const stream of streams) {
        try {
          const extracted = await this.extractSingleStream(
            stream.id,
            stream.streamIndex,
            stream.language,
            videoFile.name
          );
          
          if (extracted) {
            extractedSubtitles.push(extracted);
          }
        } catch (error) {
          console.error(`❌ Failed to extract stream ${stream.streamIndex}:`, error.message);
          // Continue with other streams
        }
      }

      console.log(`✅ Extracted ${extractedSubtitles.length} subtitle files`);
      return extractedSubtitles;
      
    } catch (error) {
      console.error(`❌ Batch extraction failed, using individual extraction:`, error.message);
      
      // Fallback to individual extraction
      const streams = await this.detectSubtitleStreams(videoFile.file);
      
      if (streams.length === 0) {
        console.log(`📝 No subtitle streams found`);
        return [];
      }

      console.log(`🎯 Extracting ${streams.length} streams individually...`);
      
      const extractedSubtitles = [];
      
      for (const stream of streams) {
        try {
          const extracted = await this.extractSingleStream(
            stream.id,
            stream.streamIndex,
            stream.language,
            videoFile.name
          );
          
          if (extracted) {
            extractedSubtitles.push(extracted);
          }
        } catch (error) {
          console.error(`❌ Failed to extract stream ${stream.streamIndex}:`, error);
          // Continue with other streams
        }
      }

      console.log(`✅ Extracted ${extractedSubtitles.length} subtitle files`);
      return extractedSubtitles;
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
   * Get supported file formats from the extractor
   */
  getSupportedFormats() {
    if (this.extractor) {
      return this.extractor.getSupportedFormats();
    }
    // Default supported formats if extractor not initialized
    return ['mkv', 'mp4', 'avi', 'mov', 'm4v', 'wmv', 'webm', 'ogv', '3gp', 'flv'];
  }

  /**
   * Terminate the extractor and clean up resources
   */
  async terminate() {
    if (this.extractor) {
      try {
        await this.extractor.terminate();
        console.log('✅ VideoMetadataExtractor terminated');
      } catch (error) {
        console.error('❌ Error terminating VideoMetadataExtractor:', error.message);
      }
    }
    this.extractor = null;
    this.isLoaded = false;
    this.loadingPromise = null;
    this.currentFile = null;
    this.cachedMetadata.clear(); // Clear metadata cache
  }
}

// Create and export the singleton instance
export const mkvSubtitleExtractor = new MkvSubtitleExtractor();