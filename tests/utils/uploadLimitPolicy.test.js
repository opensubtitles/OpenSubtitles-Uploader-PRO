import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  EXEMPT_RANKS,
  LIMITED_RANKS,
  UPLOAD_LIMIT_WINDOWS,
  canUploadBatch,
  classifyUploadLimitPolicy,
  countsTowardLimit,
  evaluateUploadLimits,
  formatTimeUntil,
} from '../../src/utils/uploadLimitPolicy.js';

const NOW = 1_760_000_000_000; // fixed clock so window maths is deterministic
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** n counted entries, each `spacingMs` apart, ending `endAgoMs` before NOW. */
const entries = (n, { spacingMs = 60_000, endAgoMs = 0, counted = true } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    ts: NOW - endAgoMs - i * spacingMs,
    counted,
  }));

describe('classifyUploadLimitPolicy', () => {
  test('enforces limits for every rank in the limited list', () => {
    for (const rank of LIMITED_RANKS) {
      const result = classifyUploadLimitPolicy([rank]);
      assert.strictEqual(result.enforced, true, `${rank} should be limited`);
    }
  });

  test('exempts every rank in the exempt list', () => {
    for (const rank of EXEMPT_RANKS) {
      const result = classifyUploadLimitPolicy([rank]);
      assert.strictEqual(result.enforced, false, `${rank} should be exempt`);
    }
  });

  test('"trusted" and "trusted member" are both limited', () => {
    assert.strictEqual(classifyUploadLimitPolicy(['trusted']).enforced, true);
    assert.strictEqual(classifyUploadLimitPolicy(['trusted member']).enforced, true);
  });

  test('exempt beats limited for multi-rank users', () => {
    // A gold member who is also a moderator keeps the moderator exemption.
    const result = classifyUploadLimitPolicy(['gold member', 'moderator']);
    assert.strictEqual(result.enforced, false);
    assert.deepStrictEqual(result.matchedRanks, ['moderator']);
  });

  test('is case and whitespace insensitive', () => {
    assert.strictEqual(classifyUploadLimitPolicy(['  Gold Member ']).enforced, true);
    assert.strictEqual(classifyUploadLimitPolicy(['SUPER ADMIN']).enforced, false);
  });

  test('accepts a bare string as well as an array', () => {
    assert.strictEqual(classifyUploadLimitPolicy('translator').enforced, true);
  });

  test('unrecognised ranks are not enforced (they cannot upload at all)', () => {
    const result = classifyUploadLimitPolicy(['bronze member']);
    assert.strictEqual(result.enforced, false);
    assert.deepStrictEqual(result.matchedRanks, []);
  });

  test('unranked is distinct from exempt — never reported as "no limits"', () => {
    // bronze member is rejected by UserService.validateUserRank, so telling them
    // they have no upload limits is the opposite of the truth.
    const bronze = classifyUploadLimitPolicy(['bronze member']);
    assert.strictEqual(bronze.status, 'unranked');
    assert.match(bronze.reason, /cannot upload/);

    assert.strictEqual(classifyUploadLimitPolicy(['moderator']).status, 'exempt');
    assert.strictEqual(classifyUploadLimitPolicy(['gold member']).status, 'limited');
  });

  test('status survives evaluateUploadLimits', () => {
    assert.strictEqual(evaluateUploadLimits([], { ranks: ['bronze member'] }).status, 'unranked');
    assert.strictEqual(evaluateUploadLimits([], { ranks: ['moderator'] }).status, 'exempt');
    assert.strictEqual(evaluateUploadLimits([], { ranks: ['trusted'] }).status, 'limited');
  });

  test('every rank allowed to upload is covered by one of the two lists', () => {
    // Mirrors UserService.validateUserRank allowedRanks. If a rank is added
    // there without landing in a list here, it would silently go unthrottled.
    const allowedToUpload = [
      'super admin',
      'translator',
      'trusted member',
      'administrator',
      'moderator',
      'gold member',
      'platinum member',
      'trusted',
      'subtranslator',
      'os legend',
    ];
    for (const rank of allowedToUpload) {
      assert.notStrictEqual(
        classifyUploadLimitPolicy([rank]).status,
        'unranked',
        `${rank} can upload but matches no limit policy`
      );
    }
  });

  test('handles empty and malformed rank input', () => {
    for (const input of [[], [''], [null], [undefined], null, undefined]) {
      assert.strictEqual(classifyUploadLimitPolicy(input).enforced, false);
    }
  });
});

