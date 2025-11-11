import { useState, useEffect } from 'react';
import { AdBlockerDetection } from '../utils/adBlockerDetection.js';
import { APP_VERSION } from '../utils/constants.js';

export const AdBlockerWarning = () => {
  // Initialize state BEFORE any conditional logic (React Rules of Hooks)
  const [showWarning, setShowWarning] = useState(false);
  const [blockerInfo, setBlockerInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [isTauriApp, setIsTauriApp] = useState(false);

  // IMMEDIATE Tauri detection - check but don't early return
  const isTauriDetected =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'tauri:' || window.location.href.includes('tauri://localhost'));

  console.log('🔥 IMMEDIATE Tauri Detection on Component Load:', isTauriDetected);
  console.log('🔥 URL:', typeof window !== 'undefined' ? window.location.href : 'undefined');

  useEffect(() => {
    const checkAdBlocker = async () => {
      // Declare isTauri outside try block so it's accessible in catch
      let isTauri = false;

      try {
        // Skip detection if Tauri was already detected on component mount
        if (isTauriDetected) {
          console.log('🖥️ Tauri desktop app detected - skipping ad blocker check');
          setIsChecking(false);
          return;
        }

        console.log('🔍 === WEB BROWSER AD BLOCKER DETECTION START ===');
        console.log('📱 Running Web Browser Analysis v1.4.3');
        console.log('📍 Current Location:', window.location.href);
        console.log('🌐 Protocol Detection:', window.location.protocol);
        console.log('==========================================');

        // Comprehensive platform and environment detection
        const platformInfo = {
          // Basic environment
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          appVersion: navigator.appVersion,
          protocol: window.location.protocol,
          origin: window.location.origin,
          hostname: window.location.hostname,
          href: window.location.href,

          // macOS specific detection
          isMac: /Mac|iPhone|iPod|iPad/.test(navigator.platform),
          isAppleSilicon:
            /Mac/.test(navigator.platform) && navigator.userAgent.includes('Intel') === false,
          isIntel: /Mac/.test(navigator.platform) && navigator.userAgent.includes('Intel'),

          // Browser detection
          isElectron: typeof window !== 'undefined' && !!window.process && !!window.process.type,
          isNode: typeof process !== 'undefined' && process.versions && process.versions.node,

          // Window properties
          windowKeys:
            typeof window !== 'undefined'
              ? Object.keys(window).filter(
                  k =>
                    k.toLowerCase().includes('tauri') ||
                    k.toLowerCase().includes('__tauri') ||
                    k.toLowerCase().includes('webkit') ||
                    k.toLowerCase().includes('electron')
                )
              : [],

          // Build info
          buildTime: new Date().toISOString(),
        };

        // Enhanced Tauri detection with multiple methods
        const tauriDetection = {};

        // Method 1: Check for Tauri global objects
        tauriDetection.hasTauriGlobal = typeof window !== 'undefined' && !!window.__TAURI__;

        // Method 2: Check for Tauri protocol/origin (SIMPLIFIED - use same logic as working detection)
        tauriDetection.hasTauriProtocol =
          window.location.protocol === 'tauri:' ||
          window.location.href.startsWith('tauri://') ||
          window.location.origin.startsWith('tauri://');

        // Method 3: Check for Tauri in user agent
        tauriDetection.hasTauriUA = navigator.userAgent.includes('Tauri');

        // Method 4: Check for file:// protocol (common in desktop apps)
        tauriDetection.isFileProtocol = window.location.protocol === 'file:';

        // Method 5: Try to detect Tauri-specific APIs
        tauriDetection.hasTauriAPI =
          typeof window !== 'undefined' &&
          (window.__TAURI_INTERNALS__ !== undefined ||
            window.__TAURI_PLUGIN_SHELL__ !== undefined ||
            window.__TAURI_PLUGIN_HTTP__ !== undefined);

        // Method 6: Try to import Tauri plugin
        try {
          await import('@tauri-apps/api/core');
          tauriDetection.hasTauriPlugin = true;
        } catch (_e) {
          tauriDetection.hasTauriPlugin = false;
        }

        // Method 7: Check for localhost with non-standard port (typical Tauri pattern)
        tauriDetection.isTauriLocalhost =
          window.location.hostname === 'localhost' &&
          window.location.port &&
          window.location.port !== '80' &&
          window.location.port !== '443' &&
          window.location.port !== '3000' &&
          window.location.port !== '5173';

        // Determine if this is Tauri - SIMPLIFIED DETECTION
        // Use same logic that works in environment detection
        isTauri =
          window.location.protocol === 'tauri:' ||
          window.location.href.includes('tauri://localhost') ||
          tauriDetection.hasTauriGlobal ||
          tauriDetection.hasTauriAPI;

        // Comprehensive debug logging
        console.log('🔍 === ENVIRONMENT ANALYSIS RESULTS ===');
        console.log('📱 Platform Detection Results:');
        console.log('  - macOS:', platformInfo.isMac);
        console.log('  - Apple Silicon:', platformInfo.isAppleSilicon);
        console.log('  - Intel Mac:', platformInfo.isIntel);
        console.log('🖥️ Tauri Detection Results:');
        console.log('  - Global Objects:', tauriDetection.hasTauriGlobal);
        console.log('  - Protocol Match:', tauriDetection.hasTauriProtocol);
        console.log('  - User Agent:', tauriDetection.hasTauriUA);
        console.log('  - API Available:', tauriDetection.hasTauriAPI);
        console.log('  - Plugin Import:', tauriDetection.hasTauriPlugin);
        console.log('✅ FINAL RESULT - Is Tauri App:', isTauri);
        console.log('🔥 CRITICAL - Will show BLUE if true, RED if false!');
        console.log('=========================================');

        // Make debug info available globally for support
        window.__DEBUG_INFO__ = {
          timestamp: new Date().toISOString(),
          appVersion: APP_VERSION,
          platformInfo,
          tauriDetection,
          isTauri,
          getCurrentState: () => ({
            showWarning,
            blockerInfo,
            isChecking,
            dismissed,
            isTauriApp,
          }),
        };

        // Add helper function for users to copy debug info
        window.getDebugInfo = () => {
          const debugInfo = JSON.stringify(window.__DEBUG_INFO__, null, 2);
          console.log('📋 Copy this debug information:');
          console.log(debugInfo);
          navigator.clipboard
            ?.writeText(debugInfo)
            .then(() => {
              console.log('✅ Debug info copied to clipboard!');
            })
            .catch(() => {
              console.log('❌ Could not copy to clipboard, please copy manually from above');
            });
          return debugInfo;
        };

        console.log('💡 To get debug info for support, type: getDebugInfo() in console');

        setIsTauriApp(isTauri);

        // Force connection problem message in Tauri apps
        if (isTauri) {
          console.log('🖥️ *** TAURI DESKTOP APP DETECTED ***');
          console.log('🔧 Overriding ad blocker detection for desktop environment');
          console.log('📡 Testing API connectivity for desktop app...');

          // Test API connectivity but always treat as connection issue, not ad blocker
          let hasConnectionIssue = false;
          try {
            const testResult = await AdBlockerDetection.testApiRequest();
            hasConnectionIssue = testResult; // testApiRequest returns true if blocked
            console.log(
              '🌐 API Test Result:',
              hasConnectionIssue ? '❌ CONNECTION BLOCKED' : '✅ CONNECTION OK'
            );
          } catch (error) {
            console.log('❌ API connectivity test failed:', error.message);
            hasConnectionIssue = true;
          }

          if (hasConnectionIssue) {
            console.log('📡 *** DISPLAYING BLUE CONNECTION PROBLEM WARNING ***');
            console.log('💙 Color: BLUE (Connection Issue) - NOT Red (Ad Blocker)');
            setBlockerInfo({ isBlocked: true, blockerType: 'Connection Problem' });
            setShowWarning(true);
          } else {
            console.log('✅ No connection issues detected in Tauri app');
            setShowWarning(false);
          }

          setIsChecking(false);
          return;
        }

        // Web browser logic (not Tauri)
        console.log('🌐 Web browser detected - checking for ad blockers');

        // Detect if Brave browser (but still run full detection)
        const isBrave =
          navigator.userAgent.includes('Brave') ||
          (navigator.brave && (await navigator.brave.isBrave().catch(() => false)));

        if (isBrave) {
          console.log('🛡️ Brave browser detected - testing if Shield is actually blocking...');
        }

        // Full ad blocker detection for all browsers (including Brave)
        const result = await AdBlockerDetection.detectAdBlocker();

        // If Brave and blocking detected, specify Brave Shield as the cause
        if (isBrave && result.isBlocked) {
          result.blockerType = 'Brave Shield';
        }
        console.log('🚫 Ad blocker detection result:', result);
        console.log('ℹ️ Note: App functionality is NOT affected by ad-block detection');

        setBlockerInfo(result);
        setShowWarning(result.isBlocked);

        if (result.isBlocked) {
          console.log('✅ App will continue working normally - this is informational only');
        }
      } catch (error) {
        console.error('❌ Ad blocker detection error:', error);
        console.log('🔧 Error details - isTauri state:', isTauri);

        // Fallback logic - use the detected isTauri value from above
        if (isTauri) {
          console.log('📡 Error in Tauri app - showing connection problem');
          setBlockerInfo({ isBlocked: true, blockerType: 'Connection Problem' });
          setShowWarning(true);
        } else if (navigator.userAgent.includes('Brave')) {
          console.log('🛡️ Error in Brave browser - showing Shield warning');
          setBlockerInfo({ isBlocked: true, blockerType: 'Brave Shield' });
          setShowWarning(true);
        } else {
          console.log('🌐 Error in web browser - showing generic ad blocker warning');
          setBlockerInfo({ isBlocked: true, blockerType: 'Ad Blocker' });
          setShowWarning(true);
        }
      } finally {
        setIsChecking(false);
      }
    };

    // Check immediately with enhanced logging
    checkAdBlocker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  if (!showWarning || dismissed || isChecking) {
    return null;
  }

  const instructions = AdBlockerDetection.getDisableInstructions(blockerInfo.blockerType);

  const isBraveShield = blockerInfo.blockerType === 'Brave Shield';
  const isConnectionProblem = blockerInfo.blockerType === 'Connection Problem';

  // Color scheme based on issue type
  const colorClass = isConnectionProblem
    ? 'bg-blue-600'
    : isBraveShield
      ? 'bg-orange-600'
      : 'bg-red-600';
  const textColorClass = isConnectionProblem
    ? 'text-blue-100'
    : isBraveShield
      ? 'text-orange-100'
      : 'text-red-100';
  const buttonColorClass = isConnectionProblem
    ? 'bg-blue-700 hover:bg-blue-800'
    : isBraveShield
      ? 'bg-orange-700 hover:bg-orange-800'
      : 'bg-red-700 hover:bg-red-800';

  return (
    <div className={`fixed top-0 left-0 right-0 ${colorClass} text-white px-4 py-3 shadow-lg z-50`}>
      <div className="max-w-4xl mx-auto flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{instructions.icon}</span>
          <div>
            <h3 className="font-bold text-lg mb-1">
              {isConnectionProblem
                ? '📡 Connection Problem'
                : isBraveShield
                  ? '🛡️ Brave Shield Active'
                  : `${blockerInfo.blockerType} Detected`}
            </h3>
            <p className={`${textColorClass} mb-2 font-medium`}>
              {isConnectionProblem
                ? '⚠️ The OpenSubtitles uploader is having trouble connecting to the API servers. Please check your internet connection.'
                : isBraveShield
                  ? '⚠️ IMPORTANT: Brave Shield is blocking OpenSubtitles API requests. The uploader will not work until you disable it for this site.'
                  : `The OpenSubtitles uploader requires API access to function properly. Your ${blockerInfo.blockerType || 'ad blocker'} is blocking necessary requests.`}
            </p>
            <div className={`text-sm ${textColorClass}`}>
              <p className="font-semibold mb-1">{instructions.title}:</p>
              <ul className="list-none space-y-1">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">▶</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
              {isBraveShield && (
                <p className="mt-2 font-semibold text-orange-200">
                  💡 Tip: You can also add "uploader.opensubtitles.org" to your Brave Shield
                  exceptions.
                </p>
              )}
              {isConnectionProblem && (
                <p className="mt-2 font-semibold text-blue-200">
                  💡 This is a desktop application - network connectivity issues are usually
                  temporary.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => window.location.reload()}
            className={`${buttonColorClass} text-white px-3 py-1 rounded text-sm font-medium transition-colors`}
            title={
              isConnectionProblem ? 'Restart application' : 'Refresh page after disabling blocker'
            }
          >
            {isConnectionProblem ? '🔄 Restart' : '🔄 Refresh'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className={`${buttonColorClass} text-white px-3 py-1 rounded text-sm font-medium transition-colors`}
            title="Dismiss this warning"
          >
            ✕ Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdBlockerWarning;
