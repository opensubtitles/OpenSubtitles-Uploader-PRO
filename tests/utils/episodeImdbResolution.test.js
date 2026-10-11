import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  buildXmlRpcEpisodeData,
  resolveEpisodeImdbId,
  resolveXmlRpcEpisodeImdbId,
} from '../../src/utils/fileUtils.js';

// Real data captured from the Astro Boy (2003) report (forum post p55122).
// The .com features API only lists episodes 1-4 of season 1; XML-RPC
// BestGuess.IMDBEpisode resolves every episode including the missing ones.
const ASTRO_BOY_FEATURES = {
  data: [
    {
      attributes: {
        title: 'astro boy',
        year: '2003',
        feature_type: 'Tvshow',
        imdb_id: 387719,
        seasons: [
          {
            season_number: 1,
            episodes: [
              { episode_number: 1, title: 'Power Up!', feature_imdb_id: 1125945 },
              { episode_number: 2, title: 'Robotto Booru', feature_imdb_id: 1436507 },
              { episode_number: 3, title: 'Atomu uchuu e iku', feature_imdb_id: 1436494 },
              { episode_number: 4, title: 'Denkou', feature_imdb_id: 1436496 },
            ],
          },
        ],
      },
    },
  ],
};

const movieGuessFor = (season, episode, imdbEpisode) => ({
  imdbid: '0387719',
  title: 'Astro Boy',
  year: '2003',
  kind: 'tv series',
  reason: 'Data Intersection',
  imdb_episode_id: imdbEpisode,
  best_guess_season: season,
  best_guess_episode: episode,
});

const guessItFor = (season, episode) => ({ season, episode });

describe('resolveEpisodeImdbId', () => {
  test('uses the features API episode row when the episode exists there', () => {
    const result = resolveEpisodeImdbId(
      movieGuessFor(1, 2, '1436507'),
      { '0387719': ASTRO_BOY_FEATURES },
      guessItFor(1, 2)
    );
    assert.strictEqual(result, '1436507');
  });

  test('falls back to XML-RPC IMDBEpisode when features has no row (gap episode)', () => {
    const result = resolveEpisodeImdbId(
      movieGuessFor(1, 5, '1436510'),
      { '0387719': ASTRO_BOY_FEATURES },
      guessItFor(1, 5)
    );
    assert.strictEqual(result, '1436510');
  });

  test('returns the series IMDb when neither source resolves an episode', () => {
    const movie = movieGuessFor(1, 5, undefined);
    delete movie.imdb_episode_id;
    const result = resolveEpisodeImdbId(
      movie,
      { '0387719': ASTRO_BOY_FEATURES },
      guessItFor(1, 5)
    );
    assert.strictEqual(result, '0387719');
  });

  test('keeps a user-selected episode IMDb untouched', () => {
    const features = {
      data: [{ attributes: { feature_type: 'Episode', imdb_id: 1436510 } }],
    };
    const result = resolveEpisodeImdbId(
      { imdbid: '1436510', reason: 'User selected' },
      { 1436510: features },
      null
    );
    assert.strictEqual(result, '1436510');
  });

  test('returns null without a base IMDb ID', () => {
    assert.strictEqual(resolveEpisodeImdbId({}, {}, guessItFor(1, 5)), null);
  });

  test('works with no features data loaded yet', () => {
    const result = resolveEpisodeImdbId(movieGuessFor(1, 5, '1436510'), {}, guessItFor(1, 5));
    assert.strictEqual(result, '1436510');
  });
});

describe('resolveXmlRpcEpisodeImdbId', () => {
  test('rejects a BestGuess episode ID that belongs to another episode', () => {
    // movieGuesses entries get reused across files in a directory; the guard
    // stops S01E05's episode ID from leaking onto S01E06.
    const result = resolveXmlRpcEpisodeImdbId(movieGuessFor(1, 5, '1436510'), guessItFor(1, 6));
    assert.strictEqual(result, null);
  });

  test('rejects a mismatched season', () => {
    const result = resolveXmlRpcEpisodeImdbId(movieGuessFor(1, 5, '1436510'), guessItFor(2, 5));
    assert.strictEqual(result, null);
  });

  test('accepts string season/episode from GuessIt', () => {
    const result = resolveXmlRpcEpisodeImdbId(movieGuessFor(1, 5, '1436510'), {
      season: '1',
      episode: '5',
    });
    assert.strictEqual(result, '1436510');
  });

  test('reads season/episode from episode_info shape', () => {
    const result = resolveXmlRpcEpisodeImdbId(movieGuessFor(1, 5, '1436510'), {
      episode_info: { season: 1, episode: 5 },
    });
    assert.strictEqual(result, '1436510');
  });

  test('falls back to season/episode carried on the movie entry', () => {
    const movie = { ...movieGuessFor(1, 5, '1436510'), season: 1, episode: 5 };
    assert.strictEqual(resolveXmlRpcEpisodeImdbId(movie, null), '1436510');
  });

  test('returns null when BestGuess carried no episode ID', () => {
    const movie = movieGuessFor(1, 5, undefined);
    delete movie.imdb_episode_id;
    assert.strictEqual(resolveXmlRpcEpisodeImdbId(movie, guessItFor(1, 5)), null);
  });

  test('returns null when BestGuess carried no season/episode to verify against', () => {
    const movie = { imdbid: '0387719', imdb_episode_id: '1436510' };
    assert.strictEqual(resolveXmlRpcEpisodeImdbId(movie, guessItFor(1, 5)), null);
  });

  test('handles a null movie entry', () => {
    assert.strictEqual(resolveXmlRpcEpisodeImdbId(null, guessItFor(1, 5)), null);
  });
});

describe('buildXmlRpcEpisodeData', () => {
  test('builds episode-level movie data with the series ID preserved', () => {
    const result = buildXmlRpcEpisodeData(movieGuessFor(1, 5, '1436510'), guessItFor(1, 5));
    assert.strictEqual(result.imdbid, '1436510');
    assert.strictEqual(result.series_imdb_id, '0387719');
    assert.strictEqual(result.kind, 'episode');
    assert.strictEqual(result.season, 1);
    assert.strictEqual(result.episode, 5);
    assert.strictEqual(result.show_title, 'Astro Boy');
    assert.strictEqual(result.title, 'Astro Boy - S01E05 - Episode 5');
    assert.strictEqual(result.reason, 'Episode matched from XML-RPC BestGuess');
  });

  test('uses the episode title from GuessIt when present', () => {
    const result = buildXmlRpcEpisodeData(movieGuessFor(1, 5, '1436510'), {
      season: 1,
      episode: 5,
      episode_title: 'Rainbow Canyon',
    });
    assert.strictEqual(result.title, 'Astro Boy - S01E05 - Rainbow Canyon');
    assert.strictEqual(result.episode_title, 'Rainbow Canyon');
  });

  test('returns null when the episode cannot be resolved', () => {
    assert.strictEqual(buildXmlRpcEpisodeData(movieGuessFor(1, 5, '1436510'), guessItFor(1, 6)), null);
    assert.strictEqual(buildXmlRpcEpisodeData(null, guessItFor(1, 5)), null);
  });
});
