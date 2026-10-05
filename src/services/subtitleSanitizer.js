/**
 * Subtitle link sanitizer (Layer 1 - public, generic patterns only).
 *
 * Strips URLs, emails, IPs, obfuscated links and social handles from subtitle
 * dialogue text, leaving timing, indexes and format scaffolding untouched.
 *
 * Matching rules (see scripts/generate-tlds.js for the TLD data):
 *
 *   - A dotted token is only a domain when its final label is a delegated TLD.
 *     `example.com` matches; `example.commute` does not, because the matcher
 *     takes the longest trailing label (`commute`) and never retries a shorter
 *     suffix.
 *   - 107 TLDs double as sentence-starting English words (`.it`, `.to`, `.me`,
 *     `.now`, `.one`). Subtitles routinely drop the space after a period
 *     ("Stop.It's over"), so those need a scheme, a `www.` prefix, or a
 *     path/port before they count as links.
 *   - A Title-Cased TLD (`.Com`, `.It`, `.Now`) is a sentence boundary, not a
 *     link. ALL-CAPS (`.COM`) and lowercase (`.com`) both still match.
 *
 * Layer 2 (the private OpenSubtitles pattern list) is deliberately NOT here -
 * it stays server-side and will arrive as a span-returning API.
 */

import { TLDS, WORD_TLDS } from '../data/tlds.js';

export const LinkCategory = {
  URL: 'url',
  EMAIL: 'email',
  IP: 'ip',
  OBFUSCATED: 'obfuscated',
  HANDLE: 'handle',
};

export const ALL_CATEGORIES = Object.values(LinkCategory);

const CATEGORY_LABELS = {
  [LinkCategory.URL]: 'URL',
  [LinkCategory.EMAIL]: 'Email',
  [LinkCategory.IP]: 'IP address',
  [LinkCategory.OBFUSCATED]: 'Obfuscated link',
  [LinkCategory.HANDLE]: 'Social handle',
};

export const categoryLabel = category => CATEGORY_LABELS[category] || category;

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Characters that terminate a URL inside subtitle text. Closing brackets are
 * deliberately allowed through - real URLs contain them (`/a_(b)`) - and
 * trimTrailingPunctuation drops the unbalanced ones afterwards.
 */
const URL_STOP = '\\s<>"\'`|';

/** `hxxp` / `h**p` are filter-evasion spellings of `http`. */
const SCHEME_URL_RE = new RegExp(
  `\\b(?:h(?:tt|xx|\\*\\*)ps?|ftps?|sftp|rtsps?|rtmp|wss?|irc|magnet):(?:\\/\\/)?[^${URL_STOP}]+`,
  'gi'
);

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';

/**
 * Generic dotted host. The trailing `[a-z]{2,63}` is greedy and nothing follows
 * it in the pattern, so it never backtracks into a shorter TLD - that is what
 * keeps `example.commute` from degrading into `example.com`.
 */
const DOMAIN_RE = new RegExp(`${LABEL}(?:\\.${LABEL})*\\.[a-z]{2,63}`, 'gi');

const EMAIL_RE = new RegExp(`[a-z0-9._%+!-]+@${LABEL}(?:\\.${LABEL})*\\.[a-z]{2,63}`, 'gi');

const IPV4_RE = /\d{1,3}(?:\.\d{1,3}){3}/g;

const HANDLE_RE = /@[a-z0-9_]{3,30}/gi;

/** Port and/or path suffix, anchored at a given index. */
const TAIL_RE = new RegExp(`(?::\\d{1,5})?(?:\\/[^${URL_STOP}]*)?`, 'y');

