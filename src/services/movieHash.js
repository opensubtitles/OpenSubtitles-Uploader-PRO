import { DEFAULT_SETTINGS } from '../utils/constants.js';
import { formatFileSize } from '../utils/fileUtils.js';
import { retryAsync } from '../utils/retryUtils.js';

/**
 * Movie hash calculation service using OpenSubtitles algorithm
 */
export class MovieHashService {
  /**
   * Read a chunk of file data
   */
  static readFileChunk(file, start, length) {
    return new Promise((resolve, reject) => {
      if (start + length > file.size) {
        console.warn(
          `[CHUNK DEBUG] Chunk extends beyond file size, adjusting length from ${length} to ${file.size - start}`
        );
        length = file.size - start;
      }

      const slice = file.slice(start, start + length);

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const uint8Array = new Uint8Array(reader.result);

          resolve(uint8Array);
        } catch (error) {
          console.error(`[CHUNK DEBUG] Error creating Uint8Array:`, error);
          reject(error);
        }
      };

      reader.onerror = () => {
        console.error(`[CHUNK DEBUG] FileReader error:`, reader.error);
        reject(reader.error);
      };

      reader.onabort = () => {
        console.error(`[CHUNK DEBUG] FileReader aborted`);
        reject(new Error('FileReader aborted'));
      };

      reader.onloadstart = () => {};

      reader.onprogress = event => {
        if (event.lengthComputable) {
          const progress = ((event.loaded / event.total) * 100).toFixed(1);
        }
      };

      reader.readAsArrayBuffer(slice);
    });
  }

  /**
   * Read 64-bit little endian integer from byte array
   */
  static readLittleEndian64(bytes, offset) {
    let result = 0n;
    for (let i = 0; i < 8; i++) {
      const byte = BigInt(bytes[offset + i] || 0);
      result = result | (byte << BigInt(i * 8));
    }
    return result;
  }

  /**
   * Calculate movie hash for a file
   */
  static async calculateMovieHash(file) {
    try {
      const fileSize = file.size;
      const chunkSize = DEFAULT_SETTINGS.MOVIE_HASH_CHUNK_SIZE;

      if (fileSize < chunkSize * 2) {
        const error = `File too small for hash calculation: ${fileSize} bytes (minimum: ${chunkSize * 2})`;
        console.error(`[HASH DEBUG] ${error}`);
        throw new Error(error);
      }

      const startTime = Date.now();

      const firstChunk = await this.readFileChunk(file, 0, chunkSize);
      const firstChunkTime = Date.now() - startTime;

      const lastChunkStart = Date.now();

      const lastChunk = await this.readFileChunk(file, fileSize - chunkSize, chunkSize);
      const lastChunkTime = Date.now() - lastChunkStart;

      let hash = BigInt(fileSize);

      // Process first chunk

      const firstChunkProcessStart = Date.now();
      for (let i = 0; i < chunkSize; i += 8) {
        try {
          const value = this.readLittleEndian64(firstChunk, i);
          hash = (hash + value) & 0xffffffffffffffffn;

          // Log progress every 8KB
          if (i % 8192 === 0 && i > 0) {
          }
        } catch (chunkError) {
          console.warn(`[HASH DEBUG] Error reading first chunk at offset ${i}:`, chunkError);
          // Continue with next 8 bytes
        }
      }
      const firstChunkProcessTime = Date.now() - firstChunkProcessStart;

      // Process last chunk

      const lastChunkProcessStart = Date.now();
      for (let i = 0; i < chunkSize; i += 8) {
        try {
          const value = this.readLittleEndian64(lastChunk, i);
          hash = (hash + value) & 0xffffffffffffffffn;

          // Log progress every 8KB
          if (i % 8192 === 0 && i > 0) {
          }
        } catch (chunkError) {
          console.warn(`[HASH DEBUG] Error reading last chunk at offset ${i}:`, chunkError);
          // Continue with next 8 bytes
        }
      }
      const lastChunkProcessTime = Date.now() - lastChunkProcessStart;

      const hashString = hash.toString(16).padStart(16, '0');
      const totalTime = Date.now() - startTime;

      return hashString;
    } catch (error) {
      console.error(`[HASH DEBUG] Error calculating movie hash for ${file.name}:`, error);
      console.error(`[HASH DEBUG] Error stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate hash with timeout protection
   */
  static async calculateMovieHashWithTimeout(file, timeoutMs = 30000) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        console.error(
          `[TIMEOUT DEBUG] Hash calculation timeout after ${timeoutMs}ms for ${file.name}`
        );
        reject(new Error(`Hash calculation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const hashPromise = this.calculateMovieHash(file)
      .then(result => {
        // Clear timeout if hash completes first
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        return result;
      })
      .catch(error => {
        console.error(`[TIMEOUT DEBUG] Hash calculation failed for ${file.name}:`, error);
        // Clear timeout if hash fails
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        throw error;
      });

    try {
      const result = await Promise.race([hashPromise, timeoutPromise]);

      return result;
    } catch (error) {
      console.error(
        `[TIMEOUT DEBUG] Promise.race rejected with: ${error.message} for ${file.name}`
      );
      // Make sure timeout is cleared
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      throw error;
    }
  }

  /**
   * Calculate hash with timeout and retry protection
   */
  static async calculateMovieHashWithRetry(file, addDebugInfo = null) {
    const startTime = Date.now();

    try {
      const result = await retryAsync(
        () => {
          return this.calculateMovieHashWithTimeout(file, 30000);
        },
        3, // max attempts
        DEFAULT_SETTINGS.RETRY_BASE_DELAY,
        (attempt, maxAttempts) => {
          const message = `Hash calculation attempt ${attempt}/${maxAttempts} for ${file.name}`;

          if (addDebugInfo) {
            addDebugInfo(message);
          }
        }
      );

      const endTime = Date.now();

      // Validate the result
      if (!result || typeof result !== 'string' || result.length !== 16) {
        console.error(
          `[RETRY DEBUG] Invalid hash format: "${result}" (type: ${typeof result}, length: ${result?.length})`
        );
        throw new Error(`Invalid hash format: ${result}`);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      console.error(
        `[RETRY DEBUG] Hash calculation failed after all retries for ${file.name} (took ${endTime - startTime}ms):`,
        error
      );
      console.error(
        `[RETRY DEBUG] Error details: type=${typeof error}, message="${error.message}"`
      );

      // Make sure we throw a proper error
      if (error.message && error.message.includes('Invalid hash format')) {
        throw error;
      } else {
        throw new Error(`Hash calculation failed: ${error.message}`);
      }
    }
  }
}
