import React, { useState } from 'react';
import { LogIn, LogOut, User, ChevronDown, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import LoginDialog from './LoginDialog.jsx';
import { WEB_EMBED, requestHostLogin } from '../config/environments.js';

/**
 * User profile component showing login status and providing logout functionality
 */
const UserProfile = () => {
  const { isAuthenticated, user, loading, error, logout, isAnonymous, clearError } = useAuth();

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const handleLoginClick = () => {
    clearError();
    if (WEB_EMBED) requestHostLogin();
    else setShowLoginDialog(true);
  };

  const isAnon = isAnonymous && isAnonymous();

  const getUserDisplayName = () => {
    if (!user) return 'Loading…';
    if (isAnon) return 'Anonymous User';
    return user.UserNickName || 'User';
  };

  const getUserRank = () => {
    if (!user || isAnon) return 'Guest';
    return user.UserRank || 'User';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-base-content/70">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2" title={error}>
        <AlertTriangle className="size-4 text-error" />
        <span className="text-sm text-error">
          Auth Error: {error.length > 30 ? error.substring(0, 30) + '…' : error}
        </span>
        <button type="button" onClick={clearError} className="btn btn-xs btn-ghost text-error">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!isAuthenticated ? (
        <button
          type="button"
          onClick={handleLoginClick}
          className="btn btn-sm btn-outline btn-primary gap-2"
        >
          <LogIn className="size-4" />
          <span>Login</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="btn btn-ghost btn-sm gap-2 normal-case"
        >
          <div className="size-7 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0">
            {isAnon ? (
              <User className="size-4" />
            ) : (
              <span className="font-medium text-sm">
                {getUserDisplayName().substring(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium text-base-content leading-tight">
              {getUserDisplayName()}
            </div>
            <div className="text-xs text-base-content/60 leading-tight">{getUserRank()}</div>
          </div>
          <ChevronDown className="size-4 text-base-content/60" />
        </button>
      )}

      {/* User Menu Dropdown */}
      {showUserMenu && (
        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg border border-base-300 bg-base-100 z-50">
          <div className="p-2">
            {isAnon && (
              <div className="mb-2 p-2 border border-info/40 bg-info/10 rounded-md">
                <div className="font-medium mb-1 text-sm text-info">Anonymous Session</div>
                <div className="text-xs text-base-content/70">
                  Login with your account for full features and personal statistics.
                </div>
              </div>
            )}

            <div className="space-y-1">
              {isAnon ? (
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-base-200 text-base-content"
                >
                  <LogIn className="size-4" />
                  Login with Account
                </button>
              ) : (
                <>
                  {user?.IDUser && (
                    <a
                      href={`${user?.base_url || 'https://www.opensubtitles.com'}/users/${user.IDUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-base-200 text-base-content"
                    >
                      <User className="size-4" />
                      View Profile
                    </a>
                  )}

                  <a
                    href="#/history"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-base-200 text-base-content"
                  >
                    <Clock className="size-4" />
                    My Uploads
                  </a>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-error/10 text-error"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!WEB_EMBED && (
        <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
      )}

      {showUserMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      )}
    </div>
  );
};

export default UserProfile;
