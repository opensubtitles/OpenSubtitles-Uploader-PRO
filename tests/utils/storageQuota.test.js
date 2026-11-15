import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

/**
 * localStorage stand-in with a byte budget, so a quota failure can actually be
 * provoked. `node --test` has no browser storage, and the original bug was
 * invisible to any test that could not make setItem throw.
 */
const store = new Map();
let quotaBytes = Infinity;

const usedBytes = () => {
  let total = 0;
  for (const [key, value] of store) total += (key.length + value.length) * 2;
  return total;
};

const quotaError = key => {
  // Mirrors Blink's wording and name, which is what the field report showed.
  const error = new Error(
    `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`
  );
  error.name = 'QuotaExceededError';
  error.code = 22;
  return error;
};

globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => {
    const next = String(value);
    const delta =
      (key.length + next.length) * 2 -
      (store.has(key) ? (key.length + store.get(key).length) * 2 : 0);
    if (usedBytes() + delta > quotaBytes) throw quotaError(key);
    store.set(key, next);
  },
  removeItem: key => store.delete(key),
  clear: () => store.clear(),
  key: index => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

const {
  safeSetItem,
  isQuotaError,
  purgeExpiredCacheEntries,
  evictCacheEntries,
  getCacheFootprint,
  isEvictableCacheKey,
} = await import('../../src/utils/storageQuota.js');

const { persistAuthData } = await import('../../src/utils/authStorage.js');

const NOW = 1_770_000_000_000;
const HOUR = 60 * 60 * 1000;

/** Write a cache entry pair straight into the store, bypassing the quota. */
const seedCache = (key, { bytes = 1000, expiresInMs = 72 * HOUR } = {}) => {
  store.set(key, 'x'.repeat(bytes));
  store.set(key + '_expiry', String(NOW + expiresInMs));
};

