import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  findLinks,
  sanitizeSubtitle,
  detectSubtitleFormat,
  LinkCategory,
} from '../../src/services/subtitleSanitizer.js';

const strip = line => {
  const spans = findLinks(line);
  let out = line;
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim();
};

const matchTexts = line => findLinks(line).map(s => s.text);

describe('TLD boundary — example.com vs example.commute', () => {
  test('bare example.com matches', () => {
    assert.deepStrictEqual(matchTexts('Visit example.com now'), ['example.com']);
  });

  test('example.commute does NOT match (commute is not a TLD)', () => {
    assert.deepStrictEqual(matchTexts('He hates the example.commute every day'), []);
  });

  test('never degrades a longer non-TLD suffix into a shorter TLD', () => {
    for (const text of ['example.commute', 'site.networking', 'thing.organism', 'x.information']) {
      assert.deepStrictEqual(matchTexts(text), [], text);
    }
  });

  test('trailing alphanumerics block the match', () => {
    assert.deepStrictEqual(matchTexts('example.com2'), []);
  });
});

describe('Bare domains with non-word TLDs — must strip', () => {
  const positives = [
    ['subs4free.xyz', 'subs4free.xyz'],
    ['opensubtitles.org', 'opensubtitles.org'],
    ['example.net', 'example.net'],
    ['my.sub.example.co.uk', 'my.sub.example.co.uk'],
    ['SUBS.EXAMPLE.COM', 'SUBS.EXAMPLE.COM'],
    ['addic7ed.com/page', 'addic7ed.com/page'],
    ['x.com', 'x.com'],
  ];
  for (const [input, expected] of positives) {
    test(`strips ${input}`, () => {
      assert.deepStrictEqual(matchTexts(`Sync by ${input} enjoy`), [expected]);
    });
  }
});

describe('Word-like TLDs — need scheme, www, or path', () => {
  test('bare word TLD is left alone', () => {
    assert.deepStrictEqual(matchTexts('i know.now go away'), []);
    assert.deepStrictEqual(matchTexts('come on.me first'), []);
    assert.deepStrictEqual(matchTexts('got to.it already'), []);
  });

  test('scheme promotes it to a link', () => {
    assert.deepStrictEqual(matchTexts('go to http://stop.it today'), ['http://stop.it']);
  });

  test('www prefix promotes it to a link', () => {
    assert.deepStrictEqual(matchTexts('see www.stop.it for subs'), ['www.stop.it']);
  });

  test('path promotes it to a link', () => {
    assert.deepStrictEqual(matchTexts('grab stop.it/freesubs here'), ['stop.it/freesubs']);
  });

  test('port promotes it to a link', () => {
    assert.deepStrictEqual(matchTexts('hit stop.it:8080 now'), ['stop.it:8080']);
  });
});

describe('Sentence boundaries — missing space after period', () => {
  const negatives = [
    "Stop.It's over",
    'I know.Now go',
    'Wait.One more thing',
    'Get out.Me too',
    'Listen.To me',
    'That is it.Is it not?',
    'He left.So what?',
    'Hold on.My turn',
  ];
  for (const line of negatives) {
    test(`leaves "${line}" untouched`, () => {
      assert.deepStrictEqual(matchTexts(line), [], line);
    });
  }

  test('Title-Cased non-word TLD is also a sentence boundary', () => {
    assert.deepStrictEqual(matchTexts('The outcome.Common sense'), []);
  });

  test('ALL CAPS is an ad, not a sentence boundary', () => {
    assert.deepStrictEqual(matchTexts('VISIT EXAMPLE.COM TODAY'), ['EXAMPLE.COM']);
  });
});

describe('Scheme URLs', () => {
  const cases = [
    ['http://example.com/subs', 'http://example.com/subs'],
    ['https://sub.example.org/a/b?c=1', 'https://sub.example.org/a/b?c=1'],
    ['hxxp://evil.example.com', 'hxxp://evil.example.com'],
    ['hxxps://evil.example.com', 'hxxps://evil.example.com'],
    ['ftp://files.example.net', 'ftp://files.example.net'],
    ['magnet:?xt=urn:btih:abcdef', 'magnet:?xt=urn:btih:abcdef'],
  ];
  for (const [input, expected] of cases) {
    test(`strips ${input}`, () => {
      assert.deepStrictEqual(matchTexts(`Download at ${input} enjoy`), [expected]);
    });
  }

  test('drops trailing sentence punctuation', () => {
    assert.deepStrictEqual(matchTexts('Go to http://example.com.'), ['http://example.com']);
  });

  test('keeps a paren the URL itself opened', () => {
    assert.deepStrictEqual(matchTexts('see http://example.com/a_(b) here'), [
      'http://example.com/a_(b)',
    ]);
  });
});

