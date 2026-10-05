#!/usr/bin/env node
/**
 * Generates src/data/tlds.js from the authoritative IANA TLD list.
 *
 * Why two sets?
 *
 *   TLDS       - every delegated TLD. Used to decide whether a dotted token is
 *                even a plausible domain. This is what makes `example.com`
 *                match while `example.commute` does not: `commute` is not a
 *                delegated TLD, and the matcher never retries a shorter suffix.
 *
 *   WORD_TLDS  - the subset of TLDs that are also common English words which
 *                frequently begin a sentence or clause (`.it`, `.to`, `.me`,
 *                `.now`, `.one`, `.is`, `.so`, ...). Subtitles are full of
 *                missing spaces after a period ("Stop.It's over", "I know.Now
 *                go"), so a bare token ending in one of these is almost never a
 *                URL. The sanitizer therefore requires a scheme, a `www.`
 *                prefix, or a path/port before stripping these.
 *
 * To tune false positives, edit SENTENCE_WORDS below and re-run.
 *
 * Usage: node scripts/generate-tlds.js
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const IANA_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';

/**
 * Common English words that frequently start a sentence or clause in dialogue.
 * Only the intersection of this list with the IANA list ends up in WORD_TLDS,
 * so entries that are not TLDs are harmless.
 *
 * Deliberately EXCLUDES words nobody begins a sentence with even though they
 * are dictionary words (`net`, `com`, `biz`, `info`, `xyz`), so that bare
 * `example.net` still strips.
 */
const SENTENCE_WORDS = [
  'a',
  'all',
  'also',
  'am',
  'an',
  'and',
  'another',
  'any',
  'are',
  'as',
  'at',
  'away',
  'back',
  'be',
  'because',
  'been',
  'before',
  'best',
  'better',
  'but',
  'buy',
  'by',
  'call',
  'came',
  'can',
  'care',
  'case',
  'come',
  'could',
  'dad',
  'day',
  'dead',
  'dear',
  'did',
  'do',
  'does',
  'dog',
  'down',
  'drive',
  'each',
  'eat',
  'end',
  'enough',
  'even',
  'ever',
  'every',
  'family',
  'far',
  'fast',
  'feel',
  'find',
  'fine',
  'fire',
  'first',
  'for',
  'free',
  'from',
  'fun',
  'get',
  'gift',
  'girl',
  'give',
  'go',
  'god',
  'going',
  'gold',
  'gone',
  'good',
  'got',
  'green',
  'had',
  'hair',
  'half',
  'hand',
  'happy',
  'hard',
  'has',
  'have',
  'he',
  'hear',
  'heart',
  'help',
  'her',
  'here',
  'hey',
  'his',
  'hold',
  'home',
  'hope',
  'horse',
  'hot',
  'house',
  'how',
  'i',
  'ice',
  'if',
  'in',
  'is',
  'it',
  'its',
  'just',
  'keep',
  'kids',
  'kill',
  'kind',
  'king',
  'know',
  'land',
  'last',
  'late',
  'law',
  'lead',
  'learn',
  'leave',
  'let',
  'life',
  'light',
  'like',
  'listen',
  'live',
  'living',
  'look',
  'lose',
  'lost',
  'love',
  'low',
  'make',
  'man',
  'many',
  'map',
  'may',
  'maybe',
  'me',
  'mean',
  'meet',
  'men',
  'mine',
  'miss',
  'mom',
  'moment',
  'money',
  'more',
  'most',
  'mother',
  'move',
  'movie',
  'mr',
  'much',
  'music',
  'must',
  'my',
  'name',
  'near',
  'need',
  'never',
  'new',
  'next',
  'nice',
  'night',
  'no',
  'not',
  'nothing',
  'now',
  'of',
  'off',
  'office',
  'oh',
  'ok',
  'okay',
  'old',
  'on',
  'once',
  'one',
  'only',
  'open',
  'or',
  'other',
  'our',
  'out',
  'over',
  'own',
  'page',
  'party',
  'pass',
  'pay',
  'people',
  'phone',
  'pick',
  'place',
  'play',
  'please',
  'poor',
  'pretty',
  'put',
  'read',
  'ready',
  'real',
  'really',
  'red',
  'rest',
  'rich',
  'right',
  'rock',
  'room',
  'run',
  'safe',
  'save',
  'say',
  'school',
  'sea',
  'second',
  'see',
  'seek',
  'sell',
  'send',
  'set',
  'seven',
  'shall',
  'she',
  'ship',
  'shoot',
  'shop',
  'short',
  'should',
  'show',
  'since',
  'sir',
  'sit',
  'six',
  'sky',
  'sleep',
  'small',
  'so',
  'some',
  'son',
  'song',
  'soon',
  'sorry',
  'sound',
  'speak',
  'star',
  'start',
  'stay',
  'still',
  'stop',
  'store',
  'study',
  'stuff',
  'sun',
  'sure',
  'take',
  'talk',
  'teach',
  'team',
  'tell',
  'ten',
  'than',
  'thank',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'thing',
  'think',
  'this',
  'those',
  'three',
  'time',
  'to',
  'today',
  'together',
  'too',
  'top',
  'total',
  'town',
  'trade',
  'travel',
  'true',
  'trust',
  'try',
  'turn',
  'two',
  'under',
  'until',
  'up',
  'us',
  'use',
  'very',
  'view',
  'voice',
  'vote',
  'wait',
  'walk',
  'wall',
  'want',
  'war',
  'was',
  'watch',
  'water',
  'way',
  'we',
  'wear',
  'week',
  'well',
  'went',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'white',
  'who',
  'why',
  'wife',
  'will',
  'win',
  'wind',
  'wine',
  'wish',
  'with',
  'woman',
  'work',
  'works',
  'world',
  'would',
  'write',
  'wrong',
  'yeah',
  'year',
  'yes',
  'you',
  'young',
  'your',
];

