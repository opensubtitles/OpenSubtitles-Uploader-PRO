import changelogData from '../data/changelog.json';

/**
 * Utility functions for working with changelog data
 */

/**
 * Parse version string to comparable format
 * @param {string} version - Version string like "v1.7.1" or "1.7.1"
 * @returns {number[]} - Array of version numbers [major, minor, patch]
 */
const parseVersion = (version) => {
  const cleanVersion = version.replace(/^v/, '');
  return cleanVersion.split('.').map(num => parseInt(num, 10));
};

/**
 * Compare two version strings
 * @param {string} version1 
 * @param {string} version2 
 * @returns {number} - -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
const compareVersions = (version1, version2) => {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  
  return 0;
};

/**
 * Get changelog entries between two versions (exclusive of fromVersion, inclusive of toVersion)
 * @param {string} fromVersion - Current version (e.g., "1.7.0")
 * @param {string} toVersion - Target version (e.g., "1.7.1")
 * @returns {Object[]} - Array of changelog entries
 */
export const getChangelogBetweenVersions = (fromVersion, toVersion) => {
  if (!fromVersion || !toVersion) return [];
  
  const releases = changelogData.releases || [];
  
  // Filter releases between versions
  const filteredReleases = releases.filter(release => {
    const releaseVersion = release.version;
    return compareVersions(releaseVersion, fromVersion) > 0 && 
           compareVersions(releaseVersion, toVersion) <= 0;
  });
  
  // Sort by version descending (newest first)
  return filteredReleases.sort((a, b) => compareVersions(b.version, a.version));
};

/**
 * Format release body text to remove markdown and clean up for display
 * @param {string} body - Release body text
 * @returns {string} - Cleaned text
 */
export const formatReleaseBody = (body) => {
  if (!body) return '';
  
  return body
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markdown
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove bullet points and convert to simple list
    .replace(/^[-*+]\s+/gm, '• ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove GitHub signature
    .replace(/🤖 Generated with.*$/gm, '')
    .replace(/Co-Authored-By:.*$/gm, '')
    // Clean up whitespace
    .trim();
};

/**
 * Get a summary of changes between versions
 * @param {string} fromVersion - Current version
 * @param {string} toVersion - Target version
 * @returns {Object} - Summary object with version info and changes
 */
export const getChangelogSummary = (fromVersion, toVersion) => {
  const releases = getChangelogBetweenVersions(fromVersion, toVersion);
  
  if (releases.length === 0) {
    return {
      hasChanges: false,
      releaseCount: 0,
      releases: []
    };
  }
  
  return {
    hasChanges: true,
    releaseCount: releases.length,
    releases: releases.map(release => ({
      version: release.version,
      name: release.name,
      publishedAt: release.published_at,
      body: formatReleaseBody(release.body),
      url: release.html_url
    }))
  };
};

/**
 * Get the latest release info
 * @returns {Object|null} - Latest release object or null
 */
export const getLatestRelease = () => {
  const releases = changelogData.releases || [];
  return releases.length > 0 ? releases[0] : null;
};