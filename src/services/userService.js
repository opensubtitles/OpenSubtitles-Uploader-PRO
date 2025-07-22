import { XmlRpcService } from './api/xmlrpc.js';
import { SessionManager } from './sessionManager.js';

/**
 * User session service for OpenSubtitles authentication
 */
export class UserService {
  
  /**
   * Get session ID from stored session, cookie, or empty fallback
   * Uses secure session storage instead of URL parameter
   * @returns {string} - Session ID or empty string
   */
  static getSessionId() {
    console.log('👤 UserService getSessionId: Starting session lookup...');
    
    // First priority: Check for stored session ID (from URL capture)
    const storedSessionId = SessionManager.getStoredSessionId();
    console.log(`👤 UserService getSessionId: Stored session ID check - Found: ${!!storedSessionId}`);
    if (storedSessionId) {
      console.log(`👤 UserService getSessionId: ✅ Using stored session ID: ${storedSessionId.substring(0, 8)}...`);
      return storedSessionId;
    }
    
    // Second priority: Get PHPSESSID cookie value
    console.log('👤 UserService getSessionId: Checking PHPSESSID cookie...');
    console.log(`👤 UserService getSessionId: Full document.cookie: ${document.cookie}`);
    const cookies = document.cookie.split(';');
    
    const phpSessionCookie = cookies.find(cookie => 
      cookie.trim().startsWith('PHPSESSID=')
    );
    
    console.log(`👤 UserService getSessionId: PHPSESSID cookie found: ${!!phpSessionCookie}`);
    if (phpSessionCookie) {
      const sessionId = phpSessionCookie.split('=')[1].trim();
      console.log(`👤 UserService getSessionId: ✅ Using PHPSESSID: ${sessionId}`);
      return sessionId;
    }
    
    // Third priority: Try remember_sid cookie (not httpOnly)
    console.log('👤 UserService getSessionId: Checking remember_sid cookie...');
    const rememberSidCookie = cookies.find(cookie => 
      cookie.trim().startsWith('remember_sid=')
    );
    
    console.log(`👤 UserService getSessionId: remember_sid cookie found: ${!!rememberSidCookie}`);
    if (rememberSidCookie) {
      const sessionId = rememberSidCookie.split('=')[1].trim();
      console.log(`👤 UserService getSessionId: ✅ Using remember_sid: ${sessionId}`);
      return sessionId;
    }
    
    // Fallback: empty token
    console.log('👤 UserService getSessionId: ❌ No session ID found anywhere - returning empty');
    return '';
  }
  
  /**
   * Get user info using XML-RPC GetUserInfo
   * @param {string} sessionId - Session ID (unused now, using token from XmlRpcService)
   * @param {Function} addDebugInfo - Debug callback (optional)
   * @returns {Promise<Object>} - User info object
   */
  static async getUserInfo(sessionId, addDebugInfo = null) {
    try {
      if (addDebugInfo) {
        addDebugInfo(`👤 Fetching user info via XML-RPC GetUserInfo`);
      }
      
      const userData = await XmlRpcService.getUserInfo();
      
      if (userData === null) {
        // User is not logged in (401 response handled gracefully)
        if (addDebugInfo) {
          addDebugInfo(`👤 User is not logged in`);
        }
        return null;
      }
      
      if (addDebugInfo) {
        addDebugInfo(`✅ User info loaded: ${userData?.UserNickName || 'Unknown'}`);
      }
      
      return userData;
      
    } catch (error) {
      if (addDebugInfo) {
        addDebugInfo(`❌ Failed to get user info via XML-RPC: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Extract username from XML-RPC GetUserInfo response
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {string} - Username or 'Anonymous'
   */
  static getUsername(userInfo) {
    return userInfo?.UserNickName || 'Anonymous';
  }
  
  /**
   * Check if user is logged in
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {boolean} - True if user is logged in
   */
  static isLoggedIn(userInfo) {
    return !!(userInfo?.UserNickName && userInfo?.IDUser);
  }
  
  /**
   * Get user's preferred languages
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {string} - Comma-separated language codes
   */
  static getPreferredLanguages(userInfo) {
    return userInfo?.UserPreferedLanguages || '';
  }
  
  /**
   * Get user's rank/role
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {string} - User rank
   */
  static getUserRank(userInfo) {
    return userInfo?.UserRank || '';
  }
  
  /**
   * Get user's upload count
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {number} - Upload count
   */
  static getUploadCount(userInfo) {
    return parseInt(userInfo?.UploadCnt) || 0;
  }
  
  /**
   * Get user's download count
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {number} - Download count
   */
  static getDownloadCount(userInfo) {
    return parseInt(userInfo?.DownloadCnt) || 0;
  }
}