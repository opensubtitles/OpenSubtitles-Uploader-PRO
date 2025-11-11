/**
 * Ad blocker and Brave Shield detection utility
 *
 * This utility detects ad-blockers using multiple methods:
 * 1. Bait element method (browser-only) - creates fake ad elements and checks if they're hidden
 * 2. Network request testing - tests if API calls are blocked
 * 3. Browser-specific detection - identifies Brave Shield, uBlock Origin, etc.
 *
 * Key Features:
 * - Only runs detection in web browsers, skips desktop apps (Tauri)
 * - Uses non-intrusive bait element method with proper cleanup
 * - Differentiates between ad-blockers vs network connectivity issues
 * - Does NOT prevent app functionality - detection is informational only
 *
 * Addresses Issue #1: False ad-block detection due to network restrictions
 */

export class AdBlockerDetection {
  static isBlocked = false;
  static blockerType = null;
  static detectionComplete = false;

  /**
   * Check if app is running in a web browser (not Tauri desktop)
   */
  static isWebBrowser() {
    return (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      window.location.protocol !== 'tauri:'
    );
  }

  /**
   * Detect if ad blockers or Brave Shield are blocking requests
   */
  static async detectAdBlocker() {
    if (this.detectionComplete) {
      return { isBlocked: this.isBlocked, blockerType: this.blockerType };
    }

    try {
      // Only run detection in web browsers, not in Tauri desktop app
      if (!this.isWebBrowser()) {
        console.log('🖥️ Running in desktop app - skipping ad-block detection');
        this.detectionComplete = true;
        return { isBlocked: false, blockerType: null };
      }

      console.log('🌐 Running in web browser - performing ad-block detection');

      // Method 1: Bait element test (most reliable for browser extensions)
      const baitElementBlocked = await this.detectWithBaitElement();

      // Method 2: Check for Brave browser specifically
      const isBrave = await this.detectBrave();

      // Method 3: Test actual API request with short timeout (for network issues)
      const apiBlocked = await this.testApiRequest();

      console.log('🔍 Detection results:', {
        baitElementBlocked,
        isBrave,
        apiBlocked,
      });

      // Determine blocker type based on detection results
      // Fix for Issue #1: Only show ad-blocker warnings for actual browser extension blocking
      if (baitElementBlocked) {
        this.isBlocked = true;
        if (isBrave) {
          this.blockerType = 'Brave Shield';
        } else if (this.detectAdBlockPlus()) {
          this.blockerType = 'AdBlock Plus';
        } else if (this.detectUBlock()) {
          this.blockerType = 'uBlock Origin';
        } else {
          this.blockerType = 'Ad Blocker';
        }
      } else if (apiBlocked) {
        // API blocked but not bait element - likely network/DNS/firewall issue
        // Issue #1 Fix: Don't show warning for network-level blocking
        console.log(
          'ℹ️ Network-level blocking detected (not browser ad-blocker) - no warning shown'
        );
        this.isBlocked = false; // Don't trigger warning for network issues
        this.blockerType = null;
      }

      this.detectionComplete = true;

      // Log the result but don't interfere with app functionality
      console.log('🚫 Ad-block detection complete:', {
        isBlocked: this.isBlocked,
        blockerType: this.blockerType,
        note: 'App will continue working normally regardless',
      });

      return { isBlocked: this.isBlocked, blockerType: this.blockerType };
    } catch (error) {
      console.warn('Ad blocker detection failed:', error);
      this.detectionComplete = true;
      return { isBlocked: false, blockerType: null };
    }
  }

