import { useState, useEffect } from 'react';
import { WasmInitializationService } from '../services/wasmInitializationService.js';

/**
 * Custom hook for WASM initialization
 * Handles loading of all WebAssembly components at startup
 */
export const useWasmInitialization = () => {
  const [loadingStatus, setLoadingStatus] = useState({
    isLoading: true,
    isInitialized: false,
    progress: 0,
    total: 2,
    percentage: 0,
    ffmpeg: { loaded: false, error: null },
    guessit: { loaded: false, error: null },
    currentComponent: 'Initializing...'
  });

  useEffect(() => {
    let cancelled = false;

    const initializeWasm = async () => {
      try {
        // Update progress callback
        const onProgressUpdate = (progress) => {
          if (cancelled) return;
          
          let currentComponent = 'Initializing...';
          if (!progress.ffmpeg.loaded && !progress.ffmpeg.error) {
            currentComponent = 'Loading FFmpeg...';
          } else if (!progress.guessit.loaded && !progress.guessit.error) {
            currentComponent = 'Loading GuessIt...';
          } else if (progress.percentage === 100) {
            currentComponent = 'Ready!';
          }

          setLoadingStatus(prev => ({
            ...prev,
            ...progress,
            isLoading: progress.percentage < 100,
            isInitialized: progress.percentage === 100,
            currentComponent
          }));
        };

        // Start initialization
        await WasmInitializationService.initializeAll(onProgressUpdate);
        
        if (!cancelled) {
          // Final status update
          const finalStatus = WasmInitializationService.getLoadingStatus();
          setLoadingStatus(prev => ({
            ...prev,
            ...finalStatus,
            isLoading: false,
            isInitialized: true,
            currentComponent: 'Ready!'
          }));
        }

      } catch (error) {
        console.error('WASM initialization error:', error);
        if (!cancelled) {
          setLoadingStatus(prev => ({
            ...prev,
            isLoading: false,
            isInitialized: false,
            error: error.message,
            currentComponent: 'Initialization failed'
          }));
        }
      }
    };

    initializeWasm();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isLoading: loadingStatus.isLoading,
    isInitialized: loadingStatus.isInitialized,
    progress: loadingStatus.progress,
    total: loadingStatus.total,
    percentage: loadingStatus.percentage,
    currentComponent: loadingStatus.currentComponent,
    ffmpegLoaded: loadingStatus.ffmpeg.loaded,
    guessitLoaded: loadingStatus.guessit.loaded,
    ffmpegError: loadingStatus.ffmpeg.error,
    guessitError: loadingStatus.guessit.error,
    error: loadingStatus.error
  };
};