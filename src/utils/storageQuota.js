/**
 * Quota-aware localStorage writes.
 *
 * Every cache in this app keys one localStorage entry per filename, per file
 * hash, or per IMDb id, so a long-lived install accumulates entries without
 * bound. Nothing reclaimed them: `CacheService.loadFromCache` treated an
 * expired entry as a miss but left it on disk forever, and `saveToCache`
 * swallowed QuotaExceededError, so the app went on silently failing to cache
 * with no user-visible signal.
 *
 * The damage surfaced somewhere else entirely. Once the quota was gone, the
 * first *unguarded* write threw - and that was `opensubtitles_login_time`, a
 * 13-character timestamp written third in `authService.login`. The login had
 * already succeeded server-side; the thrown error dropped a valid session and
 * showed the user "Login failed: ... exceeded the quota". Retrying could not
 * help, because the retry freed only the three auth keys (~1KB) and then hit
 * the same wall - a permanent lockout caused entirely by our own cache.
 *
 * So two rules are enforced here:
 *
 *   1. A write that fails must not take the caller down with it. `safeSetItem`
 *      never throws; it returns false.
 *   2. Running out of room is recoverable. On a quota error we reclaim space
 *      (expired entries first, then the entries closest to expiry) and retry
 *      before giving up.
 *
 * Reclaiming only ever touches cache entries. Auth, config, and the upload
 * ledger are protected: losing them is a worse outcome than a cache miss.
 */

import { CACHE_KEYS } from './constants.js';

/** Theme detection caches outside CACHE_KEYS but is just as disposable. */
export const THEME_CACHE_KEY = 'opensubtitles-uploader-theme-cache';

/**
 * Keys that must survive eviction no matter how tight the quota gets. Matched
 * as prefixes, so the per-account upload ledger keys are covered too.
 */
const PROTECTED_PREFIXES = [
  'opensubtitles_token',
  'opensubtitles_user_data',
  'opensubtitles_login_time',
  'opensubtitles_remembered_username',
  'opensubtitles_session_id',
  'opensubtitles_upload_ledger',
  'opensubtitles-uploader-config',
  'opensubtitles-uploader-theme',
  'uploader_test_mode',
  'uploader_test_cases',
  CACHE_KEYS.DEBUG_MODE,
];

/**
 * Cache families that may be evicted to make room. Derived from CACHE_KEYS so
 * a new cache added there is reclaimable without touching this list.
 */
const evictablePrefixes = () => {
  const fromCacheKeys = Object.entries(CACHE_KEYS)
    .filter(([name]) => name !== 'DEBUG_MODE')
    .map(([, key]) => key)
    .filter(key => !key.endsWith('_expiry'));

  return [...new Set([...fromCacheKeys, THEME_CACHE_KEY])];
};

const isProtected = key => PROTECTED_PREFIXES.some(prefix => key.startsWith(prefix));

/**
 * True when `key` belongs to an evictable cache family and is a value entry
 * (not its `_expiry` sibling, which is removed alongside its value).
 */
export const isEvictableCacheKey = key => {
  if (typeof key !== 'string' || key.endsWith('_expiry')) return false;
  if (isProtected(key)) return false;
  return evictablePrefixes().some(prefix => key.startsWith(prefix));
};

/**
 * Recognise a quota failure across engines. Blink throws QuotaExceededError,
 * Firefox historically used code 1014 / NS_ERROR_DOM_QUOTA_REACHED, and older
 * WebKit reports the legacy code 22 with its own wording - so name, code, and
 * message are all checked.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export const isQuotaError = error => {
  if (!error) return false;

  const name = error.name || '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;

  const code = error.code;
  if (code === 22 || code === 1014) return true;

  const message = String(error.message || '');
  return /quota|exceeded the quota|storage is full/i.test(message);
};

/** UTF-16: two bytes per code unit, key included. */
const entryBytes = (key, value) => (key.length + (value?.length || 0)) * 2;

const safeRemove = key => {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_expiry');
    return true;
  } catch {
    return false;
  }
};

/**
 * Snapshot every evictable cache entry with its size and expiry.
 *
 * @param {Set<string>} [skip] - keys the caller is mid-write on. Without this,
 *   reclaiming space for the second half of a value/expiry pair could evict
 *   the half already written - the write would report success while leaving an
 *   orphan behind.
 * @returns {Array<{key: string, bytes: number, expiry: number}>} entries; a
 *   missing or unparseable expiry becomes 0, which sorts it first for eviction
 *   and marks it expired - an entry whose expiry was lost can never be served
 *   by `isCacheValid` anyway, so it is pure dead weight.
 */
const collectCacheEntries = skip => {
  const entries = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!isEvictableCacheKey(key)) continue;
    if (skip?.has(key)) continue;

    const value = localStorage.getItem(key);
    const rawExpiry = localStorage.getItem(key + '_expiry');
    const expiry = Number.parseInt(rawExpiry, 10);

    entries.push({
      key,
      bytes: entryBytes(key, value) + entryBytes(key + '_expiry', rawExpiry),
      expiry: Number.isFinite(expiry) ? expiry : 0,
    });
  }

  return entries;
};

