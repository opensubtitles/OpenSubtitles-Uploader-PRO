import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// https://tauri.app/v1/guides/getting-started/setup/vite
const host = process.env.TAURI_DEV_HOST;

// Load .env so config-time settings (e.g. the dev proxy target) live in the
// same place as everything else. Vite only injects .env into import.meta.env
// for app code — config files see process.env, which .env does not populate.
// The empty prefix loads unprefixed vars too. Shell env still wins.
const fileEnv = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
const DEV_PROXY_TARGET = process.env.VITE_DEV_PROXY_TARGET || fileEnv.VITE_DEV_PROXY_TARGET || '';

// Plugin to embed API keys at build time
const embedApiKeysPlugin = () => {
  return {
    name: 'embed-api-keys',
    buildStart() {
      if (process.env.NODE_ENV === 'production') {
        try {
          console.log('🔑 Embedding API keys at build time...');
          execSync('node scripts/embed-api-keys.js', { stdio: 'inherit' });
        } catch (error) {
          console.warn('⚠️ Failed to embed API keys:', error.message);
        }
      }
    },
  };
};

// NOTE on public/ffmpeg/ — do not "optimise" it out of the web build.
//
// It holds the FFmpeg core (ffmpeg-core.js + ffmpeg-core.wasm, ~32 MB) and it
// looks unreferenced: nothing in src/, index.html or this config mentions it.
// It is not. @opensubtitles/video-metadata-extractor's
// useOptimizedVideoMetadata hook builds the URL at RUNTIME from
// `window.location.origin + window.location.pathname + 'ffmpeg'`, so the
// dependency is invisible to any grep of this repo. Moving these files out of
// publicDir makes MKV subtitle extraction 404 with no build-time warning.
//
// Both builds therefore ship it. That is a deliberate trade: the web page
// carries 32 MB so that nothing is fetched from unpkg.com at runtime.

// VITE_USE_DEV_ONLY=true: a build for testers of the shared dev server that
// can only reach the dev backend (see DEV_ONLY in src/config/environments.js).
// It carries no production key, and it must know the dev URL: without one
// every request would fail, so refuse to build rather than ship that.
const USE_DEV_ONLY = (process.env.VITE_USE_DEV_ONLY || fileEnv.VITE_USE_DEV_ONLY) === 'true';
if (
  USE_DEV_ONLY &&
  !(process.env.VITE_OPENSUBTITLES_BASE_URL || fileEnv.VITE_OPENSUBTITLES_BASE_URL)
) {
  throw new Error('VITE_USE_DEV_ONLY=true needs VITE_OPENSUBTITLES_BASE_URL (the dev API URL)');
}
// Vite inlines every VITE_* variable into the bundle (environments.js reads
// import.meta.env by name), so leaving the prod key in .env would ship it as
// text. Variables already in process.env win over .env files, so blanking
// them here keeps it out; the embed-api-keys script reads process.env too.
if (USE_DEV_ONLY) {
  process.env.VITE_OPENSUBTITLES_API_KEY_PROD = '';
  process.env.OPENSUBTITLES_API_KEY_PROD = '';
}

// VITE_WEB_EMBED=true: the build served in an iframe on the website (see
// WEB_EMBED in src/config/environments.js). Its assets are relative, so it
// works from any folder (the site serves it at /uploader/); the desktop build
// keeps absolute paths, which Tauri expects.
const WEB_EMBED = (process.env.VITE_WEB_EMBED || fileEnv.VITE_WEB_EMBED) === 'true';

