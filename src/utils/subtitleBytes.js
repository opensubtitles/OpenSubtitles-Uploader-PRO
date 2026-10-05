/**
 * Byte-exact text helpers for editing subtitle files of unknown encoding.
 *
 * Subtitles arrive as cp1250, cp1251, Big5, UTF-8, ... and the uploader hashes
 * and ships the raw bytes. Decoding as UTF-8 and re-encoding would silently
 * mangle every non-UTF-8 file, so edits run over a latin1 (ISO-8859-1) view
 * instead: latin1 is a bijection between bytes 0-255 and code points 0-255, so
 * every byte we do not touch round-trips exactly. The sanitizer only matches
 * ASCII, so matching works unchanged on that view.
 */

const LATIN1_DECODER = new TextDecoder('iso-8859-1');
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: false });

/**
 * Byte-preserving view of a file's contents: one code point per byte.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
export const decodeLatin1 = bytes =>
  LATIN1_DECODER.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));

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
