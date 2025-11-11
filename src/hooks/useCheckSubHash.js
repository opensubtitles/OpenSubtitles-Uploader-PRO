import { useState, useCallback } from 'react';
import { XmlRpcService } from '../services/api/xmlrpc.js';
import { SubtitleHashService } from '../services/subtitleHash.js';
import { isSubtitleFile } from '../utils/fileUtils.js';

/**
 * Custom hook for CheckSubHash functionality
 * Checks if subtitle files already exist in OpenSubtitles database
 */
export const useCheckSubHash = addDebugInfo => {
  const [hashCheckResults, setHashCheckResults] = useState({});
  const [hashCheckLoading, setHashCheckLoading] = useState(false);
  const [hashCheckProcessed, setHashCheckProcessed] = useState(false);

  /**
   * Process all subtitle files and check their hashes
   * @param {Array} files - Array of file objects
   */
  const processSubtitleHashes = useCallback(
    async files => {
      if (!files || files.length === 0) {
        return;
      }

      // Filter subtitle files
      const subtitleFiles = files.filter(file => isSubtitleFile(file.name) && !file.shouldRemove);

      if (subtitleFiles.length === 0) {
        addDebugInfo && addDebugInfo('📝 [CheckSubHash] No subtitle files found to check');
        return;
      }

      setHashCheckLoading(true);
      setHashCheckProcessed(false);
      addDebugInfo &&
        addDebugInfo(`📝 [CheckSubHash] Processing ${subtitleFiles.length} subtitle files...`);

      try {
        const results = {};
        const hashesToCheck = [];
        const fileHashMap = {};

        // Calculate MD5 hashes for all subtitle files
        for (const file of subtitleFiles) {
          try {
            const hashResult = await SubtitleHashService.readAndHashSubtitleFile(file.file || file);
            const hash = hashResult.hash;

            results[file.fullPath] = {
              filename: file.name,
              hash: hash,
              size: hashResult.size,
              status: 'pending',
            };

            hashesToCheck.push(hash);
            fileHashMap[hash] = file.fullPath;
          } catch (error) {
            addDebugInfo &&
              addDebugInfo(
                `❌ [CheckSubHash] Failed to calculate hash for ${file.name}: ${error.message}`
              );
            results[file.fullPath] = {
              filename: file.name,
              hash: null,
              status: 'error',
              error: error.message,
            };
          }
        }

        // Check hashes with OpenSubtitles API if we have any
        if (hashesToCheck.length > 0) {
          addDebugInfo &&
            addDebugInfo(`📝 [CheckSubHash] Checking ${hashesToCheck.length} hashes...`);

          try {
            const response = await XmlRpcService.checkSubHash(hashesToCheck);

            // Process the response
            if (response && response.status === '200 OK' && response.data) {
              // The response data contains hash results with subtitle IDs
              for (const hash of hashesToCheck) {
                const filePath = fileHashMap[hash];
                if (results[filePath] && response.data[hash]) {
                  const hashResult = response.data[hash];
                  const exists = hashResult.exists;
                  const subtitleId = hashResult.id;
                  const subtitleUrl = hashResult.url;

                  results[filePath].status = exists ? 'exists' : 'new';
                  results[filePath].subtitleId = subtitleId;
                  results[filePath].subtitleUrl = subtitleUrl;
                  results[filePath].apiResponse = hashResult;

                  if (exists) {
                    addDebugInfo &&
                      addDebugInfo(
                        `📝 [CheckSubHash] ${results[filePath].filename} - exists (ID: ${subtitleId})`
                      );
                  }
                }
              }
            } else {
              // If response format is unexpected, mark all as unknown
              for (const hash of hashesToCheck) {
                const filePath = fileHashMap[hash];
                if (results[filePath]) {
                  results[filePath].status = 'unknown';
                  addDebugInfo &&
                    addDebugInfo(
                      `📝 [CheckSubHash] ${results[filePath].filename} - ${hash} - status unknown`
                    );
                }
              }
            }
          } catch (apiError) {
            addDebugInfo && addDebugInfo(`❌ [CheckSubHash] API call failed: ${apiError.message}`);

            // Mark all as unknown due to API failure
            for (const hash of hashesToCheck) {
              const filePath = fileHashMap[hash];
              if (results[filePath]) {
                results[filePath].status = 'api_error';
                results[filePath].error = apiError.message;
              }
            }
          }
        }

        setHashCheckResults(results);
        setHashCheckProcessed(true);

        const summary = Object.values(results).reduce((acc, result) => {
          acc[result.status] = (acc[result.status] || 0) + 1;
          return acc;
        }, {});

        addDebugInfo &&
          addDebugInfo(`✅ [CheckSubHash] Complete. Summary: ${JSON.stringify(summary)}`);
      } catch (error) {
        addDebugInfo && addDebugInfo(`❌ [CheckSubHash] Processing failed: ${error.message}`);
      } finally {
        setHashCheckLoading(false);
      }
    },
    [addDebugInfo]
  );

  /**
   * Get hash check result for a specific file
   * @param {string} filePath - Full path of the file
   * @returns {Object|null} - Hash check result or null
   */
  const getHashCheckResult = useCallback(
    filePath => {
      return hashCheckResults[filePath] || null;
    },
    [hashCheckResults]
  );

  /**
   * Check if a file already exists in database
   * @param {string} filePath - Full path of the file
   * @returns {boolean} - True if file exists in database
   */
  const fileExistsInDatabase = useCallback(
    filePath => {
      const result = hashCheckResults[filePath];
      return result?.status === 'exists';
    },
    [hashCheckResults]
  );

  /**
   * Get summary of hash check results
   * @returns {Object} - Summary statistics
   */
  const getHashCheckSummary = useCallback(() => {
    const summary = Object.values(hashCheckResults).reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: Object.keys(hashCheckResults).length,
      exists: summary.exists || 0,
      new: summary.new || 0,
      pending: summary.pending || 0,
      error: summary.error || 0,
      api_error: summary.api_error || 0,
      unknown: summary.unknown || 0,
    };
  }, [hashCheckResults]);

  /**
   * Clear hash check results
   */
  const clearHashCheckResults = useCallback(() => {
    setHashCheckResults({});
    setHashCheckProcessed(false);
  }, []);

  return {
    hashCheckResults,
    hashCheckLoading,
    hashCheckProcessed,
    processSubtitleHashes,
    getHashCheckResult,
    fileExistsInDatabase,
    getHashCheckSummary,
    clearHashCheckResults,
  };
};
