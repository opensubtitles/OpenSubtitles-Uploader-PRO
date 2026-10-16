/**
 * Upload rate-limit policy — pure functions, no storage, no React.
 *
 * Scope note: this is CLIENT-SIDE throttling. It stops accidental and casual
 * flooding (someone dropping four seasons into the app at once). It is not a
 * security boundary — browser storage can be cleared and the counter resets.
 * Server-side enforcement remains the authoritative gate.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Rolling windows, evaluated together. A batch is allowed only if it fits in
 * every window at once.
 */
export const UPLOAD_LIMIT_WINDOWS = [
  // `spanLabel` spells out that the window rolls. Users read "per day" as
  // "resets at midnight" and then ask what the number is even counting, so the
  // UI says "in last 24h" instead.
  { key: 'day', label: 'day', spanLabel: 'in last 24h', windowMs: DAY_MS, limit: 50 },
  { key: 'week', label: 'week', spanLabel: 'in last 7 days', windowMs: 7 * DAY_MS, limit: 200 },
];

/**
 * Ranks the limits apply to. "trusted" and "trusted member" are distinct ranks
 * in UserService; both are limited and treated identically here.
 */
export const LIMITED_RANKS = [
  'trusted',
  'trusted member',
  'gold member',
  'platinum member',
  'translator',
];

/**
 * Ranks exempt from limits. Their uploads are still recorded in the ledger —
 * logging is unconditional, only enforcement is rank-dependent.
 */
export const EXEMPT_RANKS = [
  'administrator',
  'admin',
  'super admin',
  'moderator',
  'os legend',
  'subtranslator',
];

/** How long ledger entries are kept — covers the 7d window plus usable history. */
export const LEDGER_RETENTION_MS = 30 * DAY_MS;

const normalizeRank = rank => String(rank ?? '').trim().toLowerCase();

export const normalizeRanks = ranks =>
  (Array.isArray(ranks) ? ranks : [ranks])
    .map(normalizeRank)
    .filter(rank => rank !== '');

/**
 * Decide whether limits are enforced for a set of ranks.
 *
 * Exempt beats limited: a gold member who is also a moderator is exempt. The
 * most privileged rank a user holds decides, so adding responsibility never
 * costs someone allowance.
 *
 * `status` distinguishes the two non-enforced cases, which mean opposite things
 * to the user and must never share a message: 'exempt' is a privilege (upload
 * freely), 'unranked' means the account cannot upload at all. LIMITED_RANKS plus
 * EXEMPT_RANKS cover every rank in UserService.validateUserRank's allowedRanks,
 * so anything left over is an account the upload gate rejects upstream.
 *
 * @param {string[]|string} ranks - effective ranks (see UserService.getEffectiveRanks)
 * @returns {{enforced: boolean, status: 'exempt'|'limited'|'unranked', reason: string, matchedRanks: string[]}}
 */
export const classifyUploadLimitPolicy = ranks => {
  const normalized = normalizeRanks(ranks);

  const exemptMatches = normalized.filter(rank => EXEMPT_RANKS.includes(rank));
  if (exemptMatches.length > 0) {
    return {
      enforced: false,
      status: 'exempt',
      reason: `Exempt rank: ${exemptMatches.join(', ')}`,
      matchedRanks: exemptMatches,
    };
  }

  const limitedMatches = normalized.filter(rank => LIMITED_RANKS.includes(rank));
  if (limitedMatches.length > 0) {
    return {
      enforced: true,
      status: 'limited',
      reason: `Limited rank: ${limitedMatches.join(', ')}`,
      matchedRanks: limitedMatches,
    };
  }

  // No rank we recognise. Such accounts cannot upload at all (see
  // UserService.validateUserRank), so there is nothing to throttle — but they
  // are emphatically not "unlimited".
  return {
    enforced: false,
    status: 'unranked',
    reason: normalized.length
      ? `Rank "${normalized.join(', ')}" cannot upload subtitles`
      : 'No rank reported for this account',
    matchedRanks: [],
  };
};

/**
 * Usage for one rolling window.
 *
 * nextSlotAt answers "when does one slot free up", which needs the
 * (used - limit + 1)-th oldest entry to age out — not simply the oldest. That
 * distinction matters whenever usage sits above the limit, which happens for a
 * user who was exempt and lost the rank, or after a limit is lowered.
 */
