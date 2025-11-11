/**
 * Utility functions for retry logic
 */
import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {number} maxAttempts - Maximum number of attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: from settings)
 * @param {Function} onAttempt - Callback for each attempt
 * @returns {Promise} - Result of the function or throws after all attempts fail
 */
export const retryAsync = async (
  fn,
  maxAttempts = 3,
  baseDelay = DEFAULT_SETTINGS.RETRY_BASE_DELAY,
  onAttempt = null
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (onAttempt) {
        onAttempt(attempt, maxAttempts);
      }

      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        // Last attempt failed, throw the error
        throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${error.message}`);
      }

      // Wait before retrying with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Create a retry wrapper for a specific function
 * @param {Function} fn - The function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} - Wrapped function with retry logic
 */
export const createRetryWrapper = (fn, options = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = DEFAULT_SETTINGS.RETRY_BASE_DELAY,
    onAttempt = null,
    onSuccess = null,
    onFailure = null,
  } = options;

  return async (...args) => {
    try {
      const result = await retryAsync(() => fn(...args), maxAttempts, baseDelay, onAttempt);

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      if (onFailure) {
        onFailure(error);
      }
      throw error;
    }
  };
};

/**
 * Retry states for tracking
 */
export const RETRY_STATES = {
  IDLE: 'idle',
  ATTEMPTING: 'attempting',
  SUCCESS: 'success',
  FAILED: 'failed',
};