describe('evaluateUploadLimits', () => {
  test('exempt users get infinite allowance but still report usage', () => {
    const state = evaluateUploadLimits(entries(500), { ranks: ['moderator'], now: NOW });
    assert.strictEqual(state.enforced, false);
    assert.strictEqual(state.allowance, Infinity);
    assert.strictEqual(state.blocked, false);
    // Logging is unconditional — the windows still show what happened.
    assert.ok(state.windows[0].used > 0);
  });

  test('counts only entries inside each rolling window', () => {
    const state = evaluateUploadLimits(
      [
        ...entries(10, { spacingMs: HOUR }), // last 10 hours
        ...entries(5, { spacingMs: HOUR, endAgoMs: 3 * DAY }), // 3 days ago
        ...entries(7, { spacingMs: HOUR, endAgoMs: 20 * DAY }), // outside both
      ],
      { ranks: ['trusted'], now: NOW }
    );

    const day = state.windows.find(w => w.key === 'day');
    const week = state.windows.find(w => w.key === 'week');
    assert.strictEqual(day.used, 10);
    assert.strictEqual(week.used, 15);
  });

  test('ignores entries flagged counted:false', () => {
    const state = evaluateUploadLimits(
      [...entries(5), ...entries(40, { counted: false })],
      { ranks: ['trusted'], now: NOW }
    );
    assert.strictEqual(state.windows.find(w => w.key === 'day').used, 5);
  });

  test('ignores entries with a non-numeric timestamp', () => {
    const state = evaluateUploadLimits(
      [{ ts: 'yesterday', counted: true }, { ts: null, counted: true }, ...entries(3)],
      { ranks: ['trusted'], now: NOW }
    );
    assert.strictEqual(state.windows.find(w => w.key === 'day').used, 3);
  });

  test('allowance is the tightest window, not the daily one', () => {
    // 198 uploads spread over the week, only 2 of them today: the weekly
    // window is the binding constraint even though the day looks almost empty.
    const state = evaluateUploadLimits(
      [
        ...entries(2, { spacingMs: HOUR }),
        ...entries(196, { spacingMs: 30 * 60 * 1000, endAgoMs: 2 * DAY }),
      ],
      { ranks: ['translator'], now: NOW }
    );
    assert.strictEqual(state.allowance, 2);
    assert.strictEqual(state.blocked, false);
  });

  test('blocks when a window is exhausted and reports when a slot frees up', () => {
    // 50 entries at 10-minute spacing all land inside the 24h window.
    const batch = entries(50, { spacingMs: 10 * 60_000 });
    const state = evaluateUploadLimits(batch, { ranks: ['gold member'], now: NOW });

    assert.strictEqual(state.blocked, true);
    assert.strictEqual(state.allowance, 0);
    assert.strictEqual(state.blockingWindow.key, 'day');
    // At exactly the limit, the oldest entry aging out is what frees a slot.
    const oldest = Math.min(...batch.map(e => e.ts));
    assert.strictEqual(state.nextSlotAt, oldest + DAY);
  });

  test('entries spread beyond a window do not block it', () => {
    // 50 uploads at hourly spacing: only ~24 are ever inside the 24h window.
    const state = evaluateUploadLimits(entries(50, { spacingMs: HOUR }), {
      ranks: ['gold member'],
      now: NOW,
    });
    assert.strictEqual(state.windows.find(w => w.key === 'day').used, 24);
    assert.strictEqual(state.blocked, false);
  });

  test('nextSlotAt accounts for usage above the limit', () => {
    // 52 entries in a 50/day window: two must age out before a slot opens.
    const ts = Array.from({ length: 52 }, (_, i) => ({ ts: NOW - i * 60_000, counted: true }));
    const state = evaluateUploadLimits(ts, { ranks: ['trusted'], now: NOW });

    const sortedAsc = ts.map(e => e.ts).sort((a, b) => a - b);
    assert.strictEqual(state.nextSlotAt, sortedAsc[2] + DAY);
  });

  test('reports the soonest-freeing window when both are exhausted', () => {
    const state = evaluateUploadLimits(
      [
        ...entries(50, { spacingMs: 60_000 }), // today — frees up in ~24h
        ...entries(150, { spacingMs: 60_000, endAgoMs: 6 * DAY }), // frees up in ~1d
      ],
      { ranks: ['trusted'], now: NOW }
    );
    assert.strictEqual(state.blocked, true);
    const soonest = Math.min(
      ...state.windows.filter(w => w.remaining === 0).map(w => w.nextSlotAt)
    );
    assert.strictEqual(state.nextSlotAt, soonest);
  });

  test('empty ledger leaves the full allowance', () => {
    const state = evaluateUploadLimits([], { ranks: ['trusted'], now: NOW });
    assert.strictEqual(state.allowance, 50);
    assert.strictEqual(state.blocked, false);
    assert.strictEqual(state.nextSlotAt, null);
  });

  test('tolerates a non-array ledger', () => {
    const state = evaluateUploadLimits(null, { ranks: ['trusted'], now: NOW });
    assert.strictEqual(state.allowance, 50);
  });
});