describe('storageQuota', () => {
  beforeEach(() => {
    store.clear();
    quotaBytes = Infinity;
  });

  describe('isQuotaError', () => {
    test('recognises the Blink QuotaExceededError the field report showed', () => {
      assert.strictEqual(isQuotaError(quotaError('opensubtitles_login_time')), true);
    });

    test('recognises the Firefox quota code', () => {
      const error = new Error('persistent storage maximum size reached');
      error.code = 1014;
      assert.strictEqual(isQuotaError(error), true);
    });

    test('does not mistake unrelated failures for a full disk', () => {
      assert.strictEqual(isQuotaError(new TypeError('localStorage is not defined')), false);
      assert.strictEqual(isQuotaError(null), false);
    });
  });

  describe('eviction scope', () => {
    test('cache entries are evictable', () => {
      assert.strictEqual(isEvictableCacheKey('opensubtitles_guessit_cache_abc'), true);
      assert.strictEqual(isEvictableCacheKey('opensubtitles_movie_guess_cache_v2_abc'), true);
    });

    test('auth, config and the upload ledger are never evictable', () => {
      for (const key of [
        'opensubtitles_token',
        'opensubtitles_user_data',
        'opensubtitles_login_time',
        'opensubtitles_remembered_username',
        'opensubtitles_upload_ledger_v1_u4242',
        'opensubtitles-uploader-config',
        'opensubtitles-uploader-theme',
        'opensubtitles_debug_mode',
      ]) {
        assert.strictEqual(isEvictableCacheKey(key), false, `${key} must survive eviction`);
      }
    });

    test('expiry siblings are not evicted on their own', () => {
      assert.strictEqual(isEvictableCacheKey('opensubtitles_guessit_cache_abc_expiry'), false);
    });
  });

  describe('purgeExpiredCacheEntries', () => {
    test('deletes expired entries and their expiry siblings', () => {
      seedCache('opensubtitles_guessit_cache_old', { expiresInMs: -HOUR });
      seedCache('opensubtitles_guessit_cache_fresh', { expiresInMs: HOUR });

      const result = purgeExpiredCacheEntries(NOW);

      assert.strictEqual(result.removed, 1);
      assert.ok(result.freedBytes > 0);
      assert.strictEqual(localStorage.getItem('opensubtitles_guessit_cache_old'), null);
      assert.strictEqual(localStorage.getItem('opensubtitles_guessit_cache_old_expiry'), null);
      assert.notStrictEqual(localStorage.getItem('opensubtitles_guessit_cache_fresh'), null);
    });

    test('treats an entry with no expiry as dead weight', () => {
      // isCacheValid can never serve this, so it is pure occupied quota.
      store.set('opensubtitles_features_cache_imdb_id_tt1', 'orphan');

      assert.strictEqual(purgeExpiredCacheEntries(NOW).removed, 1);
    });

    test('leaves protected keys alone even when they look stale', () => {
      store.set('opensubtitles_token', 'session');
      store.set('opensubtitles_login_time', String(NOW - 10 * HOUR));

      purgeExpiredCacheEntries(NOW);

      assert.strictEqual(localStorage.getItem('opensubtitles_token'), 'session');
    });
  });

  describe('evictCacheEntries', () => {
    test('drops the entries closest to expiry first', () => {
      seedCache('opensubtitles_guessit_cache_dying', { bytes: 500, expiresInMs: HOUR });
      seedCache('opensubtitles_guessit_cache_healthy', { bytes: 500, expiresInMs: 70 * HOUR });

      evictCacheEntries(1, NOW);

      assert.strictEqual(localStorage.getItem('opensubtitles_guessit_cache_dying'), null);
      assert.notStrictEqual(localStorage.getItem('opensubtitles_guessit_cache_healthy'), null);
    });

    test('stops as soon as the target is met', () => {
      for (let i = 0; i < 5; i++) {
        seedCache(`opensubtitles_guessit_cache_${i}`, { bytes: 500, expiresInMs: (i + 1) * HOUR });
      }

      // Each entry is ~1000 bytes of UTF-16 payload plus its expiry sibling.
      const result = evictCacheEntries(1200, NOW);

      assert.ok(result.removed >= 1 && result.removed < 5, `evicted ${result.removed} of 5`);
    });
  });

  describe('safeSetItem', () => {
    test('writes normally when there is room', () => {
      assert.strictEqual(safeSetItem('opensubtitles_login_time', '123'), true);
      assert.strictEqual(localStorage.getItem('opensubtitles_login_time'), '123');
    });

    test('reclaims expired cache and completes the write that used to throw', () => {
      seedCache('opensubtitles_guessit_cache_old', { bytes: 2000, expiresInMs: -HOUR });
      quotaBytes = usedBytes(); // not one byte to spare

      assert.throws(() => localStorage.setItem('opensubtitles_login_time', String(NOW)));

      assert.strictEqual(
        safeSetItem('opensubtitles_login_time', String(NOW), { label: 'login timestamp' }),
        true
      );
      assert.strictEqual(localStorage.getItem('opensubtitles_login_time'), String(NOW));
    });

    test('evicts live cache when nothing has expired yet', () => {
      seedCache('opensubtitles_movie_guess_cache_v2_a', { bytes: 2000, expiresInMs: 70 * HOUR });
      quotaBytes = usedBytes();

      assert.strictEqual(safeSetItem('opensubtitles_token', 'fresh-session'), true);
      assert.strictEqual(localStorage.getItem('opensubtitles_token'), 'fresh-session');
    });

    test('returns false instead of throwing when nothing can be reclaimed', () => {
      store.set('opensubtitles_user_data', 'x'.repeat(2000)); // protected, cannot be evicted
      quotaBytes = usedBytes();

      assert.strictEqual(safeSetItem('opensubtitles_guessit_cache_new', 'x'.repeat(2000)), false);
    });

    test('does not destroy caches over a non-quota failure', () => {
      seedCache('opensubtitles_guessit_cache_keep', { bytes: 100 });
      const original = localStorage.setItem;
      localStorage.setItem = () => {
        throw new TypeError('storage disabled');
      };

      try {
        assert.strictEqual(safeSetItem('opensubtitles_token', 'x'), false);
      } finally {
        localStorage.setItem = original;
      }

      assert.notStrictEqual(localStorage.getItem('opensubtitles_guessit_cache_keep'), null);
    });
  });

  describe('getCacheFootprint', () => {
    test('counts entries, expired entries and bytes', () => {
      seedCache('opensubtitles_guessit_cache_a', { bytes: 100, expiresInMs: HOUR });
      seedCache('opensubtitles_guessit_cache_b', { bytes: 100, expiresInMs: -HOUR });
      store.set('opensubtitles_token', 'not-a-cache');

      const footprint = getCacheFootprint(NOW);

      assert.strictEqual(footprint.entries, 2);
      assert.strictEqual(footprint.expiredEntries, 1);
      assert.ok(footprint.bytes > 0);
    });
  });

  describe('persistAuthData', () => {
    test('a verified session survives a full quota', () => {
      seedCache('opensubtitles_guessit_cache_old', { bytes: 4000, expiresInMs: -HOUR });
      quotaBytes = usedBytes();

      const result = persistAuthData('session-abc', {
        UserNickName: 'uploader',
        UserRank: 'gold member',
      });

      assert.strictEqual(result.stored, true);
      assert.strictEqual(localStorage.getItem('opensubtitles_token'), 'session-abc');
      assert.strictEqual(localStorage.getItem('opensubtitles_remembered_username'), 'uploader');
    });

    test('reports failure rather than throwing when the token cannot be stored', () => {
      store.set('opensubtitles_user_data', 'x'.repeat(4000)); // protected, unevictable
      quotaBytes = usedBytes();

      const result = persistAuthData('session-abc', { UserNickName: 'uploader' });

      assert.strictEqual(result.stored, false);
      assert.strictEqual(result.partial, true);
    });

    test('an unserialisable profile does not sink the session', () => {
      const circular = { UserNickName: 'uploader' };
      circular.self = circular;

      const result = persistAuthData('session-abc', circular);

      assert.strictEqual(result.stored, true);
      assert.strictEqual(localStorage.getItem('opensubtitles_token'), 'session-abc');
    });
  });
});
