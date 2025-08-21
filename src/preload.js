/**
 * Preload optimization for WASM components
 * This script preloads WASM files to optimize loading time
 */

// Preload FFmpeg WASM files - disabled to avoid unused preload warnings
const preloadFFmpegWasm = () => {
  // FFmpeg WASM preloading disabled because it's loaded on-demand
  // and causes "unused preload" warnings in browser console
  console.log('🔄 FFmpeg WASM preloading disabled to avoid browser warnings');
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