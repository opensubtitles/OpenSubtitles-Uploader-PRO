/**
 * Unified Session Detection Utility
 *
 * This utility provides a single, consistent way to detect OpenSubtitles
 * session IDs from multiple sources, preventing authentication mismatches
 * between different parts of the application.
 */

import { hideSensitiveData, logSensitiveData } from './securityUtils.js';

/**
 * Utility to safely read cookies
 * @param {string} name - Cookie name to read
 * @returns {string|null} Cookie value or null if not found
 */
export const getCookie = name => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop().split(';').shift();
      return cookieValue || null;
    }
    return null;
  } catch (error) {
    console.warn(`🍪 Failed to read cookie ${name}:`, error.message);
    return null;
  }
};

/**
 * Utility to safely read localStorage
 * @param {string} key - localStorage key to read
 * @returns {string|null} Value or null if not found
 */
export const getStorageItem = key => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`💾 Failed to read localStorage ${key}:`, error.message);
    return null;
  }
};

/**
 * Utility to safely read URL parameters
 * @param {string} param - URL parameter name to read
 * @returns {string|null} Parameter value or null if not found
 */
export const getUrlParam = param => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  } catch (error) {
    console.warn(`🔗 Failed to read URL parameter ${param}:`, error.message);
    return null;
  }
};

/**
 * The one localStorage key that counts as "logged in". Exported so other
 * modules bind to it rather than re-typing the string and drifting apart.
 */
export const SESSION_TOKEN_KEY = 'opensubtitles_token';

/**
 * Session Source Types (for tracking where session came from)
 */
export const SessionSource = {
  URL_PARAMETER: 'url_parameter',
  STORED_TOKEN: 'stored_token',
  REMEMBER_SID_COOKIE: 'remember_sid_cookie',
  PHPSESSID_COOKIE: 'phpsessid_cookie',
  NONE: 'none',
};

/**
 * Unified session detection with priority handling
 *
 * Priority order:
 * 1. URL parameter 'sid' (highest priority - fresh from OpenSubtitles.org)
 * 2. Stored token in localStorage (previously validated session)
 * 3. remember_sid cookie (persistent login from OpenSubtitles.org)
 * 4. PHPSESSID cookie (active session from OpenSubtitles.org)
 *
 * @returns {Object} Session detection result
 */
export const detectSession = () => {
  const result = {
    sessionId: null,
    source: SessionSource.NONE,
    debug: {
      urlSid: null,
      storedToken: null,
      rememberSid: null,
      phpSessId: null,
      timestamp: new Date().toISOString(),
    },
  };

  // 1. Check URL parameter (highest priority)
  const urlSid = getUrlParam('sid');
  result.debug.urlSid = hideSensitiveData(urlSid, 'session');

  if (urlSid) {
    result.sessionId = urlSid;
    result.source = SessionSource.URL_PARAMETER;
    logSensitiveData('🔍 Session detected from URL parameter', urlSid, 'session');
    return result;
  }

  // 2. Check stored token in localStorage
  const storedToken = getStorageItem(SESSION_TOKEN_KEY);
  result.debug.storedToken = hideSensitiveData(storedToken, 'session');

  if (storedToken) {
    result.sessionId = storedToken;
    result.source = SessionSource.STORED_TOKEN;
    logSensitiveData('🔍 Session detected from stored token', storedToken, 'session');
    return result;
  }

  // 3. Check remember_sid cookie (persistent login)
  const rememberSid = getCookie('remember_sid');
  result.debug.rememberSid = hideSensitiveData(rememberSid, 'session');

  if (rememberSid) {
    result.sessionId = rememberSid;
    result.source = SessionSource.REMEMBER_SID_COOKIE;
    logSensitiveData('🔍 Session detected from remember_sid cookie', rememberSid, 'session');
    return result;
  }

  // 4. Check PHPSESSID cookie (active session)
  const phpSessId = getCookie('PHPSESSID');
  result.debug.phpSessId = hideSensitiveData(phpSessId, 'session');

  if (phpSessId) {
    result.sessionId = phpSessId;
    result.source = SessionSource.PHPSESSID_COOKIE;
    logSensitiveData('🔍 Session detected from PHPSESSID cookie', phpSessId, 'session');
    return result;
  }

  // No session found - normal for first-time users
  return result;
};

/**
 * Get detailed session information for debugging
 * @returns {Object} Comprehensive session debug info
 */
export const getSessionDebugInfo = () => {
  const detection = detectSession();

  return {
    ...detection,
    hasCookies: document.cookie.length > 0,
    localStorage: {
      token: hideSensitiveData(getStorageItem(SESSION_TOKEN_KEY), 'token'),
      hasUserData: !!getStorageItem('opensubtitles_user_data'),
      loginTime: getStorageItem('opensubtitles_login_time'),
    },
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Validate if a session ID looks like a valid OpenSubtitles session
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if session ID format looks valid
 */
export const isValidSessionFormat = sessionId => {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  // OpenSubtitles session IDs are typically 20+ characters alphanumeric
  const sessionPattern = /^[a-zA-Z0-9]{20,}$/;
  return sessionPattern.test(sessionId);
};

/**
 * Log comprehensive session detection information
 * @param {string} context - Context where this is being called from
 */
export const logSessionDetection = (context = 'Unknown') => {
  const info = getSessionDebugInfo();

  // Only log session detection if a session was found
  if (info.sessionId && info.sessionId !== 'none') {
    logSensitiveData(`🔍 Session detected from ${info.source}`, info.sessionId, 'session');
  }

  return info;
};
