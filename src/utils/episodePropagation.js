// When the user picks the show and episode for one file, give the same show
// to the other files of that series, each with the season/episode its own
// filename names.
//
// Before: dropping a season of "Norsemen.S03E0x..." files that the guess did
// not match meant clicking "Change", searching the show and picking the
// episode once per file. Now the first pick is enough: every other file whose
// name carries the same series title and an SxxEyy gets that show and its own
// coordinates. The server resolves (show, season, episode) itself and creates
// episodes it knows from IMDb and does not have yet, so no feature id is
// needed for those files.
//
// Never overrides a file the user set by hand (reason 'User selected').

const VIDEO_OR_SUB_EXT =
  /\.(mkv|mp4|avi|mov|wmv|flv|webm|m4v|ts|m2ts|mpg|mpeg|srt|sub|ass|ssa|vtt|smi|txt)$/i;

// SxxEyy (also "S01 E03", "s1.e3") or 1x02.
const SXXEYY = /^(.*?)[\s._\-[(]*s(\d{1,2})[\s._-]*e(\d{1,3})(?!\d)/i;
const NXNN = /^(.*?)[\s._\-[(]+(\d{1,2})x(\d{2,3})(?!\d)/i;

// "Norsemen", "norsemen ", "Norsemen.2016", "Astro Boy (2003)" -> comparable key.
export function seriesKey(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .replace(/[._\-]+/g, ' ')
    .replace(/[([]\s*(19|20)\d{2}\s*[)\]]/g, ' ') // (2003) / [2003]
    .replace(/\s(19|20)\d{2}\s*$/, ' ') // trailing year
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
}

// "Norsemen.S03E02.720p.WEBRip.srt" -> { seriesKey: 'norsemen', season: 3, episode: 2 }
export function parseEpisodeFilename(name) {
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .replace(VIDEO_OR_SUB_EXT, '');
  const match = base.match(SXXEYY) || base.match(NXNN);
  if (!match) return null;

  const key = seriesKey(match[1]);
  const season = Number(match[2]);
  const episode = Number(match[3]);
  if (!key || !Number.isInteger(season) || !Number.isInteger(episode) || episode < 1) return null;

  return { seriesKey: key, season, episode };
}

const isManual = guess => guess && guess.reason === 'User selected';

/**
 * @param {object} args
 * @param {string} args.changedPath  path of the file the user just changed
 * @param {object} args.newGuess     the guess the user picked for it
 * @param {Array<{path: string, name: string}>} args.files  every file that holds a guess
 * @param {object} args.movieGuesses current guesses, keyed by path
 * @returns {object} path -> new guess, for the files to update (may be empty)
 */
export function propagateShowToSiblings({ changedPath, newGuess, files, movieGuesses = {} }) {
  if (!newGuess || String(newGuess.kind || '').toLowerCase() !== 'episode') return {};

  const showImdb = newGuess.parent_imdbid || newGuess.series_imdb_id || null;
  if (!showImdb) return {};

  const changed = files.find(f => f.path === changedPath);
  const origin = changed && parseEpisodeFilename(changed.name);
  if (!origin) return {};

  const showTitle = newGuess.show_title || newGuess.title || '';
  const updates = {};

  files.forEach(file => {
    if (file.path === changedPath) return;
    if (isManual(movieGuesses[file.path])) return;

    const parsed = parseEpisodeFilename(file.name);
    if (!parsed || parsed.seriesKey !== origin.seriesKey) return;

    const { season, episode } = parsed;
    updates[file.path] = {
      imdbid: showImdb,
      parent_imdbid: showImdb,
      series_imdb_id: showImdb,
      title: showTitle,
      show_title: showTitle,
      year: newGuess.year ?? null,
      kind: 'episode',
      // No feature_id: the upload sends (show, season, episode) and the server
      // resolves the episode, creating it from IMDb when needed.
      feature_id: null,
      season,
      episode,
      season_number: season,
      episode_number: episode,
      episode_title: `Episode ${episode}`,
      formatted_title: `${showTitle} - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`,
      provisional: false,
      reason: `Same show as ${changed.name}`,
      propagated_from: changedPath,
    };
  });

  return updates;
}
