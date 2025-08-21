import React, { useState, useEffect, useRef } from 'react';
import { OPENSUBTITLES_COM_API_KEY, getApiHeaders } from '../utils/constants.js';
import { AdBlockerDetection } from '../utils/adBlockerDetection.js';

export const ApiHealthCheck = ({ onApiBlocked }) => {
  // IMMEDIATE Tauri detection - before any state setup
  const isTauriDetected = (
    typeof window !== 'undefined' && 
    (window.location.protocol === 'tauri:' || 
     window.location.href.includes('tauri://localhost'))
  );
  

  const [isChecking, setIsChecking] = useState(true);
  const [apiStatus, setApiStatus] = useState('checking');
  const [browserInfo, setBrowserInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const hasRunRef = useRef(false);
  const onApiBlockedRef = useRef(onApiBlocked);
  const connectivityCheckRef = useRef(null);
  const [isMonitoringConnectivity, setIsMonitoringConnectivity] = useState(false);
  const [showErrorWithDelay, setShowErrorWithDelay] = useState(false);
  const errorDelayTimeoutRef = useRef(null);

  // Update the ref when onApiBlocked changes
  useEffect(() => {
    onApiBlockedRef.current = onApiBlocked;
  }, [onApiBlocked]);

  // Connectivity monitoring function
  const checkInternetConnectivity = async () => {
    try {
      console.log('🌐 Checking internet connectivity (ping 1.1.1.1)...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      // Try to fetch from Cloudflare DNS (1.1.1.1)
      const response = await fetch('https://1.1.1.1/', {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Important for cross-origin requests
      });
      
      clearTimeout(timeoutId);
      console.log('✅ Internet connectivity restored!');
      return true;
    } catch (error) {
      console.log('❌ Internet still not available:', error.message);
      return false;
    }
  };

  // Start connectivity monitoring for Tauri apps with network errors
  const startConnectivityMonitoring = () => {
    if (!isTauriDetected || isMonitoringConnectivity) return;
    
    console.log('🔄 Starting connectivity monitoring for Tauri app...');
    setIsMonitoringConnectivity(true);
    
    connectivityCheckRef.current = setInterval(async () => {
      console.log('🌐 Periodic connectivity check...');
      const isConnected = await checkInternetConnectivity();
      
      if (isConnected) {
        console.log('✅ Connection restored - re-checking API health...');
        // Reset and re-run the API health check
        setIsChecking(true);
        setApiStatus('checking');
        stopConnectivityMonitoring();
        
        // Re-run the full API health check after a brief delay
        setTimeout(() => {
          hasRunRef.current = false;
          setShowErrorWithDelay(false); // Reset error display state
          checkApiHealth();
        }, 500);
      }
    }, 3000); // Check every 3 seconds
  };

  // Stop connectivity monitoring
  const stopConnectivityMonitoring = () => {
    if (connectivityCheckRef.current) {
      console.log('🛑 Stopping connectivity monitoring');
      clearInterval(connectivityCheckRef.current);
      connectivityCheckRef.current = null;
      setIsMonitoringConnectivity(false);
    }
  };

  // Detect browser function
  const detectBrowser = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let isBlocking = false;
    
    if (ua.includes('Brave')) {
      browser = 'Brave';
      isBlocking = true;
    } else if (ua.includes('Chrome')) {
      browser = 'Chrome';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Safari')) {
      browser = 'Safari';
    } else if (ua.includes('Edge')) {
      browser = 'Edge';
    }
    
    setBrowserInfo({ browser, isBlocking, userAgent: ua });
  };

  // Main API health check function
  const checkApiHealth = async () => {
      detectBrowser();
      
      // Detect Brave but don't return early - still run network tests
      const isBrave = !isTauriDetected && (navigator.userAgent.includes('Brave') || 
                     (navigator.brave && await navigator.brave.isBrave().catch(() => false)));
      
      // For Tauri apps, only test OpenSubtitles API. For browsers, test both API and ad blocking
      const testUrls = isTauriDetected ? [
        { 
          name: 'OpenSubtitles API', 
          url: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported',
          headers: OPENSUBTITLES_COM_API_KEY ? {
            'Api-Key': OPENSUBTITLES_COM_API_KEY,
            'User-Agent': 'OpenSubtitles Uploader PRO',
            'X-User-Agent': 'OpenSubtitles Uploader PRO'
          } : {
            'User-Agent': 'OpenSubtitles Uploader PRO',
            'X-User-Agent': 'OpenSubtitles Uploader PRO'
          }
        }
      ] : [
        { 
          name: 'OpenSubtitles API', 
          url: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported',
          headers: OPENSUBTITLES_COM_API_KEY ? {
            'Api-Key': OPENSUBTITLES_COM_API_KEY,
            'User-Agent': 'OpenSubtitles Uploader PRO',
            'X-User-Agent': 'OpenSubtitles Uploader PRO'
          } : {
            'User-Agent': 'OpenSubtitles Uploader PRO',
            'X-User-Agent': 'OpenSubtitles Uploader PRO'
          }
        },
        { 
          name: 'Ad Block Test', 
          url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
          headers: {}
        }
      ];

      let apiBlocked = false;
      let adBlocked = false;

      for (let i = 0; i < testUrls.length; i++) {
        const test = testUrls[i];
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(test.url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: test.headers,
            mode: 'cors'
          });
          
          clearTimeout(timeoutId);
          
          // Same success logic as /adblock page
          if (!response.ok) {
            if (i === 0) apiBlocked = true; // OpenSubtitles API test
            if (i === 1) adBlocked = true; // Ad test
          }
          
        } catch (error) {
          // Same error handling as /adblock page
          if (error.name === 'AbortError') {
            if (i === 0) apiBlocked = true;
            if (i === 1) adBlocked = true;
          } else if (error.message.includes('CORS')) {
            // CORS errors only affect the API test
            if (i === 0) apiBlocked = true;
          } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
            if (i === 0) apiBlocked = true;
            if (i === 1) adBlocked = true;
          } else {
            // Default: any other error affects both
            if (i === 0) apiBlocked = true;
            if (i === 1) adBlocked = true;
          }
        }
      }

      // Set final status based on test results
      if (!OPENSUBTITLES_COM_API_KEY) {
        setApiStatus('no-key');
        setIsChecking(false);
      } else if (apiBlocked || adBlocked) {
        if (isTauriDetected) {
          // For Tauri apps, add delay before showing network error to prevent flash
          errorDelayTimeoutRef.current = setTimeout(() => {
            setApiStatus('network-error');
            setShowErrorWithDelay(true);
            if (onApiBlockedRef.current) {
              onApiBlockedRef.current('network-error');
            }
            // Start connectivity monitoring to auto-hide message when connection restored
            setTimeout(() => startConnectivityMonitoring(), 1000);
          }, 2000); // 2 second delay before showing error
        } else {
          // For browsers, distinguish between network blocking vs real ad-blocker
          console.log('🔍 Network request failed, testing if real ad-blocker or network issue...');
          
          // Use bait element test to distinguish (Issue #1 fix)
          const testBaitElement = async () => {
            try {
              const baitBlocked = await AdBlockerDetection.detectWithBaitElement();
              console.log('🎣 Bait element test result:', baitBlocked ? 'BLOCKED (real ad-blocker)' : 'OK (network issue)');
              
              if (baitBlocked) {
                // Real ad-blocker detected - show warning
                setApiStatus('blocked');
                setShowErrorWithDelay(true);
                if (onApiBlockedRef.current) {
                  if (isBrave && (apiBlocked || adBlocked)) {
                    onApiBlockedRef.current('Brave Shield');
                  } else {
                    onApiBlockedRef.current(apiBlocked ? 'api-blocked' : 'ad-blocked');
                  }
                }
              } else {
                // Network/DNS blocking (hosts file, ISP, etc.) - no warning (Issue #1 fix)
                console.log('ℹ️ Network-level blocking detected (hosts file, DNS, ISP) - no ad-blocker warning shown');
                setApiStatus('healthy'); // Treat as healthy, no warning shown
                setShowErrorWithDelay(true);
              }
            } catch (error) {
              console.warn('Bait element test failed, defaulting to no warning:', error);
              setApiStatus('healthy'); // Default to no warning on error
              setShowErrorWithDelay(true);
            }
          };
          
          testBaitElement();
        }
        setIsChecking(false);
      } else {
        setApiStatus('healthy');
        setShowErrorWithDelay(true);
        setIsChecking(false);
      };
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopConnectivityMonitoring();
      if (errorDelayTimeoutRef.current) {
        clearTimeout(errorDelayTimeoutRef.current);
      }
    };
  }, []);

  // Initial API health check
  useEffect(() => {
    // Prevent multiple runs
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    checkApiHealth();
  }, []); // Empty dependency array - only run once

  if (isChecking) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded shadow-lg text-sm">
        🔍 Checking API connection...
      </div>
    );
  }

  if (apiStatus === 'healthy' || dismissed || (apiStatus !== 'healthy' && !showErrorWithDelay)) {
    return null; // Don't show anything if API is working, dismissed, or error not ready to show
  }

  const getStatusMessage = () => {
    switch (apiStatus) {
      case 'no-key':
        return {
          icon: '🔑',
          title: 'API Key Missing',
          message: 'OpenSubtitles API key is not configured. Please check your .env file.',
          color: 'bg-red-600',
          isFullWidth: false
        };
      case 'invalid-key':
        return {
          icon: '🚫',
          title: 'Invalid API Key',
          message: 'The OpenSubtitles API key is invalid. Please check your configuration.',
          color: 'bg-red-600',
          isFullWidth: false
        };
      case 'blocked':
        return {
          icon: '🛡️',
          title: browserInfo?.browser === 'Brave' ? 'Brave Shield Active' : 'Ad Blocker Detected',
          message: browserInfo?.browser === 'Brave' 
            ? 'IMPORTANT: Brave Shield is blocking OpenSubtitles API requests. The uploader will not work until you disable it for this site.'
            : 'Ad blockers like uBlock Origin, Adblock Plus are blocking necessary API requests.',
          color: browserInfo?.browser === 'Brave' ? 'bg-orange-600' : 'bg-red-600',
          isFullWidth: true
        };
      case 'timeout':
        return {
          icon: '⏱️',
          title: 'Connection Timeout',
          message: 'API requests are timing out. This is usually caused by ad blockers or network issues.',
          color: 'bg-orange-600',
          isFullWidth: true
        };
      case 'network-error':
        return {
          icon: '🌐',
          title: isTauriDetected ? 'Network Connection Problem' : 'Network Error',
          message: isTauriDetected 
            ? 'Unable to connect to OpenSubtitles API. Please check your internet connection or try again later.'
            : 'Unable to connect to OpenSubtitles API. This is usually caused by ad blockers (uBlock Origin, Adblock Plus, etc.). Please disable them for this site.',
          color: 'bg-red-600',
          isFullWidth: true
        };
      default:
        return {
          icon: '❌',
          title: 'API Error',
          message: 'There was an error connecting to the OpenSubtitles API.',
          color: 'bg-red-600',
          isFullWidth: false
        };
    }
  };

  const status = getStatusMessage();
  const isBraveShield = browserInfo?.browser === 'Brave' && (apiStatus === 'blocked' || apiStatus === 'timeout' || apiStatus === 'network-error');

  // Show full-width banner for blocking issues, compact notification for other errors
  if (status.isFullWidth) {
    const getDisableInstructions = () => {
      if (isTauriDetected) {
        return [
          'Check your internet connection',
          'Try connecting to a different network',
          'Restart your router/modem if needed',
          'Check if OpenSubtitles.org is accessible in your browser',
          'Try again in a few minutes (server may be temporarily unavailable)'
        ];
      } else if (isBraveShield) {
        return [
          'Click the Brave Shield icon (🛡️) in the address bar',
          'Turn off "Shields" for uploader.opensubtitles.org',
          'Refresh the page'
        ];
      } else {
        return [
          'For uBlock Origin: Click the extension icon → click the big power button to disable for this site',
          'For Adblock Plus: Click the extension icon → toggle "Enabled on this site" to OFF',
          'For other blockers: Look for a shield/block icon in your browser toolbar',
          'Alternative: Add "uploader.opensubtitles.org" to your blocker\'s whitelist',
          'Test in incognito/private mode (extensions are usually disabled there)'
        ];
      }
    };

    return (
      <div className={`fixed top-0 left-0 right-0 ${status.color} text-white px-4 py-3 shadow-lg z-50`}>
        <div className="max-w-4xl mx-auto flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">{status.icon}</span>
            <div>
              <h3 className="font-bold text-lg mb-1">
                {isBraveShield ? '🛡️ ' : ''}{status.title}
              </h3>
              <p className={`${isBraveShield ? 'text-orange-100' : 'text-red-100'} mb-2 font-medium`}>
                {isBraveShield ? '⚠️ ' : ''}{status.message}
              </p>
              <div className={`text-sm ${isBraveShield ? 'text-orange-100' : 'text-red-100'}`}>
                <p className="font-semibold mb-1">
                  {isTauriDetected ? 'Troubleshooting Steps' : (isBraveShield ? 'Disable Brave Shield' : 'Disable Ad Blocker')}:
                </p>
                <ul className="list-none space-y-1">
                  {getDisableInstructions().map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">▶</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                {isBraveShield && (
                  <p className="mt-2 font-semibold text-orange-200">
                    💡 Tip: You can also add "uploader.opensubtitles.org" to your Brave Shield exceptions.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => window.location.reload()}
              className={`${isBraveShield ? 'bg-orange-700 hover:bg-orange-800' : 'bg-red-700 hover:bg-red-800'} text-white px-3 py-1 rounded text-sm font-medium transition-colors`}
              title={isTauriDetected ? "Retry connection" : "Refresh page after disabling blocker"}
            >
              {isMonitoringConnectivity ? '🔄 Monitoring...' : `🔄 ${isTauriDetected ? 'Retry' : 'Refresh'}`}
            </button>
            {!isTauriDetected && (
              <a
                href="/#/adblock"
                className={`${isBraveShield ? 'bg-orange-700 hover:bg-orange-800' : 'bg-red-700 hover:bg-red-800'} text-white px-3 py-1 rounded text-sm font-medium transition-colors`}
              >
                🛡️ Test
              </a>
            )}
            <button
              onClick={() => setDismissed(true)}
              className={`${isBraveShield ? 'bg-orange-700 hover:bg-orange-800' : 'bg-red-700 hover:bg-red-800'} text-white px-3 py-1 rounded text-sm font-medium transition-colors`}
              title="Dismiss this warning"
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact notification for non-blocking errors
  return (
    <div className={`fixed bottom-4 right-4 ${status.color} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm text-sm`}>
      <div className="flex items-center space-x-2">
        <span className="text-lg">{status.icon}</span>
        <div>
          <div className="font-semibold">{status.title}</div>
          <div className="text-xs opacity-90">{status.message}</div>
        </div>
      </div>
    </div>
  );
};

export default ApiHealthCheck;