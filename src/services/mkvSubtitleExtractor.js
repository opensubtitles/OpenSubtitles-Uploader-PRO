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
        logLevel: 'error', // Suppress chunk processing logs
        verbose: false, // Disable verbose output
        chunkSize: 50 * 1024 * 1024, // 50MB chunks for faster processing
        metadataOnly: true, // Only extract metadata, not full file processing
        quickMode: true, // Use quick mode for faster extraction
        onProgress: (progress) => {
          // Only log significant progress milestones to reduce spam
          if (progress.progress % 50 === 0 || progress.progress === 100) {
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
        try {
          // Temporarily suppress chunk logging during metadata extraction
          const originalConsoleLog = console.log;
          console.log = (...args) => {
            const message = args.join(' ');
            // Filter out FileProcessor chunk messages
            if (message.includes('[FileProcessor]') && (
                message.includes('Completed chunk') || 
                message.includes('Processing') || 
                message.includes('Combined') ||
                message.includes('Creating complete file data')
            )) {
              return; // Suppress these messages
            }
            originalConsoleLog.apply(console, args);
          };
          
          try {
            metadata = await Promise.race([
              this.extractor.extractMetadata(file),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Metadata extraction timeout after 120 seconds')), 120000)
              )
            ]);
          } finally {
            // Restore original console.log
            console.log = originalConsoleLog;
          }
          
          this.cachedMetadata.set(fileKey, metadata);
          console.log(`💾 Cached metadata for future use`);
          console.log(`📊 Metadata contains ${metadata.streams ? metadata.streams.length : 0} streams`);
        } catch (error) {
          console.error(`❌ Metadata extraction failed:`, error.message);
          throw error;
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
  async extractSingleStream(streamId, streamIndex, language, originalFileName) {
    if (!this.currentFile) {
      throw new Error('No video file available for extraction');
    }

    console.log(`🎯 Extracting stream ${streamIndex}...`);

    try {
      // Try extracting subtitle with different options
      let extractionResult;
      
      try {
        // First try with SRT format
        extractionResult = await Promise.race([
          this.extractor.extractSubtitle(this.currentFile, streamIndex, {
            format: 'srt',
            quick: true, // Try quick extraction first
            timeout: 30000 // 30 second timeout
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Subtitle extraction timeout after 30 seconds for stream ${streamIndex}`)), 30000)
          )
        ]);
      } catch (srtError) {
        console.warn(`⚠️ SRT extraction failed for stream ${streamIndex}, trying VTT format:`, srtError.message);
        
        try {
          // Fallback to VTT format
          extractionResult = await Promise.race([
            this.extractor.extractSubtitle(this.currentFile, streamIndex, {
              format: 'vtt',
              quick: true,
              timeout: 30000
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
   * Extract all subtitles from a video file - DISABLED due to performance issues
   */
  async extractSubtitles(videoFile) {
    console.log(`⚠️ MKV subtitle extraction is currently disabled due to performance issues`);
    console.log(`📋 Detected ${await this.getSubtitleStreamCount(videoFile.file)} subtitle streams but extraction is skipped`);
    console.log(`💡 Consider using external tools like mkvextract for efficient subtitle extraction`);
    
    return [];
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