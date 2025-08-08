import { getSystemInfo } from './systemInfo.js';

/**
 * Enhanced application logging with system information
 */

let hasLoggedSystemInfo = false;

/**
 * Log comprehensive system information on app start
 */
export const logSystemInfoOnStart = async () => {
  if (hasLoggedSystemInfo) return;
  hasLoggedSystemInfo = true;

  try {
    const systemInfo = await getSystemInfo();
    
    console.group('📱 OpenSubtitles Uploader PRO - System Information');
    console.log('🎯 App Version:', systemInfo.app.version);
    console.log('🌍 Environment:', systemInfo.app.environment);
    console.log('💻 OS:', `${systemInfo.os.name} ${systemInfo.os.version} (${systemInfo.os.architecture})`);
    console.log('🔧 Browser/Runtime:', `${systemInfo.browser.name} ${systemInfo.browser.version}`);
    console.log('🖥️ Screen:', `${systemInfo.display.screenWidth}×${systemInfo.display.screenHeight} (${systemInfo.display.pixelRatio}x)`);
    console.log('🧠 CPU Cores:', systemInfo.browser.hardwareConcurrency);
    
    if (systemInfo.performance.usedJSHeapSize !== 'N/A') {
      const usedMB = Math.round(systemInfo.performance.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(systemInfo.performance.totalJSHeapSize / 1024 / 1024);
      console.log('🐏 Memory:', `${usedMB} MB / ${totalMB} MB`);
    }
    
    if (systemInfo.tauri.isTauri) {
      console.log('🦀 Tauri Version:', systemInfo.tauri.tauriVersion || 'Unknown');
      console.log('🔗 Protocol:', systemInfo.tauri.protocol);
    }
    
    console.log('🌐 Language:', systemInfo.browser.language);
    console.log('🕐 Timezone:', systemInfo.timezone);
    console.log('📡 Online:', systemInfo.browser.onLine ? 'Yes' : 'No');
    
    // Feature support summary
    const supportedFeatures = Object.entries(systemInfo.features)
      .filter(([, supported]) => supported)
      .map(([feature]) => feature);
    
    console.log('✅ Features:', supportedFeatures.join(', '));
    
    console.log('⏰ Boot Time:', new Date(systemInfo.timestamp).toLocaleString());
    console.groupEnd();
    
    // Log raw system info object for debugging
    console.log('🔍 Full System Info (for debugging):', systemInfo);
    
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
  console.log('🚀 OpenSubtitles Uploader PRO - Starting up...');
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