import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { validateApiConfiguration } from './utils/constants.js';
import { CacheService } from './services/cache.js';
import './index.css';
import './preload.js'; // Preload WASM components for faster loading

// Tauri v2 environment detection (cleaned up)
console.log('🚀 OpenSubtitles Uploader PRO - Starting app initialization');
console.log('🔍 Protocol:', window.location.protocol);

// Tauri environment detection
const isTauriEnvironment = window.location.protocol === 'tauri:';

if (isTauriEnvironment) {
  console.log(
    '🔧 Tauri v2 environment detected - drag and drop should work with dragDropEnabled: false'
  );
} else {
  console.log('🌐 Browser environment detected');
}

// Validate API configuration on startup
validateApiConfiguration();

// Reclaim quota from expired cache entries before the app needs it. Every
// cache here keys one entry per file, and expiry used to be consulted only on
// read - so entries the user never looked at again accumulated until the
// quota was gone and the next write (historically the login timestamp) threw.
try {
  const { removed, freedBytes } = CacheService.purgeExpiredEntries();
  if (removed > 0) {
    console.log(`🧹 Startup cache purge: ${removed} expired entries, ${freedBytes} bytes freed`);
  }
  const footprint = CacheService.getCacheFootprint();
  console.log(`💾 Cache footprint: ${footprint.formattedSize} across ${footprint.entries} entries`);
} catch (error) {
  console.warn('🧹 Startup cache purge skipped:', error.message);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
