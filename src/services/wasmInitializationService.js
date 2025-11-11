import { videoMetadataService } from './videoMetadataService.js';
import { OfflineGuessItService } from './offlineGuessItService.js';

/**
 * WASM Initialization Service
 * Handles loading of all WebAssembly components at application startup
 */
export class WasmInitializationService {
  static isInitialized = false;
  static initializationPromise = null;
  static loadingProgress = {
    ffmpeg: { loaded: false, error: null },
    guessit: { loaded: false, error: null },
    progress: 0,
    total: 2,
  };

  /**
   * Initialize all WASM components
   * @param {Function} onProgressUpdate - Callback for progress updates
   * @returns {Promise<boolean>} - Success status
   */
  static async initializeAll(onProgressUpdate = null) {
    if (this.isInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization(onProgressUpdate);
    return this.initializationPromise;
  }

  static async _performInitialization(onProgressUpdate) {
    console.log('🚀 Initializing all WASM components in parallel...');

    const updateProgress = () => {
      const completed = Object.values(this.loadingProgress).filter(
        item => typeof item === 'object' && item.loaded
      ).length;
      this.loadingProgress.progress = completed;

      if (onProgressUpdate) {
        onProgressUpdate({
          ...this.loadingProgress,
          percentage: Math.round((completed / this.loadingProgress.total) * 100),
        });
      }
    };

    // Initialize all components in parallel for faster loading
    const initializationPromises = [
      // Initialize FFmpeg
      (async () => {
        try {
          console.log('🎬 Initializing FFmpeg WASM...');
          await videoMetadataService.loadFFmpeg();
          this.loadingProgress.ffmpeg.loaded = true;
          console.log('✅ FFmpeg WASM loaded successfully');
        } catch (error) {
          console.error('❌ FFmpeg WASM initialization failed:', error);
          this.loadingProgress.ffmpeg.error = error.message;
        }
        updateProgress();
      })(),

      // Initialize GuessIt WASM
      (async () => {
        try {
          console.log('🔧 Initializing GuessIt WASM...');
          const guessitSuccess = await OfflineGuessItService.initialize();
          if (guessitSuccess) {
            this.loadingProgress.guessit.loaded = true;
            console.log('✅ GuessIt WASM loaded successfully');
          } else {
            throw new Error('GuessIt WASM initialization returned false');
          }
        } catch (error) {
          console.error('❌ GuessIt WASM initialization failed:', error);
          this.loadingProgress.guessit.error = error.message;
        }
        updateProgress();
      })(),
    ];

    // Wait for all components to load (or fail)
    await Promise.allSettled(initializationPromises);

    // Check if all critical components loaded
    const allLoaded = this.loadingProgress.ffmpeg.loaded && this.loadingProgress.guessit.loaded;

    if (allLoaded) {
      this.isInitialized = true;
      console.log('🎉 All WASM components initialized successfully');
    } else {
      console.warn('⚠️ Some WASM components failed to load:', {
        ffmpeg: this.loadingProgress.ffmpeg,
        guessit: this.loadingProgress.guessit,
      });

      // Allow app to start even if some components failed (fallback modes available)
      this.isInitialized = true;
    }

    // Final progress update
    updateProgress();

    return this.isInitialized;
  }

  /**
   * Get current loading status
   * @returns {Object} Loading progress information
   */
  static getLoadingStatus() {
    return {
      ...this.loadingProgress,
      isInitialized: this.isInitialized,
      percentage: Math.round((this.loadingProgress.progress / this.loadingProgress.total) * 100),
    };
  }

  /**
   * Check if a specific component is loaded
   * @param {string} component - Component name ('ffmpeg' or 'guessit')
   * @returns {boolean} Load status
   */
  static isComponentLoaded(component) {
    return this.loadingProgress[component]?.loaded || false;
  }

  /**
   * Get component error if any
   * @param {string} component - Component name
   * @returns {string|null} Error message or null
   */
  static getComponentError(component) {
    return this.loadingProgress[component]?.error || null;
  }

  /**
   * Reset initialization state (for testing)
   */
  static reset() {
    this.isInitialized = false;
    this.initializationPromise = null;
    this.loadingProgress = {
      ffmpeg: { loaded: false, error: null },
      guessit: { loaded: false, error: null },
      progress: 0,
      total: 2,
    };
  }
}

export default WasmInitializationService;
