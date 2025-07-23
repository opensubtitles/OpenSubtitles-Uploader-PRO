import React, { useState, useEffect } from 'react';
import { OPENSUBTITLES_COM_API_KEY, USER_AGENT } from '../utils/constants.js';

export const AdBlockTestPage = () => {
  // IMMEDIATE Tauri detection - same logic as AdBlockerWarning
  const isTauriDetected = (
    typeof window !== 'undefined' && 
    (window.location.protocol === 'tauri:' || 
     window.location.href.includes('tauri://localhost'))
  );
  
  console.log('🔥 AdBlockTestPage - Tauri Detection:', isTauriDetected);
  console.log('🔥 AdBlockTestPage - URL:', typeof window !== 'undefined' ? window.location.href : 'undefined');
  
  const [tests, setTests] = useState(() => {
    const baseTests = [
      { name: 'OpenSubtitles API', url: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported', status: 'testing', error: null, time: null },
      { name: 'XML-RPC API', url: 'https://api.opensubtitles.org/xml-rpc', status: 'testing', error: null, time: null }
    ];
    
    // Only add ad blocker test for web browsers, not Tauri desktop apps
    if (!isTauriDetected) {
      baseTests.push({ name: 'Ad Block Test', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', status: 'testing', error: null, time: null });
    }
    
    return baseTests;
  });
  
  const [browserInfo, setBrowserInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    // Detect browser
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

    detectBrowser();
    runTests();
  }, []);

  const runTests = async () => {
    const testUrls = [
      { 
        name: 'OpenSubtitles API', 
        url: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported',
        headers: {
          'Api-Key': OPENSUBTITLES_COM_API_KEY || 'test-key',
          'User-Agent': USER_AGENT,
          'X-User-Agent': USER_AGENT
        }
      },
      { 
        name: 'XML-RPC API', 
        url: 'https://api.opensubtitles.org/xml-rpc',
        headers: {
          'User-Agent': USER_AGENT,
          'X-User-Agent': USER_AGENT
        }
      },
      { 
        name: 'Ad Block Test', 
        url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
        headers: {}
      }
    ];

    for (let i = 0; i < testUrls.length; i++) {
      const test = testUrls[i];
      const startTime = Date.now();
      
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
        const endTime = Date.now();
        
        setTests(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: response.ok ? 'success' : 'blocked', 
            error: response.ok ? null : `HTTP ${response.status}`,
            time: endTime - startTime
          } : t
        ));
        
      } catch (error) {
        const endTime = Date.now();
        let status = 'blocked';
        let errorMsg = error.message;
        
        if (error.name === 'AbortError') {
          status = 'timeout';
          errorMsg = 'Request timeout (likely blocked)';
        } else if (error.message.includes('CORS')) {
          status = 'cors';
          errorMsg = 'CORS policy block';
        } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
          status = 'network';
          errorMsg = 'Network error / Failed to fetch';
        }
        
        setTests(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status, 
            error: errorMsg,
            time: endTime - startTime
          } : t
        ));
      }
    }
    
    // Generate recommendations after all tests
    setTimeout(() => {
      generateRecommendations();
    }, 100);
  };

  const generateRecommendations = () => {
    const recs = [];
    const apiTest = tests[0]; // OpenSubtitles API test
    const adTest = tests[2]; // Ad block test
    
    // Different recommendations for Tauri vs browser
    if (isTauriDetected) {
      // Desktop app recommendations
      if (apiTest?.status === 'blocked' || apiTest?.status === 'timeout' || apiTest?.status === 'network' || apiTest?.status === 'cors') {
        recs.push({
          type: 'network-issue',
          title: '📡 Network Connectivity Issue',
          description: 'The desktop app cannot connect to OpenSubtitles servers.',
          steps: [
            'Check your internet connection',
            'Try restarting your router/modem',
            'Check if a firewall is blocking the application',
            'Contact your ISP if the problem persists'
          ]
        });
      }
    } else {
      // Browser recommendations  
      if (browserInfo?.browser === 'Brave') {
        recs.push({
          type: 'brave',
          title: '🛡️ Brave Shield Detected',
          description: 'Brave browser is blocking API requests by default.',
          steps: [
            'Click the Shield icon (🛡️) in your address bar',
            'Turn off "Shields" for this domain',
            'Refresh this page to retest'
          ]
        });
      }
    }
    
    if (!isTauriDetected && (apiTest?.status === 'blocked' || apiTest?.status === 'timeout' || apiTest?.status === 'network' || apiTest?.status === 'cors')) {
      recs.push({
        type: 'api-blocked',
        title: '🚫 OpenSubtitles API Blocked',
        description: 'The main API required for the uploader is being blocked by an ad blocker or browser security.',
        steps: [
          'Disable uBlock Origin, Adblock Plus, or other ad blockers for this site',
          'Add "uploader.opensubtitles.org" to your ad blocker\'s whitelist/allowlist',
          'Temporarily disable all browser extensions to test',
          'Try using incognito/private browsing mode',
          'Check if your antivirus software is blocking requests'
        ]
      });
    }
    
    if (adTest?.status === 'blocked') {
      recs.push({
        type: 'adblocker',
        title: '🛡️ Ad Blocker Detected',
        description: 'Common ad blockers like uBlock Origin, Adblock Plus, or browser extensions are blocking necessary requests.',
        steps: [
          'For uBlock Origin: Click the extension icon → click the big power button to disable for this site',
          'For Adblock Plus: Click the extension icon → toggle "Enabled on this site" to OFF',
          'For other blockers: Look for a shield/block icon in your browser toolbar',
          'Alternative: Add "uploader.opensubtitles.org" to your blocker\'s whitelist',
          'Test in incognito/private mode (extensions are usually disabled there)'
        ]
      });
    }
    
    if (recs.length === 0) {
      recs.push({
        type: 'success',
        title: '✅ All Tests Passed',
        description: 'Your browser configuration appears to be working correctly!',
        steps: [
          'You can safely use the OpenSubtitles Uploader',
          'All required APIs are accessible',
          'No blocking detected'
        ]
      });
    }
    
    setRecommendations(recs);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'testing': return '⏳';
      case 'success': return '✅';
      case 'blocked': return '🚫';
      case 'timeout': return '⏱️';
      case 'cors': return '🔒';
      case 'network': return '🌐';
      default: return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'blocked': return 'text-red-600 bg-red-50 border-red-200';
      case 'timeout': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'testing': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className={`rounded-lg shadow-sm border p-6 mb-6 ${
          isTauriDetected ? 'bg-blue-50 border-blue-200' : 'bg-white'
        }`}>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isTauriDetected ? '📡 Desktop App - Network Connectivity Test' : '🛡️ OpenSubtitles Uploader - Connectivity Test'}
          </h1>
          <p className={isTauriDetected ? 'text-blue-700' : 'text-gray-600'}>
            {isTauriDetected 
              ? 'This page tests network connectivity for the desktop application. Any connection issues are related to your internet connection, not ad blockers.'
              : 'This page tests if your browser can access the required APIs for the OpenSubtitles Uploader to function properly.'
            }
          </p>
          {isTauriDetected && (
            <div className="mt-3 p-3 bg-blue-100 rounded-lg">
              <p className="text-blue-800 text-sm font-medium">
                💡 <strong>Desktop App Detected:</strong> Ad blockers cannot affect desktop applications. 
                Any issues shown below are network connectivity problems, not browser extensions.
              </p>
            </div>
          )}
        </div>

        {/* Browser/Environment Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {isTauriDetected ? 'Environment Information' : 'Browser Information'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-700">
                {isTauriDetected ? 'Environment:' : 'Browser:'}
              </span>
              <span className="ml-2 text-gray-900">
                {isTauriDetected 
                  ? 'Desktop Application (Tauri)' 
                  : (browserInfo?.browser || 'Detecting...')
                }
              </span>
              {isTauriDetected && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  📡 Network Only
                </span>
              )}
              {!isTauriDetected && browserInfo?.browser === 'Brave' && (
                <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                  🛡️ Blocking Expected
                </span>
              )}
            </div>
            <div>
              <span className="font-medium text-gray-700">User Agent:</span>
              <span className="ml-2 text-gray-600 text-sm break-all">
                {browserInfo?.userAgent?.substring(0, 80)}...
              </span>
            </div>
          </div>
        </div>

        {/* API Tests */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Connectivity Tests</h2>
          <div className="space-y-4">
            {tests.map((test, index) => (
              <div key={index} className={`border rounded-lg p-4 ${getStatusColor(test.status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getStatusIcon(test.status)}</span>
                    <div>
                      <h3 className="font-medium">{test.name}</h3>
                      <p className="text-sm opacity-75">{test.url}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {test.time && <p>{test.time}ms</p>}
                    {test.error && <p className="text-red-600">{test.error}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex space-x-3">
            <button
              onClick={runTests}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              🔄 Retest APIs
            </button>
            <a
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              📤 Go to Uploader
            </a>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommendations</h2>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">{rec.title}</h3>
                  <p className="text-gray-600 mb-3">{rec.description}</p>
                  <div className="space-y-2">
                    {rec.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">{stepIndex + 1}.</span>
                        <span className="text-gray-700">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdBlockTestPage;