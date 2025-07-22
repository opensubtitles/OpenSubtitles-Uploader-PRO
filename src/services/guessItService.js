import { OPENSUBTITLES_COM_API_KEY, DEFAULT_SETTINGS, API_ENDPOINTS, CACHE_KEYS, getApiHeaders } from '../utils/constants.js';
import { delayedFetch } from '../utils/networkUtils.js';
import { retryAsync } from '../utils/retryUtils.js';
import { CacheService } from './cache.js';

/**
 * GuessIt API service for extracting metadata from filenames
 */
export class GuessItService {
  
  /**
   * Generate cache key for filename
   * @param {string} filename - The filename to generate key for
   * @returns {string} - Cache key
   */
  static generateCacheKey(filename) {
    // Create a simple hash of the filename for the cache key
    return `${CACHE_KEYS.GUESSIT_CACHE}_${btoa(filename).replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Load GuessIt data from cache
   * @param {string} filename - The filename to check cache for
   * @returns {Object|null} - Cached data or null
   */
  static loadFromCache(filename) {
    const cacheKey = this.generateCacheKey(filename);
    return CacheService.loadFromCache(cacheKey);
  }

  /**
   * Save GuessIt data to cache
   * @param {string} filename - The filename to save cache for
   * @param {Object} data - The GuessIt response data
   * @returns {Object} - Cache save result
   */
  static saveToCache(filename, data) {
    const cacheKey = this.generateCacheKey(filename);
    return CacheService.saveToCacheWithDuration(cacheKey, data, DEFAULT_SETTINGS.GUESSIT_CACHE_DURATION);
  }

  /**
   * Extract metadata from filename using GuessIt API (without cache)
   * @param {string} filename - The filename to analyze
   * @returns {Promise<Object>} - Parsed metadata
   */
  static async guessFileMetadataUncached(filename) {
    try {
      const encodedFilename = encodeURIComponent(filename);
      const url = `${API_ENDPOINTS.GUESSIT}?filename=${encodedFilename}`;
      
      const response = await delayedFetch(url, {
        method: 'GET',
        headers: getApiHeaders('application/json', {
          'Api-Key': OPENSUBTITLES_COM_API_KEY
        }),
      }, DEFAULT_SETTINGS.GUESSIT_DELAY);

      if (!response.ok) {
        throw new Error(`GuessIt API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error(`GuessIt API failed for ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Extract metadata from filename using GuessIt API with caching
   * @param {string} filename - The filename to analyze
   * @param {Function} addDebugInfo - Debug callback (optional)
   * @returns {Promise<Object>} - Parsed metadata
   */
  static async guessFileMetadata(filename, addDebugInfo = null) {
    // Check cache first
    const cachedData = this.loadFromCache(filename);
    if (cachedData) {
      console.log(`GuessIt cache hit for: ${filename}`);
      if (addDebugInfo) {
        addDebugInfo(`🎯 GuessIt cache HIT for ${filename} (no API call needed)`);
      }
      return cachedData;
    }

    // Cache miss, make API call
    console.log(`GuessIt cache miss for: ${filename}, making API call`);
    if (addDebugInfo) {
      addDebugInfo(`❗ GuessIt cache MISS for ${filename}, making API call`);
    }
    
    const data = await this.guessFileMetadataUncached(filename);
    
    // Save to cache
    this.saveToCache(filename, data);
    if (addDebugInfo) {
      addDebugInfo(`💾 GuessIt result cached for ${filename} (72 hours)`);
    }
    
    return data;
  }

  /**
   * Extract metadata with retry logic
   * @param {string} filename - The filename to analyze
   * @param {Function} addDebugInfo - Debug callback (optional)
   * @returns {Promise<Object>} - Parsed metadata
   */
  static async guessFileMetadataWithRetry(filename, addDebugInfo = null) {
    // Check cache first
    const cachedData = this.loadFromCache(filename);
    if (cachedData) {
      if (addDebugInfo) {
        addDebugInfo(`🎯 GuessIt cache HIT for ${filename} (no API call needed)`);
      }
      return cachedData;
    }

    // Cache miss, use retry logic
    if (addDebugInfo) {
      addDebugInfo(`❗ GuessIt cache MISS for ${filename}, making API call with retry`);
    }

    return retryAsync(
      () => this.guessFileMetadataUncached(filename),
      3, // max attempts
      DEFAULT_SETTINGS.RETRY_BASE_DELAY,
      (attempt, maxAttempts) => {
        if (addDebugInfo) {
          addDebugInfo(`GuessIt attempt ${attempt}/${maxAttempts} for ${filename}`);
        }
      }
    ).then(data => {
      // Save successful result to cache
      this.saveToCache(filename, data);
      if (addDebugInfo) {
        addDebugInfo(`💾 GuessIt result cached for ${filename} (72 hours)`);
      }
      return data;
    });
  }

  /**
   * Format metadata for display as tags
   * @param {Object} metadata - Raw metadata from GuessIt
   * @returns {Array} - Array of tag objects with label, value, and color
   */
  static formatMetadataAsTags(metadata) {
    if (!metadata) return [];

    const tags = [];

    // Define comprehensive tag configurations with colors and priorities
    const tagConfigs = {
      // Main properties
      type: { label: 'Type', color: 'purple', priority: 1 },
      title: { label: 'Title', color: 'blue', priority: 2 },
      alternative_title: { label: 'Alt Title', color: 'blue', priority: 3 },
      year: { label: 'Year', color: 'green', priority: 4 },
      date: { label: 'Date', color: 'green', priority: 5 },
      
      // Episode properties
      season: { label: 'Season', color: 'orange', priority: 6 },
      episode: { label: 'Episode', color: 'orange', priority: 7 },
      episode_count: { label: 'Episodes', color: 'orange', priority: 8 },
      season_count: { label: 'Seasons', color: 'orange', priority: 9 },
      episode_details: { label: 'Details', color: 'orange', priority: 10 },
      episode_format: { label: 'Format', color: 'orange', priority: 11 },
      part: { label: 'Part', color: 'orange', priority: 12 },
      version: { label: 'Version', color: 'orange', priority: 13 },
      disc: { label: 'Disc', color: 'orange', priority: 14 },
      week: { label: 'Week', color: 'orange', priority: 15 },
      
      // Video properties
      source: { label: 'Source', color: 'teal', priority: 16 },
      screen_size: { label: 'Quality', color: 'cyan', priority: 17 },
      aspect_ratio: { label: 'Aspect', color: 'cyan', priority: 18 },
      video_codec: { label: 'Video', color: 'indigo', priority: 19 },
      video_profile: { label: 'V.Profile', color: 'indigo', priority: 20 },
      color_depth: { label: 'Color', color: 'gray', priority: 21 },
      video_api: { label: 'V.API', color: 'indigo', priority: 22 },
      video_bit_rate: { label: 'V.Bitrate', color: 'indigo', priority: 23 },
      frame_rate: { label: 'FPS', color: 'indigo', priority: 24 },
      
      // Audio properties
      audio_codec: { label: 'Audio', color: 'pink', priority: 25 },
      audio_channels: { label: 'Channels', color: 'pink', priority: 26 },
      audio_profile: { label: 'A.Profile', color: 'pink', priority: 27 },
      audio_bit_rate: { label: 'A.Bitrate', color: 'pink', priority: 28 },
      
      // Container and technical
      container: { label: 'Container', color: 'red', priority: 29 },
      mimetype: { label: 'MIME', color: 'red', priority: 30 },
      size: { label: 'Size', color: 'gray', priority: 31 },
      crc32: { label: 'CRC32', color: 'gray', priority: 32 },
      uuid: { label: 'UUID', color: 'gray', priority: 33 },
      
      // Release and distribution
      release_group: { label: 'Group', color: 'yellow', priority: 34 },
      website: { label: 'Website', color: 'yellow', priority: 35 },
      streaming_service: { label: 'Service', color: 'yellow', priority: 36 },
      
      // Localization
      country: { label: 'Country', color: 'emerald', priority: 37 },
      language: { label: 'Language', color: 'emerald', priority: 38 },
      subtitle_language: { label: 'Sub Lang', color: 'emerald', priority: 39 },
      
      // Edition and extras
      edition: { label: 'Edition', color: 'violet', priority: 40 },
      bonus: { label: 'Bonus', color: 'violet', priority: 41 },
      bonus_title: { label: 'Bonus Title', color: 'violet', priority: 42 },
      film: { label: 'Film #', color: 'violet', priority: 43 },
      film_title: { label: 'Film Title', color: 'violet', priority: 44 },
      film_series: { label: 'Film Series', color: 'violet', priority: 45 },
      
      // Media and disc
      cd: { label: 'CD', color: 'stone', priority: 46 },
      cd_count: { label: 'CDs', color: 'stone', priority: 47 },
      
      // Other properties
      other: { label: 'Other', color: 'slate', priority: 48 }
    };

    // Process each metadata field
    Object.entries(metadata).forEach(([key, value]) => {
      const config = tagConfigs[key];
      if (config && value !== null && value !== undefined && value !== '') {
        // Handle different value types
        let displayValue = this.formatMetadataValue(value);
        
        if (displayValue) {
          tags.push({
            key,
            label: config.label,
            value: displayValue,
            color: config.color,
            priority: config.priority
          });
        }
      }
    });

    // Sort by priority
    tags.sort((a, b) => a.priority - b.priority);

    return tags;
  }

  /**
   * Format metadata values for display
   * @param {any} value - The metadata value
   * @returns {string} - Formatted display value
   */
  static formatMetadataValue(value) {
    if (value === null || value === undefined) return '';
    
    // Handle arrays
    if (Array.isArray(value)) {
      // For arrays, join with commas but limit to reasonable length
      const displayArray = value.slice(0, 3); // Show max 3 items
      const result = displayArray.map(item => this.formatSingleValue(item)).join(', ');
      return value.length > 3 ? result + '...' : result;
    }
    
    return this.formatSingleValue(value);
  }

  /**
   * Format a single metadata value
   * @param {any} value - Single value to format
   * @returns {string} - Formatted value
   */
  static formatSingleValue(value) {
    if (value === null || value === undefined) return '';
    
    // Handle objects with special properties (guessit objects)
    if (typeof value === 'object') {
      // Handle babelfish Country/Language objects
      if (value.name) return value.name;
      if (value.alpha2) return value.alpha2.toUpperCase();
      if (value.alpha3) return value.alpha3.toUpperCase();
      
      // Handle guessit Size/BitRate/FrameRate objects
      if (value.magnitude !== undefined && value.units) {
        return `${value.magnitude}${value.units}`;
      }
      
      // Handle other objects by converting to string
      return String(value);
    }
    
    return String(value);
  }

  /**
   * Get color styles for tags based on theme
   * @param {string} color - Color name
   * @param {boolean} isDark - Whether dark mode is active
   * @returns {Object} - Inline styles object
   */
  static getTagColorStyles(color, isDark = false) {
    const colorMap = {
      blue: {
        light: { backgroundColor: '#dbeafe', color: '#000000', borderColor: '#60a5fa' },
        dark: { backgroundColor: 'rgba(30, 58, 138, 0.3)', color: '#93c5fd', borderColor: '#1d4ed8' }
      },
      green: {
        light: { backgroundColor: '#dcfce7', color: '#000000', borderColor: '#4ade80' },
        dark: { backgroundColor: 'rgba(20, 83, 45, 0.3)', color: '#86efac', borderColor: '#15803d' }
      },
      purple: {
        light: { backgroundColor: '#e9d5ff', color: '#000000', borderColor: '#a855f7' },
        dark: { backgroundColor: 'rgba(88, 28, 135, 0.3)', color: '#c084fc', borderColor: '#7c3aed' }
      },
      orange: {
        light: { backgroundColor: '#fed7aa', color: '#000000', borderColor: '#fb923c' },
        dark: { backgroundColor: 'rgba(154, 52, 18, 0.3)', color: '#fdba74', borderColor: '#ea580c' }
      },
      cyan: {
        light: { backgroundColor: '#cffafe', color: '#000000', borderColor: '#22d3ee' },
        dark: { backgroundColor: 'rgba(21, 94, 117, 0.3)', color: '#67e8f9', borderColor: '#0891b2' }
      },
      teal: {
        light: { backgroundColor: '#ccfbf1', color: '#000000', borderColor: '#2dd4bf' },
        dark: { backgroundColor: 'rgba(19, 78, 74, 0.3)', color: '#5eead4', borderColor: '#0d9488' }
      },
      indigo: {
        light: { backgroundColor: '#e0e7ff', color: '#000000', borderColor: '#6366f1' },
        dark: { backgroundColor: 'rgba(55, 48, 163, 0.3)', color: '#a5b4fc', borderColor: '#4338ca' }
      },
      pink: {
        light: { backgroundColor: '#fce7f3', color: '#000000', borderColor: '#f472b6' },
        dark: { backgroundColor: 'rgba(157, 23, 77, 0.3)', color: '#f9a8d4', borderColor: '#be185d' }
      },
      gray: {
        light: { backgroundColor: '#e5e7eb', color: '#000000', borderColor: '#9ca3af' },
        dark: { backgroundColor: 'rgba(75, 85, 99, 0.5)', color: '#d1d5db', borderColor: '#4b5563' }
      },
      yellow: {
        light: { backgroundColor: '#fef3c7', color: '#000000', borderColor: '#fbbf24' },
        dark: { backgroundColor: 'rgba(146, 64, 14, 0.3)', color: '#fcd34d', borderColor: '#d97706' }
      },
      red: {
        light: { backgroundColor: '#fecaca', color: '#000000', borderColor: '#f87171' },
        dark: { backgroundColor: 'rgba(153, 27, 27, 0.3)', color: '#fca5a5', borderColor: '#dc2626' }
      },
      emerald: {
        light: { backgroundColor: '#d1fae5', color: '#000000', borderColor: '#34d399' },
        dark: { backgroundColor: 'rgba(6, 78, 59, 0.3)', color: '#6ee7b7', borderColor: '#059669' }
      },
      violet: {
        light: { backgroundColor: '#ddd6fe', color: '#000000', borderColor: '#8b5cf6' },
        dark: { backgroundColor: 'rgba(76, 29, 149, 0.3)', color: '#a78bfa', borderColor: '#7c3aed' }
      },
      stone: {
        light: { backgroundColor: '#e7e5e4', color: '#000000', borderColor: '#a8a29e' },
        dark: { backgroundColor: 'rgba(87, 83, 78, 0.5)', color: '#d6d3d1', borderColor: '#57534e' }
      },
      slate: {
        light: { backgroundColor: '#e2e8f0', color: '#000000', borderColor: '#94a3b8' },
        dark: { backgroundColor: 'rgba(71, 85, 105, 0.5)', color: '#cbd5e1', borderColor: '#475569' }
      }
    };

    const colorStyles = colorMap[color] || colorMap.gray;
    return isDark ? colorStyles.dark : colorStyles.light;
  }

  /**
   * Get color classes for tags (legacy method for compatibility)
   * @param {string} color - Color name
   * @returns {string} - Empty string (styles now handled by getTagColorStyles)
   */
  static getTagColorClasses(color) {
    // Return empty string - styles are now handled by getTagColorStyles method
    return '';
  }
}