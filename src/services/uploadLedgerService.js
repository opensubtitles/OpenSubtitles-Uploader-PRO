import {
  LEDGER_RETENTION_MS,
  UPLOAD_LIMIT_WINDOWS,
  canUploadBatch,
  countsTowardLimit,
  evaluateUploadLimits,
} from '../utils/uploadLimitPolicy.js';
import { UserService } from './userService.js';

/**
 * Local upload ledger — records every upload this device performs and derives
 * rate-limit state from it.
 *
 * Deliberately NOT routed through CacheService: that layer expires whole keys
 * on a TTL, which would silently wipe the ledger mid-window. Retention is
 * handled here by pruning individual entries instead.
 *
 * Storage is localStorage, which covers the web build and the Tauri desktop
 * build alike (Tauri runs a webview). See uploadLimitPolicy.js for why this is
 * throttling and not a security boundary.
 */

const LEDGER_KEY_PREFIX = 'opensubtitles_upload_ledger_v1';
const DEVICE_ID_KEY = 'opensubtitles_upload_ledger_device_id';

/** Hard cap so a long-lived install cannot grow localStorage without bound. */
const MAX_ENTRIES = 2000;

const hasStorage = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
};

const randomId = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    /* fall through to the Math.random path below */
  }
  return `d${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
};

/**
 * Stable per-install identifier, used only when no account is known.
 * @returns {string}
 */
export const getDeviceId = () => {
  if (!hasStorage()) return 'device';
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'device';
  }
};

/**
 * Ledger storage key. Keyed on IDUser so switching accounts on one machine
 * does not pool allowance; falls back to a device bucket when the account is
 * unknown.
 *
 * @param {object} userInfo - GetUserInfo response
 * @returns {string}
 */
export const getLedgerKey = userInfo => {
  const idUser = userInfo?.IDUser;
  if (idUser) return `${LEDGER_KEY_PREFIX}_u${idUser}`;
  return `${LEDGER_KEY_PREFIX}_device_${getDeviceId()}`;
};

const pruneEntries = (entries, now) => {
  const cutoff = now - LEDGER_RETENTION_MS;
  const fresh = entries
    .filter(entry => entry && Number.isFinite(entry.ts) && entry.ts > cutoff)
    .sort((a, b) => b.ts - a.ts);

  return fresh.slice(0, MAX_ENTRIES);
};

/**
 * Read ledger entries, newest first. Pruning happens on read so an entry can
 * never outlive retention even if nothing is written for months.
 *
 * @param {object} userInfo
 * @param {number} [now]
 * @returns {Array<object>}
 */
export const readEntries = (userInfo, now = Date.now()) => {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(getLedgerKey(userInfo));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return pruneEntries(parsed, now);
  } catch (error) {
    console.warn('📒 Upload ledger unreadable, starting fresh:', error.message);
    return [];
  }
};

const writeEntries = (userInfo, entries, now = Date.now()) => {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(getLedgerKey(userInfo), JSON.stringify(pruneEntries(entries, now)));
    return true;
  } catch (error) {
    console.warn('📒 Upload ledger write failed:', error.message);
    return false;
  }
};

/**
 * Record one upload outcome. Called for every outcome regardless of rank —
 * logging is unconditional, only enforcement depends on rank.
 *
 * @param {object} userInfo - GetUserInfo response
 * @param {object} upload
 * @param {string} upload.filename - subtitle filename
 * @param {string} upload.status - 'success' | 'exists' | 'failed' | 'unknown'
 * @param {string} [upload.movieName] - resolved movie/episode title
 * @param {string} [upload.imdbid] - IMDb ID the upload targeted
 * @param {string} [upload.language] - subtitle language code
 * @param {boolean} [upload.anonymous] - uploaded with the anonymous option
 * @param {string} [upload.url] - resulting subtitle URL when the server returned one
 * @param {number} [now]
 * @returns {object} the stored entry
 */
export const recordUpload = (userInfo, upload, now = Date.now()) => {
  const entry = {
    ts: now,
    filename: upload?.filename || 'unknown',
    status: upload?.status || 'unknown',
    counted: countsTowardLimit(upload?.status),
    movieName: upload?.movieName || null,
    imdbid: upload?.imdbid ? String(upload.imdbid) : null,
    language: upload?.language || null,
    anonymous: upload?.anonymous === true,
    url: upload?.url || null,
    rank: UserService.getUserRank(userInfo) || null,
  };

  const entries = readEntries(userInfo, now);
  entries.unshift(entry);
  writeEntries(userInfo, entries, now);

  return entry;
};

/**
 * Current rate-limit state for this user.
 *
 * @param {object} userInfo - GetUserInfo response
 * @param {number} [now]
 * @returns {object} see evaluateUploadLimits
 */
export const getLimitState = (userInfo, now = Date.now()) =>
  evaluateUploadLimits(readEntries(userInfo, now), {
    ranks: UserService.getEffectiveRanks(userInfo),
    now,
  });

/**
 * Whether a batch of `count` subtitles may be uploaded right now.
 *
 * @param {object} userInfo
 * @param {number} count
 * @param {number} [now]
 * @returns {{allowed: boolean, reason: string|null, limitState: object}}
 */
export const checkUploadAllowed = (userInfo, count, now = Date.now()) => {
  const limitState = getLimitState(userInfo, now);
  return { ...canUploadBatch(limitState, count), limitState };
};

/**
 * Upload history for display — "how much, when".
 *
 * @param {object} userInfo
 * @param {number} [now]
 * @returns {{entries: Array, summary: object, limitState: object}}
 */
export const getUploadHistory = (userInfo, now = Date.now()) => {
  const entries = readEntries(userInfo, now);
  const countedSince = ms =>
    entries.filter(entry => entry.counted && entry.ts > now - ms).length;
  const allSince = ms => entries.filter(entry => entry.ts > now - ms).length;

  return {
    entries,
    summary: {
      total: entries.length,
      counted: entries.filter(entry => entry.counted).length,
      lastHour: allSince(60 * 60 * 1000),
      last24h: allSince(24 * 60 * 60 * 1000),
      last7d: allSince(7 * 24 * 60 * 60 * 1000),
      last30d: allSince(LEDGER_RETENTION_MS),
      counted24h: countedSince(24 * 60 * 60 * 1000),
      counted7d: countedSince(7 * 24 * 60 * 60 * 1000),
      byStatus: entries.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      }, {}),
      firstUpload: entries.length ? entries[entries.length - 1].ts : null,
      lastUpload: entries.length ? entries[0].ts : null,
    },
    limitState: evaluateUploadLimits(entries, {
      ranks: UserService.getEffectiveRanks(userInfo),
      now,
    }),
  };
};

/**
 * Wipe this user's ledger. Exposed for the history UI and for support cases —
 * not a limit bypass we need to defend against, since the whole mechanism is
 * client-side and already resettable by clearing browser storage.
 *
 * @param {object} userInfo
 * @returns {boolean}
 */
export const clearLedger = userInfo => {
  if (!hasStorage()) return false;
  try {
    localStorage.removeItem(getLedgerKey(userInfo));
    return true;
  } catch (error) {
    console.warn('📒 Upload ledger clear failed:', error.message);
    return false;
  }
};

export const UPLOAD_LEDGER_WINDOWS = UPLOAD_LIMIT_WINDOWS;

export const UploadLedgerService = {
  getDeviceId,
  getLedgerKey,
  readEntries,
  recordUpload,
  getLimitState,
  checkUploadAllowed,
  getUploadHistory,
  clearLedger,
};
