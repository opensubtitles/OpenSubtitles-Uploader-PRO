import { APP_VERSION } from './constants.js';

/**
 * Comprehensive system information utilities
 */

/**
 * Get detailed browser information
 */
export const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || '';
  const platform = navigator.platform || '';

  // Detect browser
  let browserName = 'N/A';
  let browserVersion = 'N/A';

  if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
    browserName = 'Chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  } else if (ua.includes('Firefox')) {
    browserName = 'Firefox';
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browserName = 'Safari';
    const match = ua.match(/Version\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  } else if (ua.includes('Edg')) {
    browserName = 'Edge';
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  } else if (ua.includes('OPR')) {
    browserName = 'Opera';
    const match = ua.match(/OPR\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  } else if (ua.includes('Tauri')) {
    browserName = 'Tauri (WebView)';
    const match = ua.match(/Tauri\/(\d+\.\d+)/);
    browserVersion = match ? match[1] : 'N/A';
  }

  return {
    name: browserName,
    version: browserVersion,
    userAgent: ua,
    vendor: vendor,
    platform: platform,
    language: navigator.language,
    languages: navigator.languages || [navigator.language],
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
  };
};

/**
 * Get operating system information
 */
export const getOSInfo = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  let osName = 'N/A';
  let osVersion = 'N/A';
  let architecture = 'N/A';

  // Detect OS
  if (ua.includes('Windows')) {
    osName = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = '10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
    else if (ua.includes('Windows NT 6.2')) osVersion = '8';
    else if (ua.includes('Windows NT 6.1')) osVersion = '7';

    if (ua.includes('WOW64') || ua.includes('x64')) architecture = 'x64';
    else architecture = 'x86';
  } else if (ua.includes('Mac OS') || ua.includes('macOS')) {
    osName = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
    if (match) {
      osVersion = match[1].replace(/_/g, '.');
    }

    // Detect Apple Silicon vs Intel
    if (platform.includes('Intel')) {
      architecture = 'Intel (x86_64)';
    } else if (platform.includes('arm') || ua.includes('arm64')) {
      architecture = 'Apple Silicon (ARM64)';
    } else {
      architecture = platform || 'N/A';
    }
  } else if (ua.includes('Linux')) {
    osName = 'Linux';
    if (ua.includes('Ubuntu')) osName = 'Ubuntu Linux';
    else if (ua.includes('Fedora')) osName = 'Fedora Linux';
    else if (ua.includes('Debian')) osName = 'Debian Linux';

    if (ua.includes('x86_64') || ua.includes('amd64')) architecture = 'x86_64';
    else if (ua.includes('i686') || ua.includes('i386')) architecture = 'i386';
    else if (ua.includes('arm64') || ua.includes('aarch64')) architecture = 'ARM64';
    else if (ua.includes('armv7')) architecture = 'ARMv7';
  }

  return {
    name: osName,
    version: osVersion,
    architecture: architecture,
    platform: platform,
    userAgent: ua,
  };
};

/**
 * Get screen and display information
 */
export const getDisplayInfo = () => {
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    availableWidth: screen.availWidth,
    availableHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    pixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    orientation: screen.orientation ? screen.orientation.type : 'N/A',
  };
};

/**
 * Get Tauri-specific information
 */
export const getTauriInfo = async () => {
  const info = {
    isTauri: false,
    tauriVersion: 'N/A',
    environment: 'Web',
    protocol: window.location.protocol,
    origin: window.location.origin,
    hostname: window.location.hostname,
    href: window.location.href,
  };

  // Detect Tauri environment
  const hasTauriProtocol = window.location.protocol === 'tauri:';
  const hasTauriOrigin = window.location.origin.startsWith('tauri://');
  const hasTauriInUserAgent = navigator.userAgent.includes('Tauri');
  const hasTauriGlobal = window.__TAURI__ !== undefined;

  info.isTauri = hasTauriProtocol || hasTauriOrigin || hasTauriGlobal;

  if (info.isTauri) {
    info.environment = 'Tauri Native App';

    // Try to get Tauri version
    try {
      if (window.__TAURI__) {
        // Try to get version from Tauri APIs if available
        const { getName, getVersion } = await import('@tauri-apps/api/app');
        info.appName = await getName();
        info.tauriVersion = await getVersion();
      }
    } catch (error) {
      console.log('Could not get Tauri app info:', error.message);
    }

    // Parse version from user agent if available
    const tauriMatch = navigator.userAgent.match(/Tauri\/(\d+\.\d+\.\d+)/);
    if (tauriMatch && !info.tauriVersion) {
      info.tauriVersion = tauriMatch[1];
    }
  }

  return info;
};

/**
 * Get memory and performance information
 */
export const getPerformanceInfo = () => {
  const memory = performance.memory || {};

  return {
    // Memory information (Chrome/Edge only)
    usedJSHeapSize: memory.usedJSHeapSize || 'N/A',
    totalJSHeapSize: memory.totalJSHeapSize || 'N/A',
    jsHeapSizeLimit: memory.jsHeapSizeLimit || 'N/A',

    // Performance timing
    timeOrigin: performance.timeOrigin || 'N/A',
    now: Math.round(performance.now()),

    // Connection information
    connection: navigator.connection
      ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData,
        }
      : 'N/A',
  };
};

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 'N/A' || bytes === 0) return bytes;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Smart format that removes N/A values and adjusts separators
 */
export const formatWithoutNA = (...parts) => {
  // Filter out N/A values and empty strings
  const filteredParts = parts.filter(
    part => part !== null && part !== undefined && part !== 'N/A' && part !== ''
  );

  // Join remaining parts with space
  return filteredParts.join(' ').trim() || 'N/A';
};

