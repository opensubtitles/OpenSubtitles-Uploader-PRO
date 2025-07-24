import { useState, useEffect, useCallback, useRef } from 'react';
import { UserService } from '../services/userService.js';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Custom hook for managing user session
 * Now uses AuthContext data to avoid duplicate GetUserInfo calls
 */
export const useUserSession = (addDebugInfo) => {
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  // Get authentication data from AuthContext to avoid duplicate API calls
  const { user: authUser, isAuthenticated, loading: authLoading } = useAuth();

  // Load user info from AuthContext instead of making duplicate API calls
  const loadUserInfo = useCallback(async () => {
    // Prevent duplicate calls
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    try {
      setIsLoading(true);
      setError(null);
      
      // Use authentication data from AuthContext instead of making new API calls
      if (isAuthenticated && authUser) {
        if (addDebugInfo) {
          addDebugInfo('👤 Using authentication data from AuthContext (avoiding duplicate GetUserInfo call)');
        }
        setUserInfo(authUser);
      } else {
        if (addDebugInfo) {
          addDebugInfo('👤 No authenticated user found in AuthContext');
        }
        setUserInfo(null);
      }
      
    } catch (err) {
      setError(err.message);
      setUserInfo(null);
      if (addDebugInfo) {
        addDebugInfo(`👤 Session validation failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, authUser, addDebugInfo]);

  // Initialize user session on mount and when auth state changes
  useEffect(() => {
    // Wait for AuthContext to finish loading before processing
    if (!authLoading) {
      hasLoadedRef.current = false; // Reset flag when auth state changes
      loadUserInfo();
    }
  }, [loadUserInfo, authLoading]);

  // Helper functions
  const getUsername = useCallback(() => {
    return UserService.getUsername(userInfo);
  }, [userInfo]);

  const isLoggedIn = useCallback(() => {
    return UserService.isLoggedIn(userInfo);
  }, [userInfo]);

  const getUserRank = useCallback(() => {
    return UserService.getUserRank(userInfo);
  }, [userInfo]);

  const getPreferredLanguages = useCallback(() => {
    return UserService.getPreferredLanguages(userInfo);
  }, [userInfo]);

  // Refresh function that resets the flag
  const refreshUserInfo = useCallback(async () => {
    hasLoadedRef.current = false;
    await loadUserInfo();
  }, [loadUserInfo]);

  return {
    userInfo,
    isLoading,
    error,
    getUsername,
    isLoggedIn,
    getUserRank,
    getPreferredLanguages,
    refreshUserInfo
  };
};