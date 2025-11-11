import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import LoginDialog from './LoginDialog.jsx';

/**
 * User profile component showing login status and providing logout functionality
 */
const UserProfile = () => {
  const {
    isAuthenticated,
    user,
    loading,
    error,
    logout,
    isAnonymous,
    getUserPreferredLanguages,
    clearError,
  } = useAuth();
  const { isDark } = useTheme();

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Handle logout
  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  // Handle login dialog
  const handleLoginClick = () => {
    clearError();
    setShowLoginDialog(true);
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'Loading...';
    if (isAnonymous && isAnonymous()) return 'Anonymous User';
    return user.UserNickName || 'User';
  };

  // Get user rank
  const getUserRank = () => {
    if (!user || (isAnonymous && isAnonymous())) return 'Guest';
    return user.UserRank || 'User';
  };

  // Get user stats
  const getUserStats = () => {
    if (!user || (isAnonymous && isAnonymous())) return null;

    return {
      uploads: user.UserUploadCnt || 0,
      downloads: user.UserDownloadCnt || 0,
      rank: user.UserRank || 'User',
    };
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center space-x-2" title={error}>
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span className="text-sm text-red-600 dark:text-red-400">
          Auth Error: {error.length > 30 ? error.substring(0, 30) + '...' : error}
        </span>
        <button
          onClick={() => {
            console.log('🔐 Full error details:', error);
            clearError();
          }}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          Debug
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!isAuthenticated ? (
        /* Login Link for Non-Authenticated Users */
        <button
          onClick={handleLoginClick}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-2 border-blue-600"
        >
          <svg
            className="w-4 h-4 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
          <span className="text-sm font-medium text-blue-600">Login</span>
        </button>
      ) : (
        /* User Profile Button for Authenticated Users */
        <button
          onClick={() => {
            console.log('👤 USERNAME CLICKED! Menu toggle debug:');
            console.log('👤 Current user:', user);
            console.log('👤 Current showUserMenu state:', showUserMenu);
            console.log('👤 Will set showUserMenu to:', !showUserMenu);
            console.log('👤 User display name:', getUserDisplayName());
            console.log('👤 User rank:', getUserRank());
            console.log('👤 Is authenticated:', isAuthenticated);
            console.log('👤 Is anonymous:', isAnonymous ? isAnonymous() : 'N/A');
            setShowUserMenu(!showUserMenu);
          }}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${isDark ? 'text-gray-50 hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}`}
        >
          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            {isAnonymous && isAnonymous() ? (
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            ) : (
              <span className="text-white font-medium text-sm">
                {getUserDisplayName().substring(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          {/* User Info */}
          <div className="hidden sm:block text-left">
            <div className={`text-sm font-medium ${isDark ? 'text-gray-50' : 'text-gray-900'}`}>
              {getUserDisplayName()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{getUserRank()}</div>
          </div>

          {/* Dropdown Arrow */}
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* User Menu Dropdown */}
      {showUserMenu && (
        <div
          className={`absolute right-0 mt-2 w-64 rounded-lg shadow-lg border z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        >
          <div className="p-2">
            {/* Anonymous User Notice */}
            {isAnonymous && isAnonymous() && (
              <div
                className={`mb-2 p-2 border rounded-lg ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}
              >
                <div
                  className={`font-medium mb-1 text-sm ${isDark ? 'text-blue-200' : 'text-blue-800'}`}
                >
                  Anonymous Session
                </div>
                <div className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  Login with your account for full features and personal statistics.
                </div>
              </div>
            )}

            {/* Menu Items */}
            <div className="space-y-1">
              {isAnonymous && isAnonymous() ? (
                <button
                  onClick={handleLoginClick}
                  className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  Login with Account
                </button>
              ) : (
                <>
                  {/* View Profile Link */}
                  {user?.IDUser && (
                    <a
                      href={`https://www.opensubtitles.org/profile/iduser-${user.IDUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      View Profile
                    </a>
                  )}

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-700 hover:bg-red-50'}`}
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login Dialog */}
      <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />

      {/* Click Outside Handler */}
      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  );
};

export default UserProfile;
