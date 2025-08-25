import { XmlRpcService } from './api/xmlrpc.js';
import authService from './authService.js';
import { detectSession, logSessionDetection } from '../utils/sessionUtils.js';
import { logSensitiveData } from '../utils/securityUtils.js';

/**
 * User session service for OpenSubtitles authentication
 */
export class UserService {
  // Cache for getUserInfo responses (1 hour TTL)
  static _userInfoCache = new Map();
  static _cacheExpiry = 60 * 60 * 1000; // 1 hour in milliseconds
  
  /**
   * Clear expired cache entries
   * @private
   */
  static _cleanExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this._userInfoCache) {
      if (now > entry.expiresAt) {
        this._userInfoCache.delete(key);
        console.log('🗑️ Expired getUserInfo cache entry removed');
      }
    }
  }
  
  /**
   * Clear all getUserInfo cache entries
   * Call this when user logs out or authentication changes
   */
  static clearUserInfoCache() {
    const cacheSize = this._userInfoCache.size;
    this._userInfoCache.clear();
    if (cacheSize > 0) {
      console.log(`🗑️ Cleared ${cacheSize} getUserInfo cache entries`);
    }
  }
  
  /**
   * Get session ID using unified session detection
   * @returns {string} - Session ID or empty string
   */
  static getSessionId() {
    // Use unified session detection system
    const sessionDetection = logSessionDetection('UserService.getSessionId');
    
    if (sessionDetection.sessionId) {
      logSensitiveData(`👤 UserService: ✅ Using session from ${sessionDetection.source}`, sessionDetection.sessionId, 'session');
      return sessionDetection.sessionId;
    }
    
    console.log('👤 UserService: No session found, using empty string');
    return '';
  }
  
  /**
   * Get user info using XML-RPC GetUserInfo with 1-hour caching
   * @param {string} sessionId - Session ID (unused now, using token from XmlRpcService)
   * @param {Function} addDebugInfo - Debug callback (optional)
   * @param {boolean} bypassCache - Force bypass cache (optional, default: false)
   * @returns {Promise<Object>} - User info object
   */
  static async getUserInfo(sessionId, addDebugInfo = null, bypassCache = false) {
    try {
      // Clean expired cache entries first
      this._cleanExpiredCache();
      
      // Get current token for cache key
      const currentToken = authService.getToken() || sessionId || '';
      const cacheKey = currentToken;
      
      // Check cache if not bypassing
      if (!bypassCache && cacheKey && this._userInfoCache.has(cacheKey)) {
        const cachedEntry = this._userInfoCache.get(cacheKey);
        const now = Date.now();
        
        if (now < cachedEntry.expiresAt) {
          console.log(`📄 Using cached getUserInfo (${Math.round((cachedEntry.expiresAt - now) / 1000 / 60)}min remaining): ${cachedEntry.data?.UserNickName || 'Unknown'}`);
          
          if (addDebugInfo) {
            addDebugInfo(`📄 Used cached user info (${Math.round((cachedEntry.expiresAt - now) / 1000 / 60)}min remaining): ${cachedEntry.data?.UserNickName || 'Unknown'}`);
          }
          
          return cachedEntry.data;
        } else {
          // Expired cache entry
          this._userInfoCache.delete(cacheKey);
          console.log('🗑️ Removed expired cache entry');
        }
      }
      
      if (addDebugInfo) {
        addDebugInfo(`👤 Fetching fresh user info via XML-RPC GetUserInfo${bypassCache ? ' (cache bypassed)' : ''}`);
      }
      
      const userData = await XmlRpcService.getUserInfo();
      
      if (userData === null) {
        // User is not logged in (401 response handled gracefully)
        if (addDebugInfo) {
          addDebugInfo(`👤 User is not logged in`);
        }
        return null;
      }
      
      // Cache the successful response
      if (cacheKey) {
        const cacheEntry = {
          data: userData,
          cachedAt: Date.now(),
          expiresAt: Date.now() + this._cacheExpiry
        };
        this._userInfoCache.set(cacheKey, cacheEntry);
        console.log(`💾 Cached getUserInfo for 1 hour: ${userData?.UserNickName || 'Unknown'}`);
      }
      
      if (addDebugInfo) {
        addDebugInfo(`✅ Fresh user info loaded and cached: ${userData?.UserNickName || 'Unknown'}`);
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

  /**
   * Get user's ranks array
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {Array} - Array of user ranks
   */
  static getUserRanks(userInfo) {
    return userInfo?.UserRanks || [];
  }

  /**
   * Check if user has sufficient rank to use the application
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {Object} - { allowed: boolean, reason: string, userRanks: Array }
   */
  static validateUserRank(userInfo) {
    const userRanks = this.getUserRanks(userInfo);
    const currentRank = this.getUserRank(userInfo);
    
    // Allowed ranks for application usage
    const allowedRanks = [
      'super admin',
      'translator', 
      'trusted member',
      'administrator',
      'moderator',
      'gold member',
      'platinum member',
      'trusted',
      'subtranslator',
      'os legend',
      'vip lifetime member'
    ];
    
    // Explicitly forbidden ranks
    const forbiddenRanks = [
      'read only'
    ];
    
    // Check for forbidden ranks first (higher priority)
    const hasForbiddenRank = userRanks.some(rank => 
      forbiddenRanks.some(forbidden => 
        rank.toLowerCase().includes(forbidden.toLowerCase())
      )
    );
    
    if (hasForbiddenRank) {
      const forbiddenRank = userRanks.find(rank => 
        forbiddenRanks.some(forbidden => 
          rank.toLowerCase().includes(forbidden.toLowerCase())
        )
      );
      console.log('❌ User has forbidden rank:', forbiddenRank);
      return {
        allowed: false,
        reason: `Access denied: Your account has "${forbiddenRank}" restriction which prevents uploading.`,
        userRanks: userRanks,
        forbiddenRank: forbiddenRank
      };
    }
    
    // Check if user has any allowed rank
    const hasAllowedRank = userRanks.some(rank => 
      allowedRanks.some(allowed => 
        rank.toLowerCase().trim() === allowed.toLowerCase().trim()
      )
    );
    
    if (hasAllowedRank) {
      const matchedRank = userRanks.find(rank => 
        allowedRanks.some(allowed => 
          rank.toLowerCase().trim() === allowed.toLowerCase().trim()
        )
      );
      return {
        allowed: true,
        reason: `Access granted with rank: ${matchedRank}`,
        userRanks: userRanks,
        allowedRank: matchedRank
      };
    }
    
    // User doesn't have sufficient rank
    console.log('❌ User does not have sufficient rank for application access');
    return {
      allowed: false,
      reason: `Access denied: Your account rank "${currentRank}" is not sufficient for uploading. Required ranks: ${allowedRanks.join(', ')}.`,
      userRanks: userRanks,
      currentRank: currentRank
    };
  }

  /**
   * Check if user can upload (combines login status and rank validation)
   * @param {Object} userInfo - User info response from XML-RPC GetUserInfo
   * @returns {Object} - { canUpload: boolean, reason: string, rankValidation: Object }
   */
  static canUserUpload(userInfo) {
    // First check if user is logged in
    if (!this.isLoggedIn(userInfo)) {
      return {
        canUpload: false,
        reason: 'Please log in to upload subtitles.',
        rankValidation: null
      };
    }
    
    // Then validate user rank
    const rankValidation = this.validateUserRank(userInfo);
    
    return {
      canUpload: rankValidation.allowed,
      reason: rankValidation.reason,
      rankValidation: rankValidation
    };
  }
}