describe('Emails', () => {
  test('strips a plain address', () => {
    assert.deepStrictEqual(matchTexts('Contact subs@example.com for more'), ['subs@example.com']);
  });

  test('word TLDs are fine behind an @', () => {
    assert.deepStrictEqual(matchTexts('write me@example.me please'), ['me@example.me']);
  });

  test('ignores an unknown TLD', () => {
    assert.deepStrictEqual(matchTexts('foo@bar.invalidtld'), []);
  });
});

describe('IPv4', () => {
  test('strips a plain address', () => {
    assert.deepStrictEqual(matchTexts('server at 192.168.1.1 is up'), ['192.168.1.1']);
  });

  test('strips address with port and path', () => {
    assert.deepStrictEqual(matchTexts('try 10.0.0.5:8080/subs now'), ['10.0.0.5:8080/subs']);
  });

  test('rejects out-of-range octets', () => {
    assert.deepStrictEqual(matchTexts('version 1.2.3.999 released'), []);
  });

  test('rejects five-group numbers', () => {
    assert.deepStrictEqual(matchTexts('build 1.2.3.4.5 here'), []);
  });
});

describe('Obfuscated links', () => {
  const cases = [
    'example (dot) com',
    'example [dot] com',
    'example {dot} com',
    'example [.] com',
    'www dot example dot com',
    'subs (at) example (dot) com',
  ];
  for (const input of cases) {
    test(`strips "${input}"`, () => {
      const found = findLinks(`Visit ${input} today`);
      assert.strictEqual(found.length, 1, JSON.stringify(found));
      assert.strictEqual(found[0].category, LinkCategory.OBFUSCATED);
      assert.strictEqual(found[0].text, input);
    });
  }

  test('spaced dot alone is not enough evidence', () => {
    assert.deepStrictEqual(matchTexts('And then . com went down'), []);
  });

  test('spaced dots with www are stripped', () => {
    assert.deepStrictEqual(matchTexts('go www . example . com now'), ['www . example . com']);
  });

  test('two spaced dots are stripped', () => {
    assert.deepStrictEqual(matchTexts('go subs . example . com now'), ['subs . example . com']);
  });

  test('normal prose with periods survives', () => {
    const line = 'I said no. Come on. That is it. Now go.';
    assert.deepStrictEqual(matchTexts(line), [], line);
  });
});

describe('Social handles', () => {
  test('strips a standalone handle', () => {
    assert.deepStrictEqual(matchTexts('Follow @releasegroup for more'), ['@releasegroup']);
  });

  test('ignores a two-character handle', () => {
    assert.deepStrictEqual(matchTexts('Follow @ab now'), []);
  });

  test('t.me link is caught as a URL via its path', () => {
    assert.deepStrictEqual(matchTexts('join t.me/somechannel now'), ['t.me/somechannel']);
  });

  test('discord.gg link is caught bare', () => {
    assert.deepStrictEqual(matchTexts('join discord.gg/abcd now'), ['discord.gg/abcd']);
  });
});

describe('Line cleanup', () => {
  test('collapses the gap a removed link leaves', () => {
    assert.strictEqual(strip('Subs by example.com team'), 'Subs by team');
  });

  test('removes empty formatting tags', () => {
    const result = sanitizeSubtitle(
      ['1', '00:00:01,000 --> 00:00:02,000', '<i>www.example.com</i>', '', ''].join('\n')
    );
    assert.strictEqual(result.removedCues, 1);
  });
});

describe('SRT structure', () => {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:02,000',
    'Hello there.',
    '',
    '2',
    '00:00:03,000 --> 00:00:04,000',
    'Subtitles by www.example.com',
    '',
    '3',
    '00:00:05,000 --> 00:00:06,000',
    'example.com',
    '',
    '4',
    '00:00:07,000 --> 00:00:08,000',
    'Goodbye.',
    '',
  ].join('\n');

  test('detects the format', () => {
    assert.strictEqual(detectSubtitleFormat(srt), 'srt');
  });

  test('never touches timing or index lines', () => {
    const result = sanitizeSubtitle(srt);
    assert.ok(result.content.includes('00:00:01,000 --> 00:00:02,000'));
    assert.ok(result.content.includes('00:00:07,000 --> 00:00:08,000'));
  });

  test('strips the link but keeps the surviving dialogue', () => {
    const result = sanitizeSubtitle(srt);
    assert.ok(result.content.includes('Subtitles by'));
    assert.ok(!result.content.includes('example.com'));
  });

  test('drops the cue that was nothing but a link, and renumbers', () => {
    const result = sanitizeSubtitle(srt);
    assert.strictEqual(result.removedCues, 1);
    const indexes = result.content
      .split('\n')
      .filter(line => /^\d+$/.test(line.trim()))
      .map(Number);
    assert.deepStrictEqual(indexes, [1, 2, 3]);
  });

  test('reports a match id per link', () => {
    const result = sanitizeSubtitle(srt);
    assert.strictEqual(result.matches.length, 2);
    assert.ok(result.matches.every(m => typeof m.id === 'string'));
  });

  test('excluded ids are reported but not removed', () => {
    const first = sanitizeSubtitle(srt);
    const excluded = new Set([first.matches[0].id]);
    const second = sanitizeSubtitle(srt, { excludedIds: excluded });
    assert.ok(second.content.includes('www.example.com'));
    assert.strictEqual(second.matches.filter(m => m.excluded).length, 1);
  });

  test('a clean file is returned unchanged', () => {
    const clean = ['1', '00:00:01,000 --> 00:00:02,000', 'Just dialogue.', '', ''].join('\n');
    const result = sanitizeSubtitle(clean);
    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.content, clean);
  });

  test('CRLF files keep CRLF', () => {
    const crlf = srt.replace(/\n/g, '\r\n');
    const result = sanitizeSubtitle(crlf);
    assert.ok(result.content.includes('\r\n'));
    assert.ok(!/[^\r]\n/.test(result.content));
  });
});

