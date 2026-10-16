/**
 * Byte-exact text helpers for editing subtitle files of unknown encoding.
 *
 * Subtitles arrive as cp1250, cp1251, Big5, UTF-8, ... and the uploader hashes
 * and ships the raw bytes. Decoding as UTF-8 and re-encoding would silently
 * mangle every non-UTF-8 file, so edits run over a latin1 (ISO-8859-1) view
 * instead: latin1 is a bijection between bytes 0-255 and code points 0-255, so
 * every byte we do not touch round-trips exactly. The sanitizer only matches
 * ASCII, so matching works unchanged on that view.
 *
 * The view is built by hand rather than with `TextDecoder('iso-8859-1')`. In
 * the WHATWG Encoding Standard every ISO-8859-1 label is an alias for the
 * windows-1252 decoder, so a browser or WebView maps 0x80-0x9F to code points
 * above U+00FF (0x87 -> U+2021, 0x8B -> U+2039, ...). Re-encoding those with
 * `& 0xff` writes back the wrong byte and corrupts every multi-byte character
 * whose encoding contains one, which is most of UTF-8 Devanagari, Cyrillic and
 * CJK. Node's ICU-backed TextDecoder returns true latin1 for the same label,
 * so the bug is invisible to `node --test` and only appears in the app.
 */

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: false });

// Bounded so String.fromCharCode never overflows the call stack on big files.
const DECODE_CHUNK = 0x8000;

/**
 * Byte-preserving view of a file's contents: one code point per byte.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
export const decodeLatin1 = bytes => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = '';
  for (let offset = 0; offset < view.length; offset += DECODE_CHUNK) {
    text += String.fromCharCode(...view.subarray(offset, offset + DECODE_CHUNK));
  }
  return text;
};

/**
 * Converts a latin1 view back to the exact bytes it came from.
 * @param {string} text
 * @returns {ArrayBuffer}
 */
export const encodeLatin1ToBuffer = text => {
  const buffer = new ArrayBuffer(text.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i) & 0xff;
  }
  return buffer;
};

/**
 * Converts a latin1 view back to the exact bytes it came from.
 * @param {string} text
 * @returns {Uint8Array}
 */
export const encodeLatin1 = text => new Uint8Array(encodeLatin1ToBuffer(text));

/**
 * Best-effort human-readable rendering of a latin1 view, for the diff preview
 * only. UTF-8 files come out correct; other encodings come out legible enough
 * to confirm what is being removed.
 * @param {string} latin1Text
 * @returns {string}
 */
export const latin1ToDisplay = latin1Text => {
  const bytes = encodeLatin1(latin1Text);
  const decoded = UTF8_DECODER.decode(bytes);
  // U+FFFD means the bytes were not UTF-8 - show the latin1 view as-is.
  return decoded.includes('�') ? latin1Text : decoded;
};

/**
 * Reads a File as a byte-preserving latin1 string.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export const readFileAsLatin1 = async file => decodeLatin1(await file.arrayBuffer());

/**
 * Builds a replacement File from edited latin1 text, keeping the original
 * name, MIME type and modification time so downstream code sees no difference.
 * @param {File} original
 * @param {string} latin1Text
 * @returns {File}
 */
export const createFileFromLatin1 = (original, latin1Text) =>
  new File([encodeLatin1ToBuffer(latin1Text)], original.name, {
    type: original.type,
    lastModified: original.lastModified,
  });
