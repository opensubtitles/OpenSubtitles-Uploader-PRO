import { CACHE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';
import pako from 'pako';
import { uint8ArrayToBase64 } from '../utils/base64Utils.js';
import { safeSetItem, purgeExpiredCacheEntries, getCacheFootprint } from '../utils/storageQuota.js';

/**
 * Cache management service for OpenSubtitles data
 */
export class CacheService {
  /**
   * Compress data using pako (deflate)
   * @param {any} data - Data to compress (will be JSON stringified)
   * @returns {string} - Base64 encoded compressed data with compression marker
   */
  static compressData(data) {
    try {
      // Convert to JSON string
      const jsonString = JSON.stringify(data);

      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);

      // Compress using deflate
      const compressed = pako.deflate(uint8Array);

      // Convert to base64 and add compression marker
      const base64 = uint8ArrayToBase64(compressed);
      const compressedWithMarker = 'PAKO:' + base64;

      // Log compression stats for debugging
      const compressionRatio = ((compressed.length / uint8Array.length) * 100).toFixed(1);
      const sizeSavings = uint8Array.length - compressed.length;
      const withMarkerSize = compressedWithMarker.length;

      console.log(
        `📦 Cache compression: ${uint8Array.length} → ${compressed.length} bytes (${compressionRatio}%) | With marker: ${withMarkerSize} bytes | Saved: ${sizeSavings} bytes`
      );

      return compressedWithMarker;
    } catch (error) {
      console.error('Cache compression failed, storing uncompressed:', error);
      // Fallback to uncompressed JSON
      return JSON.stringify(data);
    }
  }

  /**
   * Decompress data using pako (inflate)
   * @param {string} compressedData - Base64 encoded compressed data
   * @returns {any} - Decompressed and parsed data
   */
  static decompressData(compressedData) {
    try {
      // Check if data is compressed (has PAKO: marker)
      if (!compressedData.startsWith('PAKO:')) {
        // Backward compatibility: parse as regular JSON
        return JSON.parse(compressedData);
      }

      // Remove compression marker
      const base64Data = compressedData.substring(5); // Remove 'PAKO:'

      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const compressedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        compressedBytes[i] = binaryString.charCodeAt(i);
      }

      // Decompress using inflate
      const decompressed = pako.inflate(compressedBytes);

      // Convert back to string
      const decoder = new TextDecoder('utf-8');
      const jsonString = decoder.decode(decompressed);

      // Parse JSON
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Cache decompression failed:', error);
      // Try parsing as regular JSON (fallback for corrupted data)
      try {
        return JSON.parse(
          compressedData.startsWith('PAKO:') ? compressedData.substring(5) : compressedData
        );
      } catch (fallbackError) {
        console.error('Cache fallback parsing also failed:', fallbackError);
        return null;
      }
    }
  }
  /**
   * Check if cache is valid for a given key
   */
  static isCacheValid(cacheKey) {
    try {
      const expiryTime = localStorage.getItem(cacheKey + '_expiry');
      if (!expiryTime) return false;

      const now = new Date().getTime();
      const expiry = parseInt(expiryTime, 10);

      return now < expiry;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Load data from cache if valid and decompress.
   *
   * An expired entry is deleted on the way out. Without this, expiry only ever
   * demoted an entry to a miss and left it occupying quota forever - the leak
   * that eventually made login impossible.
   */
  static loadFromCache(cacheKey) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData === null) return null;

      if (this.isCacheValid(cacheKey)) {
        return this.decompressData(cachedData);
      }

      this.clearCache(cacheKey);
    } catch (error) {
      console.error(`Error loading from cache (${cacheKey}):`, error);
    }
    return null;
  }

  /**
   * Store a value and its expiry as a pair, reclaiming space if the quota is
   * already gone.
   *
   * The two keys are written together or not at all. A value without a live
   * expiry can never be served by `isCacheValid`, so a half-written pair would
   * be dead weight occupying the very quota we are short of.
   *
   * @param {string} cacheKey
   * @param {any} data - compressed in place
   * @param {number} expiryTime - absolute epoch ms
   * @returns {boolean} true when both keys are on disk
   */
  static writeCacheEntry(cacheKey, data, expiryTime) {
    const compressedData = this.compressData(data);
    // Both halves reserve the value key so making room for one cannot evict
    // the other and leave a half-written pair reported as a success.
    const reserve = [cacheKey];

    if (!safeSetItem(cacheKey, compressedData, { label: `cache ${cacheKey}`, reserve })) {
      return false;
    }

    if (
      !safeSetItem(cacheKey + '_expiry', expiryTime.toString(), {
        label: `expiry ${cacheKey}`,
        reserve,
      })
    ) {
      // Roll back so no orphan value survives without its expiry.
      try {
        localStorage.removeItem(cacheKey);
      } catch {
        /* nothing more we can do */
      }
      return false;
    }

    return true;
  }

  /**
   * Save data to cache with expiration and compression
   */
  static saveToCache(cacheKey, data, cacheControlHeader = null) {
    try {
      let maxAge = DEFAULT_SETTINGS.CACHE_DURATION;

      if (cacheControlHeader) {
        const maxAgeMatch = cacheControlHeader.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          maxAge = parseInt(maxAgeMatch[1], 10);
        }
      }

      const expiryTime = new Date().getTime() + maxAge * 1000;

      if (!this.writeCacheEntry(cacheKey, data, expiryTime)) {
        return { success: false, error: 'storage full' };
      }

      return { success: true, expiryTime: maxAge };
    } catch (error) {
      console.error(`Error saving to cache (${cacheKey}):`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save data to cache with custom expiration duration and compression
   */
  static saveToCacheWithDuration(cacheKey, data, durationInSeconds) {
    try {
      const expiryTime = new Date().getTime() + durationInSeconds * 1000;

      if (!this.writeCacheEntry(cacheKey, data, expiryTime)) {
        return { success: false, error: 'storage full' };
      }

      return { success: true, expiryTime: durationInSeconds };
    } catch (error) {
      console.error(`Error saving to cache (${cacheKey}):`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear specific cache
   */
  static clearCache(cacheKey) {
    try {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey + '_expiry');
      return true;
    } catch (error) {
      console.error(`Error clearing cache (${cacheKey}):`, error);
      return false;
    }
  }

  /**
   * Delete every expired cache entry. Called once at startup so quota is
   * reclaimed before the app has a chance to need it, rather than only in
   * response to a write that already failed.
   *
   * @returns {{removed: number, freedBytes: number}}
   */
  static purgeExpiredEntries() {
    return purgeExpiredCacheEntries();
  }

  /**
   * Footprint of the evictable caches, so the quota can be watched filling up.
   *
   * @returns {{entries: number, expiredEntries: number, bytes: number, formattedSize: string}}
   */
  static getCacheFootprint() {
    const footprint = getCacheFootprint();
    return { ...footprint, formattedSize: this.formatBytes(footprint.bytes) };
  }

  /**
   * Get cache size information
   */
  static getCacheSize() {
    try {
      let totalSize = 0;
      let itemCount = 0;
      const cacheItems = [];

      // Check all localStorage items for OpenSubtitles cache
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          // Check if it's an OpenSubtitles cache key
          const isOSCache =
            Object.values(CACHE_KEYS).some(cacheKey => key.startsWith(cacheKey)) ||
            key.includes('opensubtitles') ||
            key.includes('guessit') ||
            key.includes('movieguess') ||
            key.includes('language_detection') ||
            key.includes('features_') ||
            key.includes('checksub') ||
            key.endsWith('_expiry');

          if (isOSCache) {
            const value = localStorage.getItem(key);
            const itemSize = (key.length + (value?.length || 0)) * 2; // UTF-16 chars = 2 bytes each
            totalSize += itemSize;
            itemCount++;

            if (!key.endsWith('_expiry')) {
              const isCompressed = value && value.startsWith('PAKO:');
              cacheItems.push({
                key,
                size: itemSize,
                isExpired: !this.isCacheValid(key),
                compressed: isCompressed,
              });
            }
          }
        }
      }

      return {
        totalSize,
        itemCount,
        cacheItems,
        formattedSize: this.formatBytes(totalSize),
      };
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        cacheItems: [],
        formattedSize: '0 B',
      };
    }
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Clear all OpenSubtitles related cache
   */
  static clearAllCache() {
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        if (key.endsWith('_expiry')) return; // Skip expiry keys, they'll be cleared with main keys
        this.clearCache(key);
      });

      // Clear all GuessIt cache entries (they have dynamic keys)
      this.clearGuessItCache();

      // Clear all Movie Guess cache entries (they have dynamic keys)
      this.clearMovieGuessCache();

      // Clear all Language Detection cache entries (they have dynamic keys)
      this.clearLanguageDetectionCache();

      // Clear all Features cache entries (they have dynamic keys)
      this.clearFeaturesCache();

      // Clear all CheckSubHash cache entries (they have dynamic keys)
      this.clearCheckSubHashCache();

      return true;
    } catch (error) {
      console.error('Error clearing all cache:', error);
      return false;
    }
  }

  /**
   * Clear all GuessIt cache entries
   */
  static clearGuessItCache() {
    try {
      const guessItPrefix = CACHE_KEYS.GUESSIT_CACHE;
      const keysToRemove = [];

      // Find all localStorage keys that start with GuessIt cache prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(guessItPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_expiry');
      });

      console.log(`Cleared ${keysToRemove.length} GuessIt cache entries`);
      return true;
    } catch (error) {
      console.error('Error clearing GuessIt cache:', error);
      return false;
    }
  }

  /**
   * Clear all Movie Guess cache entries
   */
  static clearMovieGuessCache() {
    try {
      const movieGuessPrefix = CACHE_KEYS.MOVIE_GUESS_CACHE;
      const keysToRemove = [];

      // Find all localStorage keys that start with Movie Guess cache prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(movieGuessPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_expiry');
      });

      console.log(`Cleared ${keysToRemove.length} Movie Guess cache entries`);
      return true;
    } catch (error) {
      console.error('Error clearing Movie Guess cache:', error);
      return false;
    }
  }

  /**
   * Clear all Language Detection cache entries
   */
  static clearLanguageDetectionCache() {
    try {
      const languageDetectionPrefix = CACHE_KEYS.LANGUAGE_DETECTION_CACHE;
      const keysToRemove = [];

      // Find all localStorage keys that start with Language Detection cache prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(languageDetectionPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_expiry');
      });

      console.log(`Cleared ${keysToRemove.length} Language Detection cache entries`);
      return true;
    } catch (error) {
      console.error('Error clearing Language Detection cache:', error);
      return false;
    }
  }

  /**
   * Clear all Features cache entries
   */
  static clearFeaturesCache() {
    try {
      const featuresPrefix = CACHE_KEYS.FEATURES_CACHE;
      const keysToRemove = [];

      // Find all localStorage keys that start with Features cache prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(featuresPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_expiry');
      });

      console.log(`Cleared ${keysToRemove.length} Features cache entries`);
      return true;
    } catch (error) {
      console.error('Error clearing Features cache:', error);
      return false;
    }
  }

  /**
   * Clear all CheckSubHash cache entries
   */
  static clearCheckSubHashCache() {
    try {
      const checkSubPrefix = CACHE_KEYS.XMLRPC_CHECKSUB;
      const keysToRemove = [];

      // Find all localStorage keys that start with CheckSubHash cache prefix
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(checkSubPrefix)) {
          keysToRemove.push(key);
        }
      }

      // Remove all found keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        localStorage.removeItem(key + '_expiry');
      });

      console.log(`Cleared ${keysToRemove.length} CheckSubHash cache entries`);
      return true;
    } catch (error) {
      console.error('Error clearing CheckSubHash cache:', error);
      return false;
    }
  }

  /**
   * Get cache compression statistics
   */
  static getCacheCompressionStats() {
    try {
      let totalCompressed = 0;
      let totalUncompressed = 0;
      let compressedEntries = 0;
      let uncompressedEntries = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const isOSCache =
            Object.values(CACHE_KEYS).some(cacheKey => key.startsWith(cacheKey)) ||
            key.includes('opensubtitles') ||
            key.includes('guessit') ||
            key.includes('movieguess') ||
            key.includes('language_detection') ||
            key.includes('features_') ||
            key.includes('checksub');

          if (isOSCache && !key.endsWith('_expiry')) {
            const value = localStorage.getItem(key);
            if (value) {
              const itemSize = value.length;
              if (value.startsWith('PAKO:')) {
                totalCompressed += itemSize;
                compressedEntries++;
              } else {
                totalUncompressed += itemSize;
                uncompressedEntries++;
              }
            }
          }
        }
      }

      return {
        compressedEntries,
        uncompressedEntries,
        totalCompressed: this.formatBytes(totalCompressed * 2), // UTF-16
        totalUncompressed: this.formatBytes(totalUncompressed * 2), // UTF-16
        totalSize: this.formatBytes((totalCompressed + totalUncompressed) * 2),
        compressionRatio:
          totalUncompressed > 0
            ? ((totalCompressed / (totalCompressed + totalUncompressed)) * 100).toFixed(1) + '%'
            : 'N/A',
      };
    } catch (error) {
      console.error('Error calculating compression stats:', error);
      return {
        compressedEntries: 0,
        uncompressedEntries: 0,
        totalCompressed: '0 B',
        totalUncompressed: '0 B',
        totalSize: '0 B',
        compressionRatio: 'N/A',
      };
    }
  }

  /**
   * Get cache info for debugging
   */
  static getCacheInfo() {
    const info = {};

    Object.entries(CACHE_KEYS).forEach(([name, key]) => {
      if (key.endsWith('_expiry')) return;

      const hasData = localStorage.getItem(key) !== null;
      const isValid = this.isCacheValid(key);
      const expiryTime = localStorage.getItem(key + '_expiry');

      info[name] = {
        hasData,
        isValid,
        expiryTime: expiryTime ? new Date(parseInt(expiryTime, 10)).toISOString() : null,
      };
    });

    // Add GuessIt cache stats
    const guessItPrefix = CACHE_KEYS.GUESSIT_CACHE;
    let guessItCount = 0;
    let validGuessItCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(guessItPrefix) && !key.endsWith('_expiry')) {
        guessItCount++;
        if (this.isCacheValid(key)) {
          validGuessItCount++;
        }
      }
    }

    info.GUESSIT_ENTRIES = {
      totalEntries: guessItCount,
      validEntries: validGuessItCount,
      cacheDuration: '72 hours',
    };

    // Add Movie Guess cache stats
    const movieGuessPrefix = CACHE_KEYS.MOVIE_GUESS_CACHE;
    let movieGuessCount = 0;
    let validMovieGuessCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(movieGuessPrefix) && !key.endsWith('_expiry')) {
        movieGuessCount++;
        if (this.isCacheValid(key)) {
          validMovieGuessCount++;
        }
      }
    }

    info.MOVIE_GUESS_ENTRIES = {
      totalEntries: movieGuessCount,
      validEntries: validMovieGuessCount,
      cacheDuration: '72 hours',
    };

    // Add Language Detection cache stats
    const languageDetectionPrefix = CACHE_KEYS.LANGUAGE_DETECTION_CACHE;
    let languageDetectionCount = 0;
    let validLanguageDetectionCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(languageDetectionPrefix) && !key.endsWith('_expiry')) {
        languageDetectionCount++;
        if (this.isCacheValid(key)) {
          validLanguageDetectionCount++;
        }
      }
    }

    info.LANGUAGE_DETECTION_ENTRIES = {
      totalEntries: languageDetectionCount,
      validEntries: validLanguageDetectionCount,
      cacheDuration: '72 hours',
    };

    // Add Features cache stats
    const featuresPrefix = CACHE_KEYS.FEATURES_CACHE;
    let featuresCount = 0;
    let validFeaturesCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(featuresPrefix) && !key.endsWith('_expiry')) {
        featuresCount++;
        if (this.isCacheValid(key)) {
          validFeaturesCount++;
        }
      }
    }

    info.FEATURES_ENTRIES = {
      totalEntries: featuresCount,
      validEntries: validFeaturesCount,
      cacheDuration: '72 hours',
    };

    // Add CheckSubHash cache stats
    const checkSubPrefix = CACHE_KEYS.XMLRPC_CHECKSUB;
    let checkSubCount = 0;
    let validCheckSubCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(checkSubPrefix) && !key.endsWith('_expiry')) {
        checkSubCount++;
        if (this.isCacheValid(key)) {
          validCheckSubCount++;
        }
      }
    }

    info.CHECKSUB_ENTRIES = {
      totalEntries: checkSubCount,
      validEntries: validCheckSubCount,
      cacheDuration: '24 hours',
    };

    return info;
  }
}
