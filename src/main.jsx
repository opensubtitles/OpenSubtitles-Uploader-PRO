import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { validateApiConfiguration } from './utils/constants.js';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