/** Trailing sentence punctuation that is not part of the link. */
const TRAILING_PUNCT_RE = /[.,!?;:'")\]}>*_~-]+$/;

const CHAR_BEFORE_DOMAIN = /[a-z0-9@._%+-]/i;
const CHAR_AFTER_DOMAIN = /[a-z0-9-]/i;
const TITLE_CASED = /^[A-Z][a-z]+$/;
const HANDLE_OPENERS = /[\s([{<"'\u2018\u2019\u201c\u201d\u2013\u2014-]/;

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

const makeMatch = (category, start, end, text) => ({ category, start, end, text });

/** Drops sentence punctuation that the greedy URL match swallowed. */
const trimTrailingPunctuation = (text, start) => {
  let trimmed = text.replace(TRAILING_PUNCT_RE, '');
  // Put back a closing paren the URL itself opened, e.g. wiki-style links.
  while (
    trimmed.length < text.length &&
    (trimmed.match(/\(/g) || []).length > (trimmed.match(/\)/g) || []).length
  ) {
    trimmed = text.slice(0, trimmed.length + 1);
  }
  return { text: trimmed, start, end: start + trimmed.length };
};

/**
 * Validates a raw dotted-host match and, if it is a link, returns its span
 * extended over any port/path suffix.
 *
 * @param {string} text - the full line being scanned
 * @param {number} start - match start in `text`
 * @param {string} raw - matched host
 * @param {Object} [flags]
 * @param {boolean} [flags.trusted] - skip the Title-Case guard (the caller
 *   already saw an explicit obfuscation token, which is signal enough)
 * @param {number} [flags.separators] - separator count, used by the
 *   obfuscation pass to require evasion evidence
 * @returns {{start: number, end: number, text: string}|null}
 */
const validateDomain = (text, start, raw, flags = {}) => {
  const end = start + raw.length;

  const before = start > 0 ? text[start - 1] : '';
  if (before && CHAR_BEFORE_DOMAIN.test(before)) return null;

  const after = text[end] || '';
  if (after && CHAR_AFTER_DOMAIN.test(after)) return null;

  const labels = raw.split('.');
  const tldRaw = labels[labels.length - 1];
  const tld = tldRaw.toLowerCase();
  if (!TLDS.has(tld)) return null;

  // `Stop.It's over` / `I know.Now go` - a Title-Cased TLD is a sentence
  // boundary. ALL-CAPS (`EXAMPLE.COM`) is a real ad, so it stays.
  if (!flags.trusted && TITLE_CASED.test(tldRaw)) return null;

  TAIL_RE.lastIndex = end;
  const tail = TAIL_RE.exec(text);
  const tailText = tail ? tail[0] : '';
  const hasTail = tailText.length > 0;

  const hasWww = /^www\./i.test(raw);
  const hasScheme = /:\/\/$/.test(text.slice(Math.max(0, start - 3), start));

  // Word-like TLDs need structural evidence that this is really a link.
  if (WORD_TLDS.has(tld) && !hasWww && !hasTail && !hasScheme) return null;

  // Obfuscation pass only: a single plain separator is not evasion.
  if (flags.separators !== undefined && !flags.trusted) {
    if (!hasWww && !hasTail && flags.separators < 2) return null;
  }

  return trimTrailingPunctuation(raw + tailText, start);
};

// ---------------------------------------------------------------------------
// Scanners - each returns spans relative to the line it was given
// ---------------------------------------------------------------------------

const scanSchemeUrls = line => {
  const out = [];
  SCHEME_URL_RE.lastIndex = 0;
  let m;
  while ((m = SCHEME_URL_RE.exec(line)) !== null) {
    const span = trimTrailingPunctuation(m[0], m.index);
    // Reject a bare scheme with nothing after it ("http://").
    const body = span.text.slice(span.text.indexOf(':') + 1).replace(/^\/+/, '');
    if (body.length > 0) {
      out.push(makeMatch(LinkCategory.URL, span.start, span.end, span.text));
    }
  }
  return out;
};

const scanEmails = line => {
  const out = [];
  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(line)) !== null) {
    const raw = m[0];
    const after = line[m.index + raw.length] || '';
    if (after && CHAR_AFTER_DOMAIN.test(after)) continue;
    const tld = raw.split('.').pop().toLowerCase();
    if (!TLDS.has(tld)) continue;
    const span = trimTrailingPunctuation(raw, m.index);
    out.push(makeMatch(LinkCategory.EMAIL, span.start, span.end, span.text));
  }
  return out;
};

const scanDomains = line => {
  const out = [];
  DOMAIN_RE.lastIndex = 0;
  let m;
  while ((m = DOMAIN_RE.exec(line)) !== null) {
    const span = validateDomain(line, m.index, m[0]);
    if (span) out.push(makeMatch(LinkCategory.URL, span.start, span.end, span.text));
  }
  return out;
};

const scanIpv4 = line => {
  const out = [];
  IPV4_RE.lastIndex = 0;
  let m;
  while ((m = IPV4_RE.exec(line)) !== null) {
    const raw = m[0];
    const before = m.index > 0 ? line[m.index - 1] : '';
    const after = line[m.index + raw.length] || '';
    if (before && /[0-9.]/.test(before)) continue;
    if (after && /[0-9.]/.test(after)) continue;
    const octets = raw.split('.');
    if (!octets.every(octet => Number(octet) <= 255)) continue;

    TAIL_RE.lastIndex = m.index + raw.length;
    const tail = TAIL_RE.exec(line);
    const tailText = tail ? tail[0] : '';

    // `3.4.5.6` is a version or a score, not an address. Real addresses
    // almost always have a multi-digit octet, a port, or a path.
    if (!tailText && octets.every(octet => octet.length === 1)) continue;

    const span = trimTrailingPunctuation(raw + tailText, m.index);
    out.push(makeMatch(LinkCategory.IP, span.start, span.end, span.text));
  }
  return out;
};

const scanHandles = line => {
  const out = [];
  HANDLE_RE.lastIndex = 0;
  let m;
  while ((m = HANDLE_RE.exec(line)) !== null) {
    const raw = m[0];
    const before = m.index > 0 ? line[m.index - 1] : '';
    const after = line[m.index + raw.length] || '';
    if (before && !HANDLE_OPENERS.test(before)) continue;
    // `name@host.com` is an email, not a handle - let the email pass own it.
    if (after && /[a-z0-9_.@-]/i.test(after)) continue;
    if (!/[a-z]/i.test(raw.slice(1))) continue;
    out.push(makeMatch(LinkCategory.HANDLE, m.index, m.index + raw.length, raw));
  }
  return out;
};

// ---------------------------------------------------------------------------
// Obfuscation pass
// ---------------------------------------------------------------------------

/**
 * Separator spellings uploaders use to dodge naive URL filters. Each entry is
 * a sticky regex plus the character it normalizes to; `explicit` marks the
 * spellings that are themselves proof of evasion.
 */
const SEPARATORS = [
  {
    re: /\s*[([{<]\s*(?:dot|punto|punkt|ponto|point|punt)\s*[)\]}>]\s*/iy,
    as: '.',
    explicit: true,
  },
  { re: /\s*[([{<]\s*\.\s*[)\]}>]\s*/y, as: '.', explicit: true },
  { re: /\s+(?:dot|punto|punkt|ponto)\s+/iy, as: '.', explicit: true },
  { re: /\s*[([{<]\s*(?:at|arroba|chiocciola)\s*[)\]}>]\s*/iy, as: '@', explicit: true },
  { re: /\s*\.\s*/y, as: '.', explicit: false },
];

/**
 * Collapses obfuscated separators so the normal scanners can see the link,
 * while recording how to map every normalized index back to the original line.
 *
 * @param {string} line
 * @returns {{text: string, origStart: number[], origLen: number[],
 *            explicit: boolean[], separator: boolean[], changed: boolean}}
 */
const normalizeObfuscation = line => {
  const chars = [];
  const origStart = [];
  const origLen = [];
  const explicit = [];
  const separator = [];
  let changed = false;
  let i = 0;

  while (i < line.length) {
    let matched = null;
    for (const sep of SEPARATORS) {
      sep.re.lastIndex = i;
      const m = sep.re.exec(line);
      if (m && m[0].length > 0) {
        matched = { sep, raw: m[0] };
        break;
      }
    }

    if (matched) {
      chars.push(matched.sep.as);
      origStart.push(i);
      origLen.push(matched.raw.length);
      explicit.push(matched.sep.explicit);
      separator.push(true);
      if (matched.raw !== matched.sep.as) changed = true;
      i += matched.raw.length;
      continue;
    }

    chars.push(line[i]);
    origStart.push(i);
    origLen.push(1);
    explicit.push(false);
    separator.push(false);
    i += 1;
  }

  return {
    text: chars.join(''),
    origStart,
    origLen,
    explicit,
    separator,
    changed,
  };
};

/** Cheap pre-filter so the per-character normalizer only runs when it can pay off. */
const OBFUSCATION_HINT_RE =
  /\s\.|\.\s|[([{<]\s*(?:dot|punto|punkt|ponto|point|punt|at|arroba|chiocciola|\.)\s*[)\]}>]|\s(?:dot|punto|punkt|ponto)\s/i;

const scanObfuscated = line => {
  if (!OBFUSCATION_HINT_RE.test(line)) return [];

  const norm = normalizeObfuscation(line);
  if (!norm.changed) return [];

  const out = [];
  const push = (nStart, nEnd) => {
    const hasExplicit = norm.explicit.slice(nStart, nEnd).some(Boolean);
    const separators = norm.separator.slice(nStart, nEnd).filter(Boolean).length;
    const raw = norm.text.slice(nStart, nEnd);

    const span = validateDomain(norm.text, nStart, raw, {
      trusted: hasExplicit,
      separators,
    });
    if (!span) return;

    const lastIdx = span.end - 1;
    const start = norm.origStart[span.start];
    const end = norm.origStart[lastIdx] + norm.origLen[lastIdx];
    out.push(makeMatch(LinkCategory.OBFUSCATED, start, end, line.slice(start, end)));
  };

  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(norm.text)) !== null) {
    const tld = m[0].split('.').pop().toLowerCase();
    if (!TLDS.has(tld)) continue;
    const nStart = m.index;
    const nEnd = nStart + m[0].length;
    const start = norm.origStart[nStart];
    const end = norm.origStart[nEnd - 1] + norm.origLen[nEnd - 1];
    out.push(makeMatch(LinkCategory.OBFUSCATED, start, end, line.slice(start, end)));
  }

  DOMAIN_RE.lastIndex = 0;
  while ((m = DOMAIN_RE.exec(norm.text)) !== null) {
    push(m.index, m.index + m[0].length);
  }

  return out;
};

// ---------------------------------------------------------------------------
// Span merging
// ---------------------------------------------------------------------------

const CATEGORY_PRIORITY = {
  [LinkCategory.URL]: 0,
  [LinkCategory.EMAIL]: 1,
  [LinkCategory.OBFUSCATED]: 2,
  [LinkCategory.IP]: 3,
  [LinkCategory.HANDLE]: 4,
};

/** Keeps the longest span per overlap, breaking ties by category priority. */
const mergeSpans = spans => {
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
  });

  const out = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span.start < last.end) {
      if (span.end > last.end) {
        last.text += span.text.slice(last.end - span.start);
        last.end = span.end;
      }
      continue;
    }
    out.push({ ...span });
  }
  return out;
};

