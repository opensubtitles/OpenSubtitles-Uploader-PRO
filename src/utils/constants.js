// Application version - updated manually to match package.json
export const APP_VERSION = '1.2.0';

// API Configuration - embedded keys take priority over environment variables
// Global __EMBEDDED_OPENSUBTITLES_API_KEY__ is defined by Vite at build time
export const OPENSUBTITLES_COM_API_KEY = (typeof __EMBEDDED_OPENSUBTITLES_API_KEY__ !== 'undefined' && __EMBEDDED_OPENSUBTITLES_API_KEY__) 
  ? __EMBEDDED_OPENSUBTITLES_API_KEY__
  : ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_OPENSUBTITLES_API_KEY || '' : '');

// User Agent for all API requests
export const USER_AGENT = `OpenSubtitles Uploader PRO v${APP_VERSION}`;

// Shared HD Detection Pattern - used by both frontend and backend
export const HD_DETECTION_REGEX = /\[?720p\]?|\[?1080p\]?|\[?1440p\]?|\[?2160p\]?|\[?4K\]?|\[?8K\]?|\[?HDR\]?|Blu[\s._-]?Ray|BR[\s._-]?Rip|BD[\s._-]?(Rip|5|9)|HD[\s._-]?DVD|WEB[\s._-]?(DL|Rip)|WEB[\s._-]?HD|\[?WEBDL\]?|\[?WEBRip\]?/i;

// Get standard headers for API requests
export const getApiHeaders = (contentType = 'application/json', additionalHeaders = {}) => {
  return {
    'Content-Type': contentType,
    'User-Agent': USER_AGENT,
    'X-User-Agent': USER_AGENT,
    ...additionalHeaders
  };
};

// Validate API configuration
export const validateApiConfiguration = () => {
  const errors = [];
  
  if (!OPENSUBTITLES_COM_API_KEY) {
    errors.push('VITE_OPENSUBTITLES_API_KEY is not set. Please check your .env file.');
  }
  
  if (errors.length > 0) {
    console.error('⚠️ API Configuration Issues:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('Please copy .env.example to .env and configure your API credentials.');
    return false;
  }
  
  return true;
};

// Cache Configuration
export const CACHE_KEYS = {
  LANGUAGES: 'opensubtitles_languages_cache',
  LANGUAGES_EXPIRY: 'opensubtitles_languages_cache_expiry',
  XMLRPC_LANGUAGES: 'opensubtitles_xmlrpc_languages_cache',
  XMLRPC_LANGUAGES_EXPIRY: 'opensubtitles_xmlrpc_languages_cache_expiry',
  GUESSIT_CACHE: 'opensubtitles_guessit_cache',
  GUESSIT_CACHE_EXPIRY: 'opensubtitles_guessit_cache_expiry',
  MOVIE_GUESS_CACHE: 'opensubtitles_movie_guess_cache',
  MOVIE_GUESS_CACHE_EXPIRY: 'opensubtitles_movie_guess_cache_expiry',
  LANGUAGE_DETECTION_CACHE: 'opensubtitles_language_detection_cache',
  LANGUAGE_DETECTION_CACHE_EXPIRY: 'opensubtitles_language_detection_cache_expiry',
  FEATURES_CACHE: 'opensubtitles_features_cache',
  FEATURES_CACHE_EXPIRY: 'opensubtitles_features_cache_expiry',
  XMLRPC_CHECKSUB: 'opensubtitles_xmlrpc_checksub_cache',
  XMLRPC_CHECKSUB_EXPIRY: 'opensubtitles_xmlrpc_checksub_cache_expiry',
  DEBUG_MODE: 'opensubtitles_debug_mode'
};

// File Extensions
export const VIDEO_EXTENSIONS = [
  ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".mpeg", ".mpg", 
  ".ts", ".m2ts", ".mts", ".f4v", ".ogv", ".ogg", ".amv", ".nsv", ".yuv", 
  ".nut", ".nuv", ".wtv", ".tivo", ".ty"
];

export const SUBTITLE_EXTENSIONS = [
  ".srt", ".vtt", ".ass", ".ssa", ".sub", ".txt", ".smi", ".mpl", ".tmp"
];

export const ARCHIVE_EXTENSIONS = [
  // ZIP formats
  ".zip",
  // 7z format
  ".7z",
  // TAR formats (with various compressions)
  ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz", ".tar.lz4", ".tar.lz", ".tar.lzma", ".tar.zst",
  // RAR formats
  ".rar", ".r00", ".r01", ".r02", ".r03", ".r04", ".r05", ".r06", ".r07", ".r08", ".r09",
  // Other archive formats
  ".lha", ".lzh", ".arj", ".cab", ".iso", ".img", ".dmg",
  // Unix ar format
  ".ar", ".a", ".deb",
  // CPIO format
  ".cpio",
  // Compressed individual files
  ".gz", ".bz2", ".xz", ".lz4", ".lz", ".lzma", ".zst", ".Z"
];

// MIME Types
export const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-ms-wmv',
  'video/webm', 'video/x-flv', 'video/3gpp', 'video/x-matroska'
];

