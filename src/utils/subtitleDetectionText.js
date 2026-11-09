/**
 * Plain-dialogue extraction for language detection.
 *
 * The `utilities/fasttext/language/detect/file` endpoint samples a file's first
 * ~100 lines. For SubRip that is mostly dialogue and detection works, but for
 * Advanced SubStation Alpha the `[Script Info]` / `[V4+ Styles]` header plus the
 * per-event `Dialogue: 0,0:00:16.10,0:00:20.23,BottomCenter,,0,0,0,,` prefixes
 * and `{\i1}` override blocks swamp the real text. The server then reports the
 * header itself:
 *
 *   content_preview: "ScriptType: v4.00+ Collisions: Normal PlayResX: 640 ..."
 *   languages:       en=0.192, de=0.070, ru=0.063
 *
 * — byte-identical for every `.ass` file regardless of its actual language. A
 * Crunchyroll MKV with English, Latin-American Spanish and Brazilian Portuguese
 * ASS tracks reports all three as English.
 *
 * This module reduces a subtitle to the words a human would read, so detection
 * runs on language and nothing else. The same three tracks then return
 * en=0.942 / es=0.996 / pt=0.997.
 *
 * Detection-only. The uploaded file is always the untouched original — nothing
 * here is ever written back to disk or shipped to the upload endpoint.
 */

import { detectSubtitleFormat } from '../services/subtitleSanitizer.js';

/** ASS override blocks: `{\i1}`, `{\pos(10,20)}`, `{\k45}`, ... */
const ASS_OVERRIDE_RE = /\{[^}]*\}/g;

/** ASS escapes: `\N` and `\n` are line breaks, `\h` a hard space. */
const ASS_ESCAPE_RE = /\\[Nnh]/g;

/**
 * Vector drawing mode. `{\p1}m 0 0 l 100 0 ...` carries coordinates, not words;
 * the coordinate soup survives override-block removal and is pure noise.
 */
const ASS_DRAWING_RE = /\\p[1-9]/;

/** `<i>`, `</font>`, `<b>` — legal in SRT/VTT and not part of the language. */
const HTML_TAG_RE = /<[^>]*>/g;

/** VTT cue payload tags: `<v Speaker>` handled above; `&nbsp;` and friends. */
const HTML_ENTITY_RE = /&(?:[a-z]+|#\d+);/gi;

/** MicroDVD: `{123}{456}` frame markers, `/` italic flag, `|` line break. */
const MICRODVD_PREFIX_RE = /^\s*\{\d+\}\{\d+\}/;

const SRT_INDEX_RE = /^\s*\d+\s*$/;
const TIMECODE_RE = /-->/;
const VTT_KEYWORD_RE = /^\s*(?:WEBVTT|NOTE|STYLE|REGION)\b/i;

/** A UTF-8 BOM, both as a code point and as its latin1-view spelling. */
const BOM_RE = /^(?:\uFEFF|\u00EF\u00BB\u00BF)/;

const collapse = text => text.replace(/\s+/g, ' ').trim();

/**
 * Text of one ASS `Dialogue:` event, or null when the line is not a dialogue
 * event or carries no readable words.
 *
 * `Comment:` events are deliberately excluded: translators routinely leave
 * English production notes in non-English scripts, which is exactly the noise
 * this module exists to remove.
 */
const assDialogueText = line => {
  const marker = /^\s*Dialogue\s*:\s*/i.exec(line);
  if (!marker) return null;

  // Event fields: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
  let idx = marker[0].length;
  for (let field = 0; field < 9; field += 1) {
    const comma = line.indexOf(',', idx);
    if (comma === -1) return null;
    idx = comma + 1;
  }

  const raw = line.slice(idx);
  if (ASS_DRAWING_RE.test(raw)) return null;

  return collapse(raw.replace(ASS_OVERRIDE_RE, ' ').replace(ASS_ESCAPE_RE, ' '));
};

const cleanCueText = line =>
  collapse(
    line
      .replace(HTML_TAG_RE, ' ')
      .replace(HTML_ENTITY_RE, ' ')
      // SRT in the wild carries ASS-style positioning tags too.
      .replace(ASS_OVERRIDE_RE, ' ')
  );

/**
 * Reduces subtitle content to its dialogue text, one cue per line.
 *
 * @param {string} content - Decoded subtitle text (any supported format).
 * @param {object} [options]
 * @param {number} [options.maxChars] - Truncate the result at this many
 *   characters, on a line boundary, so the caller can bound the upload.
 * @returns {{text: string, format: string, lines: number}} `text` is empty when
 *   nothing readable was found, which the caller should treat as "send the raw
 *   content instead" rather than as a detection result.
 */
export const extractDialogueText = (content, { maxChars = Infinity } = {}) => {
  const format = detectSubtitleFormat(content);
  const source = content.replace(BOM_RE, '');

  if (format === 'unknown') {
    const text = source.slice(0, maxChars === Infinity ? undefined : maxChars);
    return { text, format, lines: text ? text.split('\n').length : 0 };
  }

  const out = [];
  let total = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    let text = null;

    if (format === 'ass') {
      text = assDialogueText(line);
    } else if (format === 'microdvd') {
      const prefix = MICRODVD_PREFIX_RE.exec(line);
      if (prefix) {
        text = cleanCueText(line.slice(prefix[0].length).replace(/\|/g, ' ').replace(/^\//, ' '));
      }
    } else {
      // srt / vtt: everything that is not scaffolding is dialogue.
      if (!line.trim()) continue;
      if (TIMECODE_RE.test(line)) continue;
      if (SRT_INDEX_RE.test(line)) continue;
      if (format === 'vtt' && VTT_KEYWORD_RE.test(line)) continue;
      text = cleanCueText(line);
    }

    if (!text) continue;

    // +1 for the newline that will join this line to the previous one.
    const cost = text.length + (out.length ? 1 : 0);
    if (total + cost > maxChars) break;
    out.push(text);
    total += cost;
  }

  return { text: out.join('\n'), format, lines: out.length };
};