/**
 * Finds every link-like span in a single piece of dialogue text.
 *
 * @param {string} line
 * @param {string[]} [categories] - categories to scan for
 * @returns {Array<{category: string, start: number, end: number, text: string}>}
 */
export const findLinks = (line, categories = ALL_CATEGORIES) => {
  if (!line) return [];
  const enabled = new Set(categories);
  const spans = [];

  if (enabled.has(LinkCategory.URL)) spans.push(...scanSchemeUrls(line));
  if (enabled.has(LinkCategory.EMAIL)) spans.push(...scanEmails(line));
  if (enabled.has(LinkCategory.URL)) spans.push(...scanDomains(line));
  if (enabled.has(LinkCategory.IP)) spans.push(...scanIpv4(line));
  if (enabled.has(LinkCategory.OBFUSCATED)) spans.push(...scanObfuscated(line));
  if (enabled.has(LinkCategory.HANDLE)) spans.push(...scanHandles(line));

  return mergeSpans(spans);
};

// ---------------------------------------------------------------------------
// Line cleanup
// ---------------------------------------------------------------------------

const EMPTY_TAG_RE = /<\s*([a-z]+)[^>]*>\s*<\s*\/\s*\1\s*>/gi;
const EMPTY_BRACKETS_RE = /\(\s*\)|\[\s*\]|\{\s*\}/g;
/** A line left holding nothing but separators/dashes carries no dialogue. */
const SEPARATORS_ONLY_RE = /^[\s\-\u2013\u2014:|,.*=~_"'<>()[\]{}]+$/;

/** Tidies the whitespace and orphan punctuation a removed span leaves behind. */
const cleanupLine = line => {
  let out = line;
  for (let pass = 0; pass < 2; pass += 1) {
    out = out.replace(EMPTY_TAG_RE, '').replace(EMPTY_BRACKETS_RE, '');
  }
  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/^[ \t]+|[ \t]+$/g, '');

  if (SEPARATORS_ONLY_RE.test(out)) return '';
  return out;
};

