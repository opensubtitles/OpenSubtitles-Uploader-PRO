import React, { useState, useEffect } from 'react';
import { OfflineGuessItService } from '../services/offlineGuessItService.js';

const OfflineIndicator = () => {
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check WASM status
    const checkWasmStatus = async () => {
      try {
        const ready = await OfflineGuessItService.initialize();
        setIsWasmReady(ready);
      } catch (error) {
        setIsWasmReady(false);
      }
    };

    checkWasmStatus();

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'text-orange-600 bg-orange-50';
    if (isWasmReady) return 'text-green-600 bg-green-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline Mode';
    if (isWasmReady) return 'Offline Ready';
    return 'Online Only';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '🔌';
    if (isWasmReady) return '⚡';
    return '🌐';
  };

  const getDescription = () => {
    if (!isOnline) {
      return 'No internet connection. Using offline GuessIt WASM for movie detection.';
    }
    if (isWasmReady) {
      return 'Offline WASM available. Faster movie detection with API fallback.';
    }
    return 'API-only mode. Internet required for movie detection.';
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}
    >
      <span className="text-base">{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
      <div className="group relative">
        <button className="text-xs opacity-60 hover:opacity-100 ml-1">?</button>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg w-64 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {getDescription()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1 border-4 border-transparent border-t-gray-300"></div>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
