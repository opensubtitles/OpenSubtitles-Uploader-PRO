/**
 * Persisting a verified session.
 *
 * The three auth keys were previously written with bare `localStorage.setItem`
 * in two separate places (`authService.login` and the AuthContext init
 * effect). Both sat inside a try block whose catch treated any failure as a
 * failed login - so a full quota threw on the 13-character
 * `opensubtitles_login_time` write and discarded a session the server had
 * already granted.
 *
 * Persistence is a convenience, not the login itself. A session that cannot be
 * cached to disk is still a valid session for this run of the app, so these
 * helpers report failure and never throw.
 */

import { safeSetItem } from './storageQuota.js';

export const TOKEN_KEY = 'opensubtitles_token';
export const USER_DATA_KEY = 'opensubtitles_user_data';
export const LOGIN_TIME_KEY = 'opensubtitles_login_time';
export const REMEMBERED_USERNAME_KEY = 'opensubtitles_remembered_username';

/**
 * Store a verified session for reuse on the next launch.
 *
 * The token is written first, because it is the one key that decides whether
 * the app looks logged in; user data and the login timestamp are refinements
 * that a later run can rebuild from GetUserInfo.
 *
 * @param {string} token - verified session id
 * @param {object} userData - GetUserInfo / LogIn payload
 * @param {object} [options]
 * @param {number} [options.loginTime] - epoch ms, defaults to now
 * @param {boolean} [options.rememberUsername] - also store the nickname for the login form
 * @returns {{stored: boolean, partial: boolean}} `stored` is false only when
 *   the token itself could not be written; `partial` flags that the session is
 *   usable but something else was dropped.
 */
export const persistAuthData = (token, userData, { loginTime, rememberUsername = true } = {}) => {
  const results = [];

  const tokenStored = safeSetItem(TOKEN_KEY, token, { label: 'session token' });

  if (userData) {
    try {
      results.push(safeSetItem(USER_DATA_KEY, JSON.stringify(userData), { label: 'user profile' }));
    } catch (error) {
      // Circular or otherwise unserialisable profile - not worth failing over.
      console.warn('💾 Could not serialise user profile for storage:', error.message);
      results.push(false);
    }
  }

  results.push(
    safeSetItem(LOGIN_TIME_KEY, String(loginTime ?? Date.now()), { label: 'login timestamp' })
  );

  if (rememberUsername && userData?.UserNickName) {
    results.push(
      safeSetItem(REMEMBERED_USERNAME_KEY, userData.UserNickName, { label: 'remembered username' })
    );
  }

  const partial = !tokenStored || results.some(ok => !ok);

  if (!tokenStored) {
    console.warn(
      '💾 Session verified but could not be saved - you will need to log in again next launch'
    );
  } else if (partial) {
    console.warn('💾 Session saved, but some profile details could not be stored');
  }

  return { stored: tokenStored, partial };
};

/**
 * Refresh only the cached profile, after GetUserInfo returns richer data than
 * LogIn did.
 *
 * @param {object} userData
 * @returns {boolean}
 */
export const persistUserData = userData => {
  if (!userData) return false;

  try {
    return safeSetItem(USER_DATA_KEY, JSON.stringify(userData), { label: 'user profile' });
  } catch (error) {
    console.warn('💾 Could not serialise user profile for storage:', error.message);
    return false;
  }
};

/**
 * Remember a nickname for the login form.
 *
 * @param {string} username
 * @returns {boolean}
 */
export const persistRememberedUsername = username => {
  if (!username) return false;
  return safeSetItem(REMEMBERED_USERNAME_KEY, username, { label: 'remembered username' });
};
