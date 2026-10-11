import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Minimal localStorage before the service module is imported.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  clear: () => store.clear(),
  key: index => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

const {
  UploadLedgerService,
  getLedgerKey,
  readEntries,
  recordUpload,
  getLimitState,
  checkUploadAllowed,
  getUploadHistory,
  clearLedger,
} = await import('../../src/services/uploadLedgerService.js');

const NOW = 1_760_000_000_000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const limitedUser = { IDUser: '4242', UserNickName: 'uploader', UserRank: 'gold member' };
const exemptUser = { IDUser: '777', UserNickName: 'boss', UserRank: 'moderator' };
const multiRankUser = {
  IDUser: '999',
  UserNickName: 'both',
  UserRank: 'gold member',
  UserRanks: ['moderator'],
};

const fill = (userInfo, count, { status = 'success', startAgoMs = 0, spacingMs = 60_000 } = {}) => {
  for (let i = 0; i < count; i++) {
    recordUpload(userInfo, { filename: `s${i}.srt`, status }, NOW - startAgoMs - i * spacingMs);
  }
};

describe('uploadLedgerService', () => {
  beforeEach(() => store.clear());

  describe('storage keying', () => {
    test('keys the ledger on IDUser so accounts do not share allowance', () => {
      const a = getLedgerKey({ IDUser: '1' });
      const b = getLedgerKey({ IDUser: '2' });
      assert.notStrictEqual(a, b);
      assert.match(a, /_u1$/);
    });

    test('falls back to a stable device bucket without an account', () => {
      const first = getLedgerKey({});
      const second = getLedgerKey(null);
      assert.strictEqual(first, second);
      assert.match(first, /_device_/);
    });

    test('entries from one user are invisible to another', () => {
      fill(limitedUser, 3);
      assert.strictEqual(readEntries(limitedUser, NOW).length, 3);
      assert.strictEqual(readEntries(exemptUser, NOW).length, 0);
    });
  });

  describe('recordUpload', () => {
    test('stores when, what and the outcome', () => {
      const entry = recordUpload(
        limitedUser,
        {
          filename: 'Astro Boy s01e05.en.srt',
          status: 'success',
          movieName: 'Astro Boy - S01E05',
          imdbid: '1436510',
          language: 'en',
          url: 'https://www.opensubtitles.org/en/subtitles/123',
        },
        NOW
      );

      assert.strictEqual(entry.ts, NOW);
      assert.strictEqual(entry.filename, 'Astro Boy s01e05.en.srt');
      assert.strictEqual(entry.status, 'success');
      assert.strictEqual(entry.counted, true);
      assert.strictEqual(entry.imdbid, '1436510');
      assert.strictEqual(entry.rank, 'gold member');
    });

    test('logs exempt users too — only enforcement is rank-dependent', () => {
      recordUpload(exemptUser, { filename: 'a.srt', status: 'success' }, NOW);
      assert.strictEqual(readEntries(exemptUser, NOW).length, 1);
    });

    test('marks duplicates and failures as not counted', () => {
      const dupe = recordUpload(limitedUser, { filename: 'b.srt', status: 'exists' }, NOW);
      const failed = recordUpload(limitedUser, { filename: 'c.srt', status: 'failed' }, NOW);
      assert.strictEqual(dupe.counted, false);
      assert.strictEqual(failed.counted, false);
    });

    test('anonymous uploads are recorded and still count', () => {
      const entry = recordUpload(
        limitedUser,
        { filename: 'd.srt', status: 'success', anonymous: true },
        NOW
      );
      assert.strictEqual(entry.anonymous, true);
      assert.strictEqual(entry.counted, true);
    });

    test('returns newest first', () => {
      recordUpload(limitedUser, { filename: 'old.srt', status: 'success' }, NOW - HOUR);
      recordUpload(limitedUser, { filename: 'new.srt', status: 'success' }, NOW);
      assert.strictEqual(readEntries(limitedUser, NOW)[0].filename, 'new.srt');
    });
  });

  describe('retention', () => {
    test('drops entries older than 30 days on read', () => {
      recordUpload(limitedUser, { filename: 'ancient.srt', status: 'success' }, NOW - 31 * DAY);
      recordUpload(limitedUser, { filename: 'recent.srt', status: 'success' }, NOW);
      const kept = readEntries(limitedUser, NOW);
      assert.strictEqual(kept.length, 1);
      assert.strictEqual(kept[0].filename, 'recent.srt');
    });

    test('survives corrupted storage without throwing', () => {
      localStorage.setItem(getLedgerKey(limitedUser), 'not json');
      assert.deepStrictEqual(readEntries(limitedUser, NOW), []);

      localStorage.setItem(getLedgerKey(limitedUser), '{"not":"an array"}');
      assert.deepStrictEqual(readEntries(limitedUser, NOW), []);
    });
  });

  describe('enforcement', () => {
    test('a limited user is blocked at the daily limit', () => {
      fill(limitedUser, 50, { spacingMs: 10 * 60_000 });
      const state = getLimitState(limitedUser, NOW);
      assert.strictEqual(state.enforced, true);
      assert.strictEqual(state.blocked, true);
      assert.strictEqual(checkUploadAllowed(limitedUser, 1, NOW).allowed, false);
    });

    test('duplicates and failures do not consume allowance', () => {
      fill(limitedUser, 80, { status: 'exists', spacingMs: 10 * 60_000 });
      const state = getLimitState(limitedUser, NOW);
      assert.strictEqual(state.blocked, false);
      assert.strictEqual(state.allowance, 50);
    });

    test('an exempt user is never blocked however much they upload', () => {
      fill(exemptUser, 300, { spacingMs: 60_000 });
      const state = getLimitState(exemptUser, NOW);
      assert.strictEqual(state.enforced, false);
      assert.strictEqual(checkUploadAllowed(exemptUser, 1000, NOW).allowed, true);
    });

    test('a gold member who is also a moderator is exempt', () => {
      fill(multiRankUser, 60, { spacingMs: 10 * 60_000 });
      assert.strictEqual(getLimitState(multiRankUser, NOW).enforced, false);
    });

    test('the weekly limit binds even when today is quiet', () => {
      fill(limitedUser, 200, { startAgoMs: 2 * DAY, spacingMs: 30 * 60_000 });
      const state = getLimitState(limitedUser, NOW);
      assert.strictEqual(state.windows.find(w => w.key === 'day').used, 0);
      assert.strictEqual(state.blocked, true);
      assert.strictEqual(state.blockingWindow.key, 'week');
    });

    test('a batch larger than the allowance is refused whole', () => {
      fill(limitedUser, 45, { spacingMs: 10 * 60_000 });
      assert.strictEqual(checkUploadAllowed(limitedUser, 5, NOW).allowed, true);
      const over = checkUploadAllowed(limitedUser, 6, NOW);
      assert.strictEqual(over.allowed, false);
      assert.match(over.reason, /Only 5 of 50/);
    });

    test('allowance recovers as entries age out of the window', () => {
      fill(limitedUser, 50, { startAgoMs: 23 * HOUR, spacingMs: 60_000 });
      assert.strictEqual(checkUploadAllowed(limitedUser, 1, NOW).allowed, false);
      // One hour later the whole batch has left the 24h window.
      assert.strictEqual(checkUploadAllowed(limitedUser, 1, NOW + 2 * HOUR).allowed, true);
    });
  });

  describe('getUploadHistory', () => {
    test('summarises how much and when', () => {
      recordUpload(limitedUser, { filename: 'a.srt', status: 'success' }, NOW - 10 * 60_000);
      recordUpload(limitedUser, { filename: 'b.srt', status: 'exists' }, NOW - 5 * HOUR);
      recordUpload(limitedUser, { filename: 'c.srt', status: 'failed' }, NOW - 3 * DAY);
      recordUpload(limitedUser, { filename: 'd.srt', status: 'success' }, NOW - 10 * DAY);

      const { entries: rows, summary } = getUploadHistory(limitedUser, NOW);

      assert.strictEqual(rows.length, 4);
      assert.strictEqual(summary.total, 4);
      assert.strictEqual(summary.counted, 2);
      assert.strictEqual(summary.lastHour, 1);
      assert.strictEqual(summary.last24h, 2);
      assert.strictEqual(summary.last7d, 3);
      assert.strictEqual(summary.last30d, 4);
      assert.strictEqual(summary.counted24h, 1);
      assert.deepStrictEqual(summary.byStatus, { success: 2, exists: 1, failed: 1 });
      assert.strictEqual(summary.lastUpload, NOW - 10 * 60_000);
      assert.strictEqual(summary.firstUpload, NOW - 10 * DAY);
    });

    test('is empty and safe for a user who never uploaded', () => {
      const { entries: rows, summary, limitState } = getUploadHistory(limitedUser, NOW);
      assert.deepStrictEqual(rows, []);
      assert.strictEqual(summary.total, 0);
      assert.strictEqual(summary.firstUpload, null);
      assert.strictEqual(limitState.allowance, 50);
    });
  });

  test('clearLedger removes only that user', () => {
    fill(limitedUser, 3);
    fill(exemptUser, 2);
    clearLedger(limitedUser);
    assert.strictEqual(readEntries(limitedUser, NOW).length, 0);
    assert.strictEqual(readEntries(exemptUser, NOW).length, 2);
  });

  test('exposes the same functions on the namespace object', () => {
    for (const name of [
      'getLedgerKey',
      'readEntries',
      'recordUpload',
      'getLimitState',
      'checkUploadAllowed',
      'getUploadHistory',
      'clearLedger',
    ]) {
      assert.strictEqual(typeof UploadLedgerService[name], 'function', name);
    }
  });
});
