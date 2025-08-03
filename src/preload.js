/**
 * Preload optimization for WASM components
 * This script preloads WASM files to optimize loading time
 */

// Preload FFmpeg WASM files
const preloadFFmpegWasm = () => {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  // Create link elements for preloading
  const preloadWasm = document.createElement('link');
  preloadWasm.rel = 'preload';
  preloadWasm.href = `${baseURL}/ffmpeg-core.wasm`;
  preloadWasm.as = 'fetch';
  preloadWasm.crossOrigin = 'anonymous';
  document.head.appendChild(preloadWasm);

  const preloadJs = document.createElement('link');
  preloadJs.rel = 'preload';
  preloadJs.href = `${baseURL}/ffmpeg-core.js`;
  preloadJs.as = 'fetch';
  preloadJs.crossOrigin = 'anonymous';
  document.head.appendChild(preloadJs);

  console.log('🔄 Preloading FFmpeg WASM files...');
};

// Preload GuessIt WASM (if available)
const preloadGuessItWasm = () => {
  try {
    // GuessIt WASM is bundled with guessit-js, preloading happens automatically
    console.log('🔄 GuessIt WASM will be loaded with guessit-js module');
  } catch (error) {
    console.warn('GuessIt preload optimization skipped:', error);
  }
};

// Start preloading immediately
if (typeof window !== 'undefined') {
  // Use requestIdleCallback for non-blocking preload
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadFFmpegWasm();
      preloadGuessItWasm();
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      preloadFFmpegWasm();
      preloadGuessItWasm();
    }, 100);
  }
}