/**
 * Smart format for system info lines that handles N/A values
 */
export const formatSystemInfoLine = (parts, separator = ' | ') => {
  // Filter out N/A values and empty strings
  const filteredParts = parts.filter(
    part =>
      part !== null && part !== undefined && part !== 'N/A' && part !== '' && part.trim() !== ''
  );

  // Join remaining parts with separator
  return filteredParts.length > 0 ? filteredParts.join(separator) : 'N/A';
};

/**
 * Get library and dependency information
 */
export const getLibraryInfo = () => {
  const libraries = {};

  // Check for React version
  if (typeof React !== 'undefined' && React.version) {
    libraries.react = React.version;
  } else if (window.React?.version) {
    libraries.react = window.React.version;
  } else {
    // Fallback to known version from package.json
    libraries.react = '18.2.0+';
  }

  // Check for Tauri version (from import or user agent)
  if (window.__TAURI_METADATA__?.version) {
    libraries.tauri = window.__TAURI_METADATA__.version;
  } else {
    const tauriMatch = navigator.userAgent.match(/Tauri\/(\d+\.\d+\.\d+)/);
    if (tauriMatch) {
      libraries.tauri = tauriMatch[1];
    } else {
      libraries.tauri = '2.6.0+';
    }
  }

  // Check for Vite (build tool)
  if (typeof __VITE__ !== 'undefined') {
    libraries.vite = '5.0.0+';
  } else if (import.meta?.env?.VITE_VERSION) {
    libraries.vite = import.meta.env.VITE_VERSION;
  } else {
    libraries.vite = '5.0.0+';
  }

  // Check for WebAssembly support
  if (typeof WebAssembly === 'object') {
    libraries.webAssembly = 'Supported';
  }

  // Check for FFmpeg WASM
  if (window.FFmpeg || window.__FFMPEG_LOADED__) {
    libraries.ffmpeg = '0.12.15+';
  }

  // Check for GuessIt WASM
  if (window.guessit || window.GuessIt || window.__GUESSIT_LOADED__) {
    libraries.guessit = '1.0.1+';
  }

  // Check for other key dependencies we know are included
  libraries.reactRouter = '7.6.3+';
  libraries.cryptoJS = '4.2.0+';
  libraries.jszip = '3.10.1+';
  libraries.tailwindCSS = '3.4.17+';

  // Check for archive support
  if (window.ArchiveWasm || window.__ARCHIVE_WASM_LOADED__) {
    libraries.archiveWasm = '2.1.0+';
  }

  // Check for pako (compression)
  if (window.pako) {
    libraries.pako = '2.1.0+';
  }

  return libraries;
};

/**
 * Get security and capability information
 */
export const getSecurityInfo = () => {
  const security = {};

  // Check HTTPS
  security.https = window.location.protocol === 'https:';

  // Check secure context
  security.secureContext = window.isSecureContext || false;

  // Check for CSP (Content Security Policy)
  try {
    security.contentSecurityPolicy = !!document.querySelector(
      'meta[http-equiv="Content-Security-Policy"]'
    );
  } catch (e) {
    security.contentSecurityPolicy = false;
  }

  // Check for SameSite cookie support
  security.sameSiteCookies = 'cookieStore' in window || document.cookie !== undefined;

  // Check permissions API
  security.permissionsAPI = 'permissions' in navigator;

  // Check clipboard API
  security.clipboardAPI = 'clipboard' in navigator;

  // Check for File System Access API
  security.fileSystemAccess = 'showOpenFilePicker' in window;

  return security;
};

/**
 * Get comprehensive system information
 */
export const getSystemInfo = async () => {
  const browser = getBrowserInfo();
  const os = getOSInfo();
  const display = getDisplayInfo();
  const tauri = await getTauriInfo();
  const performance = getPerformanceInfo();
  const libraries = getLibraryInfo();
  const security = getSecurityInfo();

  return {
    // App information
    app: {
      name: 'OpenSubtitles Uploader PRO',
      version: APP_VERSION,
      environment: tauri.environment,
      buildDate: new Date().toISOString(), // You might want to inject this at build time
    },

    // System information
    browser,
    os,
    display,
    tauri,
    performance,
    libraries,
    security,

    // Timestamp
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Feature detection
    features: {
      webGL: !!window.WebGLRenderingContext,
      webGL2: !!window.WebGL2RenderingContext,
      webAssembly: typeof WebAssembly === 'object',
      serviceWorker: 'serviceWorker' in navigator,
      notifications: 'Notification' in window,
      geolocation: 'geolocation' in navigator,
      localStorage: typeof Storage !== 'undefined',
      indexedDB: 'indexedDB' in window,
      webRTC: !!(
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia
      ),
    },
  };
};

/**
 * Get system info formatted for display
 */
export const getSystemInfoFormatted = async () => {
  const info = await getSystemInfo();

  return {
    'App Name': info.app.name,
    'App Version': info.app.version,
    Environment: info.app.environment,
    Browser: formatWithoutNA(info.browser.name, info.browser.version),
    'Operating System': formatWithoutNA(info.os.name, info.os.version),
    Architecture: info.os.architecture,
    'CPU Cores': info.browser.hardwareConcurrency,
    'Screen Resolution': `${info.display.screenWidth}x${info.display.screenHeight}`,
    Viewport: `${info.display.viewportWidth}x${info.display.viewportHeight}`,
    'Pixel Ratio': info.display.pixelRatio,
    'Memory Used': formatBytes(info.performance.usedJSHeapSize),
    'Memory Total': formatBytes(info.performance.totalJSHeapSize),
    Language: info.browser.language,
    Timezone: info.timezone,
    Online: info.browser.onLine ? 'Yes' : 'No',
  };
};
