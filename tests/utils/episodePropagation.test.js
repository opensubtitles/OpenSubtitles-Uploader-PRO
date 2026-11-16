/**
 * Tests for giving a user-picked show to the other files of the same series.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  parseEpisodeFilename,
  seriesKey,
  propagateShowToSiblings,
} from '../../src/utils/episodePropagation.js';
import { buildUploadTarget } from '../../src/utils/uploadTarget.js';

describe('parseEpisodeFilename', () => {
  test('reads the series and SxxEyy from a release name', () => {
    assert.deepStrictEqual(parseEpisodeFilename('Norsemen.S03E02.720p.WEBRip.x264-GalaxyTV.srt'), {
      seriesKey: 'norsemen',
      season: 3,
      episode: 2,
    });
  });

  test('accepts spaced, lower-case and 1x02 forms, and paths', () => {
    assert.deepStrictEqual(parseEpisodeFilename('Vikingane S01 E03.en.srt'), {
      seriesKey: 'vikingane',
      season: 1,
      episode: 3,
    });
    assert.deepStrictEqual(parseEpisodeFilename('shows/Astro Boy (2003) s01e05.mkv'), {
      seriesKey: 'astro boy',
      season: 1,
      episode: 5,
    });
    assert.deepStrictEqual(parseEpisodeFilename('The.Office.2x04.HDTV.srt'), {
      seriesKey: 'the office',
      season: 2,
      episode: 4,
    });
  });

  test('returns null without episode coordinates or series title', () => {
    assert.strictEqual(parseEpisodeFilename('Perfect.Days.2023.1080p.srt'), null);
    assert.strictEqual(parseEpisodeFilename('S01E02.srt'), null);
  });

  test('seriesKey drops the year and separators', () => {
    assert.strictEqual(seriesKey('Norsemen.2016.'), 'norsemen');
    assert.strictEqual(seriesKey('Astro Boy (2003)'), 'astro boy');
  });
});

describe('propagateShowToSiblings', () => {
  const picked = {
    imdbid: 'tt5905354',
    title: 'Norsemen',
    year: 2016,
    kind: 'episode',
    reason: 'User selected',
    feature_id: 180477,
    season_number: 3,
    episode_number: 1,
    parent_imdbid: 'tt5905354',
  };
  const files = [
    { path: 'a', name: 'Norsemen.S03E01.720p.WEBRip.x264-GalaxyTV.srt' },
    { path: 'b', name: 'Norsemen.S03E02.720p.WEBRip.x264-GalaxyTV.srt' },
    { path: 'c', name: 'Norsemen.S03E06.720p.WEBRip.x264-GalaxyTV.srt' },
    { path: 'd', name: 'Perfect.Days.2023.srt' },
    { path: 'e', name: 'Other.Show.S03E02.srt' },
  ];

  test('gives the show to the same series, each with its own episode', () => {
    const updates = propagateShowToSiblings({ changedPath: 'a', newGuess: picked, files });

    assert.deepStrictEqual(Object.keys(updates).sort(), ['b', 'c']);
    assert.strictEqual(updates.b.imdbid, 'tt5905354');
    assert.strictEqual(updates.b.kind, 'episode');
    assert.strictEqual(updates.b.season_number, 3);
    assert.strictEqual(updates.b.episode_number, 2);
    assert.strictEqual(updates.c.episode_number, 6);
    assert.strictEqual(updates.b.feature_id, null);
    assert.match(updates.b.reason, /Same show as Norsemen\.S03E01/);
  });

  test('uploads as (show, season, episode)', () => {
    const updates = propagateShowToSiblings({ changedPath: 'a', newGuess: picked, files });
    const target = buildUploadTarget(updates.b);

    assert.deepStrictEqual(target.payload, {
      idmovieimdb: 'tt5905354',
      season_number: 3,
      episode_number: 2,
    });
  });

  test('leaves files the user set by hand', () => {
    const updates = propagateShowToSiblings({
      changedPath: 'a',
      newGuess: picked,
      files,
      movieGuesses: { b: { reason: 'User selected', imdbid: 'tt1' } },
    });

    assert.deepStrictEqual(Object.keys(updates), ['c']);
  });

  test('does nothing for a movie, or without the show id', () => {
    assert.deepStrictEqual(
      propagateShowToSiblings({ changedPath: 'a', newGuess: { ...picked, kind: 'movie' }, files }),
      {}
    );
    assert.deepStrictEqual(
      propagateShowToSiblings({
        changedPath: 'a',
        newGuess: { ...picked, parent_imdbid: null },
        files,
      }),
      {}
    );
  });

  test('does nothing when the changed file names no episode', () => {
    assert.deepStrictEqual(
      propagateShowToSiblings({ changedPath: 'd', newGuess: picked, files }),
      {}
    );
  });
});
