import React, { createContext, useContext, useEffect, useState } from 'react';
import authService from '../services/authService.js';
import { SessionManager } from '../services/sessionManager.js';
import { detectSession, logSessionDetection, SessionSource } from '../utils/sessionUtils.js';

/**
 * Authentication context for managing login state across the application
 */
const AuthContext = createContext();

/**
 * Hook to use authentication context
 * @returns {Object} Authentication context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Authentication provider component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize authentication on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Use unified session detection system
        const sessionDetection = logSessionDetection('AuthContext Initialization');

        if (sessionDetection.sessionId) {
          const sessionId = sessionDetection.sessionId;

          // Check if the session ID is valid by calling GetUserInfo
          const userInfo = await authService.checkAuthStatus(sessionId);

          if (userInfo) {
            // Valid session - user is already logged in on OpenSubtitles.org
            setIsAuthenticated(true);
            setUser(userInfo);
            setToken(sessionId);
            console.log('✅ Valid session authenticated');
            console.log('✅ User data:', userInfo);
            console.log('✅ User:', userInfo.UserNickName);
            console.log('✅ Rank:', userInfo.UserRank);

            // Store in localStorage for future use
            localStorage.setItem('opensubtitles_token', sessionId);
            localStorage.setItem('opensubtitles_user_data', JSON.stringify(userInfo));
            localStorage.setItem('opensubtitles_login_time', Date.now().toString());

            // Remember username for future logins
            if (userInfo.UserNickName) {
              localStorage.setItem('opensubtitles_remembered_username', userInfo.UserNickName);
            }

            // If session came from URL, ensure it's stored by SessionManager
            if (sessionDetection.source === SessionSource.URL_PARAMETER) {
              SessionManager.storeSessionId(sessionId);
            }
          } else {
            // Invalid session ID
            console.log('❌ Invalid session ID');
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            // Clear invalid stored session
            SessionManager.clearStoredSession();
          }
        } else {
          // No URL parameter, try to restore from localStorage
          const restored = authService.restoreAuthFromStorage();
          if (restored) {
            // Check if the restored session is still valid
            const userInfo = await authService.checkAuthStatus();

            if (userInfo) {
              // Valid session restored
              setIsAuthenticated(true);
              setUser(userInfo);
              setToken(authService.getToken());
              console.log('✅ Valid session restored');
              console.log('✅ User data:', userInfo);
            } else {
              // Invalid session, user needs to login
              console.log('❌ Stored session is invalid, user needs to login');
              setIsAuthenticated(false);
              setUser(null);
              setToken(null);
            }
          } else {
            // No stored session, user needs to login
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
          }
        }
      } catch (error) {
        console.error('❌ Failed to initialize authentication:', error);
        console.error('❌ Error stack:', error.stack);
        setError(`Auth initialization failed: ${error.message}`);
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login with username and password
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {string} language - Language code (default: 'en')
   * @returns {Promise<Object>} Login result
   */
  const login = async (username, password, language = 'en') => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.loginWithHash(username, password, language);

      if (result.success) {
        setIsAuthenticated(true);
        setUser(result.userData);
        setToken(result.token);
        console.log('✅ Login successful:', result.userData.UserNickName);

        // Remember username for future logins
        if (result.userData.UserNickName) {
          localStorage.setItem('opensubtitles_remembered_username', result.userData.UserNickName);
        }

        return result;
      } else {
        setError(result.message || 'Login failed');
        console.error('❌ Login failed:', result.error);
        return result;
      }
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      console.error('❌ Login error:', error);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout current user
   * @returns {Promise<Object>} Logout result
   */
  const logout = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.logout();

      // Clear state regardless of API response
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);

      console.log('✅ Logout completed');

      return result;
    } catch (error) {
      const errorMessage = error.message || 'Logout failed';
      setError(errorMessage);
      console.error('❌ Logout error:', error);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if current user is anonymous
   * @returns {boolean} True if anonymous user
   */
  const isAnonymous = () => {
    return authService.isAnonymous();
  };

  /**
   * Get user's preferred languages
   * @returns {string[]} Array of language codes
   */
  const getUserPreferredLanguages = () => {
    return authService.getUserPreferredLanguages();
  };

  /**
   * Clear authentication error
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Refresh authentication token
   * @returns {Promise<Object>} Refresh result
   */
  const refreshAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // If we have a user, try to re-login with same credentials
      if (user && !isAnonymous()) {
        // Note: We can't re-login with original credentials since we don't store them
        // This would require the user to login again
        setError('Please login again to refresh your session');
        return { success: false, error: 'Session expired' };
      } else {
        // For anonymous users, clear auth state - can't refresh without credentials
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        return { success: false, error: 'Session expired, please login again' };
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to refresh authentication';
      setError(errorMessage);
      console.error('❌ Auth refresh error:', error);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    // State
    isAuthenticated,
    user,
    token,
    loading,
    error,

    // Methods
    login,
    logout,
    isAnonymous,
    getUserPreferredLanguages,
    clearError,
    refreshAuth,

    // Utility
    authService,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
