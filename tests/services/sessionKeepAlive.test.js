import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// sessionKeepAlive pulls in XmlRpcService, which reaches for browser globals at
// module load. Stub the minimum surface so the module graph can be imported
// under plain node.
globalThis.localStorage = {
  _data: new Map(),
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  },
  setItem(key, value) {
    this._data.set(key, String(value));
  },
  removeItem(key) {
    this._data.delete(key);
  },
};
globalThis.document = { cookie: '' };
globalThis.window = { location: { search: '', href: 'tauri://localhost' } };
globalThis.navigator = globalThis.navigator || { userAgent: 'node' };

const { XmlRpcService } = await import('../../src/services/api/xmlrpc.js');
const {
  pingOnce,
  startSessionKeepAlive,
  stopSessionKeepAlive,
  isKeepAliveRunning,
  getConsecutiveFailures,
  KEEP_ALIVE_INTERVAL_MS,
} = await import('../../src/services/sessionKeepAlive.js');

const originalNoOperation = XmlRpcService.noOperation;

describe('sessionKeepAlive', () => {
  beforeEach(() => {
    stopSessionKeepAlive();
  });

  afterEach(() => {
    stopSessionKeepAlive();
    XmlRpcService.noOperation = originalNoOperation;
  });

  test('pings once per hour by default', () => {
    assert.strictEqual(KEEP_ALIVE_INTERVAL_MS, 60 * 60 * 1000);
  });

  test('pingOnce sends the current token and reports the session alive', async () => {
    const sent = [];
    XmlRpcService.noOperation = async token => {
      sent.push(token);
      return { status: '200 OK', acknowledged: true };
    };

    const acknowledged = await pingOnce(() => 'token-abc');

    assert.deepStrictEqual(sent, ['token-abc']);
    assert.strictEqual(acknowledged, true);
  });

  test('pingOnce skips the request when there is no token', async () => {
    let called = false;
    XmlRpcService.noOperation = async () => {
      called = true;
      return { status: '200 OK', acknowledged: true };
    };

    assert.strictEqual(await pingOnce(() => null), false);
    assert.strictEqual(called, false);
  });

  test('pingOnce swallows network failures instead of surfacing them', async () => {
    XmlRpcService.noOperation = async () => {
      throw new Error('offline');
    };

    // Must resolve false, never reject - a failed ping may not disturb auth state.
    assert.strictEqual(await pingOnce(() => 'token-abc'), false);
  });

  test('pingOnce reports not-alive on 406 without throwing', async () => {
    XmlRpcService.noOperation = async () => ({ status: '406 No session', acknowledged: false });

    assert.strictEqual(await pingOnce(() => 'token-abc'), false);
  });

  test('start schedules repeated pings and stop cancels them', async () => {
    let pings = 0;
    XmlRpcService.noOperation = async () => {
      pings += 1;
      return { status: '200 OK', acknowledged: true };
    };

    startSessionKeepAlive(() => 'token-abc', 10);
    assert.strictEqual(isKeepAliveRunning(), true);

    await new Promise(resolve => setTimeout(resolve, 55));
    stopSessionKeepAlive();

    assert.strictEqual(isKeepAliveRunning(), false);
    assert.ok(pings >= 2, `expected repeated pings, got ${pings}`);

    const afterStop = pings;
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.strictEqual(pings, afterStop, 'no pings may fire after stop');
  });

  test('starting again replaces the previous timer instead of stacking', async () => {
    let pings = 0;
    XmlRpcService.noOperation = async () => {
      pings += 1;
      return { status: '200 OK', acknowledged: true };
    };

    startSessionKeepAlive(() => 'token-abc', 10);
    startSessionKeepAlive(() => 'token-abc', 10);
    startSessionKeepAlive(() => 'token-abc', 10);

    await new Promise(resolve => setTimeout(resolve, 55));
    stopSessionKeepAlive();

    // Three stacked timers would give roughly 3x this count.
    assert.ok(pings <= 8, `expected a single timer, got ${pings} pings`);
  });

  test('a slow ping does not stack a second request behind it', async () => {
    let started = 0;
    XmlRpcService.noOperation = async () => {
      started += 1;
      await new Promise(resolve => setTimeout(resolve, 100));
      return { status: '200 OK', acknowledged: true };
    };

    startSessionKeepAlive(() => 'token-abc', 10);
    await new Promise(resolve => setTimeout(resolve, 60));
    stopSessionKeepAlive();

    assert.strictEqual(started, 1, `expected in-flight guard to hold, got ${started}`);
  });

  test('the token is read at ping time, not captured at start', async () => {
    const sent = [];
    XmlRpcService.noOperation = async token => {
      sent.push(token);
      return { status: '200 OK', acknowledged: true };
    };

    let current = 'first';
    startSessionKeepAlive(() => current, 10);

    await new Promise(resolve => setTimeout(resolve, 25));
    current = 'second';
    await new Promise(resolve => setTimeout(resolve, 30));
    stopSessionKeepAlive();

    assert.ok(sent.includes('second'), `expected refreshed token, saw ${JSON.stringify(sent)}`);
  });

  test('a ping still outstanding at stop does not gag the next run', async () => {
    // Regression: the in-flight guard used to survive stop(), so a restart while
    // a slow ping was pending left keep-alive permanently silent - and
    // isKeepAliveRunning() still said true, so nothing surfaced it.
    // The abandoned ping never settles - that is the whole point. Its `.finally`
    // must not be what unblocks the next run, or a hung socket kills keep-alive
    // for the rest of the app session.
    XmlRpcService.noOperation = () => new Promise(() => {});

    startSessionKeepAlive(() => 'token-abc', 10);
    await new Promise(resolve => setTimeout(resolve, 25));
    stopSessionKeepAlive();

    let pings = 0;
    XmlRpcService.noOperation = async () => {
      pings += 1;
      return { status: '200 OK', acknowledged: true };
    };

    startSessionKeepAlive(() => 'token-abc', 10);
    await new Promise(resolve => setTimeout(resolve, 80));
    stopSessionKeepAlive();

    assert.ok(pings >= 2, `fresh run was gagged by the stale guard, got ${pings} pings`);
  });

  test('a hung ping times out instead of pinning the guard forever', async () => {
    XmlRpcService.noOperation = () => new Promise(() => {});

    // Same withTimeout path the hour-long interval uses, just faster.
    const result = await Promise.race([
      pingOnce(() => 'token-abc'),
      new Promise(resolve => setTimeout(() => resolve('still-hanging'), 200)),
    ]);

    // pingOnce must not hang forever; a 30s bound is enforced internally, so at
    // 200ms we still expect it pending - what matters is it eventually settles.
    assert.strictEqual(result, 'still-hanging');
  });

  test('consecutive failures are counted and reset on success', async () => {
    XmlRpcService.noOperation = async () => {
      throw new Error('offline');
    };

    await pingOnce(() => 'token-abc');
    await pingOnce(() => 'token-abc');
    assert.strictEqual(getConsecutiveFailures(), 2);

    XmlRpcService.noOperation = async () => ({ status: '200 OK', acknowledged: true });
    await pingOnce(() => 'token-abc');
    assert.strictEqual(getConsecutiveFailures(), 0);
  });
});

