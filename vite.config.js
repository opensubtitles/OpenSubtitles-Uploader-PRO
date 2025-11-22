import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// https://tauri.app/v1/guides/getting-started/setup/vite
const host = process.env.TAURI_DEV_HOST

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
    }
  }
}

export default defineConfig({
  plugins: [react(), embedApiKeysPlugin()],
  publicDir: 'public',
  
  // Define global constants for embedded API keys and polyfills
  define: {
    '__EMBEDDED_OPENSUBTITLES_API_KEY__': JSON.stringify(process.env.OPENSUBTITLES_API_KEY || process.env.VITE_OPENSUBTITLES_API_KEY || ''),
    global: 'globalThis',
  },

  // Resolve configuration to handle Node.js modules
  resolve: {
    alias: {
      buffer: 'buffer',
    }
  },
  
  // Add worker configuration for FFmpeg WebAssembly
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  
  // Optimize dependencies for FFmpeg, video metadata extractor, and Tauri
  optimizeDeps: {
    exclude: [
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      'archive-wasm',
      '@opensubtitles/video-metadata-extractor'
    ],
    include: [
      'jszip',
      'buffer'
    ]
  },
  build: {
    sourcemap: false,
    target: 'esnext', // Support top-level await
    format: 'es',
    // Support for WebAssembly files
    assetsInclude: ['**/*.wasm'],
    rollupOptions: {
      external: [],  // Don't externalize anything by default
      onwarn(warning, warn) {
        // Suppress specific externalization warnings for archive-wasm
        if (warning.code === 'PLUGIN_WARNING' && 
            warning.message.includes('Module "module" has been externalized') &&
            warning.message.includes('archive-wasm')) {
          return; // Suppress this warning
        }
        warn(warning); // Show other warnings
      },
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'crypto': ['crypto-js', 'pako'],
          
          // App chunks
          'services': [
            'src/services/api/openSubtitlesApi.js',
            'src/services/api/xmlrpc.js',
            'src/services/cache.js',
            'src/services/movieHash.js',
            'src/services/subtitleHash.js',
            'src/services/fileProcessing.js',
            'src/services/guessItService.js',
            'src/services/subtitleUploadService.js',
            'src/services/videoMetadataService.js'
          ],
          'hooks': [
            'src/hooks/useDebugMode.js',
            'src/hooks/useFileHandling.js',
            'src/hooks/useLanguageData.js',
            'src/hooks/useLanguageDetection.js',
            'src/hooks/useMovieGuess.js',
            'src/hooks/useGuessIt.js',
            'src/hooks/useUserSession.js',
            'src/hooks/useCheckSubHash.js',
            'src/hooks/useVideoMetadata.js'
          ],
          'components': [
            'src/components/FileList/FileList.jsx',
            'src/components/FileList/MovieGroup.jsx',
            'src/components/FileList/SubtitleFile.jsx',
            'src/components/FileList/VideoFile.jsx',
            'src/components/MatchedPairs.jsx',
            'src/components/OrphanedSubtitles.jsx',
            'src/components/DebugPanel.jsx',
            'src/components/SubtitlePreview.jsx',
            'src/components/UploadButton.jsx',
            'src/components/VideoMetadataDisplay.jsx'
          ],
          'utils': [
            'src/utils/fileUtils.js',
            'src/utils/constants.js',
            'src/utils/networkUtils.js',
            'src/utils/retryUtils.js',
            'src/utils/themeUtils.js'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 600
  },
  server: {
    sourcemapIgnoreList: () => true,
    host: host || false, // Use Tauri host or allow external connections
    port: 1420,
    allowedHosts: ['uploader.opensubtitles.org'],
    headers: {
      // Headers needed for FFmpeg WebAssembly support (matches working demo)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  // Tauri expects a fixed port, and vite server will fail if the port is not available
  clearScreen: false,
  preview: {
    host: true, // Allow external connections
    allowedHosts: ['uploader.opensubtitles.org']
  },
  esbuild: {
    sourcemap: false,
    target: 'esnext' // Support top-level await
  }
})

