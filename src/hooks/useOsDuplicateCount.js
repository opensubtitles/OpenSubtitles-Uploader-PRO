import { useState, useCallback, useEffect, useRef } from 'react';
import { XmlRpcService } from '../services/api/xmlrpc.js';
import { SubtitleHashService } from '../services/subtitleHash.js';

/**
 * useOsDuplicateCount
 *
 * For each subtitle in a matched pair, queries OpenSubtitles SearchSubtitles by
 * (imdbid, sublanguageid) so the UI can show "N on OS" — how many subtitles
 * already exist for this movie + language pair. De-duplicates by the
 * (imdb, lang) key so a batch of 20 episodes in one language costs at most
 * 20 API calls, and re-scans hit the 24h cache for free.
 *
 * Returned per subtitle.fullPath:
 *   { status: 'idle'|'loading'|'done'|'error',
 *     count: number, searchUrl: string|null, error?: string }
 */
export const useOsDuplicateCount = (addDebugInfo) => {
  const [results, setResults] = useState({});

  // In-flight de-dup: key = `${imdbid}|${sublang}`, value = Promise
  const inFlight = useRef(new Map());

  const setRowState = useCallback((fullPath, patch) => {
    setResults((prev) => ({
      ...prev,
      [fullPath]: { ...(prev[fullPath] || {}), ...patch },
    }));
  }, []);

  /**
   * pairedFiles: [{ video, subtitles: [...] }]
   * movieGuesses: { [videoPath]: { imdbid, ... } }
   * getSubtitleLanguage: (subtitle) => language code (2 or 3 letter)
   * combinedLanguages: language data (used to normalise to 3-letter sublanguageid)
   */
  const refreshFromPairs = useCallback(
    async (pairedFiles, movieGuesses, getSubtitleLanguage, combinedLanguages) => {
      if (!pairedFiles || pairedFiles.length === 0) return;

      // Build the list of (subtitle.fullPath, imdbid, sublang) tasks
      const tasks = [];
      for (const pair of pairedFiles) {
        if (!pair?.video || !pair.subtitles?.length) continue;
        const movie = movieGuesses?.[pair.video.fullPath];
        const imdbid = movie?.imdbid;
        if (!imdbid) continue;

        for (const subtitle of pair.subtitles) {
          const langCode = getSubtitleLanguage?.(subtitle);
          if (!langCode) continue;
          const sublang = SubtitleHashService.getLanguageId(langCode, combinedLanguages);
          if (!sublang) continue;
          tasks.push({ fullPath: subtitle.fullPath, imdbid, sublang });
        }
      }

      if (tasks.length === 0) return;

      // De-dup tasks by (imdb, lang) — but every task still maps to its own fullPath row
      const pairKey = (t) => `${String(t.imdbid).replace(/^tt/i, '').replace(/^0+/, '')}|${t.sublang}`;
      const grouped = new Map();
      for (const task of tasks) {
        const key = pairKey(task);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(task.fullPath);
      }

      // Mark rows that don't yet have a result as loading
      setResults((prev) => {
        const next = { ...prev };
        for (const [, paths] of grouped) {
          for (const fp of paths) {
            const cur = next[fp];
            if (!cur || cur.status === 'idle') {
              next[fp] = { status: 'loading', count: 0, searchUrl: null };
            }
          }
        }
        return next;
      });

      // Fire each unique (imdb, lang) once. If multiple rows share the key, fan
      // the same result out to all of them.
      const promises = [];
      for (const [key, paths] of grouped) {
        // Skip if we already have a final result for every path under this key
        const allDone = paths.every((p) => {
          const r = results[p];
          return r && r.status === 'done' && r.pairKey === key;
        });
        if (allDone) continue;

        let promise = inFlight.current.get(key);
        if (!promise) {
          const [imdbid, sublang] = key.split('|');
          promise = XmlRpcService.searchSubtitlesByImdb(imdbid, sublang, addDebugInfo)
            .then((data) => {
              for (const fp of paths) {
                setRowState(fp, {
                  status: 'done',
                  count: data.count,
                  searchUrl: data.searchUrl,
                  pairKey: key,
                });
              }
              return data;
            })
            .catch((err) => {
              for (const fp of paths) {
                setRowState(fp, {
                  status: 'error',
                  count: 0,
                  searchUrl: null,
                  error: err?.message || String(err),
                  pairKey: key,
                });
              }
              if (addDebugInfo) {
                addDebugInfo(
                  `❌ [OsDuplicateCount] ${key} failed: ${err?.message || err}`
                );
              }
            })
            .finally(() => {
              inFlight.current.delete(key);
            });
          inFlight.current.set(key, promise);
        } else {
          // Same key already in flight from a previous call — attach extra paths
          promise.then((data) => {
            if (!data) return;
            for (const fp of paths) {
              setRowState(fp, {
                status: 'done',
                count: data.count,
                searchUrl: data.searchUrl,
                pairKey: key,
              });
            }
          });
        }
        promises.push(promise);
      }

      await Promise.allSettled(promises);
    },
    [addDebugInfo, results, setRowState]
  );

  const clearOsDuplicateCounts = useCallback(() => {
    setResults({});
    inFlight.current.clear();
  }, []);

  return {
    osDuplicateCounts: results,
    refreshOsDuplicateCounts: refreshFromPairs,
    clearOsDuplicateCounts,
  };
};

/**
 * Stable hook wrapper that auto-refreshes whenever the (pairs, guesses,
 * languages) inputs change. Avoids the consumer needing to wire useEffect.
 */
export const useAutoOsDuplicateCount = ({
  pairedFiles,
  movieGuesses,
  getSubtitleLanguage,
  combinedLanguages,
  addDebugInfo,
}) => {
  const { osDuplicateCounts, refreshOsDuplicateCounts, clearOsDuplicateCounts } =
    useOsDuplicateCount(addDebugInfo);

  // Build a stable signature so we only re-fire when the actual (path -> imdb -> lang)
  // tuples change. Otherwise React re-renders on unrelated state would re-trigger.
  const signature = (() => {
    if (!pairedFiles?.length) return '';
    const parts = [];
    for (const pair of pairedFiles) {
      if (!pair?.video || !pair.subtitles?.length) continue;
      const imdb = movieGuesses?.[pair.video.fullPath]?.imdbid || '-';
      for (const sub of pair.subtitles) {
        const lang = getSubtitleLanguage?.(sub) || '-';
        parts.push(`${sub.fullPath}:${imdb}:${lang}`);
      }
    }
    return parts.join('|');
  })();

  useEffect(() => {
    if (!signature) return;
    refreshOsDuplicateCounts(
      pairedFiles,
      movieGuesses,
      getSubtitleLanguage,
      combinedLanguages
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { osDuplicateCounts, refreshOsDuplicateCounts, clearOsDuplicateCounts };
};
