import React, { createContext, useContext, useState, useEffect } from 'react';
import { WEB_EMBED } from '../config/environments.js';

const ThemeContext = createContext();

// The website's dark themes (data-theme on its <html>, set by its theme
// switcher); every other value, light included, is light.
const HOST_DARK_THEMES = ['dark', 'dim', 'material-dark'];

// The web build runs in an iframe on a page of the website, same origin, and
// takes its theme from that page: data-theme on the page's <html>, or the
// system preference when the page sets none. Null when the page cannot be read
// (not framed, or framed by another origin).
const hostRoot = () => {
  try {
    if (window.parent === window) return null;
    return window.parent.document.documentElement;
  } catch (_e) {
    return null;
  }
};

const systemPrefersDark = () =>
  !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

const hostIsDark = root => {
  const theme = root && root.getAttribute('data-theme');
  return theme ? HOST_DARK_THEMES.includes(theme) : systemPrefersDark();
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  // Detect system preference and cache for 1 hour
  const detectSystemTheme = () => {
    const now = Date.now();
    const cacheKey = 'opensubtitles-uploader-theme-cache';
    const cacheData = localStorage.getItem(cacheKey);

    if (cacheData) {
      try {
        const { theme, timestamp } = JSON.parse(cacheData);
        // Check if cache is less than 1 hour old (3600000 ms)
        if (now - timestamp < 3600000) {
          return theme === 'dark';
        }
      } catch (e) {
        // Invalid cache data, continue with detection
      }
    }

    // Detect system preference
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Cache the detected preference
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        theme: prefersDark ? 'dark' : 'light',
        timestamp: now,
      })
    );

    return prefersDark;
  };

  // Web build: follow the host page, live. Its theme switcher changes the
  // attribute without reloading the iframe, so the attribute is watched; with
  // no attribute, the system preference is watched instead.
  useEffect(() => {
    if (!WEB_EMBED) return undefined;

    const root = hostRoot();
    const sync = () => setIsDark(hostIsDark(root));
    sync();

    const observer = root && window.MutationObserver ? new window.MutationObserver(sync) : null;
    if (observer) observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (media && media.addEventListener) media.addEventListener('change', sync);

    return () => {
      if (observer) observer.disconnect();
      if (media && media.removeEventListener) media.removeEventListener('change', sync);
    };
  }, []);

  // Load theme preference from localStorage on mount (desktop; the web build
  // follows the host page, above)
  useEffect(() => {
    if (WEB_EMBED) return;

    const savedTheme = localStorage.getItem('opensubtitles-uploader-theme');
    if (savedTheme) {
      // User has manually set a theme preference
      setIsDark(savedTheme === 'dark');
    } else {
      // No manual preference, detect system theme
      const systemPrefersDark = detectSystemTheme();
      setIsDark(systemPrefersDark);
    }
  }, []);

  // Apply dark mode class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', isDark ? 'osub-dark' : 'osub-light');
  }, [isDark]);

  // Save theme preference to localStorage
  const toggleTheme = () => {
    if (WEB_EMBED) return; // the host page owns the theme
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('opensubtitles-uploader-theme', newTheme ? 'dark' : 'light');
  };

  // Theme configuration
  const theme = {
    isDark,
    colors: {
      // Light theme colors (OpenSubtitles style)
      light: {
        background: '#f4f4f4',
        cardBackground: '#fff',
        text: '#000',
        textSecondary: '#454545',
        textMuted: '#808080',
        border: '#ccc',
        borderAccent: '#2878C0',
        link: '#2878C0',
        linkHover: '#185DA0',
        success: '#9EC068',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#2878C0',
      },
      // Dark theme colors
      dark: {
        background: '#1a1a1a',
        cardBackground: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#cccccc',
        textMuted: '#999999',
        border: '#444444',
        borderAccent: '#4a9eff',
        link: '#4a9eff',
        linkHover: '#66b3ff',
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8',
      },
    },
  };

  const currentColors = isDark ? theme.colors.dark : theme.colors.light;

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme,
        colors: currentColors,
        theme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
