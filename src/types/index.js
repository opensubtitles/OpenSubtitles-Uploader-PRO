/**
 * Type definitions for the Subtitle Uploader application
 * These can be used with JSDoc comments or as reference for TypeScript migration
 */

/**
 * @typedef {Object} FileObject
 * @property {string} name - Original filename
 * @property {string} fullPath - Full path including directory structure
 * @property {number} size - File size in bytes
 * @property {string} type - MIME type
 * @property {File} file - Browser File object
 * @property {boolean} isVideo - Whether this is a video file
 * @property {boolean} isSubtitle - Whether this is a subtitle file
 * @property {string|null} movieHash - Calculated movie hash or 'error'
 * @property {LanguageDetectionResult|string|null} detectedLanguage - Language detection result
 * @property {boolean} recognized - Whether file type was recognized
 * @property {string} [file_type] - Video file type (mp4, mkv, etc.)
 * @property {string} [file_kind] - Human readable file type description
 * @property {boolean} [shouldRemove] - Flag to indicate file should be removed
 */

/**
 * @typedef {Object} LanguageDetectionResult
 * @property {string} language_code - ISO 639-1 language code
 * @property {string} language_name - Human readable language name
 * @property {number} confidence - Detection confidence (0-1)
 * @property {DetectedLanguage[]} all_languages - All detected languages with confidence
 * @property {string} file_type - Detected file type
 * @property {string} file_kind - Human readable file kind
 * @property {string} filename - Original filename
 * @property {string} text_sample - Sample of analyzed text
 */

/**
 * @typedef {Object} DetectedLanguage
 * @property {string} language_code - ISO 639-1 language code
 * @property {string} language_name - Human readable language name
 * @property {number} confidence - Detection confidence (0-1)
 */

/**
 * @typedef {Object} MovieGuessResult
 * @property {string} imdbid - IMDb ID
 * @property {string} title - Movie title
 * @property {string} year - Release year
 * @property {string} kind - Movie kind (movie, tv series, etc.)
 * @property {string} [reason] - Reason for match
 * @property {string} [season] - Season number for TV shows
 * @property {string} [episode] - Episode number for TV shows
 */

/**
 * @typedef {Object} LanguageInfo
 * @property {string} flag - Unicode flag emoji
 * @property {string} name - Language name in English
 * @property {string} [originalName] - Language name in original language
 * @property {string} [iso639_3] - ISO 639-3 language code
 * @property {string} [language_code] - ISO 639-1 language code
 * @property {string} [subLanguageID] - OpenSubtitles internal language ID
 * @property {string} [languageName] - Language name from XML-RPC
 * @property {string} [iso639] - ISO 639-1 code from XML-RPC
 * @property {boolean} [canUpload] - Whether language supports uploads
 * @property {string} displayName - Display name for UI
 */

/**
 * @typedef {Object} CombinedLanguage
 * @property {string} code - Language code
 * @property {string} flag - Unicode flag emoji
 * @property {string} displayName - Display name for UI
 * @property {string} iso639 - ISO 639-1 language code
 * @property {boolean} canUpload - Whether language supports uploads
 * @property {number} [confidence] - Detection confidence if detected
 * @property {boolean} [isDetected] - Whether this was detected from subtitle
 */

/**
 * @typedef {Object} VideoPair
 * @property {FileObject} video - Video file object
 * @property {FileObject[]} subtitles - Array of matching subtitle files
 * @property {string} id - Unique identifier (usually video fullPath)
 */

/**
 * @typedef {Object} MovieGroup
 * @property {FileObject|null} video - Video file (null for orphaned subtitles)
 * @property {FileObject[]} subtitles - Array of subtitle files
 * @property {string} directory - Directory path
 * @property {string} baseName - Base filename without extension
 * @property {boolean} [isOrphan] - Whether this group has orphaned subtitles
 */

/**
 * @typedef {Object} BrowserCapabilities
 * @property {string} browser - Browser name (Chrome, Firefox, etc.)
 * @property {boolean} hasFileSystemAPI - Supports File System Access API
 * @property {boolean} hasWebkitGetAsEntry - Supports webkit directory reading
 * @property {boolean} supportsDirectories - General directory support flag
 */

/**
 * @typedef {Object} FeatureData
 * @property {FeatureAttributes} attributes - Feature attributes
 */

/**
 * @typedef {Object} FeatureAttributes
 * @property {string} original_title - Original movie title
 * @property {string} year - Release year
 * @property {string} feature_type - Type of feature (movie, tv series, etc.)
 * @property {string} img_url - Poster image URL
 */

/**
 * @typedef {Object} FeaturesResponse
 * @property {FeatureData[]} data - Array of feature data
 */

/**
 * @typedef {Object} CacheInfo
 * @property {boolean} hasData - Whether cache has data
 * @property {boolean} isValid - Whether cache is still valid
 * @property {string|null} expiryTime - Cache expiry time in ISO format
 */

/**
 * @typedef {Object} ApiResponse
 * @property {any} data - Response data
 * @property {boolean} fromCache - Whether data came from cache
 */

/**
 * @typedef {Object} DropdownState
 * @property {Object.<string, boolean>} openDropdowns - Open state by subtitle path
 * @property {Object.<string, string>} dropdownSearch - Search terms by subtitle path
 */

/**
 * @typedef {Object} ProcessingState
 * @property {Object.<string, MovieGuessResult|string>} movieGuesses - Movie guesses by video path
 * @property {Object.<string, FeaturesResponse|null>} featuresByImdbId - Features by IMDb ID
 * @property {Object.<string, string>} subtitleLanguages - Selected languages by subtitle path
 */

// Export types for TypeScript migration (if needed)
export const Types = {
  // This is just a placeholder for potential TypeScript migration
  // The actual types would be defined with TypeScript syntax
};

// Default values for common objects
export const DEFAULT_VALUES = {
  FILE_OBJECT: {
    name: '',
    fullPath: '',
    size: 0,
    type: '',
    file: null,
    isVideo: false,
    isSubtitle: false,
    movieHash: null,
    detectedLanguage: null,
    recognized: false,
  },

  LANGUAGE_INFO: {
    flag: '🏳️',
    name: 'Unknown',
    displayName: 'Unknown',
  },

  MOVIE_GUESS: {
    imdbid: '',
    title: '',
    year: '',
    kind: '',
  },

  BROWSER_CAPABILITIES: {
    browser: 'Unknown',
    hasFileSystemAPI: false,
    hasWebkitGetAsEntry: false,
    supportsDirectories: false,
  },
};

// Validation functions (optional)
export const Validators = {
  /**
   * Validate file object structure
   * @param {any} obj - Object to validate
   * @returns {boolean} - Whether object is valid FileObject
   */
  isValidFileObject: obj => {
    return (
      obj &&
      typeof obj.name === 'string' &&
      typeof obj.fullPath === 'string' &&
      typeof obj.size === 'number' &&
      typeof obj.isVideo === 'boolean' &&
      typeof obj.isSubtitle === 'boolean'
    );
  },

  /**
   * Validate language info structure
   * @param {any} obj - Object to validate
   * @returns {boolean} - Whether object is valid LanguageInfo
   */
  isValidLanguageInfo: obj => {
    return obj && typeof obj.flag === 'string' && typeof obj.name === 'string';
  },

  /**
   * Validate movie guess result
   * @param {any} obj - Object to validate
   * @returns {boolean} - Whether object is valid MovieGuessResult
   */
  isValidMovieGuess: obj => {
    return obj && typeof obj.title === 'string' && typeof obj.year === 'string';
  },
};
