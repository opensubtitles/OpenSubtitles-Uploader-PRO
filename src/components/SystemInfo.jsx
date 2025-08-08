import React, { useState, useEffect } from 'react';
import { getSystemInfo, getSystemInfoFormatted, formatBytes } from '../utils/systemInfo.js';

/**
 * System Information Display Component
 * Shows comprehensive app and system information
 */
export const SystemInfo = ({ compact = false, showTitle = true }) => {
  const [systemInfo, setSystemInfo] = useState(null);
  const [formattedInfo, setFormattedInfo] = useState(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const [info, formatted] = await Promise.all([
          getSystemInfo(),
          getSystemInfoFormatted()
        ]);
        setSystemInfo(info);
        setFormattedInfo(formatted);
      } catch (error) {
        console.error('Failed to load system info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSystemInfo();
  }, []);

  const copyToClipboard = async () => {
    if (!systemInfo) return;

    const text = Object.entries(formattedInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('System information copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback: create textarea and select
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('System information copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="system-info loading">
        <div className="loading-spinner">Loading system info...</div>
      </div>
    );
  }

  if (!systemInfo) {
    return (
      <div className="system-info error">
        <div className="error-message">Failed to load system information</div>
      </div>
    );
  }

  // Compact version (just version info)
  if (compact && !isExpanded) {
    return (
      <div className="system-info compact">
        {showTitle && <h4>System Info</h4>}
        <div className="compact-info">
          <div className="info-line">
            <strong>{systemInfo.app.name}</strong> v{systemInfo.app.version}
          </div>
          <div className="info-line secondary">
            {systemInfo.os.name} {systemInfo.os.version} ({systemInfo.os.architecture})
          </div>
          <div className="info-line secondary">
            {systemInfo.browser.name} {systemInfo.browser.version} | {systemInfo.app.environment}
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(true)}
          className="expand-button"
          title="Show detailed system information"
        >
          Show Details
        </button>
      </div>
    );
  }

  return (
    <div className="system-info expanded">
      {showTitle && (
        <div className="header">
          <h4>System Information</h4>
          <div className="header-actions">
            <button onClick={copyToClipboard} className="copy-button" title="Copy to clipboard">
              📋 Copy
            </button>
            {compact && (
              <button 
                onClick={() => setIsExpanded(false)} 
                className="collapse-button"
                title="Show compact view"
              >
                ↑ Collapse
              </button>
            )}
          </div>
        </div>
      )}

      <div className="info-grid">
        {/* Application Information */}
        <div className="info-section">
          <h5>Application</h5>
          <div className="info-item">
            <span className="label">Name:</span>
            <span className="value">{systemInfo.app.name}</span>
          </div>
          <div className="info-item">
            <span className="label">Version:</span>
            <span className="value">{systemInfo.app.version}</span>
          </div>
          <div className="info-item">
            <span className="label">Environment:</span>
            <span className="value">{systemInfo.app.environment}</span>
          </div>
          {systemInfo.tauri.isTauri && systemInfo.tauri.tauriVersion && (
            <div className="info-item">
              <span className="label">Tauri Version:</span>
              <span className="value">{systemInfo.tauri.tauriVersion}</span>
            </div>
          )}
        </div>

        {/* Browser Information */}
        <div className="info-section">
          <h5>Browser/Runtime</h5>
          <div className="info-item">
            <span className="label">Browser:</span>
            <span className="value">{systemInfo.browser.name} {systemInfo.browser.version}</span>
          </div>
          <div className="info-item">
            <span className="label">Language:</span>
            <span className="value">{systemInfo.browser.language}</span>
          </div>
          <div className="info-item">
            <span className="label">Platform:</span>
            <span className="value">{systemInfo.browser.platform}</span>
          </div>
          <div className="info-item">
            <span className="label">Online:</span>
            <span className="value">{systemInfo.browser.onLine ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {/* Operating System */}
        <div className="info-section">
          <h5>Operating System</h5>
          <div className="info-item">
            <span className="label">OS:</span>
            <span className="value">{systemInfo.os.name} {systemInfo.os.version}</span>
          </div>
          <div className="info-item">
            <span className="label">Architecture:</span>
            <span className="value">{systemInfo.os.architecture}</span>
          </div>
          <div className="info-item">
            <span className="label">CPU Cores:</span>
            <span className="value">{systemInfo.browser.hardwareConcurrency}</span>
          </div>
          <div className="info-item">
            <span className="label">Timezone:</span>
            <span className="value">{systemInfo.timezone}</span>
          </div>
        </div>

        {/* Display Information */}
        <div className="info-section">
          <h5>Display</h5>
          <div className="info-item">
            <span className="label">Screen:</span>
            <span className="value">{systemInfo.display.screenWidth}×{systemInfo.display.screenHeight}</span>
          </div>
          <div className="info-item">
            <span className="label">Viewport:</span>
            <span className="value">{systemInfo.display.viewportWidth}×{systemInfo.display.viewportHeight}</span>
          </div>
          <div className="info-item">
            <span className="label">Pixel Ratio:</span>
            <span className="value">{systemInfo.display.pixelRatio}x</span>
          </div>
          <div className="info-item">
            <span className="label">Color Depth:</span>
            <span className="value">{systemInfo.display.colorDepth}-bit</span>
          </div>
        </div>

        {/* Performance Information */}
        {systemInfo.performance.usedJSHeapSize !== 'N/A' && (
          <div className="info-section">
            <h5>Memory</h5>
            <div className="info-item">
              <span className="label">Used:</span>
              <span className="value">{formatBytes(systemInfo.performance.usedJSHeapSize)}</span>
            </div>
            <div className="info-item">
              <span className="label">Total:</span>
              <span className="value">{formatBytes(systemInfo.performance.totalJSHeapSize)}</span>
            </div>
            <div className="info-item">
              <span className="label">Limit:</span>
              <span className="value">{formatBytes(systemInfo.performance.jsHeapSizeLimit)}</span>
            </div>
          </div>
        )}

        {/* Network Information */}
        {systemInfo.performance.connection !== 'N/A' && (
          <div className="info-section">
            <h5>Connection</h5>
            <div className="info-item">
              <span className="label">Type:</span>
              <span className="value">{systemInfo.performance.connection.effectiveType}</span>
            </div>
            <div className="info-item">
              <span className="label">Downlink:</span>
              <span className="value">{systemInfo.performance.connection.downlink} Mbps</span>
            </div>
            <div className="info-item">
              <span className="label">RTT:</span>
              <span className="value">{systemInfo.performance.connection.rtt}ms</span>
            </div>
          </div>
        )}
      </div>

      {/* Features Support */}
      <div className="features-section">
        <h5>Feature Support</h5>
        <div className="features-grid">
          {Object.entries(systemInfo.features).map(([feature, supported]) => (
            <div key={feature} className={`feature ${supported ? 'supported' : 'not-supported'}`}>
              <span className="feature-name">{feature.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              <span className="feature-status">{supported ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="timestamp">
        <small>Generated: {new Date(systemInfo.timestamp).toLocaleString()}</small>
      </div>
    </div>
  );
};

export default SystemInfo;