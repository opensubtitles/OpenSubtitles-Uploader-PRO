/**
 * Ad blocker and Brave Shield detection utility
 */

export class AdBlockerDetection {
  static isBlocked = false;
  static blockerType = null;
  static detectionComplete = false;

  /**
   * Detect if ad blockers or Brave Shield are blocking requests
   */
  static async detectAdBlocker() {
    if (this.detectionComplete) {
      return { isBlocked: this.isBlocked, blockerType: this.blockerType };
    }

    try {
      // Method 1: Test a known tracking URL that ad blockers typically block
      const testUrls = [
        'https://google-analytics.com/analytics.js',
        'https://www.googletagmanager.com/gtm.js',
        'https://connect.facebook.net/en_US/sdk.js'
      ];

      // Method 2: Check for Brave browser specifically
      const isBrave = await this.detectBrave();
      
      // Method 3: Test actual API request with short timeout
      const apiBlocked = await this.testApiRequest();

      // Try to fetch a test tracking script
      let trackerBlocked = false;
      try {
        const response = await fetch(testUrls[0], { 
          method: 'HEAD',
          mode: 'no-cors',
          timeout: 2000 
        });
      } catch (error) {
        trackerBlocked = true;
      }

      // Determine blocker type
      if (apiBlocked || trackerBlocked) {
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
      }

      this.detectionComplete = true;
      return { isBlocked: this.isBlocked, blockerType: this.blockerType };

    } catch (error) {
      console.warn('Ad blocker detection failed:', error);
      this.detectionComplete = true;
      return { isBlocked: false, blockerType: null };
    }
  }

  /**
   * Test if API requests are being blocked
   */
  static async testApiRequest() {
    try {
      // Test the actual API with a quick request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('https://api.opensubtitles.com/api/v1/utilities/fasttext/language/supported', {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'Api-Key': 'test' // Use dummy key for test
        }
      });

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
      if (navigator.brave && await navigator.brave.isBrave()) {
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
    return window.getComputedStyle && 
           getComputedStyle(document.body).getPropertyValue('-webkit-appearance') !== '' &&
           document.createElement('div').id === '';
  }

  /**
   * Detect uBlock Origin
   */
  static detectUBlock() {
    return typeof window.uBlock !== 'undefined' || 
           document.querySelector('script[src*="ublock"]') !== null;
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
          '3. Refresh the page'
        ],
        icon: '🛡️'
      },
      'AdBlock Plus': {
        title: 'Disable AdBlock Plus',
        steps: [
          '1. Click the AdBlock Plus icon in your browser toolbar',
          `2. Click "Enabled on this site" to disable it for ${domain}`,
          '3. Refresh the page'
        ],
        icon: '🚫'
      },
      'uBlock Origin': {
        title: 'Disable uBlock Origin',
        steps: [
          '1. Click the uBlock Origin icon in your browser toolbar',
          '2. Click the large power button to disable filtering',
          '3. Refresh the page'
        ],
        icon: '🔴'
      },
      'Ad Blocker': {
        title: 'Disable Ad Blocker',
        steps: [
          '1. Click your ad blocker icon in the browser toolbar',
          `2. Disable it for ${domain} or pause protection`,
          '3. Refresh the page'
        ],
        icon: '🚫'
      },
      'Connection Problem': {
        title: 'Connection Issue',
        steps: [
          '1. Check your internet connection',
          '2. Try restarting the application',
          '3. If the problem persists, check firewall settings',
          '4. Contact support if the issue continues'
        ],
        icon: '📡'
      }
    };

    return instructions[blockerType] || instructions['Ad Blocker'];
  }
}