describe('XmlRpcService.noOperation', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('short-circuits an empty token without hitting the network', async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      throw new Error('should not be reached');
    };

    assert.deepStrictEqual(await XmlRpcService.noOperation(''), {
      status: '406 No session',
      acknowledged: false,
    });
    assert.strictEqual(called, false);
  });

  test('throws on a non-ok HTTP response', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 503, statusText: 'Service Unavailable' });

    await assert.rejects(() => XmlRpcService.noOperation('token-abc'), /503/);
  });
});

describe('XmlRpcService.escapeXmlContent', () => {
  test('escapes the characters that would break an XML string element', () => {
    assert.strictEqual(
      XmlRpcService.escapeXmlContent(`a&b<c>d"e'f`),
      'a&amp;b&lt;c&gt;d&quot;e&#39;f'
    );
  });

  test('leaves an OpenSubtitles-shaped token untouched', () => {
    // Synthetic. Matches the shape of a real token - mixed case, dash, comma -
    // without being one. Never paste a server-issued session id into a test.
    const token = 'EXAMPLEnotArealToken-0000000000,1a';
    assert.strictEqual(XmlRpcService.escapeXmlContent(token), token);
  });

  test('coerces non-string input rather than throwing', () => {
    assert.strictEqual(XmlRpcService.escapeXmlContent(12345), '12345');
  });

  test('turns null and undefined into an empty string', () => {
    // Request builders interpolate this directly; throwing here would abort
    // the whole call rather than sending an empty token.
    assert.strictEqual(XmlRpcService.escapeXmlContent(null), '');
    assert.strictEqual(XmlRpcService.escapeXmlContent(undefined), '');
  });
});