const main = async () => {
  const response = await fetch(IANA_URL);
  if (!response.ok) {
    throw new Error(`IANA fetch failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.text();

  const versionLine = body.split('\n').find(line => line.startsWith('#')) || '';
  const version = versionLine.replace(/^#\s*/, '').trim();

  const tlds = body
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => line && !line.startsWith('#'))
    // Punycode TLDs (xn--*) can never appear in the ASCII patterns the
    // sanitizer matches, so they only bloat the bundle.
    .filter(tld => !tld.startsWith('xn--'))
    .sort();

  if (tlds.length < 500) {
    throw new Error(`Suspiciously few TLDs parsed (${tlds.length}) - aborting`);
  }

  const sentenceWords = new Set(SENTENCE_WORDS);
  const wordTlds = tlds.filter(tld => sentenceWords.has(tld));

  const format = list =>
    list
      .reduce((lines, tld) => {
        const last = lines[lines.length - 1];
        const quoted = `'${tld}',`;
        if (last && `${last} ${quoted}`.length <= 96) {
          lines[lines.length - 1] = `${last} ${quoted}`;
        } else {
          lines.push(quoted);
        }
        return lines;
      }, [])
      .map(line => `  ${line}`)
      .join('\n');

  const out = `/**
 * GENERATED FILE - do not edit by hand.
 * Run \`node scripts/generate-tlds.js\` to refresh from IANA.
 *
 * Source: ${IANA_URL}
 * ${version}
 * TLDs: ${tlds.length} (punycode xn--* excluded)
 */

/**
 * Every delegated TLD. A dotted token is only treated as a domain when its
 * final label is in this set, which is why \`example.com\` matches but
 * \`example.commute\` does not.
 */
export const TLDS = new Set([
${format(tlds)}
]);

/**
 * TLDs that double as common sentence-starting English words. Subtitles often
 * drop the space after a period ("Stop.It's over"), so a bare token ending in
 * one of these needs a scheme, a \`www.\` prefix, or a path/port before the
 * sanitizer will treat it as a link.
 */
export const WORD_TLDS = new Set([
${format(wordTlds)}
]);
`;

  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, '..', 'src', 'data', 'tlds.js');
  writeFileSync(target, out, 'utf8');

  console.log(`Wrote ${target}`);
  console.log(`  ${version}`);
  console.log(`  TLDS:      ${tlds.length}`);
  console.log(`  WORD_TLDS: ${wordTlds.length} -> ${wordTlds.join(' ')}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