/**
 * Delete every expired cache entry. This is the leak fix: expiry was only ever
 * consulted on read, so an entry the user never re-requested occupied quota
 * forever.
 *
 * @param {number} [now] - injectable clock for tests
 * @param {Set<string>} [skip] - keys to leave alone (see collectCacheEntries)
 * @returns {{removed: number, freedBytes: number}}
 */
export const purgeExpiredCacheEntries = (now = Date.now(), skip) => {
  let removed = 0;
  let freedBytes = 0;

  try {
    for (const entry of collectCacheEntries(skip)) {
      if (entry.expiry > now) continue;
      if (!safeRemove(entry.key)) continue;
      removed++;
      freedBytes += entry.bytes;
    }
  } catch (error) {
    console.warn('💾 Expired-cache purge failed:', error.message);
  }

  if (removed > 0) {
    console.log(`💾 Purged ${removed} expired cache entries (${freedBytes} bytes)`);
  }

  return { removed, freedBytes };
};

/**
 * Reclaim space by dropping the cache entries closest to expiry first - those
 * have the least remaining value. Not an LRU: localStorage records no access
 * time, and expiry is the only ordering signal actually on disk.
 *
 * @param {number} targetBytes - stop once at least this much is freed
 * @param {number} [now] - injectable clock for tests
 * @param {Set<string>} [skip] - keys to leave alone (see collectCacheEntries)
 * @returns {{removed: number, freedBytes: number}}
 */
export const evictCacheEntries = (targetBytes, now = Date.now(), skip) => {
  let removed = 0;
  let freedBytes = 0;

  try {
    const candidates = collectCacheEntries(skip).sort((a, b) => a.expiry - b.expiry);

    for (const entry of candidates) {
      if (freedBytes >= targetBytes) break;
      if (!safeRemove(entry.key)) continue;
      removed++;
      freedBytes += entry.bytes;
    }
  } catch (error) {
    console.warn('💾 Cache eviction failed:', error.message);
  }

  if (removed > 0) {
    console.log(`💾 Evicted ${removed} cache entries (${freedBytes} bytes) to free space`);
  }

  // `now` is accepted for symmetry with purgeExpiredCacheEntries and to keep
  // the call sites uniform; expiry ordering needs no clock of its own.
  void now;

  return { removed, freedBytes };
};

/** Floor for a reclaim attempt, so one tiny write does not trigger one tiny eviction. */
const MIN_RECLAIM_BYTES = 256 * 1024;

/**
 * Write to localStorage without ever throwing.
 *
 * On a quota error the space is reclaimed in two escalating steps - expired
 * entries first (free, nobody wanted them), then nearest-to-expiry entries -
 * retrying the write after each. Any non-quota failure (private mode, storage
 * disabled, serialisation) returns false immediately rather than destroying
 * caches for a problem eviction cannot solve.
 *
 * @param {string} key
 * @param {string} value
 * @param {object} [options]
 * @param {string} [options.label] - human name for the log line
 * @param {string[]} [options.reserve] - cache keys reclaiming must not touch,
 *   used when writing one half of a value/expiry pair so the other half is not
 *   evicted to make room for it
 * @returns {boolean} true when the value is on disk
 */
export const safeSetItem = (key, value, { label, reserve } = {}) => {
  const describe = label || key;
  const payload = String(value);
  const skip = reserve?.length ? new Set(reserve) : undefined;

  const attempt = () => {
    localStorage.setItem(key, payload);
    return true;
  };

  try {
    return attempt();
  } catch (error) {
    if (!isQuotaError(error)) {
      console.warn(`💾 Could not store ${describe}:`, error.message);
      return false;
    }
    console.warn(`💾 Storage quota reached while storing ${describe} - reclaiming space`);
  }

  const needed = Math.max(entryBytes(key, payload) * 2, MIN_RECLAIM_BYTES);

  if (purgeExpiredCacheEntries(Date.now(), skip).removed > 0) {
    try {
      return attempt();
    } catch (error) {
      if (!isQuotaError(error)) {
        console.warn(`💾 Could not store ${describe}:`, error.message);
        return false;
      }
    }
  }

  if (evictCacheEntries(needed, Date.now(), skip).removed > 0) {
    try {
      return attempt();
    } catch (error) {
      if (!isQuotaError(error)) {
        console.warn(`💾 Could not store ${describe}:`, error.message);
        return false;
      }
    }
  }

  console.error(
    `💾 Storage full - ${describe} was not saved. Clear the cache from the Debug panel if this persists.`
  );
  return false;
};

/**
 * Current footprint of the evictable caches. Used by the debug panel so the
 * quota can be seen filling up instead of only discovered on failure.
 *
 * @param {number} [now] - injectable clock for tests
 * @returns {{entries: number, expiredEntries: number, bytes: number}}
 */
export const getCacheFootprint = (now = Date.now()) => {
  const entries = collectCacheEntries();

  return {
    entries: entries.length,
    expiredEntries: entries.filter(entry => entry.expiry <= now).length,
    bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
};
