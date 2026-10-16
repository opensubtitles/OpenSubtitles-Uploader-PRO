import { test, describe } from 'node:test';
import assert from 'node:assert';
import { pathToFileURL } from 'node:url';
import {
  decodeLatin1,
  encodeLatin1,
  latin1ToDisplay,
} from '../../src/utils/subtitleBytes.js';
import { findLinks, sanitizeSubtitle } from '../../src/services/subtitleSanitizer.js';

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

// Subtitles arrive in whatever the release group used. The latin1 view is
// charset-agnostic by construction, but the matcher runs over those same bytes,
// so each encoding family gets a real sample pushed through the full sanitizer.
// Fixtures are stored as hex rather than generated with iconv so the test has
// no external dependency.
const ENCODED_DIALOGUE = {
  utf8: { label: 'UTF-8', hex: 'e0a4a8e0a4aee0a4b8e0a58de0a4a4e0a58720e0a4a6e0a58be0a4b8e0a58de0a4a4e0a58be0a4822c20e0a486e0a4aae0a495e0a4be20e0a4b9e0a4aee0a4bee0a4b0e0a58720e0a49ae0a588e0a4a8e0a4b220e0a4aee0a587e0a48220e0a4b8e0a58de0a4b5e0a4bee0a497e0a4a420e0a4b9e0a588e0a5a4' },
  cp1251: { label: 'CP1251', hex: 'cff0e8e2e5f22c20e4f0f3e7fcff2120c4eee1f0ee20efeee6e0ebeee2e0f2fc20ede020ede0f820eae0ede0eb2e' },
  cp1250: { label: 'CP1250', hex: '41686f6a2070f8e174656ce92c2076ed74656a7465206e61206e619a656d206b616ee16c752e' },
  big5: { label: 'BIG5', hex: 'a46aae61a66ea141c577aaefa8d3a8eca7daadccaabac057b944a143' },
  shiftJis: { label: 'SHIFT_JIS', hex: '82b182f182c982bf82cd81418a4682b382f181428e8482bd82bf82cc836083838393836c838b82d682e682a482b182bb8142' },
  gbk: { label: 'GBK', hex: 'b4f3bcd2bac3a3acbbb6d3adc0b4b5bdced2c3c7b5c4c6b5b5c0a1a3' },
  eucKr: { label: 'EUC-KR', hex: 'bec8b3e7c7cfbcbcbfe420bfa9b7afbad02c20bfecb8ae20c3a4b3cebfa120bfc0bdc520b0cdc0bb20c8afbfb5c7d5b4cfb4d92e' },
  koi8r: { label: 'KOI8-R', hex: 'f0d2c9d7c5d42c20c4d2d5dad8d12120e4cfc2d2cf20d0cfd6c1cccfd7c1d4d820cec120cec1db20cbc1cec1cc2e' },
  greek: { label: 'ISO-8859-7', hex: 'c3e5e9e120f3e1f220f6dfebefe92c20eae1ebfef220def1e8e1f4e520f3f4ef20eae1eddcebe920ece1f22e' },
  arabic: { label: 'CP1256', hex: 'e3d1cdc8c720c3d5cfdec7c6eda120c3e5e1c720c8dfe320dded20dee4c7cae4c72e' },
};

const fromHex = hex => Uint8Array.from(hex.match(/../g).map(b => parseInt(b, 16)));

const concatBytes = parts => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const ascii = text => Uint8Array.from(text, c => c.charCodeAt(0));

/** An SRT whose dialogue is raw `encoded` bytes, plus one ASCII link cue. */
const buildEncodedSrt = encoded =>
  concatBytes([
    ascii('1\n00:00:01,000 --> 00:00:03,000\n'),
    encoded,
    ascii('\n\n2\n00:00:03,024 --> 00:00:04,024\nhttps://website.com\n\n3\n00:00:03,024 --> 00:00:05,024\n'),
    encoded,
    ascii('\n\n'),
  ]);

