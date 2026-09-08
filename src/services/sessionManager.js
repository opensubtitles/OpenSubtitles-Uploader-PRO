/**
 * Session ID management service
 * Handles secure session ID storage and URL cleanup
 */

import { hideSensitiveData, logSensitiveData } from '../utils/securityUtils.js';
import { SESSION_TOKEN_KEY } from '../utils/sessionUtils.js';

/**
 * Legacy key. This used to be the store, but `detectSession` never read it, so
 * it was write-only: a session id sitting on disk forever that nothing could
 * use, and that no expiry path ever pruned. Kept only so existing installs get
 * it deleted.
 */
const LEGACY_SESSION_STORAGE_KEY = 'opensubtitles_session_id';

export class SessionManager {
  /**
   * Capture session ID from URL parameter and store it securely
   * Then redirect to clean URL without session ID
   */
  static initializeSession() {
    this.purgeLegacyStorage();

    const urlParams = new URLSearchParams(window.location.search);
    const sidParam = urlParams.get('sid');

    if (sidParam) {
      logSensitiveData('🔐 SessionManager: ✅ Capturing session ID from URL', sidParam, 'session');

      // Store before stripping the URL. This is the handoff: once the `sid` is
      // gone from the address bar, storage is the only remaining copy.
      this.storeSessionId(sidParam);

      // Remove sid parameter from URL and redirect
      urlParams.delete('sid');
      const cleanUrl =
        window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');

      console.log(`🔐 SessionManager: Redirecting to clean URL: ${cleanUrl}`);
      // Use replaceState to avoid adding to browser history
      window.history.replaceState({}, document.title, cleanUrl);

      return sidParam;
    } else {
      // Silently check for existing session
      const existing = this.getStoredSessionId();
      if (existing) {
        logSensitiveData('🔐 SessionManager: ✅ Using existing stored session', existing, 'session');
      }
    }

    return null;
  }

  /**
   * Delete the orphaned pre-existing key from installs that still carry it.
   */
  static purgeLegacyStorage() {
    try {
      if (localStorage.getItem(LEGACY_SESSION_STORAGE_KEY) !== null) {
        localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
        console.log('🔐 SessionManager: Removed orphaned legacy session key');
      }
    } catch (error) {
      console.error('🔐 SessionManager: Failed to remove legacy session key:', error);
    }
  }

  /**
   * Store session ID under the key the rest of the app actually reads.
   * @param {string} sessionId - The session ID to store
   */
  static storeSessionId(sessionId) {
    try {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionId);

      // Verify storage worked
      const stored = localStorage.getItem(SESSION_TOKEN_KEY);
      console.log(
        `🔐 SessionManager: ✅ Session ID stored successfully - Verification: ${stored === sessionId}`
      );
    } catch (error) {
      console.error('🔐 SessionManager: ❌ Failed to store session ID:', error);
    }
  }

  /**
   * Retrieve stored session ID
   * @returns {string|null} - The session ID or null if not available
   */
  static getStoredSessionId() {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY) || null;
    } catch (error) {
      console.error('🔐 SessionManager: ❌ Failed to retrieve session ID:', error);
      return null;
    }
  }

  /**
   * Clear stored session data
   */
  static clearStoredSession() {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      this.purgeLegacyStorage();
      console.log('SessionManager: Stored session cleared');
    } catch (error) {
      console.error('SessionManager: Failed to clear session:', error);
    }
  }

  /**
   * Check if session is valid
   * @returns {boolean} - True if session is valid
   */
  static isSessionValid() {
    return this.getStoredSessionId() !== null;
  }

  /**
   * Get session info for debugging
   * @returns {Object} - Session information
   */
  static getSessionInfo() {
    const sessionId = this.getStoredSessionId();

    return {
      hasSessionId: !!sessionId,
      sessionId: hideSensitiveData(sessionId, 'session'),
      isValid: this.isSessionValid(),
    };
  }
}