/** Removes the given spans from a line, then cleans up the remains. */
const stripSpans = (line, spans) => {
  let out = line;
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    out = out.slice(0, spans[i].start) + out.slice(spans[i].end);
  }
  return cleanupLine(out);
};

// ---------------------------------------------------------------------------
// Format handling
// ---------------------------------------------------------------------------

/**
 * A UTF-8 BOM read through the byte-preserving latin1 view shows up as
 * "\u00EF\u00BB\u00BF", so both spellings have to be tolerated.
 */
const BOM_RE = /^(?:\uFEFF|\u00EF\u00BB\u00BF)/;

const stripBom = text => text.replace(BOM_RE, '');

export const detectSubtitleFormat = content => {
  const head = stripBom(content);
  if (/^\s*WEBVTT/i.test(head)) return 'vtt';
  if (/^\s*\[Script Info\]/im.test(head) || /^\s*Dialogue:/im.test(head)) return 'ass';
  if (/^\s*\{\d+\}\{\d+\}/m.test(head)) return 'microdvd';
  if (/-->/.test(head)) return 'srt';
  return 'unknown';
};

const INDEX_LINE_RE = /^\s*\d+\s*$/;
const TIME_LINE_RE = /-->/;

/** An SRT index line, tolerating a BOM on the very first one. */
const isIndexLine = line => INDEX_LINE_RE.test(stripBom(line));
const bomPrefix = line => (BOM_RE.test(line) ? line.match(BOM_RE)[0] : '');
const VTT_BLOCK_KEYWORD_RE = /^\s*(?:NOTE|STYLE|REGION)\b/;