const evaluateWindow = (timestamps, window, now) => {
  const inWindow = timestamps.filter(ts => ts > now - window.windowMs).sort((a, b) => a - b);
  const used = inWindow.length;
  const remaining = Math.max(0, window.limit - used);

  let nextSlotAt = null;
  if (remaining === 0 && used > 0) {
    const indexToExpire = Math.min(used - window.limit, used - 1);
    nextSlotAt = inWindow[Math.max(0, indexToExpire)] + window.windowMs;
  }

  return { ...window, used, remaining, nextSlotAt };
};

/**
 * Evaluate ledger entries against the policy.
 *
 * @param {Array<{ts: number, counted?: boolean}>} entries - ledger entries
 * @param {object} [options]
 * @param {string[]|string} [options.ranks] - effective ranks
 * @param {number} [options.now] - current epoch ms (injectable for tests)
 * @param {Array} [options.windows] - override windows (tests)
 * @returns {object} limit state
 */
export const evaluateUploadLimits = (entries, { ranks, now = Date.now(), windows } = {}) => {
  const activeWindows = windows || UPLOAD_LIMIT_WINDOWS;
  const policy = classifyUploadLimitPolicy(ranks);

  const countedTimestamps = (Array.isArray(entries) ? entries : [])
    .filter(entry => entry && entry.counted !== false && Number.isFinite(entry.ts))
    .map(entry => entry.ts);

  const windowStates = activeWindows.map(window =>
    evaluateWindow(countedTimestamps, window, now)
  );

  if (!policy.enforced) {
    return {
      enforced: false,
      status: policy.status,
      reason: policy.reason,
      matchedRanks: policy.matchedRanks,
      windows: windowStates,
      allowance: Infinity,
      blocked: false,
      blockingWindow: null,
      nextSlotAt: null,
    };
  }

  const allowance = windowStates.reduce(
    (min, window) => Math.min(min, window.remaining),
    Infinity
  );
  const exhausted = windowStates.filter(window => window.remaining === 0);
  // Report the window that frees up first, so the user sees the soonest retry.
  const blockingWindow =
    exhausted.sort((a, b) => (a.nextSlotAt ?? Infinity) - (b.nextSlotAt ?? Infinity))[0] || null;

  return {
    enforced: true,
    status: policy.status,
    reason: policy.reason,
    matchedRanks: policy.matchedRanks,
    windows: windowStates,
    allowance,
    blocked: allowance === 0,
    blockingWindow,
    nextSlotAt: blockingWindow?.nextSlotAt ?? null,
  };
};

/**
 * Can a batch of `count` subtitles be uploaded right now?
 *
 * Hard-block semantics: a batch larger than the remaining allowance is refused
 * whole rather than partially uploaded.
 *
 * @param {object} limitState - result of evaluateUploadLimits
 * @param {number} count - subtitles the user is trying to upload
 * @returns {{allowed: boolean, reason: string|null}}
 */
export const canUploadBatch = (limitState, count) => {
  if (!limitState?.enforced) return { allowed: true, reason: null };
  if (!Number.isFinite(count) || count <= 0) return { allowed: true, reason: null };

  if (limitState.blocked) {
    const window = limitState.blockingWindow;
    return {
      allowed: false,
      reason: window
        ? `Upload limit reached (${window.used}/${window.limit} per ${window.label}).`
        : 'Upload limit reached.',
    };
  }

  if (count > limitState.allowance) {
    const window = limitState.windows.find(w => w.remaining === limitState.allowance);
    return {
      allowed: false,
      reason: window
        ? `Only ${limitState.allowance} of ${window.limit} uploads left this ${window.label} — ${count} selected.`
        : `Only ${limitState.allowance} uploads left — ${count} selected.`,
    };
  }

  return { allowed: true, reason: null };
};

/**
 * Should this upload outcome count against the limit?
 *
 * Counted: new subtitles accepted by the server, including anonymous uploads —
 * otherwise toggling "upload as anonymous" would be a free bypass.
 * Not counted: already-in-database (nothing was added) and failures (genuine
 * errors shouldn't burn allowance).
 *
 * @param {string} status - 'success' | 'exists' | 'failed' | 'unknown'
 * @returns {boolean}
 */
export const countsTowardLimit = status => status === 'success';

/**
 * Human-readable "3h 14m" for a future timestamp.
 *
 * @param {number} targetTs - epoch ms
 * @param {number} [now]
 * @returns {string}
 */
export const formatTimeUntil = (targetTs, now = Date.now()) => {
  const ms = targetTs - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'now';

  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};
