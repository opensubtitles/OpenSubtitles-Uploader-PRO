import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  REPO_URL,
  stripReleasePrefix,
  buildReleaseEntry,
  withCurrentRelease,
} from '../../scripts/lib/changelogEntries.js';

/**
 * The bug these cover: the in-app "What's new" panel was always one version
 * behind the build it shipped in, because the changelog is generated while the
 * release is being cut - before the GitHub release exists. Opening the panel in
 * 1.10.2 showed 1.10.1 as the newest entry.
 */

const RELEASE_COMMIT = `🚀 RELEASE: Version 1.10.2 - Correct language detection for ASS/SSA subtitles

**Fixes every .ass and .ssa subtitle being detected as English.**

Detection now runs on dialogue text only.`;

const published = tag => ({ tag_name: tag, draft: false, name: tag, body: `notes for ${tag}` });

const silentLogger = { log: () => {}, warn: () => {} };

const quiet = (overrides = {}) => ({
  version: '1.10.2',
  lookupReleaseCommit: () => ({ authoredAt: '2026-11-09T05:24:46Z', message: RELEASE_COMMIT }),
  logger: silentLogger,
  ...overrides,
});

describe('stripReleasePrefix', () => {
  test('removes the release prefix the workflow also strips', () => {
    assert.equal(
      stripReleasePrefix('🚀 RELEASE: Version 1.2.3 - Thing\n\nBody'),
      'Version 1.2.3 - Thing\n\nBody'
    );
  });

  test('leaves a non-release message alone', () => {
    assert.equal(stripReleasePrefix('ci: move macOS builds'), 'ci: move macOS builds');
  });

  test('a prefix-only message yields nothing usable', () => {
    assert.equal(stripReleasePrefix('🚀 RELEASE: '), '');
  });
});

describe('buildReleaseEntry', () => {
  test('shapes a release commit like the GitHub API payload', () => {
    const entry = buildReleaseEntry({
      version: '1.10.2',
      authoredAt: '2026-11-09T05:24:46Z',
      message: RELEASE_COMMIT,
    });

    assert.equal(entry.tag_name, 'v1.10.2');
    assert.equal(entry.version, 'v1.10.2');
    assert.equal(entry.name, 'v1.10.2');
    assert.equal(entry.draft, false);
    assert.equal(entry.prerelease, false);
    assert.equal(entry.published_at, '2026-11-09T05:24:46Z');
    assert.equal(entry.html_url, `${REPO_URL}/releases/tag/v1.10.2`);
    // Assets do not exist while the release is still building.
    assert.deepEqual(entry.assets, []);
  });

  test('body matches what the workflow publishes - prefix stripped, rest kept', () => {
    const { body } = buildReleaseEntry({
      version: '1.10.2',
      authoredAt: '2026-11-09T05:24:46Z',
      message: RELEASE_COMMIT,
    });

    assert.ok(body.startsWith('Version 1.10.2 - Correct language detection'));
    assert.ok(body.includes('**Fixes every .ass and .ssa subtitle being detected as English.**'));
    assert.ok(!body.includes('🚀 RELEASE:'));
  });

  test('returns null when there are no usable notes', () => {
    assert.equal(buildReleaseEntry({ version: '1.10.2', message: '🚀 RELEASE: ' }), null);
    assert.equal(buildReleaseEntry({ version: '1.10.2', message: '' }), null);
    assert.equal(buildReleaseEntry({ version: '', message: RELEASE_COMMIT }), null);
  });
});

describe('withCurrentRelease', () => {
  test('prepends the version being built when GitHub has not published it', () => {
    const releases = [published('v1.10.1'), published('v1.10.0')];
    const result = withCurrentRelease({ ...quiet(), releases });

    assert.equal(result.length, 3);
    assert.equal(result[0].tag_name, 'v1.10.2', 'current release must come first');
    assert.equal(result[1].tag_name, 'v1.10.1');
    assert.ok(result[0].body.includes('Correct language detection'));
  });

  test('prefers the published release and does not duplicate it', () => {
    const releases = [published('v1.10.2'), published('v1.10.1')];
    const result = withCurrentRelease({ ...quiet(), releases });

    assert.equal(result.length, 2);
    assert.equal(result, releases, 'published list should pass through untouched');
    assert.equal(result[0].body, 'notes for v1.10.2', 'GitHub notes must win');
  });

  test('leaves the list untouched when no release commit can be found', () => {
    const releases = [published('v1.10.1')];
    const result = withCurrentRelease({
      ...quiet({ lookupReleaseCommit: () => null }),
      releases,
    });

    assert.deepEqual(result, releases);
  });

  test('warns loudly when the current version cannot be listed', () => {
    const warnings = [];
    withCurrentRelease({
      ...quiet({
        lookupReleaseCommit: () => null,
        logger: { log: () => {}, warn: msg => warnings.push(msg) },
      }),
      releases: [],
    });

    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('v1.10.2'));
    assert.ok(warnings[0].includes('fetch-depth: 0'), 'must name the CI fix');
  });

  test('still produces an entry when the API returned nothing at all', () => {
    const result = withCurrentRelease({ ...quiet(), releases: [] });

    assert.equal(result.length, 1);
    assert.equal(result[0].tag_name, 'v1.10.2');
  });

  test('a release commit with no usable notes is not prepended', () => {
    const result = withCurrentRelease({
      ...quiet({
        lookupReleaseCommit: () => ({
          authoredAt: '2026-11-09T05:24:46Z',
          message: '🚀 RELEASE: ',
        }),
      }),
      releases: [published('v1.10.1')],
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].tag_name, 'v1.10.1');
  });
});
