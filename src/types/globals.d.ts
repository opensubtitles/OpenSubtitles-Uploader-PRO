/**
 * Global type declarations for OpenSubtitles Uploader PRO
 * Defines types for browser globals, Tauri APIs, and environment variables
 */

// Vite environment variables
declare const __EMBEDDED_OPENSUBTITLES_API_KEY__: string | undefined;
declare const __EMBEDDED_TMDB_API_KEY__: string | undefined;
declare const __VITE__: any;

// Tauri globals
interface Window {
  __TAURI__?: any;
  __TAURI_INTERNALS__?: any;
  __TAURI_PLUGIN_SHELL__?: any;
  __TAURI_PLUGIN_HTTP__?: any;
  __TAURI_METADATA__?: any;
  __DEBUG_INFO__?: any[];
  getDebugInfo?: () => any;
  // Library globals
  FFmpeg?: any;
  __FFMPEG_LOADED__?: boolean;
  guessit?: any;
  GuessIt?: any;
  __GUESSIT_LOADED__?: boolean;
  ArchiveWasm?: any;
  __ARCHIVE_WASM_LOADED__?: boolean;
  pako?: any;
  // Ad blocker detection
  uBlock?: any;
}

// Browser-specific globals
interface Navigator {
  brave?: {
    isBrave?: () => Promise<boolean>;
  };
  connection?: any;
  getUserMedia?: any;
  webkitGetUserMedia?: any;
  mozGetUserMedia?: any;
  msGetUserMedia?: any;
}

// Performance API extensions
interface Performance {
  memory?: {
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
  };
}

// Import meta environment (Vite)
interface ImportMeta {
  env: {
    [key: string]: string | boolean | undefined;
    VITE_OPENSUBTITLES_API_KEY?: string;
    VITE_TMDB_API_KEY?: string;
    MODE?: string;
    DEV?: boolean;
    PROD?: boolean;
    SSR?: boolean;
  };
}
