import CryptoJS from 'crypto-js';
import pako from 'pako';

/**
 * Subtitle hash calculation utilities for OpenSubtitles
 */
export class SubtitleHashService {
  /**
   * Calculate MD5 hash of subtitle file bytes
   * @param {Uint8Array} uint8Array - Raw file bytes
   * @returns {string} - MD5 hash in lowercase
   */
  static calculateSubtitleHashFromBytes(uint8Array) {
    // Convert Uint8Array to WordArray for CryptoJS
    const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
    const hash = CryptoJS.MD5(wordArray).toString().toLowerCase();

    return hash;
  }

  /**
   * Calculate MD5 hash of subtitle content (string version - for compatibility)
   * @param {string} content - Subtitle file content (raw, unescaped)
   * @returns {string} - MD5 hash in lowercase
   */
  static calculateSubtitleHash(content) {
    // Ensure we're working with the raw content, not escaped
    const hash = CryptoJS.MD5(content).toString().toLowerCase();
    return hash;
  }

  /**
   * Read subtitle file and calculate hash
   * @param {File} file - Subtitle file
   * @param {boolean} includeContent - Whether to include content (for UploadSubtitles)
   * @returns {Promise<Object>} - Object containing hash, size, and optionally content
   */
  static async readAndHashSubtitleFile(file, includeContent = false) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          // Convert ArrayBuffer to string preserving exact bytes
          const arrayBuffer = reader.result;
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to string using TextDecoder to handle encoding properly
          const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false });
          const content = decoder.decode(uint8Array);

          // Try both methods - hash from raw bytes and from string
          const hashFromBytes = this.calculateSubtitleHashFromBytes(uint8Array);
          const hashFromString = this.calculateSubtitleHash(content);

          // CRITICAL: Use hash from raw file bytes, not string content
          // The server expects the MD5 of the original file bytes
          const hash = hashFromBytes;

          const result = {
            hash,
            size: file.size,
          };

          if (includeContent) {
            result.content = content;
            // Try compressing the raw file bytes instead of the decoded string
            const compressionResult = this.compressAndEncodeRawBytesWithHash(uint8Array);
            result.contentGzipBase64 = compressionResult.base64;
            result.compressedHash = compressionResult.compressedHash;

            // Additional debug info passed to parent function
            console.log('DEBUG: Full subtitle content info:', {
              fileName: file.name,
              originalHash: hash,
              compressedHash: compressionResult.compressedHash,
              contentLength: content.length,
              rawFileSize: uint8Array.length,
              compressedLength: result.contentGzipBase64.length,
              compressionMethod: 'Raw binary bytes -> GZIP DEFLATE (no headers) -> Base64',
              firstLine: content.split('\n')[0],
              lastLine: content.split('\n').slice(-2)[0], // -2 to avoid empty last line
            });
          }

          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);

      // Read as ArrayBuffer to preserve exact file content
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Compress raw file bytes with zlib (gzcompress equivalent) and encode as base64, returning both base64 and hash
   * @param {Uint8Array} rawBytes - Raw file bytes
   * @returns {Object} - Object with base64 and compressedHash
   */
  static compressAndEncodeRawBytesWithHash(rawBytes) {
    try {
      // Compress the raw bytes using zlib format (gzcompress equivalent)
      const compressed = pako.deflate(rawBytes);

      // Calculate MD5 hash of compressed data
      const compressedHash = this.calculateSubtitleHashFromBytes(compressed);

      // Convert to base64
      const base64 = btoa(String.fromCharCode.apply(null, compressed));

      console.log('Raw bytes compression (zlib):', {
        originalSize: rawBytes.length,
        compressedSize: compressed.length,
        base64Size: base64.length,
        compressionRatio: ((compressed.length / rawBytes.length) * 100).toFixed(1) + '%',
        compressedDataHash: compressedHash,
        compressionFormat: 'zlib (gzcompress equivalent)',
      });

      return {
        base64,
        compressedHash,
      };
    } catch (error) {
      console.error('Raw bytes compression failed:', error);
      throw new Error(`Failed to compress raw subtitle bytes: ${error.message}`);
    }
  }

  /**
   * Compress content with zlib (gzcompress equivalent) and encode as base64, returning both base64 and hash
   * @param {string} content - Raw subtitle content
   * @returns {Object} - Object with base64 and compressedHash
   */
  static compressAndEncodeContentWithHash(content) {
    try {
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(content);

      // Compress with zlib format (gzcompress equivalent)
      const compressed = pako.deflate(uint8Array);

      // Calculate MD5 hash of compressed data
      const compressedHash = this.calculateSubtitleHashFromBytes(compressed);

      // Convert to base64
      const base64 = btoa(String.fromCharCode.apply(null, compressed));

      // DEBUG: Verify round-trip compression/decompression
      const debugResult = this.debugCompressedContent(base64, content);

      // ADDITIONAL DEBUG: Calculate MD5 of base64
      const base64Hash = this.calculateSubtitleHash(base64);

      console.log('Content compression (zlib with hash):', {
        originalSize: content.length,
        compressedSize: compressed.length,
        base64Size: base64.length,
        compressionRatio: ((compressed.length / content.length) * 100).toFixed(1) + '%',
        debugVerification: debugResult,
        compressedDataHash: compressedHash,
        base64Hash: base64Hash,
        compressionFormat: 'zlib (gzcompress equivalent)',
      });

      return {
        base64,
        compressedHash,
      };
    } catch (error) {
      console.error('Content compression failed:', error);
      throw new Error(`Failed to compress subtitle content: ${error.message}`);
    }
  }

  /**
   * Compress content with zlib (gzcompress equivalent) and encode as base64 (legacy function)
   * @param {string} content - Raw subtitle content
   * @returns {string} - Zlib compressed and base64 encoded content
   */
  static compressAndEncodeContent(content) {
    try {
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(content);

      // Compress with zlib format (gzcompress equivalent)
      const compressed = pako.deflate(uint8Array);

      // Convert to base64
      const base64 = btoa(String.fromCharCode.apply(null, compressed));

      // DEBUG: Verify round-trip compression/decompression
      const debugResult = this.debugCompressedContent(base64, content);

      // ADDITIONAL DEBUG: Calculate MD5 of compressed data
      const compressedHash = this.calculateSubtitleHashFromBytes(compressed);
      const base64Hash = this.calculateSubtitleHash(base64);

      console.log('Content compression (zlib):', {
        originalSize: content.length,
        compressedSize: compressed.length,
        base64Size: base64.length,
        compressionRatio: ((compressed.length / content.length) * 100).toFixed(1) + '%',
        debugVerification: debugResult,
        compressedDataHash: compressedHash,
        base64Hash: base64Hash,
        compressionFormat: 'zlib (gzcompress equivalent)',
      });

      return base64;
    } catch (error) {
      console.error('Content compression failed:', error);
      throw new Error(`Failed to compress subtitle content: ${error.message}`);
    }
  }

  /**
   * Debug function to decode base64, decompress, and verify content/hash
   * @param {string} base64Content - Base64 encoded compressed content
   * @param {string} originalContent - Original uncompressed content
   * @returns {Object} - Debug information about the round-trip
   */
  static debugCompressedContent(base64Content, originalContent) {
    try {
      // Decode base64 back to binary
      const binaryString = atob(base64Content);
      const compressedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        compressedBytes[i] = binaryString.charCodeAt(i);
      }

      // Decompress using inflate (counterpart to deflate - zlib format)
      const decompressed = pako.inflate(compressedBytes);

      // Convert back to string
      const decoder = new TextDecoder('utf-8');
      const decompressedContent = decoder.decode(decompressed);

      // Calculate hash of decompressed content
      const decompressedHash = this.calculateSubtitleHash(decompressedContent);
      const originalHash = this.calculateSubtitleHash(originalContent);

      // Compare content and hashes
      const contentMatch = decompressedContent === originalContent;
      const hashMatch = decompressedHash === originalHash;

      console.log('DEBUG: Compression round-trip verification:', {
        originalLength: originalContent.length,
        decompressedLength: decompressedContent.length,
        contentMatch: contentMatch,
        originalHash: originalHash,
        decompressedHash: decompressedHash,
        hashMatch: hashMatch,
        firstDifference: contentMatch
          ? null
          : this.findFirstDifference(originalContent, decompressedContent),
      });

      return {
        contentMatch,
        hashMatch,
        decompressedHash,
        originalHash,
      };
    } catch (error) {
      console.error('DEBUG: Failed to verify compressed content:', error);
      return {
        error: error.message,
        contentMatch: false,
        hashMatch: false,
      };
    }
  }

  /**
   * Find the first difference between two strings for debugging
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {Object} - Information about the first difference
   */
  static findFirstDifference(str1, str2) {
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
      if (str1[i] !== str2[i]) {
        return {
          position: i,
          original: str1.charCodeAt(i),
          decompressed: str2.charCodeAt(i),
          originalChar: str1[i],
          decompressedChar: str2[i],
          context: {
            before: str1.substring(Math.max(0, i - 10), i),
            after: str1.substring(i, Math.min(str1.length, i + 10)),
          },
        };
      }
    }

    if (str1.length !== str2.length) {
      return {
        position: minLength,
        lengthDifference: str1.length - str2.length,
        originalLength: str1.length,
        decompressedLength: str2.length,
      };
    }

    return null;
  }

  /**
   * Get language ID in 3-letter format for OpenSubtitles
   * @param {string} languageCode - 2 or 3 letter language code
   * @param {Object} combinedLanguages - Language data
   * @returns {string} - 3-letter language code
   */
  static getLanguageId(languageCode, combinedLanguages) {
    if (!languageCode || !combinedLanguages) return null;

    const langData = combinedLanguages[languageCode];
    if (!langData) return languageCode;

    // Return ISO639-3 if available, otherwise ISO639-2, otherwise original
    return langData.iso639_3 || langData.iso639_2 || langData.iso639 || languageCode;
  }
}
