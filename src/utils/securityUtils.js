/**
 * Security utility functions to prevent data leakage in logs
 */

/**
 * Safely formats sensitive data for logging by hiding the actual value
 * @param {string|null} sensitiveData - The sensitive data (token, session ID, etc.)
 * @param {string} dataType - Type of data for context (optional, e.g., 'token', 'session')
 * @returns {string} - Safe string for logging
 */
export function hideSensitiveData(sensitiveData, dataType = 'data') {
  if (!sensitiveData || sensitiveData === '' || sensitiveData === 'null') {
    return 'null';
  }

  return '[HIDDEN]';
}

/**
 * Safely logs sensitive authentication data
 * @param {string} message - Log message prefix
 * @param {string|null} sensitiveData - The sensitive data to hide
 * @param {string} dataType - Type of data being logged
 */
export function logSensitiveData(message, sensitiveData, dataType = 'data') {
  const safeValue = hideSensitiveData(sensitiveData, dataType);
  console.log(`${message}: ${safeValue}`);
}

/**
 * Creates a debug object with sensitive data hidden
 * @param {Object} debugData - Object containing potentially sensitive data
 * @param {Array<string>} sensitiveFields - Array of field names that contain sensitive data
 * @returns {Object} - Debug object with sensitive fields hidden
 */
export function createSafeDebugObject(debugData, sensitiveFields = []) {
  const safeDebug = { ...debugData };

  for (const field of sensitiveFields) {
    if (safeDebug[field]) {
      safeDebug[field] = hideSensitiveData(safeDebug[field], field);
    }
  }

  return safeDebug;
}
