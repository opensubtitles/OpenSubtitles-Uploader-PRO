import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

/** Byte-budgeted localStorage, so a quota failure can be provoked. */
const store = new Map();
let quotaBytes = Infinity;

const usedBytes = () => {
  let total = 0;
  for (const [key, value] of store) total += (key.length + value.length) * 2;
  return total;
};

globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    const next = String(value);
    const delta =
      (key.length + next.length) * 2 -
      (store.has(key) ? (key.length + store.get(key).length) * 2 : 0);
    if (usedBytes() + delta > quotaBytes) {
      const error = new Error(
        `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`
      );
      error.name = 'QuotaExceededError';
      throw error;
    }
    store.set(key, next);
  },
  removeItem: key => store.delete(key),
  clear: () => store.clear(),
  key: index => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

const { CacheService } = await import('../../src/services/cache.js');

const GUESSIT = 'opensubtitles_guessit_cache_test';

describe('CacheService quota behaviour', () => {
  beforeEach(() => {
    store.clear();
    quotaBytes = Infinity;
  });

  describe('expired entries are reclaimed, not just ignored', () => {
    test('loadFromCache deletes the entry it just refused to serve', () => {
      CacheService.saveToCacheWithDuration(GUESSIT, { title: 'Movie' }, -1);

      assert.notStrictEqual(localStorage.getItem(GUESSIT), null, 'entry should be written');
      assert.strictEqual(CacheService.loadFromCache(GUESSIT), null, 'expired entry is a miss');

      // The leak this release fixes: expiry used to demote an entry to a miss
      // and leave it occupying quota forever.
      assert.strictEqual(localStorage.getItem(GUESSIT), null);
      assert.strictEqual(localStorage.getItem(GUESSIT + '_expiry'), null);
    });

    test('loadFromCache still serves a live entry', () => {
      CacheService.saveToCacheWithDuration(GUESSIT, { title: 'Movie' }, 3600);

      assert.deepStrictEqual(CacheService.loadFromCache(GUESSIT), { title: 'Movie' });
      assert.notStrictEqual(localStorage.getItem(GUESSIT), null);
    });

    test('purgeExpiredEntries sweeps what nobody re-requested', () => {
      CacheService.saveToCacheWithDuration(GUESSIT + '_a', { a: 1 }, -1);
      CacheService.saveToCacheWithDuration(GUESSIT + '_b', { b: 2 }, 3600);

      const result = CacheService.purgeExpiredEntries();

      assert.strictEqual(result.removed, 1);
      assert.strictEqual(localStorage.getItem(GUESSIT + '_a'), null);
      assert.notStrictEqual(localStorage.getItem(GUESSIT + '_b'), null);
    });
  });

  describe('writes under a full quota', () => {
    test('a cache write reclaims expired space instead of silently failing', () => {
      CacheService.saveToCacheWithDuration(GUESSIT + '_stale', { pad: 'x'.repeat(3000) }, -1);
      quotaBytes = usedBytes();

      const result = CacheService.saveToCacheWithDuration(GUESSIT + '_new', { title: 'New' }, 3600);

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(CacheService.loadFromCache(GUESSIT + '_new'), { title: 'New' });
    });

    test('an unwritable cache reports failure without throwing', () => {
      store.set('opensubtitles_user_data', 'x'.repeat(4000)); // protected, unevictable
      quotaBytes = usedBytes();

      const result = CacheService.saveToCacheWithDuration(
        GUESSIT + '_big',
        { pad: 'x'.repeat(5000) },
        3600
      );

      assert.strictEqual(result.success, false);
    });

    test('a value is never left behind without its expiry', () => {
      // Budget admits the value but not the expiry sibling that follows it.
      const probe = CacheService.compressData({ title: 'Movie' });
      store.set('opensubtitles_user_data', 'pinned');
      quotaBytes = usedBytes() + (GUESSIT.length + probe.length) * 2 + 2;

      const result = CacheService.saveToCacheWithDuration(GUESSIT, { title: 'Movie' }, 3600);

      assert.strictEqual(result.success, false);
      assert.strictEqual(
        localStorage.getItem(GUESSIT),
        null,
        'orphan value must be rolled back, not left occupying quota'
      );
    });
  });

  describe('getCacheFootprint', () => {
    test('reports entries, expired entries and a formatted size', () => {
      CacheService.saveToCacheWithDuration(GUESSIT + '_a', { a: 1 }, 3600);
      CacheService.saveToCacheWithDuration(GUESSIT + '_b', { b: 2 }, -1);

      const footprint = CacheService.getCacheFootprint();

      assert.strictEqual(footprint.entries, 2);
      assert.strictEqual(footprint.expiredEntries, 1);
      assert.match(footprint.formattedSize, /B$/);
    });
  });
});
