/**
 * Changelog entry assembly, kept separate from the network/filesystem script so
 * it can be tested.
 *
 * The problem this solves: `generate-changelog.js` builds the in-app "What's
 * new" panel from *published* GitHub releases, but it runs while the release is
 * being cut - before `gh release create`. So every build shipped a changelog
 * one version behind itself. Opening "What's new" in 1.10.2 showed 1.10.1 as
 * the newest entry.
 *
 * The notes already exist locally at that point: they are the body of the
 * `🚀 RELEASE: Version X.Y.Z` commit, which is the same text the workflow hands
 * to `gh release create`. When GitHub has no release for the version being
 * built, synthesise the entry from that commit instead of omitting it.
 */

export const REPO_URL = 'https://github.com/opensubtitles/opensubtitles-uploader-pro';

/**
 * Mirrors the workflow's "Ensure release exists" step, which does
 * `sed 's/^🚀 RELEASE: //'` on the commit message before passing it as release
 * notes. Keeping the two identical means the synthesised entry does not
 * visibly change when a later build regenerates it from the GitHub API.
 */
export const stripReleasePrefix = message => message.replace(/^🚀 RELEASE: /, '').trim();

/**
 * Builds a GitHub-API-shaped release entry from a release commit.
 *
 * @param {object} params
 * @param {string} params.version - Bare version, e.g. "1.10.2".
 * @param {string} params.authoredAt - ISO-8601 commit author date.
 * @param {string} params.message - Full commit message (subject + body).
 * @param {string} [params.repoUrl]
 * @returns {object|null} null when the message carries no usable notes.
 */
export const buildReleaseEntry = ({ version, authoredAt, message, repoUrl = REPO_URL }) => {
  if (!version || !message) return null;

  const body = stripReleasePrefix(message);
  if (!body) return null;

  const tag = `v${version}`;
  return {
    // `tag_name` / `draft` keep this shaped like the API payload so the caller's
    // mapping stays uniform across both sources.
    tag_name: tag,
    draft: false,
    version: tag,
    name: tag,
    published_at: authoredAt,
    body,
    html_url: `${repoUrl}/releases/tag/${tag}`,
    prerelease: false,
    // Still being built - the assets do not exist yet.
    assets: [],
  };
};

/**
 * Guarantees the version being built appears in its own changelog, preferring a
 * published GitHub release whenever one exists.
 *
 * @param {object} params
 * @param {object[]} params.releases - Non-draft releases from the GitHub API.
 * @param {string} params.version - Bare version from package.json.
 * @param {function(string): {authoredAt: string, message: string}|null}
 *   params.lookupReleaseCommit - Resolves the release commit for a version.
 * @param {string} [params.repoUrl]
 * @param {{log: function, warn: function}} [params.logger]
 * @returns {object[]} releases, newest first, including the current version.
 */
export const withCurrentRelease = ({
  releases,
  version,
  lookupReleaseCommit,
  repoUrl = REPO_URL,
  logger = console,
}) => {
  const tag = `v${version}`;

  if (releases.some(release => release.tag_name === tag)) {
    logger.log(`✅ ${tag} already published on GitHub - using the release as-is`);
    return releases;
  }

  const commit = lookupReleaseCommit(version);
  const entry = commit
    ? buildReleaseEntry({
        version,
        authoredAt: commit.authoredAt,
        message: commit.message,
        repoUrl,
      })
    : null;

  if (!entry) {
    logger.warn(
      `⚠️ ${tag} is not published on GitHub and no "🚀 RELEASE: Version ${version}" commit ` +
        `was found. The in-app changelog will NOT list ${tag}. If this is a release build, ` +
        `check that the release commit is reachable (CI needs actions/checkout with ` +
        `fetch-depth: 0).`
    );
    return releases;
  }

  logger.log(`📌 ${tag} not on GitHub yet - using the release commit for its notes`);
  return [entry, ...releases];
};
