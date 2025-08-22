import { xmlrpcCall } from './api/xmlrpc.js';
import { APP_VERSION } from '../utils/constants.js';

/**
 * Authentication service for OpenSubtitles XML-RPC API
 */
class AuthService {
  constructor() {
    this.token = null;
    this.userData = null;
    this.isAuthenticated = false;
    this.userAgent = `OpenSubtitles Uploader PRO v${APP_VERSION}`;
  }

  /**
   * Login to OpenSubtitles using XML-RPC LogIn method
   * @param {string} username - Username (empty string for anonymous)
   * @param {string} password - Password (empty string for anonymous)
   * @param {string} language - ISO 639-1 language code (default: 'en')
   * @returns {Promise<Object>} Login response with token and user data
   */
  async login(username = '', password = '', language = 'en') {
    try {
      console.log('🔐 Attempting login to OpenSubtitles...');
      console.log('🔐 Username:', username ? `"${username}"` : '(anonymous)');
      console.log('🔐 Password:', password ? '[HIDDEN]' : '(no password)');
      console.log('🔐 Language:', language);
      console.log('🔐 User Agent:', this.userAgent);
      
      // Prepare parameters for XML-RPC call
      const params = [
        username || '',
        password || '',
        language || 'en',
        this.userAgent
      ];

      console.log('🔐 XML-RPC params prepared:', params.map((p, i) => i === 1 && p ? '[HIDDEN]' : p));

      // Make XML-RPC call to LogIn method
      console.log('🔐 Making XML-RPC call to LogIn...');
      const response = await xmlrpcCall('LogIn', params);
      
      console.log('🔐 Login response received:', response);
      console.log('🔐 Response type:', typeof response);
      console.log('🔐 Response keys:', response ? Object.keys(response) : 'null');

      // Check if login was successful
      if (response && response.status && response.status.includes('200')) {
        console.log('✅ Login response status is 200 OK');
        
        // Store authentication data
        this.token = response.token;
        this.userData = response.data || {};
        this.isAuthenticated = true;

        console.log('🔐 Token received:', this.token ? `${this.token.substring(0, 10)}...` : 'null');
        console.log('🔐 User data received:', this.userData);

        // Store in localStorage for persistence
        localStorage.setItem('opensubtitles_token', this.token);
        localStorage.setItem('opensubtitles_user_data', JSON.stringify(this.userData));
        localStorage.setItem('opensubtitles_login_time', Date.now().toString());

        console.log('✅ Login successful');
        console.log('👤 User:', this.userData.UserNickName || 'Anonymous');
        console.log('🎖️ Rank:', this.userData.UserRank || 'User');
        console.log('🎯 Token stored');

        // Fetch additional user info via getUserInfo to get complete profile data
        try {
          console.log('📋 Fetching additional user info via getUserInfo...');
          const { UserService } = await import('./userService.js');
          const detailedUserInfo = await UserService.getUserInfo(this.token);
          
          if (detailedUserInfo) {
            // Prioritize getUserInfo data over login data - use getUserInfo as primary source
            this.userData = { ...detailedUserInfo, ...this.userData };
            
            // Validate user rank permissions
            const uploadPermission = UserService.canUserUpload(this.userData);
            console.log('🎖️ Upload permission check:', uploadPermission);
            
            // Store rank validation result
            this.userData._rankValidation = uploadPermission.rankValidation;
            this.userData._canUpload = uploadPermission.canUpload;
            this.userData._uploadRestrictionReason = uploadPermission.reason;
            
            // Update localStorage with enhanced user data (getUserInfo priority)
            localStorage.setItem('opensubtitles_user_data', JSON.stringify(this.userData));
            
            console.log('✅ Enhanced user info retrieved via getUserInfo (using as primary data source)');
            console.log('📋 Enhanced user data:', this.userData);
            
            if (!uploadPermission.canUpload) {
              console.log('⚠️ User login successful but upload access restricted:', uploadPermission.reason);
            }
          } else {
            console.log('⚠️ getUserInfo failed or returned no data, using login data only');
          }
        } catch (getUserInfoError) {
          console.warn('⚠️ getUserInfo call failed after login:', getUserInfoError.message);
          console.log('📝 Continuing with basic login data only');
        }

        return {
          success: true,
          token: this.token,
          userData: this.userData,
          isAnonymous: !username,
          message: `Login successful as ${this.userData.UserNickName || 'Anonymous'}`
        };
      } else {
        console.error('❌ Login failed - invalid response status:', response?.status);
        console.error('❌ Full response:', response);
        throw new Error(response?.status || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login failed with error:', error);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      // Clear any existing authentication data
      await this.clearAuthData();
      
      return {
        success: false,
        error: error.message,
        message: `Login failed: ${error.message}`
      };
    }
  }

  /**
   * Login with MD5 hashed password for security
   * @param {string} username - Username
   * @param {string} password - Plain text password (will be hashed)
   * @param {string} language - ISO 639-1 language code
   * @returns {Promise<Object>} Login response
   */
  async loginWithHash(username, password, language = 'en') {
    // Import crypto-js for MD5 hashing
    const CryptoJS = await import('crypto-js');
    const hashedPassword = CryptoJS.MD5(password).toString();
    
    return this.login(username, hashedPassword, language);
  }

  /**
   * Logout from OpenSubtitles
   * @returns {Promise<Object>} Logout response
   */
  async logout() {
    try {
      console.log('🔐 Attempting logout from OpenSubtitles...');

      if (this.token) {
        // Make XML-RPC call to LogOut method
        const response = await xmlrpcCall('LogOut', [this.token]);
        console.log('🔐 Logout response:', response);
      }

      // Clear authentication data regardless of API response
      await this.clearAuthData();

      console.log('✅ Logout successful');
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      console.error('❌ Logout failed:', error);
      
      // Clear auth data even if logout API call failed
      await this.clearAuthData();
      
      return {
        success: false,
        error: error.message,
        message: 'Logout completed (with errors)'
      };
    }
  }

  /**
   * Check if user is currently authenticated by calling GetUserInfo with session ID
   * @param {string} sessionId - Optional session ID to check (from URL parameter)
   * @returns {Promise<Object>} User info if authenticated, null if not
   */
  async checkAuthStatus(sessionId = null) {
    try {
      console.log('🔐 Checking authentication status with GetUserInfo...');
      
      // Use provided sessionId or stored token
      const tokenToUse = sessionId || this.token || '';
      console.log('🔐 Using token:', tokenToUse ? tokenToUse.substring(0, 10) + '...' : 'null');
      
      // Use UserService caching for GetUserInfo calls
      const { UserService } = await import('./userService.js');
      const userData = await UserService.getUserInfo(tokenToUse);
      
      if (userData) {
        console.log('✅ User is authenticated via session ID');
        console.log('✅ User data:', userData);
        
        // Store the valid session data
        this.token = tokenToUse;
        this.isAuthenticated = true;
        this.userData = userData;
        
        return userData;
      } else {
        console.log('❌ User is not authenticated');
        await this.clearAuthData();
        return null;
      }
    } catch (error) {
      console.log('❌ Authentication check failed:', error.message);
      await this.clearAuthData();
      return null;
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} Authentication status
   */
  isLoggedIn() {
    return this.isAuthenticated && this.token;
  }

  /**
   * Get current authentication token
   * @returns {string|null} Current token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get current user data
   * @returns {Object|null} Current user data
   */
  getUserData() {
    return this.userData;
  }

  /**
   * Check if current user is anonymous
   * @returns {boolean} True if anonymous user
   */
  isAnonymous() {
    return !this.userData?.UserNickName || this.userData.UserNickName === '';
  }

  /**
   * Get user's preferred languages
   * @returns {string[]} Array of language codes
   */
  getUserPreferredLanguages() {
    if (!this.userData?.UserPreferedLanguages) return ['en'];
    return this.userData.UserPreferedLanguages.split(',').map(lang => lang.trim());
  }

  /**
   * Restore authentication from localStorage
   * @returns {Promise<boolean>} True if authentication was restored
   */
  async restoreAuthFromStorage() {
    try {
      const token = localStorage.getItem('opensubtitles_token');
      const userData = localStorage.getItem('opensubtitles_user_data');
      const loginTime = localStorage.getItem('opensubtitles_login_time');

      if (token && userData && loginTime) {
        // Check if token is not too old (24 hours)
        const now = Date.now();
        const loginTimestamp = parseInt(loginTime);
        const tokenAge = now - loginTimestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (tokenAge < maxAge) {
          this.token = token;
          this.userData = JSON.parse(userData);
          this.isAuthenticated = true;

          console.log('✅ Authentication restored from storage');
          console.log('👤 User:', this.userData.UserNickName || 'Anonymous');
          return true;
        } else {
          console.log('🕐 Stored token expired, clearing...');
          await this.clearAuthData();
        }
      }
    } catch (error) {
      console.error('❌ Failed to restore authentication:', error);
      await this.clearAuthData();
    }
    return false;
  }

  /**
   * Clear all authentication data
   */
  async clearAuthData() {
    this.token = null;
    this.userData = null;
    this.isAuthenticated = false;

    // Clear localStorage
    localStorage.removeItem('opensubtitles_token');
    localStorage.removeItem('opensubtitles_user_data');
    localStorage.removeItem('opensubtitles_login_time');
    
    // Clear UserService cache when auth data is cleared (avoid circular import)
    try {
      const { UserService } = await import('./userService.js');
      UserService.clearUserInfoCache();
    } catch (error) {
      console.warn('⚠️ Could not clear UserService cache:', error.message);
    }
  }

  /**
   * Get authentication headers for API requests
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    return {
      'User-Agent': this.userAgent,
      'Accept-Language': this.userData?.UserWebLanguage || 'en'
    };
  }
}

// Create singleton instance
const authService = new AuthService();

// Try to restore authentication on module load (async)
authService.restoreAuthFromStorage().catch(error => {
  console.warn('⚠️ Failed to restore authentication on module load:', error.message);
});

export default authService;