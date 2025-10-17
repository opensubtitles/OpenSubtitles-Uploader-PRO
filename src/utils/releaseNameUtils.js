/**
 * Utility functions for cleaning and processing release names from subtitle filenames
 * Port of PHP GetReleaseFromSubFilename function
 */

/**
 * Clean a release name from subtitle filename by removing language codes and extra markers
 * @param {string} subfilename - Subtitle filename or release name to clean
 * @param {Object} combinedLanguages - Combined language data from useLanguageData
 * @param {boolean} isReleaseName - If true, treat input as release name (skip extension removal)
 * @returns {string|false} - Cleaned release name with leading space, or false if invalid
 */
export function getReleaseFromSubFilename(subfilename, combinedLanguages = {}, isReleaseName = false) {
  if (!subfilename) return false;

  let string;

  if (!isReleaseName) {
    // Remove file extension
    const lastDotIndex = subfilename.lastIndexOf('.');
    if (lastDotIndex > 0) {
      string = subfilename.substring(0, lastDotIndex);
    } else {
      string = subfilename;
    }
  } else {
    string = subfilename;
  }

  // Remove CD1/CD I patterns (e.g., .CD1, -CD1, _CD I, etc.)
  // Pattern: ([\.\-\_\s]*)cd\s*[1I][\.\-\_\s]*
  string = string.replace(/([\.\-\_\s]*)cd\s*[1I][\.\-\_\s]*/gi, '$1');

  // First, remove regional language variants (e.g., pt-PT, pt-BR, en-US, es-ES)
  // Pattern: language code + hyphen + region code at the end
  string = string.replace(/([\.\-\_]+)(\w{2,3})-(\w{2,3})([\.\-\_]*(sdh)?)?$/gi, '$1$2$4');

  // Build language patterns from combinedLanguages
  const languagePatterns = buildLanguagePatterns(combinedLanguages);

  // Check if string ends with 2-3 character language code
  if (/[\.\-\_]+\w{2,3}[\.\-\_]*$/.test(string)) {
    // Try to remove short language codes (ISO639, ISO3) from the end
    for (const pattern of languagePatterns.shortCodes) {
      const regex = new RegExp(`(.*?)[\\.\\-\\_]+${escapeRegex(pattern)}[\\.\\-\\_]*(sdh)?$`, 'i');
      const match = string.match(regex);
      if (match) {
        string = match[1];
        break;
      }
    }
  } else {
    // Try to remove full language names from the end
    for (const pattern of languagePatterns.fullNames) {
      const regex = new RegExp(`(.*?)[\\.\\-\\_]+${escapeRegex(pattern)}[\\.\\-\\_]*(sdh)?$`, 'i');
      const match = string.match(regex);
      if (match) {
        string = match[1];
        break;
      }
    }
  }

  // Delete leading and trailing special characters: ,.-_\s=
  string = string.replace(/^[\,\.\-\_\s\=]+/g, '');
  string = string.replace(/[\,\.\-\_\s\=]+$/g, '');

  // Return false if result is too short
  if (string.length < 3) return false;

  // Return with leading space (matches PHP behavior)
  return ' ' + string.trim();
}

/**
 * Build language patterns from combined language data
 * @param {Object} combinedLanguages - Combined language data
 * @returns {Object} - Object with shortCodes and fullNames arrays
 */
function buildLanguagePatterns(combinedLanguages) {
  const shortCodes = new Set();
  const fullNames = new Set();

  // Add custom patterns (matching PHP hardcoded values)
  shortCodes.add('pt-br');
  fullNames.add('Portuguese'); // For pt-br
  fullNames.add('addic7ed.com');

  // Add patterns from combinedLanguages
  Object.values(combinedLanguages).forEach(lang => {
    // Add short codes (ISO639, language_code, iso639_3)
    if (lang.iso639) {
      shortCodes.add(lang.iso639.toLowerCase());
    }
    if (lang.language_code) {
      shortCodes.add(lang.language_code.toLowerCase());
    }
    if (lang.iso639_3) {
      shortCodes.add(lang.iso639_3.toLowerCase());
    }

    // Add full language names
    if (lang.languageName) {
      fullNames.add(lang.languageName);
    }
    if (lang.displayName) {
      fullNames.add(lang.displayName);
    }
    if (lang.originalName) {
      fullNames.add(lang.originalName);
    }
  });

  // Sort by length (longest first) to match longest patterns first
  const shortCodesArray = Array.from(shortCodes).sort((a, b) => b.length - a.length);
  const fullNamesArray = Array.from(fullNames).sort((a, b) => b.length - a.length);

  return {
    shortCodes: shortCodesArray,
    fullNames: fullNamesArray
  };
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Clean release name by removing language codes (convenience wrapper)
 * @param {string} releaseName - Release name to clean
 * @param {Object} combinedLanguages - Combined language data
 * @returns {string} - Cleaned release name (without leading space)
 */
export function cleanReleaseName(releaseName, combinedLanguages = {}) {
  const cleaned = getReleaseFromSubFilename(releaseName, combinedLanguages, true);
  if (cleaned === false) {
    return releaseName; // Return original if cleaning failed
  }
  return cleaned.trim(); // Remove leading space for convenience
}