describe('WebVTT structure', () => {
  const vtt = [
    'WEBVTT',
    '',
    'NOTE this file came from example.com',
    '',
    '1',
    '00:00:01.000 --> 00:00:02.000',
    'Hello from www.example.com',
    '',
  ].join('\n');

  test('detects the format', () => {
    assert.strictEqual(detectSubtitleFormat(vtt), 'vtt');
  });

  test('keeps the header and NOTE block', () => {
    const result = sanitizeSubtitle(vtt);
    assert.ok(result.content.startsWith('WEBVTT'));
    assert.ok(result.content.includes('NOTE this file came from example.com'));
  });

  test('strips the cue text', () => {
    const result = sanitizeSubtitle(vtt);
    assert.ok(result.content.includes('Hello from'));
    assert.ok(!result.content.includes('www.example.com'));
  });
});

describe('ASS/SSA structure', () => {
  const ass = [
    '[Script Info]',
    'Title: example.com release',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello there.',
    'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Subs by www.example.com',
    'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,example.com',
  ].join('\n');

  test('detects the format', () => {
    assert.strictEqual(detectSubtitleFormat(ass), 'ass');
  });

  test('never touches headers or the Format line', () => {
    const result = sanitizeSubtitle(ass);
    assert.ok(result.content.includes('Title: example.com release'));
    assert.ok(result.content.includes('Format: Layer, Start, End'));
  });

  test('strips only the Text field', () => {
    const result = sanitizeSubtitle(ass);
    assert.ok(result.content.includes('0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Subs by'));
  });

  test('drops a Dialogue line whose text was only a link', () => {
    const result = sanitizeSubtitle(ass);
    assert.strictEqual(result.removedCues, 1);
    assert.ok(!result.content.includes(',,example.com'));
  });
});

describe('MicroDVD structure', () => {
  const sub = ['{100}{200}Hello there.', '{300}{400}Subs by www.example.com', '{500}{600}example.com'].join(
    '\n'
  );

  test('detects the format', () => {
    assert.strictEqual(detectSubtitleFormat(sub), 'microdvd');
  });

  test('keeps frame markers', () => {
    const result = sanitizeSubtitle(sub);
    assert.ok(result.content.includes('{100}{200}Hello there.'));
    assert.ok(result.content.includes('{300}{400}Subs by'));
  });

  test('drops a link-only line', () => {
    const result = sanitizeSubtitle(sub);
    assert.strictEqual(result.removedCues, 1);
  });
});

describe('Real-world ad lines', () => {
  const ads = [
    'Subtitles by OpenSubtitles.org',
    'Download free subtitles at www.subs4free.com',
    'Sync & corrections by n17t01 www.addic7ed.com',
    'Visit WWW.EXAMPLE.COM for more',
    'Advertise your product or brand here contact www.OpenSubtitles.org today',
    'support us and become VIP member to remove all ads from www.OpenSubtitles.org',
    'Resync by subs (dot) example (dot) com',
    'Follow us @examplesubs',
    'email: subs@example.org',
  ];
  for (const line of ads) {
    test(`finds a link in "${line.slice(0, 48)}"`, () => {
      assert.ok(findLinks(line).length > 0, line);
    });
  }
});

describe('Real dialogue must survive untouched', () => {
  const dialogue = [
    'I have no idea what you are talking about.',
    "Stop.It's not funny anymore.",
    'Wait.One second.',
    'He told me.To be fair, I believed him.',
    'Dr. Smith will see you now.',
    'It cost 1.5 million dollars.',
    'The ratio was 2.5 to 1.',
    'Mr. and Mrs. Anderson, please.',
    'Chapter 3.2 of the manual.',
    'We land at 10.30 a.m.',
    'That is a nice example.commute you have.',
    'U.S.A. forever.',
    'I said no. Come on. That is it. Now go.',
    'He scored 3.4.5.6 points?',
    'etc. and so on.',
  ];
  for (const line of dialogue) {
    test(`leaves "${line.slice(0, 44)}" alone`, () => {
      assert.deepStrictEqual(findLinks(line), [], line);
    });
  }
});