const indexOfBytes = (haystack, needle) => {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

describe('every encoding family survives link removal byte-for-byte', () => {
  for (const [name, { label, hex }] of Object.entries(ENCODED_DIALOGUE)) {
    test(`${name} (${label}) keeps its dialogue bytes and loses the link`, () => {
      const dialogue = fromHex(hex);
      const source = buildEncodedSrt(dialogue);
      const output = encodeLatin1(sanitizeSubtitle(decodeLatin1(source)).content);

      const first = indexOfBytes(output, dialogue);
      assert.notStrictEqual(first, -1, `${label} dialogue bytes were altered`);
      const second = indexOfBytes(output.subarray(first + dialogue.length), dialogue);
      assert.notStrictEqual(second, -1, `${label} second dialogue line was altered`);
      assert.strictEqual(indexOfBytes(output, ascii('website.com')), -1, 'link survived');
    });
  }
});

// The matcher is ASCII-only and every legacy DBCS trail byte starts at 0x40, so
// '.', '/', ':' and '-' can never be the second half of a double-byte char.
// '@' (0x40) can be — the handle scanner's opener guard is what stops it.
describe('legacy double-byte encodings produce no false matches', () => {
  const DBCS = {
    big5: { lead: [[0xa1, 0xf9]], trail: [[0x40, 0x7e], [0xa1, 0xfe]] },
    shiftJis: { lead: [[0x81, 0x9f], [0xe0, 0xef]], trail: [[0x40, 0x7e], [0x80, 0xfc]] },
    gbk: { lead: [[0x81, 0xfe]], trail: [[0x40, 0x7e], [0x80, 0xfe]] },
    eucKr: { lead: [[0xa1, 0xfe]], trail: [[0xa1, 0xfe]] },
  };

  const expand = ranges => ranges.flatMap(([a, b]) =>
    Array.from({ length: b - a + 1 }, (_, i) => a + i));

  for (const [name, spec] of Object.entries(DBCS)) {
    test(`${name}: every lead/trail pair scans clean`, () => {
      const leads = expand(spec.lead);
      const trails = expand(spec.trail);
      for (const lead of leads) {
        const bytes = [];
        for (const trail of trails) bytes.push(lead, trail);
        const found = findLinks(decodeLatin1(Uint8Array.from(bytes)));
        assert.deepStrictEqual(
          found.map(f => f.text),
          [],
          `lead 0x${lead.toString(16)} produced a false match`
        );
      }
    });
  }

  test('a trail byte of 0x40 is not read as a social handle', () => {
    for (const lead of [0x81, 0xa1, 0xe0, 0xfe]) {
      const bytes = Uint8Array.from([lead, 0x40, ...ascii('release')]);
      assert.deepStrictEqual(findLinks(decodeLatin1(bytes)), [], `lead 0x${lead.toString(16)}`);
    }
  });
});

// UTF-16 interleaves NULs, so "https" is never contiguous and nothing matches.
// That is a no-op, not corruption - the bytes must come back untouched.
describe('UTF-16 subtitles are left completely alone', () => {
  for (const [name, littleEndian] of [['UTF-16LE', true], ['UTF-16BE', false]]) {
    test(`${name} is returned byte-identical`, () => {
      const text = '1\n00:00:01,000 --> 00:00:03,000\nПривет\n\n2\n00:00:03,024 --> 00:00:04,024\nhttps://website.com\n\n';
      const source = new Uint8Array(text.length * 2);
      const view = new DataView(source.buffer);
      for (let i = 0; i < text.length; i += 1) {
        view.setUint16(i * 2, text.charCodeAt(i), littleEndian);
      }
      const result = sanitizeSubtitle(decodeLatin1(source));
      assert.strictEqual(result.changed, false);
      assert.deepStrictEqual(result.matches, []);
      assert.deepStrictEqual(encodeLatin1(result.content), source);
    });
  }
});