/**
 * Returns the editable dialogue slice of a line, or null when the whole line
 * is format scaffolding (index, timing, ASS header, ...).
 *
 * @returns {{start: number, end: number}|null}
 */
const dialogueSlice = (line, format) => {
  if (!line.trim()) return null;
  if (TIME_LINE_RE.test(line)) return null;
  if (isIndexLine(line)) return null;

  if (format === 'ass') {
    const m = /^(\s*(?:Dialogue|Comment)\s*:\s*)/i.exec(line);
    if (!m) return null;
    // ASS event fields: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    let idx = m[0].length;
    for (let field = 0; field < 9; field += 1) {
      const comma = line.indexOf(',', idx);
      if (comma === -1) return null;
      idx = comma + 1;
    }
    return { start: idx, end: line.length };
  }

  if (format === 'microdvd') {
    const m = /^\s*\{\d+\}\{\d+\}/.exec(line);
    if (!m) return null;
    return { start: m[0].length, end: line.length };
  }

  if (format === 'vtt' && VTT_BLOCK_KEYWORD_RE.test(line)) return null;
  if (format === 'vtt' && /^\s*WEBVTT/i.test(stripBom(line))) return null;

  return { start: 0, end: line.length };
};

const splitLines = content => {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  return { lines: content.split(/\r\n|\n|\r/), eol };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const matchId = (lineNumber, span) => `${lineNumber}:${span.start}:${span.end}`;

/**
 * Scans and (optionally) rewrites a subtitle file.
 *
 * Cues whose dialogue is nothing but a link are dropped and SRT indexes are
 * renumbered, so the output stays a valid subtitle file.
 *
 * @param {string} content - full subtitle file text
 * @param {Object} [options]
 * @param {string[]} [options.categories] - which link categories to strip
 * @param {Set<string>|string[]} [options.excludedIds] - match ids the user
 *   unchecked in the preview; they are reported but not removed
 * @returns {{
 *   format: string,
 *   content: string,
 *   changed: boolean,
 *   matches: Array<Object>,
 *   removedCues: number,
 *   changedCues: number,
 *   diffs: Array<{lineNumber: number, before: string, after: string, removed: boolean, matches: Array<Object>}>
 * }}
 */
export const sanitizeSubtitle = (content, options = {}) => {
  const categories = options.categories || ALL_CATEGORIES;
  const excluded =
    options.excludedIds instanceof Set ? options.excludedIds : new Set(options.excludedIds || []);

  const empty = {
    format: 'unknown',
    content: content || '',
    changed: false,
    matches: [],
    removedCues: 0,
    changedCues: 0,
    diffs: [],
  };
  if (!content) return empty;

  const format = detectSubtitleFormat(content);
  const { lines, eol } = splitLines(content);

  const matches = [];
  const diffs = [];
  const rewritten = [...lines];

  lines.forEach((line, i) => {
    const slice = dialogueSlice(line, format);
    if (!slice) return;

    const segment = line.slice(slice.start, slice.end);
    const spans = findLinks(segment, categories);
    if (spans.length === 0) return;

    const lineNumber = i + 1;
    const kept = [];

    for (const span of spans) {
      const absolute = {
        ...span,
        start: span.start + slice.start,
        end: span.end + slice.start,
      };
      const id = matchId(lineNumber, absolute);
      const excludedFlag = excluded.has(id);
      matches.push({
        id,
        lineNumber,
        category: span.category,
        text: span.text,
        start: absolute.start,
        end: absolute.end,
        excluded: excludedFlag,
      });
      if (!excludedFlag) kept.push(span);
    }

    if (kept.length === 0) return;

    const cleanedSegment = stripSpans(segment, kept);
    const after = line.slice(0, slice.start) + cleanedSegment;
    rewritten[i] = after;
    diffs.push({
      lineNumber,
      before: line,
      after,
      removed: false,
      matches: matches.filter(m => m.lineNumber === lineNumber && !m.excluded),
    });
  });

  if (matches.length === 0) return { ...empty, format };

  const { content: finalContent, removedCues } = rebuild(rewritten, format, eol);
  const changedCues = diffs.length;

  return {
    format,
    content: finalContent,
    changed: finalContent !== content,
    matches,
    removedCues,
    changedCues,
    diffs,
  };
};

/**
 * Reassembles the file after stripping: drops cues left with no dialogue and
 * renumbers SRT indexes so the result stays valid.
 */
const rebuild = (lines, format, eol) => {
  if (format === 'ass' || format === 'microdvd') {
    const out = [];
    let removedCues = 0;
    for (const line of lines) {
      const slice = dialogueSlice(line, format);
      if (slice && line.slice(slice.start).trim() === '') {
        removedCues += 1;
        continue;
      }
      out.push(line);
    }
    return { content: out.join(eol), removedCues };
  }

  if (format !== 'srt' && format !== 'vtt') {
    // Unknown format: never drop lines, we cannot tell cues from scaffolding.
    return { content: lines.join(eol), removedCues: 0 };
  }

  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const kept = [];
  let removedCues = 0;

  for (const block of blocks) {
    const timeIdx = block.findIndex(line => TIME_LINE_RE.test(line));
    if (timeIdx === -1) {
      kept.push(block);
      continue;
    }
    const textLines = block.slice(timeIdx + 1);
    const hasText = textLines.some(line => line.trim() !== '');
    if (!hasText) {
      removedCues += 1;
      continue;
    }
    kept.push([...block.slice(0, timeIdx + 1), ...textLines.filter(line => line.trim() !== '')]);
  }

  // Renumber sequential numeric cue identifiers.
  let counter = 0;
  const out = kept.map(block => {
    const timeIdx = block.findIndex(line => TIME_LINE_RE.test(line));
    if (timeIdx === -1) return block;
    counter += 1;
    if (timeIdx > 0 && isIndexLine(block[0])) {
      return [bomPrefix(block[0]) + String(counter), ...block.slice(1)];
    }
    return block;
  });

  const body = out.map(block => block.join(eol)).join(eol + eol);
  return { content: body ? body + eol + eol : '', removedCues };
};

/**
 * Convenience wrapper: true when the file contains at least one link.
 * @param {string} content
 * @param {string[]} [categories]
 */
export const hasLinks = (content, categories) =>
  sanitizeSubtitle(content, { categories }).matches.length > 0;
