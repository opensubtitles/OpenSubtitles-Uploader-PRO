import { XmlRpcService } from './api/xmlrpc.js';

/**
 * Session keep-alive service.
 *
 * OpenSubtitles hands us a PHPSESSID as the session token and expires it six
 * hours after the last request (observed `Max-Age=21600` on every XML-RPC
 * response). XML-RPC `NoOperation` exists precisely to slide that window
 * forward without doing any work.
 *
 * Scope note: this only helps while the app is running. It cannot keep a
 * session alive across app restarts - a token left untouched longer than the
 * server window is gone regardless of what the client does.
 */

/**
 * How often to ping. The API docs recommend every 15 minutes; the observed
 * server window is six hours, so hourly leaves a 6x safety margin while
 * keeping the app near-silent on the network.
 */
export const KEEP_ALIVE_INTERVAL_MS = 60 * 60 * 1000;

/** Give up on a ping well before the next one is due. */
const PING_TIMEOUT_MS = 30 * 1000;

let intervalId = null;
let inFlight = false;
let consecutiveFailures = 0;
// Bumped on every stop so a ping left over from a previous run can tell that it
// no longer owns the in-flight guard.
let generation = 0;

/**
 * Send a single keep-alive ping.
 *
 * Deliberately swallows every failure. A ping is best-effort maintenance, not
 * an authentication check - `NoOperation` returns `200 OK` even for tokens the
 * server never issued, so its result can never be used to log the user out.
 *
 * @param {() => string|null} getToken - Supplies the current session token
 * @returns {Promise<boolean>} - True if the server acknowledged the ping
 */
export async function pingOnce(getToken) {
  const token = getToken();

  if (!token) {
    return false;
  }

  try {
    // Bound the wait. delayedFetch has no timeout of its own, and a socket that
    // never answers would otherwise pin the in-flight guard forever and kill
    // keep-alive silently for the rest of the app session.
    const { status, acknowledged } = await withTimeout(
      XmlRpcService.noOperation(token),
      PING_TIMEOUT_MS
    );

    consecutiveFailures = 0;

    if (acknowledged) {
      console.log('💓 Session keep-alive: session refreshed');
    } else {
      // 406 means the server has no session for this token. We do not clear
      // anything here - the next GetUserInfo decides authentication state.
      console.log(`💓 Session keep-alive: server replied ${status}`);
    }

    return acknowledged;
  } catch (error) {
    consecutiveFailures += 1;
    console.warn(
      `💓 Session keep-alive ping failed (${consecutiveFailures} in a row): ${error.message}`
    );
    return false;
  }
}

/**
 * Reject if a promise has not settled within the given time.
 * @param {Promise<any>} promise - Promise to bound
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise<any>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Number of consecutive failed pings (used by tests and debug UI).
 * @returns {number}
 */
export function getConsecutiveFailures() {
  return consecutiveFailures;
}

/**
 * Start pinging on an interval. Restarting cancels any previous timer, so this
 * is safe to call repeatedly (including under React StrictMode double-mount).
 *
 * @param {() => string|null} getToken - Supplies the current session token
 * @param {number} intervalMs - Ping interval, defaults to one hour
 * @returns {() => void} - Stop function
 */
export function startSessionKeepAlive(getToken, intervalMs = KEEP_ALIVE_INTERVAL_MS) {
  stopSessionKeepAlive();

  console.log(`💓 Session keep-alive started (every ${Math.round(intervalMs / 60000)} min)`);

  const myGeneration = generation;

  intervalId = setInterval(() => {
    // Skip if a previous ping is still outstanding - a slow or hung request
    // must not queue up behind itself on a machine waking from sleep.
    if (inFlight) {
      return;
    }

    inFlight = true;
    pingOnce(getToken).finally(() => {
      // A ping outliving its own start/stop cycle must not clear the guard
      // belonging to whichever run is current now.
      if (generation === myGeneration) {
        inFlight = false;
      }
    });
  }, intervalMs);

  return stopSessionKeepAlive;
}

/**
 * Stop the keep-alive timer if one is running.
 */
export function stopSessionKeepAlive() {
  // Reset the guard as well as the timer. An outstanding ping belongs to the
  // run being torn down; leaving the flag set would gag the next timer that
  // starts, with nothing in the logs to say why.
  generation += 1;
  inFlight = false;
  consecutiveFailures = 0;

  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('💓 Session keep-alive stopped');
  }
}

/**
 * Whether a keep-alive timer is currently active (used by tests and debug UI).
 * @returns {boolean}
 */
export function isKeepAliveRunning() {
  return intervalId !== null;
}