export const SUBTITLE_MIME_TYPES = [
  'text/srt', 'text/vtt', 'text/plain', 'application/x-subrip'
];

export const ARCHIVE_MIME_TYPES = [
  // ZIP formats
  'application/zip', 'application/x-zip-compressed',
  // 7z format
  'application/x-7z-compressed',
  // TAR formats
  'application/x-tar', 'application/x-gtar',
  // Compressed TAR formats
  'application/gzip', 'application/x-gzip', 'application/x-tgz',
  'application/x-bzip2', 'application/x-bzip', 'application/x-tbz2',
  'application/x-xz', 'application/x-lzip', 'application/x-lzma',
  'application/x-zstd',
  // RAR formats
  'application/x-rar-compressed', 'application/vnd.rar',
  // Other archive formats
  'application/x-lha', 'application/x-lzh', 'application/x-arj',
  'application/vnd.ms-cab-compressed', 'application/x-cab',
  // ISO formats
  'application/x-iso9660-image', 'application/x-cd-image',
  // Unix ar format
  'application/x-archive', 'application/x-ar',
  // CPIO format
  'application/x-cpio',
  // Compressed individual files
  'application/x-compress', 'application/x-lz4'
];

// API Endpoints - public URLs
export const API_ENDPOINTS = {
  OPENSUBTITLES_REST: 'https://api.opensubtitles.com/api/v1',
  OPENSUBTITLES_XMLRPC: 'https://api.opensubtitles.org/xml-rpc',
  LANGUAGE_DETECTION: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/detect/file',
  SUPPORTED_LANGUAGES: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported',
  FEATURES: 'https://api.opensubtitles.com/api/v1/features',
  GUESSIT: 'https://api.opensubtitles.com/api/v1/utilities/guessit'
};

// Default Settings
export const DEFAULT_SETTINGS = {
  CACHE_DURATION: 259200, // 72 hours in seconds (3 days) - for language data
  GUESSIT_CACHE_DURATION: 259200, // 72 hours in seconds (3 days)
  MOVIE_GUESS_CACHE_DURATION: 259200, // 72 hours in seconds (3 days)
  LANGUAGE_DETECTION_CACHE_DURATION: 259200, // 72 hours in seconds (3 days)
  FEATURES_CACHE_DURATION: 259200, // 72 hours in seconds (3 days)
  CHECKSUB_CACHE_DURATION: 86400, // 24 hours in seconds (1 day) - shorter for hash checks
  LANGUAGE_DETECTION_CHUNK_SIZE: 5120, // 5KB
  MOVIE_HASH_CHUNK_SIZE: 65536, // 64KB
  DEBUG_LOG_LIMIT: 1000,
  
  // Network request delays (in milliseconds)
  NETWORK_REQUEST_DELAY: 100, // 0.1 seconds between any network requests
  RETRY_BASE_DELAY: 1000, // 1 second base delay for retries
  MOVIE_GUESS_DELAY: 3000, // 3 seconds base delay for movie guessing
  LANGUAGE_DETECTION_DELAY: 2000, // 2 seconds base delay for language detection
  FEATURES_FETCH_DELAY: 1000, // 1 second delay for features fetching
  GUESSIT_DELAY: 1500 // 1.5 seconds delay for GuessIt processing
};