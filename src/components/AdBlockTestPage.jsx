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
      { name: 'Internet Connectivity', url: 'https://httpbin.org/get', status: 'pending', error: null, time: null, category: 'connectivity' },
      { name: 'OpenSubtitles API', url: 'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported', status: 'pending', error: null, time: null, category: 'api' },
      { name: 'XML-RPC API', url: 'https://api.opensubtitles.org/xml-rpc', status: 'pending', error: null, time: null, category: 'api' }
    ];
    
    // Only add ad blocker test for web browsers, not Tauri desktop apps
    if (!isTauriDetected) {
      baseTests.push({ name: 'AdBlock Detection', url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', status: 'pending', error: null, time: null, category: 'adblock' });
    }
    
    return baseTests;
  });
  
  const [browserInfo, setBrowserInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

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

  const runSingleTest = async (testIndex, test) => {
    const startTime = Date.now();
    
    // Set test to "testing" status
    setTests(prev => prev.map((t, idx) => 
      idx === testIndex ? { ...t, status: 'testing' } : t
    ));
    
    const getHeaders = (test) => {
      switch (test.category) {
        case 'connectivity':
          return {}; // No special headers for connectivity test
        case 'api':
          if (test.name.includes('OpenSubtitles API')) {
            return {
              'Api-Key': OPENSUBTITLES_COM_API_KEY || 'test-key',
              'User-Agent': USER_AGENT,
              'X-User-Agent': USER_AGENT
            };
          } else {
            return {
              'User-Agent': USER_AGENT,
              'X-User-Agent': USER_AGENT
            };
          }
        case 'adblock':
          return {}; // No special headers for adblock test
        default:
          return {};
      }
    };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Longer timeout for more accurate results
      
      const response = await fetch(test.url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: getHeaders(test),
        mode: 'cors',
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      
      setTests(prev => prev.map((t, idx) => 
        idx === testIndex ? { 
          ...t, 
          status: response.ok ? 'success' : 'failed', 
          error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
          time: endTime - startTime
        } : t
      ));
      
      return { success: response.ok, status: response.status, error: null };
      
    } catch (error) {
      const endTime = Date.now();
      let status = 'failed';
      let errorMsg = error.message;
      
      if (error.name === 'AbortError') {
        status = 'timeout';
        errorMsg = 'Request timeout';
      } else if (error.message.includes('CORS')) {
        status = 'cors';
        errorMsg = 'CORS policy block';
      } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
        status = 'network';
        errorMsg = 'Network connection failed';
      }
      
      setTests(prev => prev.map((t, idx) => 
        idx === testIndex ? { 
          ...t, 
          status, 
          error: errorMsg,
          time: endTime - startTime
        } : t
      ));
      
      return { success: false, status: null, error: errorMsg };
    }
  };

  const runTests = async () => {
    // Prevent multiple simultaneous runs
    if (isRunning) {
      console.log('⚠️ Tests already running, skipping...');
      return;
    }
    
    setIsRunning(true);
    // Reset all tests to pending
    setTests(prev => prev.map(t => ({ ...t, status: 'pending', error: null, time: null })));
    setRecommendations([]);
    
    // Step 1: Test internet connectivity first
    console.log('🌐 Testing internet connectivity...');
    const connectivityResult = await runSingleTest(0, tests[0]);
    
    if (!connectivityResult.success) {
      console.log('❌ No internet connectivity - skipping other tests');
      // Let the final generateRecommendations handle this case after state update
      setTimeout(() => generateRecommendations(), 200);
      setIsRunning(false);
      return;
    }
    
    console.log('✅ Internet connectivity OK - proceeding with API tests');
    
    // Step 2: Test OpenSubtitles APIs
    const apiTests = tests.filter(t => t.category === 'api');
    for (let i = 0; i < apiTests.length; i++) {
      const testIndex = tests.findIndex(t => t.name === apiTests[i].name);
      console.log(`🔧 Testing ${apiTests[i].name}...`);
      await runSingleTest(testIndex, apiTests[i]);
    }
    
    // Step 3: Test AdBlock (only in browser)
    if (!isTauriDetected) {
      const adBlockTest = tests.find(t => t.category === 'adblock');
      if (adBlockTest) {
        const testIndex = tests.findIndex(t => t.name === adBlockTest.name);
        console.log('🛡️ Testing AdBlock detection...');
        await runSingleTest(testIndex, adBlockTest);
      }
    }
    
    // Wait for all tests to complete before generating recommendations
    const checkTestsComplete = () => {
      setTests(currentTests => {
        const allComplete = currentTests.every(test => test.status !== 'pending' && test.status !== 'testing');
        console.log('🔍 Checking test completion:', currentTests.map(t => `${t.name}: ${t.status}`));
        
        if (allComplete) {
          console.log('✅ All tests complete, generating recommendations');
          setTimeout(() => generateRecommendationsWithCurrentState(currentTests), 50);
        } else {
          console.log('⏳ Tests still running, checking again in 100ms');
          setTimeout(checkTestsComplete, 100);
        }
        
        return currentTests; // Return unchanged state
      });
    };
    
    setTimeout(checkTestsComplete, 200);
    setIsRunning(false);
  };

  const generateRecommendationsWithCurrentState = (currentTests) => {
    const recs = [];
    const connectivityTest = currentTests.find(t => t.category === 'connectivity');
    const apiTests = currentTests.filter(t => t.category === 'api');
    const adBlockTest = currentTests.find(t => t.category === 'adblock');
    
    console.log('🔍 Generating recommendations with current test statuses:', {
      connectivity: connectivityTest?.status,
      api: apiTests.map(t => `${t.name}: ${t.status}`),
      adblock: adBlockTest?.status
    });
    
    // Check connectivity first
    if (connectivityTest?.status !== 'success') {
      recs.push({
        type: 'no-internet',
        title: '🌐 No Internet Connection',
        description: 'Cannot reach the internet. This is a basic connectivity issue, not related to ad blockers or browser settings.',
        steps: [
          'Check your internet connection (WiFi/Ethernet)',
          'Try accessing other websites like google.com',
          'Restart your router/modem if needed',
          'Contact your internet service provider if the problem persists',
          'Check if you\'re behind a corporate firewall that blocks access'
        ]
      });
      setRecommendations(recs);
      return; // Don't analyze other tests if no internet
    }
    
    // Analyze API connectivity issues
    const failedApiTests = apiTests.filter(t => t.status !== 'success');
    if (failedApiTests.length > 0) {
      if (isTauriDetected) {
        // Desktop app - network/firewall issues
        recs.push({
          type: 'network-issue',
          title: '📡 OpenSubtitles Server Connection Issue',
          description: 'Internet works, but cannot reach OpenSubtitles servers. This could be a server issue or firewall blocking.',
          steps: [
            'Check if OpenSubtitles.org is currently down (try visiting the website)',
            'Your firewall might be blocking the desktop application',
            'Try temporarily disabling your firewall/antivirus to test',
            'Check if you\'re behind a corporate firewall',
            'Contact your network administrator if in a corporate environment'
          ]
        });
      } else {
        // Browser - could be ad blocker or CORS
        recs.push({
          type: 'api-blocked',
          title: '🚫 OpenSubtitles API Access Blocked',
          description: 'Internet works, but OpenSubtitles APIs are blocked. This is likely caused by ad blockers or browser security settings.',
          steps: [
            'Disable uBlock Origin, Adblock Plus, or other ad blockers for this site',
            'Add "uploader.opensubtitles.org" to your ad blocker\'s allowlist',
            'Try browsing in incognito/private mode (extensions usually disabled)',
            'Temporarily disable all browser extensions to test',
            'Check if your antivirus has web protection that blocks API calls'
          ]
        });
      }
    }
    
    // Analyze AdBlock test (browser only)
    if (!isTauriDetected && adBlockTest) {
      if (adBlockTest.status !== 'success') {
        recs.push({
          type: 'adblocker',
          title: '🛡️ Ad Blocker Confirmed',
          description: 'An ad blocker is actively blocking advertising-related requests. This is normal but may interfere with the uploader.',
          steps: [
            'For uBlock Origin: Click extension icon → click the big power button to disable for this site',
            'For Adblock Plus: Click extension icon → toggle "Enabled on this site" to OFF',
            'For Brave: Click the Shield 🛡️ icon in address bar → turn off Shields',
            'Alternative: Add "uploader.opensubtitles.org" to your blocker\'s allowlist',
            'This is just a detection test - the uploader may still work fine'
          ]
        });
      }
      
      // Special case: Brave browser
      if (browserInfo?.browser === 'Brave') {
        recs.push({
          type: 'brave',
          title: '🛡️ Brave Browser Detected',
          description: 'Brave browser blocks ads and trackers by default, which may interfere with some functionality.',
          steps: [
            'Click the Shield icon (🛡️) in your address bar',
            'Turn off "Shields" for this domain (uploader.opensubtitles.org)',
            'Refresh this page to retest',
            'You can re-enable shields after testing if the uploader works'
          ]
        });
      }
    }
    
    // Success case
    if (recs.length === 0) {
      recs.push({
        type: 'success',
        title: '✅ All Tests Passed',
        description: 'Your internet connection and browser configuration are working perfectly!',
        steps: [
          'Internet connectivity: ✅ Working',
          'OpenSubtitles APIs: ✅ Accessible',
          !isTauriDetected && adBlockTest ? `Ad blocker test: ${adBlockTest.status === 'success' ? '✅ No blocking detected' : '⚠️ Some blocking detected (may not affect uploader)'}` : '✅ Desktop app (no ad blocker concerns)',
          '📤 Ready to upload subtitles!'
        ].filter(Boolean),
        showUploaderLink: true
      });
    }
    
    setRecommendations(recs);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏸️';
      case 'testing': return '⏳';
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'timeout': return '⏱️';
      case 'cors': return '🔒';
      case 'network': return '🌐';
      default: return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'timeout': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'testing': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'cors': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'network': return 'text-orange-600 bg-orange-50 border-orange-200';
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
            {isTauriDetected ? '📡 Desktop App - Network Diagnostics' : '🔍 OpenSubtitles Uploader - Connection Diagnostics'}
          </h1>
          <p className={isTauriDetected ? 'text-blue-700' : 'text-gray-600'}>
            {isTauriDetected 
              ? 'This page performs sequential network tests to diagnose connectivity issues. Tests run in order: Internet → APIs → Analysis.'
              : 'This page performs comprehensive connectivity tests to identify the root cause of any access issues. Tests run sequentially to provide accurate diagnosis.'
            }
          </p>
          {isTauriDetected && (
            <div className="mt-3 p-3 bg-blue-100 rounded-lg">
              <p className="text-blue-800 text-sm font-medium">
                💡 <strong>Desktop App Detected:</strong> Ad blockers cannot affect desktop applications. 
                Any issues detected are network connectivity or firewall problems.
              </p>
            </div>
          )}
          {!isTauriDetected && (
            <div className="mt-3 p-3 bg-green-100 rounded-lg">
              <p className="text-green-800 text-sm font-medium">
                🔍 <strong>Improved Testing:</strong> Tests run in sequence (Internet → APIs → AdBlock) to distinguish between connectivity issues and browser blocking.
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

        {/* Sequential Tests */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sequential Connectivity Tests</h2>
          <p className="text-sm text-gray-600 mb-4">
            Tests run in order: Internet connectivity → OpenSubtitles APIs → Ad blocker detection (browser only)
          </p>
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
                    {rec.showUploaderLink && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <a
                          href="/"
                          className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                          <span>📤</span>
                          <span>Go to OpenSubtitles Uploader</span>
                        </a>
                      </div>
                    )}
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