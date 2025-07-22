/**
 * Session ID management service
 * Handles secure session ID storage and URL cleanup
 */

const SESSION_STORAGE_KEY = 'opensubtitles_session_id';

export class SessionManager {
  /**
   * Capture session ID from URL parameter and store it securely
   * Then redirect to clean URL without session ID
   */
  static initializeSession() {
    console.log('🔐 SessionManager: Initializing session...');
    console.log(`🔐 SessionManager: Current URL: ${window.location.href}`);
    console.log(`🔐 SessionManager: URL search params: ${window.location.search}`);
    
    const urlParams = new URLSearchParams(window.location.search);
    const sidParam = urlParams.get('sid');
    
    console.log(`🔐 SessionManager: SID parameter found: ${!!sidParam}`);
    if (sidParam) {
      console.log(`🔐 SessionManager: ✅ Capturing session ID from URL: ${sidParam.substring(0, 8)}...`);
      console.log(`🔐 SessionManager: SID length: ${sidParam.length} chars`);
      
      // Store the session ID securely
      this.storeSessionId(sidParam);
      
      // Remove sid parameter from URL and redirect
      urlParams.delete('sid');
      const cleanUrl = window.location.pathname + 
        (urlParams.toString() ? '?' + urlParams.toString() : '');
      
      console.log(`🔐 SessionManager: Redirecting to clean URL: ${cleanUrl}`);
      // Use replaceState to avoid adding to browser history
      window.history.replaceState({}, document.title, cleanUrl);
      
      return sidParam;
    } else {
      console.log('🔐 SessionManager: No SID parameter in URL');
      console.log('🔐 SessionManager: Checking existing stored session...');
      const existing = this.getStoredSessionId();
      if (existing) {
        console.log(`🔐 SessionManager: Found existing stored session: ${existing.substring(0, 8)}...`);
      } else {
        console.log('🔐 SessionManager: No existing stored session');
      }
    }
    
    return null;
  }
  
  /**
   * Store session ID in localStorage permanently
   * @param {string} sessionId - The session ID to store
   */
  static storeSessionId(sessionId) {
    try {
      console.log(`🔐 SessionManager: Storing session ID: ${sessionId.substring(0, 8)}...`);
      console.log(`🔐 SessionManager: Storage key: ${SESSION_STORAGE_KEY}`);
      
      // Store session ID permanently
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      
      // Verify storage worked
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      console.log(`🔐 SessionManager: ✅ Session ID stored successfully - Verification: ${stored === sessionId}`);
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
      console.log(`🔐 SessionManager: Retrieving stored session ID from key: ${SESSION_STORAGE_KEY}`);
      const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      console.log(`🔐 SessionManager: Retrieved session ID: ${sessionId ? sessionId.substring(0, 8) + '...' : 'null'}`);
      console.log(`🔐 SessionManager: Session ID length: ${sessionId ? sessionId.length : 0} chars`);
      return sessionId || null;
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
      localStorage.removeItem(SESSION_STORAGE_KEY);
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
    const sessionId = this.getStoredSessionId();
    return sessionId !== null;
  }
  
  /**
   * Get session info for debugging
   * @returns {Object} - Session information
   */
  static getSessionInfo() {
    const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    
    return {
      hasSessionId: !!sessionId,
      sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : null, // Truncated for security
      isValid: this.isSessionValid()
    };
  }
}