describe('canUploadBatch', () => {
  const limited = count =>
    evaluateUploadLimits(entries(count), { ranks: ['trusted'], now: NOW });

  test('allows a batch that fits the allowance', () => {
    assert.strictEqual(canUploadBatch(limited(10), 40).allowed, true);
  });

  test('allows a batch exactly at the allowance', () => {
    assert.strictEqual(canUploadBatch(limited(10), 40).allowed, true);
  });

  test('refuses a batch one over the allowance — hard block, not partial', () => {
    const result = canUploadBatch(limited(10), 41);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason, /Only 40 of 50 uploads left this day — 41 selected/);
  });

  test('refuses everything once blocked', () => {
    const result = canUploadBatch(limited(50), 1);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason, /Upload limit reached \(50\/50 per day\)/);
  });

  test('never blocks an exempt user', () => {
    const state = evaluateUploadLimits(entries(1000), { ranks: ['super admin'], now: NOW });
    assert.strictEqual(canUploadBatch(state, 5000).allowed, true);
  });

  test('treats a zero or malformed count as allowed', () => {
    for (const count of [0, -3, NaN, undefined, null]) {
      assert.strictEqual(canUploadBatch(limited(10), count).allowed, true);
    }
  });

  test('tolerates a missing limit state', () => {
    assert.strictEqual(canUploadBatch(null, 10).allowed, true);
  });
});

describe('countsTowardLimit', () => {
  test('only new successful uploads count', () => {
    assert.strictEqual(countsTowardLimit('success'), true);
    assert.strictEqual(countsTowardLimit('exists'), false);
    assert.strictEqual(countsTowardLimit('failed'), false);
    assert.strictEqual(countsTowardLimit('unknown'), false);
    assert.strictEqual(countsTowardLimit(undefined), false);
  });
});

describe('formatTimeUntil', () => {
  test('formats hours and minutes', () => {
    assert.strictEqual(formatTimeUntil(NOW + 3 * HOUR + 14 * 60_000, NOW), '3h 14m');
  });

  test('drops minutes on a whole hour', () => {
    assert.strictEqual(formatTimeUntil(NOW + 2 * HOUR, NOW), '2h');
  });

  test('formats minutes only under an hour', () => {
    assert.strictEqual(formatTimeUntil(NOW + 7 * 60_000, NOW), '7m');
  });

  test('formats days for long waits', () => {
    assert.strictEqual(formatTimeUntil(NOW + 6 * DAY + 5 * HOUR, NOW), '6d 5h');
  });

  test('past and invalid targets read as now', () => {
    assert.strictEqual(formatTimeUntil(NOW - 1000, NOW), 'now');
    assert.strictEqual(formatTimeUntil(NaN, NOW), 'now');
  });
});

describe('configured limits', () => {
  test('are 50 per day and 200 per week', () => {
    assert.deepStrictEqual(
      UPLOAD_LIMIT_WINDOWS.map(w => [w.key, w.limit]),
      [
        ['day', 50],
        ['week', 200],
      ]
    );
  });
});
