import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { ensureNetworkDelay } from '../utils/networkUtils.js';
import { DEFAULT_SETTINGS } from '../utils/constants.js';

/**
 * Video Metadata Service
 * Extracts metadata from video files using FFmpeg WebAssembly
 */
class VideoMetadataService {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.isLoaded = false;
    this.loadPromise = null;
  }

  /**
   * Initialize FFmpeg WebAssembly
   */
  async loadFFmpeg() {
    if (this.isLoaded) return;

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadFFmpegCore();
    return this.loadPromise;
  }

  async _loadFFmpegCore() {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('✅ FFmpeg loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load FFmpeg:', error);
      throw new Error(`Failed to load FFmpeg: ${error.message}`);
    }
  }

  /**
   * Extract metadata from video file
   * @param {File} file - Video file to analyze
   * @returns {Promise<Object>} Video metadata including FPS, duration, etc.
   */
  async extractMetadata(file) {
    if (!this.isLoaded) {
      await this.loadFFmpeg();
    }

    try {
      // Validate file
      if (!file || file.size === 0) {
        throw new Error('Invalid or empty file');
      }

      // Check file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'];

      if (!extension || !supportedFormats.includes(extension)) {
        throw new Error(`Unsupported video format: ${extension || 'unknown'}`);
      }

      // Use chunked reading for large files (first 32MB should contain metadata)
      const chunkSize = 32 * 1024 * 1024; // 32MB
      const fileData = file.size <= chunkSize ? file : file.slice(0, chunkSize);

      // Generate unique filename to avoid conflicts
      const uniqueFilename = `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.video`;

      try {
        // Write file to FFmpeg virtual filesystem
        await this.ffmpeg.writeFile(uniqueFilename, await fetchFile(fileData));

        // Capture FFmpeg log output
        let ffmpegLogs = [];
        const logHandler = ({ message }) => {
          ffmpegLogs.push(message);
        };

        this.ffmpeg.on('log', logHandler);

        try {
          // Use -i to get metadata info (this will "fail" but produce metadata logs)
          await this.ffmpeg.exec(['-i', uniqueFilename]);
        } catch (error) {
          // Expected "error" for metadata extraction
        }

        this.ffmpeg.off('log', logHandler);

        // Parse metadata from logs
        const metadata = this._parseFFmpegLogs(ffmpegLogs.join('\n'), file);

        return metadata;
      } finally {
        // Always clean up the file, even if there's an error
        try {
          await this.ffmpeg.deleteFile(uniqueFilename);
        } catch (cleanupError) {
          console.warn('Failed to cleanup FFmpeg file:', cleanupError);
        }
      }
    } catch (error) {
      console.error('Video metadata extraction failed:', error);

      // Return basic metadata if FFmpeg fails
      return {
        filename: file.name,
        filesize: file.size,
        fps: 25.0, // Default FPS
        duration: null,
        durationFormatted: 'unknown',
        width: 1920,
        height: 1080,
        resolution: 'unknown',
        videoCodec: 'unknown',
        bitrate: null,
        audioCodec: 'unknown',
        sampleRate: 48000,
        moviebytesize: file.size,
        movietimems: null,
        moviefps: 25.0,
        movieframes: null,
        moviefilename: file.name,
        extractedAt: new Date().toISOString(),
        method: 'fallback',
        error: error.message,
      };
    }
  }

  /**
   * Parse FFmpeg logs to extract metadata
   * @param {string} logOutput - FFmpeg log output
   * @param {File} file - Original file for additional info
   * @returns {Object} Parsed metadata
   */
  _parseFFmpegLogs(logOutput, file) {
    // Parse video stream info
    const videoStreamMatch = logOutput.match(
      /Stream.*Video: ([^,]+)[^,]*,.*?(\d+x\d+)[^,]*,.*?(\d+\.?\d*) fps/
    );
    const videoCodec = videoStreamMatch ? videoStreamMatch[1] : 'unknown';
    const resolution = videoStreamMatch ? videoStreamMatch[2] : 'unknown';

    // Extract and log FPS with detailed debugging
    let fps = 25.0; // Default fallback
    if (videoStreamMatch) {
      const fpsString = videoStreamMatch[3];
      fps = parseFloat(fpsString);

      console.log(`🎬 FFmpeg FPS Detection for ${file.name}:`);
      console.log(`   - Raw FFmpeg FPS string: "${fpsString}"`);
      console.log(`   - Parsed FPS value: ${fps}`);
      console.log(`   - Full video stream match: "${videoStreamMatch[0]}"`);

      // Special handling for common problematic values
      if (fpsString === '23.98' || Math.abs(fps - 23.98) < 0.001) {
        console.log(`⚠️ Detected potentially incorrect FPS 23.98, should be 23.976`);
        console.log(`   - Original: ${fps}`);
        fps = 23.976; // Correct to proper NTSC film rate
        console.log(`   - Corrected: ${fps}`);
      }
    } else {
      console.log(`⚠️ No FPS found in FFmpeg output for ${file.name}, using default ${fps} fps`);
    }

    // Parse duration
    const durationMatch = logOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    let duration = null;
    let durationFormatted = 'unknown';
    let movietimems = null;
    let movieframes = null;

    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = parseInt(durationMatch[3]);
      const centiseconds = parseInt(durationMatch[4]);

      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      const totalMilliseconds = totalSeconds * 1000 + centiseconds * 10;

      duration = totalSeconds;
      durationFormatted = this._formatDuration(totalSeconds);
      movietimems = totalMilliseconds;
      movieframes = Math.round((totalMilliseconds / 1000) * fps);
    }

    // Parse bitrate
    const bitrateMatch = logOutput.match(/bitrate: (\d+) kb\/s/);
    const bitrate = bitrateMatch ? parseInt(bitrateMatch[1]) * 1000 : null;

    // Parse audio info
    const audioStreamMatch = logOutput.match(/Stream.*Audio: ([^,]+)[^,]*,.*?(\d+) Hz/);
    const audioCodec = audioStreamMatch ? audioStreamMatch[1] : 'unknown';
    const sampleRate = audioStreamMatch ? parseInt(audioStreamMatch[2]) : 48000;

    // Get dimensions
    const [width, height] =
      resolution !== 'unknown' ? resolution.split('x').map(n => parseInt(n)) : [1920, 1080];

    return {
      // File info
      filename: file.name,
      filesize: file.size,

      // Video info
      fps: fps,
      duration: duration, // in seconds
      durationFormatted: durationFormatted, // "1:23:45" format
      width: width,
      height: height,
      resolution: resolution,
      videoCodec: videoCodec,
      bitrate: bitrate,

      // Audio info
      audioCodec: audioCodec,
      sampleRate: sampleRate,

      // Upload parameters (for OpenSubtitles API)
      moviebytesize: file.size,
      movietimems: movietimems,
      moviefps: fps,
      movieframes: movieframes,
      moviefilename: file.name,

      // Processing info
      extractedAt: new Date().toISOString(),
      method: 'ffmpeg',
    };
  }

  /**
   * Format duration from seconds to H:MM:SS format
   * @param {number} totalSeconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  _formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Process multiple video files with rate limiting
   * @param {File[]} files - Array of video files
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Map of file paths to metadata
   */
  async processMultipleFiles(files, onProgress) {
    const results = {};
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        onProgress?.(i + 1, total, file.name);

        // Add delay between processing to prevent overwhelming the browser
        if (i > 0) {
          await ensureNetworkDelay(DEFAULT_SETTINGS.NETWORK_REQUEST_DELAY);
        }

        const metadata = await this.extractMetadata(file);
        results[file.name] = metadata;
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        results[file.name] = {
          error: error.message,
          filename: file.name,
          filesize: file.size,
        };
      }
    }

    return results;
  }
}

// Export singleton instance
export const videoMetadataService = new VideoMetadataService();
export default videoMetadataService;
