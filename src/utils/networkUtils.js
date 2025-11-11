import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Network utilities for managing request timing and rate limiting
 */

// Track the last network request time globally
let lastRequestTime = 0;

/**
 * Ensure minimum delay between network requests
 * @param {number} customDelay - Custom delay in ms (optional)
 * @returns {Promise} - Resolves after ensuring proper delay
 */
export const ensureNetworkDelay = async (customDelay = DEFAULT_SETTINGS.NETWORK_REQUEST_DELAY) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < customDelay) {
    const waitTime = customDelay - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

/**
 * Wrapper for fetch that includes automatic delay
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} delay - Custom delay in ms (optional)
 * @param {Function} addDebugInfo - Debug callback (optional)
 * @returns {Promise<Response>} - Fetch response
 */
export const delayedFetch = async (
  url,
  options = {},
  delay = DEFAULT_SETTINGS.NETWORK_REQUEST_DELAY,
  addDebugInfo = null
) => {
  const timing = getNetworkTiming();

  if (addDebugInfo && timing.timeSinceLastRequest < delay) {
    const waitTime = delay - timing.timeSinceLastRequest;
    addDebugInfo(`Network delay: waiting ${waitTime}ms before request to ${url}`);
  }

  await ensureNetworkDelay(delay);

  if (addDebugInfo) {
    addDebugInfo(`Making network request to: ${url}`);
  }

  try {
    const response = await fetch(url, options);

    if (addDebugInfo) {
      addDebugInfo(`Network request completed: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    if (addDebugInfo) {
      addDebugInfo(`❌ Network request failed: ${error.name} - ${error.message}`);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addDebugInfo(
          `❌ This is likely a network connectivity issue (DNS, connection timeout, etc.)`
        );
      }
    }

    // Log network error details to console for debugging
    console.error('🌐 Network Request Failed:', {
      url,
      error: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
};

/**
 * Create a delayed version of any async function
 * @param {Function} asyncFn - The async function to wrap
 * @param {number} delay - Delay in ms
 * @returns {Function} - Wrapped function with delay
 */
export const withNetworkDelay = (asyncFn, delay = DEFAULT_SETTINGS.NETWORK_REQUEST_DELAY) => {
  return async (...args) => {
    await ensureNetworkDelay(delay);
    return asyncFn(...args);
  };
};

/**
 * Get network timing info for debugging
 * @returns {Object} - Timing information
 */
export const getNetworkTiming = () => {
  return {
    lastRequestTime,
    timeSinceLastRequest: Date.now() - lastRequestTime,
    nextAllowedTime: lastRequestTime + DEFAULT_SETTINGS.NETWORK_REQUEST_DELAY,
  };
};

/**
 * Reset network timing (useful for testing)
 */
export const resetNetworkTiming = () => {
  lastRequestTime = 0;
};
