import { guessit } from 'guessit-js';
import { CacheService } from './cache.js';
import { CACHE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';

/**
 * Offline GuessIt service using WASM
 * Provides movie/TV show metadata extraction without API dependency
 */
export class OfflineGuessItService {
  static wasmReady = false;
  static initializationPromise = null;

  /**
   * Initialize the GuessIt WASM module
   */
  static async initialize() {
    if (this.wasmReady) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeWasm();
    return this.initializationPromise;
  }

  static async _initializeWasm() {
    try {
      // The guessit-js module should auto-initialize
      // Test it by running a simple guess
      await guessit('test.movie.2023.mkv');
      this.wasmReady = true;
      console.log('✅ GuessIt WASM initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize GuessIt WASM:', error);
      return false;
    }
  }

  /**
   * Guess movie/TV show information from filename
   * @param {string} filename - The filename to analyze
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - GuessIt result
   */
  static async guessFromFilename(filename, options = {}) {
    if (!(await this.initialize())) {
      throw new Error('GuessIt WASM not initialized');
    }

    // Check cache first
    const cacheKey = `${CACHE_KEYS.GUESSIT_CACHE}_${filename}`;
    const cached = CacheService.loadFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const result = await guessit(filename, options);

      // Cache the result
      CacheService.saveToCacheWithDuration(
        cacheKey,
        result,
        DEFAULT_SETTINGS.GUESSIT_CACHE_DURATION
      );

      return result;
    } catch (error) {
      console.error('GuessIt WASM error:', error);
      throw new Error(`Failed to guess from filename: ${error.message}`);
    }
  }

  /**
   * Extract movie information from subtitle file
   * Uses the best movie detection name for more accurate results
   * @param {Object} subtitleFile - Subtitle file object with fullPath and name
   * @returns {Promise<Object>} - GuessIt result
   */
  static async guessFromSubtitleFile(subtitleFile) {
    // Import getBestMovieDetectionName dynamically to avoid circular dependencies
    const { getBestMovieDetectionName } = await import('../utils/fileUtils.js');

    const bestName = getBestMovieDetectionName(subtitleFile);
    return this.guessFromFilename(bestName);
  }

  /**
   * Enhanced guess with additional processing
   * @param {string} filename - The filename to analyze
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Enhanced GuessIt result
   */
  static async enhancedGuess(filename, options = {}) {
    const result = await this.guessFromFilename(filename, options);

    // Add enhanced fields
    const enhanced = {
      ...result,

      // Add formatted title
      formatted_title: this.formatTitle(result),

      // Add year extraction
      year: this.extractYear(result),

      // Add type detection
      media_type: this.detectMediaType(result),

      // Add quality information
      quality_info: this.extractQualityInfo(result),

      // Add episode information for TV shows
      episode_info: this.extractEpisodeInfo(result),

      // Add original filename for reference
      original_filename: filename,
    };

    return enhanced;
  }

  /**
   * Format title for display
   */
  static formatTitle(guessitResult) {
    const { title, year, season, episode, episode_title } = guessitResult;

    if (season !== undefined && episode !== undefined) {
      // TV show episode
      const seasonStr = String(season).padStart(2, '0');
      const episodeStr = String(episode).padStart(2, '0');
      const episodeTitle = episode_title ? ` - ${episode_title}` : '';
      const yearStr = year ? ` (${year})` : '';

      return `${title} - S${seasonStr}E${episodeStr}${episodeTitle}${yearStr}`;
    } else if (title && year) {
      // Movie with year
      return `${title} (${year})`;
    } else if (title) {
      // Just title
      return title;
    }

    return 'Unknown Title';
  }

  /**
   * Extract year from GuessIt result
   */
  static extractYear(guessitResult) {
    return guessitResult.year || null;
  }

  /**
   * Detect media type (movie, tv, anime, etc.)
   */
  static detectMediaType(guessitResult) {
    const { type, season, episode } = guessitResult;

    if (type) {
      return type;
    }

    if (season !== undefined || episode !== undefined) {
      return 'episode';
    }

    return 'movie';
  }

  /**
   * Extract quality information
   */
  static extractQualityInfo(guessitResult) {
    const { screen_size, video_codec, audio_codec, source, release_group, format } = guessitResult;

    return {
      resolution: screen_size || null,
      video_codec: video_codec || null,
      audio_codec: audio_codec || null,
      source: source || null,
      release_group: release_group || null,
      format: format || null,
    };
  }

  /**
   * Extract episode information for TV shows
   */
  static extractEpisodeInfo(guessitResult) {
    const { season, episode, episode_title, part } = guessitResult;

    if (season === undefined && episode === undefined) {
      return null;
    }

    return {
      season: season || null,
      episode: episode || null,
      episode_title: episode_title || null,
      part: part || null,
    };
  }

  /**
   * Batch process multiple filenames
   * @param {Array<string>} filenames - Array of filenames to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array<Object>>} - Array of GuessIt results
   */
  static async batchGuess(filenames, options = {}) {
    if (!(await this.initialize())) {
      throw new Error('GuessIt WASM not initialized');
    }

    const results = [];
    const { concurrency = 5 } = options;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < filenames.length; i += concurrency) {
      const batch = filenames.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(filename =>
          this.enhancedGuess(filename, options).catch(error => ({
            filename,
            error: error.message,
          }))
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get supported file extensions that GuessIt can process
   */
  static getSupportedExtensions() {
    return [
      // Video extensions
      '.mp4',
      '.mkv',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.webm',
      '.m4v',
      '.mpg',
      '.mpeg',
      '.3gp',
      '.ts',
      '.vob',
      '.ogv',

      // Subtitle extensions
      '.srt',
      '.vtt',
      '.ass',
      '.ssa',
      '.sub',
      '.idx',
      '.sup',
      '.sbv',
      '.dfxp',
      '.ttml',
      '.xml',
      '.txt',

      // Archive extensions
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.gz',
    ];
  }

  /**
   * Check if GuessIt WASM is ready
   */
  static isReady() {
    return this.wasmReady;
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return CacheService.getCacheInfo();
  }

  /**
   * Clear GuessIt cache
   */
  static clearCache() {
    CacheService.clearGuessItCache();
  }
}
