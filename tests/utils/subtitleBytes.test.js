import { test, describe } from 'node:test';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import {
  decodeLatin1,
  encodeLatin1,
  latin1ToDisplay,
} from '../../src/utils/subtitleBytes.js';
import { sanitizeSubtitle } from '../../src/services/subtitleSanitizer.js';

const MODULE_URL = pathToFileURL(
  new URL('../../src/utils/subtitleBytes.js', import.meta.url).pathname
).href;

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);

// windows-1252 mappings for 0x80-0x9F, the only range where it differs from
// ISO-8859-1. Every WHATWG-compliant browser decodes the "iso-8859-1" label
// through this table.
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

/** Stands in for a browser TextDecoder while a module is imported. */
class Cp1252TextDecoder {
  constructor(label = 'utf-8', options) {
    this.label = String(label).toLowerCase();
    this.real = new RealTextDecoder(label, options);
  }

  decode(input) {
    if (!['iso-8859-1', 'latin1', 'windows-1252'].includes(this.label)) {
      return this.real.decode(input);
    }
    const view = input instanceof Uint8Array ? input : new Uint8Array(input);
    let out = '';
    for (const byte of view) {
      out += String.fromCharCode(byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte);
    }
    return out;
  }
}

const RealTextDecoder = globalThis.TextDecoder;

/**
 * Runs `body` against a fresh copy of subtitleBytes.js with a browser-accurate
 * TextDecoder installed for both the import and the calls, so a decoder grabbed
 * at module scope and one constructed per call are equally covered.
 */
const withBrowserDecoder = async (key, body) => {
  globalThis.TextDecoder = Cp1252TextDecoder;
  try {
    return await body(await import(`${MODULE_URL}?browser-decoder=${key}`));
  } finally {
    globalThis.TextDecoder = RealTextDecoder;
  }
};

describe('latin1 view is a byte bijection', () => {
  test('every byte 0-255 decodes to its own code point', () => {
    const view = decodeLatin1(ALL_BYTES);
    assert.strictEqual(view.length, 256);
    for (let byte = 0; byte < 256; byte += 1) {
      assert.strictEqual(view.charCodeAt(byte), byte, `byte 0x${byte.toString(16)}`);
    }
  });

  test('all 256 bytes round-trip unchanged', () => {
    assert.deepStrictEqual(encodeLatin1(decodeLatin1(ALL_BYTES)), ALL_BYTES);
  });

  test('accepts an ArrayBuffer as well as a Uint8Array', () => {
    assert.strictEqual(decodeLatin1(ALL_BYTES.buffer), decodeLatin1(ALL_BYTES));
  });

  test('round-trips past the internal chunk boundary', () => {
    const big = Uint8Array.from({ length: 0x8000 * 2 + 7 }, (_, i) => i % 256);
    assert.deepStrictEqual(encodeLatin1(decodeLatin1(big)), big);
  });
});

// Regression guard for the v1.9.0 corruption of non-Latin subtitles:
// TextDecoder('iso-8859-1') is a windows-1252 decoder in every browser and
// WebView, which lifts 0x80-0x9F above U+00FF and breaks the re-encode. Node's
// ICU build returns true latin1 for the same label, so only an explicit stub
// can reproduce it here.
describe('latin1 view does not depend on the host TextDecoder', () => {
  test('round-trips all 256 bytes under a windows-1252 TextDecoder', () =>
    withBrowserDecoder('bytes', mod => {
      assert.deepStrictEqual(mod.encodeLatin1(mod.decodeLatin1(ALL_BYTES)), ALL_BYTES);
    }));

  test('preserves UTF-8 Devanagari under a windows-1252 TextDecoder', () =>
    withBrowserDecoder('devanagari', mod => {
      const text = 'नमस्ते दोस्तों, आपका हमारे चैनल में स्वागत है।';
      const original = new TextEncoder().encode(text);
      const bytes = mod.encodeLatin1(mod.decodeLatin1(original));
      assert.deepStrictEqual(bytes, original);
      assert.strictEqual(new RealTextDecoder('utf-8').decode(bytes), text);
    }));
});

describe('sanitizing a UTF-8 subtitle keeps every untouched byte', () => {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:03,000',
    'नमस्ते दोस्तों, आपका हमारे चैनल में स्वागत है।',
    '',
    '2',
    '00:00:03,024 --> 00:00:04,024',
    'https://website.com',
    '',
    '3',
    '00:00:03,024 --> 00:00:05,024',
    'आज हम एक नई और रोमांचक यात्रा पर निकल रहे हैं।',
    '',
  ].join('\n');

  test('drops the link cue and leaves the Devanagari bytes identical', () => {
    const source = new TextEncoder().encode(srt);
    const result = sanitizeSubtitle(decodeLatin1(source));
    const output = new RealTextDecoder('utf-8', { fatal: true }).decode(
      encodeLatin1(result.content)
    );

    assert.ok(!output.includes('website.com'), 'link cue survived');
    assert.ok(!output.includes('�'), 'output contains replacement characters');
    assert.ok(output.includes('नमस्ते दोस्तों, आपका हमारे चैनल में स्वागत है।'));
    assert.ok(output.includes('आज हम एक नई और रोमांचक यात्रा पर निकल रहे हैं।'));
  });

  test('renumbers the surviving cues', () => {
    const result = sanitizeSubtitle(decodeLatin1(new TextEncoder().encode(srt)));
    const output = new RealTextDecoder('utf-8').decode(encodeLatin1(result.content));
    assert.deepStrictEqual(
      output.split('\n').filter(line => /^\d+$/.test(line)),
      ['1', '2']
    );
  });

  test('the preview renders UTF-8 rather than the raw latin1 view', () => {
    const view = decodeLatin1(new TextEncoder().encode('स्वागत'));
    assert.strictEqual(latin1ToDisplay(view), 'स्वागत');
  });
});