export default defineConfig({
  plugins: [react(), embedApiKeysPlugin()],
  publicDir: 'public',
  base: WEB_EMBED ? './' : '/',

  // Define global constants for embedded API keys and polyfills
  define: {
    __EMBEDDED_OPENSUBTITLES_API_KEY_PROD__: JSON.stringify(
      USE_DEV_ONLY
        ? ''
        : process.env.OPENSUBTITLES_API_KEY_PROD ||
            process.env.VITE_OPENSUBTITLES_API_KEY_PROD ||
            ''
    ),
    __EMBEDDED_OPENSUBTITLES_API_KEY_DEV__: JSON.stringify(
      process.env.OPENSUBTITLES_API_KEY_DEV ||
        process.env.VITE_OPENSUBTITLES_API_KEY_DEV ||
        process.env.VITE_OPENSUBTITLES_API_KEY ||
        ''
    ),
    __ENV_SWITCH_ENABLED__: JSON.stringify(process.env.VITE_ENV_SWITCH || ''),
    __USE_DEV_ONLY__: JSON.stringify(USE_DEV_ONLY ? 'true' : ''),
    __WEB_EMBED__: JSON.stringify(WEB_EMBED ? 'true' : ''),
    global: 'globalThis',
  },

  // Resolve configuration to handle Node.js modules
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },

  // Add worker configuration for FFmpeg WebAssembly
  worker: {
    format: 'es',
    plugins: () => [react()],
  },

  // Optimize dependencies for FFmpeg, video metadata extractor, and Tauri
  optimizeDeps: {
    exclude: [
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      'archive-wasm',
      '@opensubtitles/video-metadata-extractor',
    ],
    include: ['jszip', 'buffer'],
  },
  build: {
    sourcemap: false,
    target: 'esnext', // Support top-level await
    format: 'es',
    // Support for WebAssembly files
    assetsInclude: ['**/*.wasm'],
    rollupOptions: {
      external: [], // Don't externalize anything by default
      onwarn(warning, warn) {
        // Suppress specific externalization warnings for archive-wasm
        if (
          warning.code === 'PLUGIN_WARNING' &&
          warning.message.includes('Module "module" has been externalized') &&
          warning.message.includes('archive-wasm')
        ) {
          return; // Suppress this warning
        }
        warn(warning); // Show other warnings
      },
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          router: ['react-router-dom'],
          crypto: ['crypto-js', 'pako'],

          // App chunks
          services: [
            'src/services/api/openSubtitlesApi.js',
            'src/services/cache.js',
            'src/services/movieHash.js',
            'src/services/subtitleHash.js',
            'src/services/fileProcessing.js',
            'src/services/guessItService.js',
            'src/services/subtitleUploadService.js',
            'src/services/videoMetadataService.js',
          ],
          hooks: [
            'src/hooks/useDebugMode.js',
            'src/hooks/useFileHandling.js',
            'src/hooks/useLanguageData.js',
            'src/hooks/useLanguageDetection.js',
            'src/hooks/useMovieGuess.js',
            'src/hooks/useGuessIt.js',
            'src/hooks/useUserSession.js',
            'src/hooks/useCheckSubHash.js',
            'src/hooks/useVideoMetadata.js',
          ],
          components: [
            'src/components/FileList/FileList.jsx',
            'src/components/FileList/MovieGroup.jsx',
            'src/components/FileList/SubtitleFile.jsx',
            'src/components/FileList/VideoFile.jsx',
            'src/components/MatchedPairs.jsx',
            'src/components/OrphanedSubtitles.jsx',
            'src/components/DebugPanel.jsx',
            'src/components/SubtitlePreview.jsx',
            'src/components/UploadButton.jsx',
            'src/components/VideoMetadataDisplay.jsx',
          ],
          utils: [
            'src/utils/fileUtils.js',
            'src/utils/constants.js',
            'src/utils/networkUtils.js',
            'src/utils/retryUtils.js',
            'src/utils/themeUtils.js',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    sourcemapIgnoreList: () => true,
    // Dev-only reverse proxy. Set VITE_DEV_PROXY_TARGET to reach an API server
    // that does not send CORS headers (e.g. hitting Rails directly, bypassing
    // Kong). Requests then look same-origin to the browser, so no preflight is
    // needed. Pair it with VITE_OPENSUBTITLES_BASE_URL=/api/v1
    //
    //   VITE_DEV_PROXY_TARGET=http://10.0.0.1   (in .env, or exported)
    //
    // Reads from .env or the shell (shell wins). Keep internal addresses out
    // of the repo — set it in .env, which is gitignored.
    proxy: DEV_PROXY_TARGET
      ? {
          '/api': {
            target: DEV_PROXY_TARGET,
            changeOrigin: true,
          },
        }
      : undefined,
    host: host || false, // Use Tauri host or allow external connections
    port: 1420,
    allowedHosts: ['uploader.opensubtitles.org'],
    headers: {
      // Headers needed for FFmpeg WebAssembly support (matches working demo)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  // Tauri expects a fixed port, and vite server will fail if the port is not available
  clearScreen: false,
  preview: {
    host: true, // Allow external connections
    allowedHosts: ['uploader.opensubtitles.org'],
  },
  esbuild: {
    sourcemap: false,
    target: 'esnext', // Support top-level await
  },
});
