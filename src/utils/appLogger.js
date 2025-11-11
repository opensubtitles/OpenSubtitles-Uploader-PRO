import { getSystemInfo, formatWithoutNA, formatSystemInfoLine } from './systemInfo.js';

/**
 * Enhanced application logging with system information
 */

let hasLoggedSystemInfo = false;

/**
 * Log comprehensive system information on app start
 * Only logs to console if debug panel is not available (web-only usage)
 */
export const logSystemInfoOnStart = async () => {
  if (hasLoggedSystemInfo) return;
  hasLoggedSystemInfo = true;

  try {
    const systemInfo = await getSystemInfo();

    // Only log system info to console in non-debug environments
    // In debug mode, it's shown in the debug panel to avoid duplication
    const isDebugPanelEnvironment =
      typeof document !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.protocol.startsWith('tauri'));

    if (!isDebugPanelEnvironment) {
      // Compact one-line system info for console-only environments
      console.log(
        formatSystemInfoLine([
          `🚀 OpenSubtitles Uploader PRO v${systemInfo.app.version}`,
          systemInfo.app.environment,
          formatWithoutNA(
            systemInfo.os.name,
            systemInfo.os.version,
            `(${systemInfo.os.architecture})`
          ),
          formatWithoutNA(systemInfo.browser.name, systemInfo.browser.version),
        ])
      );

      // Additional details only if needed for debugging
      if (systemInfo.tauri.isTauri) {
        console.log('🦀 Tauri App:', systemInfo.tauri.tauriVersion || 'Unknown version');
      }
    }
  } catch (error) {
    console.error('❌ Failed to log system information:', error);
  }
};

/**
 * Enhanced console logging with context
 */
export const logWithContext = (level, message, data = null) => {
  const timestamp = new Date().toLocaleTimeString();
  const context = `[${timestamp}]`;

  if (data) {
    console[level](context, message, data);
  } else {
    console[level](context, message);
  }
};

/**
 * Log app initialization
 */
export const logAppInit = async () => {
  await logSystemInfoOnStart();
};

/**
 * Log updater diagnostics
 */
export const logUpdaterDiagnostics = async (context = 'General') => {
  try {
    const systemInfo = await getSystemInfo();

    console.group(`🔄 Updater Diagnostics - ${context}`);
    console.log('Environment Type:', systemInfo.app.environment);
    console.log('Is Tauri App:', systemInfo.tauri.isTauri);
    console.log('Protocol:', systemInfo.tauri.protocol);
    console.log('Origin:', systemInfo.tauri.origin);
    console.log('User Agent Contains Tauri:', navigator.userAgent.includes('Tauri'));
    console.log('Window.__TAURI__ Available:', !!window.__TAURI__);

    if (window.__TAURI__) {
      console.log('Available Tauri APIs:', Object.keys(window.__TAURI__));
    }

    // Test import availability
    try {
      const updaterModule = await import('@tauri-apps/plugin-updater');
      console.log('✅ @tauri-apps/plugin-updater import:', 'Success');
      console.log('Available updater methods:', Object.keys(updaterModule));
    } catch (importError) {
      console.log('❌ @tauri-apps/plugin-updater import:', importError.message);
    }

    console.groupEnd();
  } catch (error) {
    console.error('❌ Failed to log updater diagnostics:', error);
  }
};
