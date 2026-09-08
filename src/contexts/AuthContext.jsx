import React, { createContext, useContext, useEffect, useState } from 'react';
import authService from '../services/authService.js';
import { SessionManager } from '../services/sessionManager.js';
import { startSessionKeepAlive, stopSessionKeepAlive } from '../services/sessionKeepAlive.js';
import { detectSession, logSessionDetection, SessionSource } from '../utils/sessionUtils.js';

/**
 * Authentication context for managing login state across the application
 */
const AuthContext = createContext();

/**
 * Minimum idle gap before a refocus triggers a fresh GetUserInfo. Short enough
 * to catch a dead session soon after wake, long enough that ordinary tab
 * switching costs nothing.
 */
const REVALIDATE_AFTER_IDLE_MS = 5 * 60 * 1000;

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
  // Set when a session could not be verified because the server was
  // unreachable. Distinct from being logged out: the credentials are still on
  // disk and deserve another attempt once connectivity returns.
  const [needsRecheck, setNeedsRecheck] = useState(false);

  // Initialize authentication on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Use unified session detection system
        const sessionDetection = logSessionDetection('AuthContext Initialization');

        if (sessionDetection.sessionId) {
          const sessionId = sessionDetection.sessionId;

          // Check if the session ID is valid by calling GetUserInfo
          const { userData: userInfo, unreachable } = await authService.checkAuthStatus(sessionId);

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
          } else if (unreachable) {
            // The server never gave a verdict (offline, 5xx, bot challenge).
            // Leave the stored session in place so it can be retried.
            console.warn('⚠️ Could not verify session - keeping it for the next attempt');
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
            setNeedsRecheck(true);
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
          const restored = await authService.restoreAuthFromStorage();
          if (restored) {
            // Check if the restored session is still valid
            const { userData: userInfo, unreachable } = await authService.checkAuthStatus();

            if (userInfo) {
              // Valid session restored
              setIsAuthenticated(true);
              setUser(userInfo);
              setToken(authService.getToken());
              console.log('✅ Valid session restored');
            } else if (unreachable) {
              // Same as above: no verdict, so keep the stored session and retry.
              console.warn('⚠️ Could not verify stored session - keeping it for the next attempt');
              setIsAuthenticated(false);
              setUser(null);
              setToken(null);
              setNeedsRecheck(true);
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

  // Retry a session check that failed because the server was unreachable.
  // Without this, one bad moment at launch would leave the app logged out - and
  // keep-alive disabled - until the user restarts it.
  useEffect(() => {
    if (!needsRecheck) {
      return undefined;
    }

    const retry = async () => {
      // Re-detect rather than trusting service state: the failed attempt may
      // have come from a URL `sid` that was never promoted to this.token.
      const detected = detectSession();
      const { userData, unreachable } = await authService.checkAuthStatus(
        detected.sessionId || null
      );

      if (userData) {
        setIsAuthenticated(true);
        setUser(userData);
        setToken(authService.getToken());
        setNeedsRecheck(false);
        console.log('✅ Session verified on retry');
      } else if (!unreachable) {
        // Server answered this time and rejected it - stop retrying.
        setNeedsRecheck(false);
      }
    };

    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [needsRecheck]);

  // Revalidate after the app has been idle or hidden. Keep-alive cannot cover
  // this: a suspended machine stops firing timers, and on wake NoOperation
  // answers 200 OK even for a token the server has already dropped. Only a
  // fresh GetUserInfo can tell, and it must skip the one-hour cache.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let lastCheckedAt = Date.now();

    const revalidate = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      // Don't re-hit the API on every tab switch - only after a gap long enough
      // for the session to plausibly have died.
      if (Date.now() - lastCheckedAt < REVALIDATE_AFTER_IDLE_MS) {
        return;
      }
      lastCheckedAt = Date.now();

      const { userData, unreachable } = await authService.checkAuthStatus(null, {
        forceFresh: true,
      });

      if (userData) {
        setUser(userData);
        setToken(authService.getToken());
      } else if (unreachable) {
        setNeedsRecheck(true);
      } else {
        console.log('❌ Session expired while the app was idle');
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
      }
    };

    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);

    return () => {
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [isAuthenticated]);

  // Keep the OpenSubtitles session from expiring while the app is open.
  // The server drops an idle session after six hours; NoOperation resets that
  // window. Only runs while authenticated, and stops on logout or unmount.
  useEffect(() => {
    if (!isAuthenticated || !token) {
      stopSessionKeepAlive();
      return undefined;
    }

    // Read the token at ping time rather than closing over it, so a token
    // refreshed mid-session is picked up without restarting the timer.
    return startSessionKeepAlive(() => authService.getToken() || token);
  }, [isAuthenticated, token]);

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
