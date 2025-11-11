import { useState, useEffect, useCallback, useRef } from 'react';
import { CACHE_KEYS, DEFAULT_SETTINGS } from '../utils/constants.js';

/**
 * Custom hook for debug mode functionality
 */
export const useDebugMode = () => {
  const [debugMode, setDebugMode] = useState(() => {
    try {
      return localStorage.getItem(CACHE_KEYS.DEBUG_MODE) === 'true';
    } catch {
      return false;
    }
  });

  const [debugInfo, setDebugInfo] = useState([]);

  // Message deduplication cache: hash -> { timestamp, count }
  const messageCache = useRef(new Map());

  // Store original console methods - use useRef to avoid creating new object on every render
  const originalConsole = useRef({
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  });

  // Persist debug mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEYS.DEBUG_MODE, debugMode ? 'true' : 'false');
    } catch {}
  }, [debugMode]);

  // Console interception when debug mode is ON
  useEffect(() => {
    if (debugMode) {
      // Helper function to add console messages to debug panel
      const addConsoleMessage = (level, args) => {
        const timestamp = new Date().toLocaleTimeString();

        // Filter out CSS styling arguments and format strings
        const filteredArgs = [];
        let skipNext = false;

        for (let i = 0; i < args.length; i++) {
          if (skipNext) {
            skipNext = false;
            continue;
          }

          const str = String(args[i]);

          // Skip %c%s pattern and its style argument
          if (str.includes('%c%s')) {
            skipNext = true; // Skip the next argument (style)
            continue;
          }

          // Skip standalone %c and %s with styles
          if (str === '%c' || str.startsWith('color:') || str.startsWith('font-')) {
            continue;
          }

          filteredArgs.push(args[i]);
        }

        const rawMessage = filteredArgs
          .map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
          .join(' ');

        // Deduplication for console messages (same logic as addDebugInfo)
        const hash = (() => {
          let h = 0;
          for (let i = 0; i < rawMessage.length; i++) {
            const char = rawMessage.charCodeAt(i);
            h = (h << 5) - h + char;
            h = h & h;
          }
          return h.toString();
        })();

        const now = Date.now();
        const cached = messageCache.current.get(hash);

        if (cached && now - cached.timestamp < 1000) {
          // Update count for duplicate within 1000ms window
          messageCache.current.set(hash, {
            timestamp: now,
            count: cached.count + 1,
          });
          return; // Skip duplicate message
        }

        // Cache this message
        messageCache.current.set(hash, { timestamp: now, count: 1 });

        // Clean up old entries (older than 5 seconds)
        for (const [key, value] of messageCache.current.entries()) {
          if (now - value.timestamp > 5000) {
            messageCache.current.delete(key);
          }
        }

        const finalMessage = rawMessage;

        // Defer the setState update to prevent setState during render warnings
        setTimeout(() => {
          setDebugInfo(prev => [
            ...prev.slice(-(DEFAULT_SETTINGS.DEBUG_LOG_LIMIT - 1)),
            `${timestamp}: ${finalMessage}`,
          ]);
        }, 0);
      };

      // Override console methods
      console.log = (...args) => {
        originalConsole.current.log(...args);
        addConsoleMessage('log', args);
      };

      console.warn = (...args) => {
        originalConsole.current.warn(...args);
        addConsoleMessage('warn', args);
      };

      console.error = (...args) => {
        originalConsole.current.error(...args);
        addConsoleMessage('error', args);
      };

      console.info = (...args) => {
        originalConsole.current.info(...args);
        addConsoleMessage('info', args);
      };

      // Cleanup function to restore original console
      return () => {
        console.log = originalConsole.current.log;
        console.warn = originalConsole.current.warn;
        console.error = originalConsole.current.error;
        console.info = originalConsole.current.info;
      };
    }
  }, [debugMode]); // Removed originalConsole from deps since it's now a useRef

  // Add debug info with timestamp - DEFERRED TO PREVENT setState DURING RENDER
  const addDebugInfo = useCallback((message, isBasic = false) => {
    const timestamp = new Date().toLocaleTimeString();

    // Defer the setState update to prevent setState during render warnings
    setTimeout(() => {
      setDebugInfo(prev => [
        ...prev.slice(-(DEFAULT_SETTINGS.DEBUG_LOG_LIMIT - 1)),
        `${timestamp}: ${message}`,
      ]);
    }, 0);

    // Don't log to browser console to avoid duplication with console intercept
  }, []); // Empty dependency array to make it stable

  // Clear debug info - DEFERRED TO PREVENT setState DURING RENDER
  const clearDebugInfo = useCallback(() => {
    setTimeout(() => {
      setDebugInfo([]);
    }, 0);
  }, []);

  // Toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);

  return {
    debugMode,
    debugInfo,
    addDebugInfo,
    clearDebugInfo,
    toggleDebugMode,
    setDebugMode,
  };
};