  /**
   * Detect ad-blocker using bait element method (browser-only)
   */
  static async detectWithBaitElement() {
    if (!this.isWebBrowser()) {
      return false;
    }

    return new Promise(resolve => {
      try {
        // Create a bait element that looks like an ad
        const bait = document.createElement('div');
        bait.innerHTML = '&nbsp;';
        bait.className = 'adsbox ad-banner advertisement ads google-ad';
        bait.style.cssText = `
          position: absolute !important;
          left: -999px !important;
          top: -999px !important;
          width: 1px !important;
          height: 1px !important;
          opacity: 0 !important;
          pointer-events: none !important;
        `;

        // Add to DOM
        document.body.appendChild(bait);

        // Check if it's been blocked after a short delay
        setTimeout(() => {
          try {
            const isHidden =
              bait.offsetHeight === 0 ||
              bait.offsetWidth === 0 ||
              getComputedStyle(bait).display === 'none' ||
              getComputedStyle(bait).visibility === 'hidden' ||
              bait.style.display === 'none';

            // Cleanup
            if (document.body.contains(bait)) {
              document.body.removeChild(bait);
            }

            resolve(isHidden);
          } catch (cleanupError) {
            console.warn('Bait element cleanup error:', cleanupError);
            resolve(false);
          }
        }, 100);
      } catch (error) {
        console.warn('Bait element detection failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Test if API requests are being blocked
   */
  static async testApiRequest() {
    try {
      // Test the actual API with a quick request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(
        'https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported',
        {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'Api-Key': 'test', // Use dummy key for test
          },
        }
      );

      clearTimeout(timeoutId);
      return false; // Not blocked if we get any response
    } catch (error) {
      if (error.name === 'AbortError') {
        return true; // Likely blocked if timeout
      }
      return error.message.includes('blocked') || error.message.includes('ERR_BLOCKED');
    }
  }

  /**
   * Detect Brave browser
   */
  static async detectBrave() {
    try {
      // Brave has navigator.brave API
      if (navigator.brave && (await navigator.brave.isBrave())) {
        return true;
      }
    } catch (error) {
      // Ignore errors
    }

    // Fallback: Check user agent
    return navigator.userAgent.includes('Brave');
  }

  /**
   * Detect AdBlock Plus
   */
  static detectAdBlockPlus() {
    return (
      window.getComputedStyle &&
      getComputedStyle(document.body).getPropertyValue('-webkit-appearance') !== '' &&
      document.createElement('div').id === ''
    );
  }

  /**
   * Detect uBlock Origin
   */
  static detectUBlock() {
    return (
      typeof window.uBlock !== 'undefined' ||
      document.querySelector('script[src*="ublock"]') !== null
    );
  }

  /**
   * Get instructions for disabling ad blocker
   */
  static getDisableInstructions(blockerType) {
    const domain = window.location.hostname;

    const instructions = {
      'Brave Shield': {
        title: 'Disable Brave Shield',
        steps: [
          '1. Click the Brave Shield icon (🛡️) in the address bar',
          `2. Turn off "Shields" for ${domain}`,
          '3. Refresh the page',
        ],
        icon: '🛡️',
      },
      'AdBlock Plus': {
        title: 'Disable AdBlock Plus',
        steps: [
          '1. Click the AdBlock Plus icon in your browser toolbar',
          `2. Click "Enabled on this site" to disable it for ${domain}`,
          '3. Refresh the page',
        ],
        icon: '🚫',
      },
      'uBlock Origin': {
        title: 'Disable uBlock Origin',
        steps: [
          '1. Click the uBlock Origin icon in your browser toolbar',
          '2. Click the large power button to disable filtering',
          '3. Refresh the page',
        ],
        icon: '🔴',
      },
      'Ad Blocker': {
        title: 'Disable Ad Blocker',
        steps: [
          '1. Click your ad blocker icon in the browser toolbar',
          `2. Disable it for ${domain} or pause protection`,
          '3. Refresh the page',
        ],
        icon: '🚫',
      },
      'Connection Problem': {
        title: 'Connection Issue',
        steps: [
          '1. Check your internet connection',
          '2. Try restarting the application',
          '3. If the problem persists, check firewall settings',
          '4. Contact support if the issue continues',
        ],
        icon: '📡',
      },
    };

    return instructions[blockerType] || instructions['Ad Blocker'];
  }
}
