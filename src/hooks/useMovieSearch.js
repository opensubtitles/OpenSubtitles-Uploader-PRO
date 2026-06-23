import React from 'react';
import { OpenSubtitlesApiService } from '../services/api/openSubtitlesApi.js';

/**
 * Shared movie search hook for both MatchedPairs and OrphanedSubtitles
 * Provides consistent movie search functionality across components
 */
export const useMovieSearch = onMovieChange => {
  const [openMovieSearch, setOpenMovieSearch] = React.useState(null);
  const [movieSearchQuery, setMovieSearchQuery] = React.useState('');
  const [movieSearchResults, setMovieSearchResults] = React.useState([]);
  const [movieSearchLoading, setMovieSearchLoading] = React.useState(false);
  const [movieUpdateLoading, setMovieUpdateLoading] = React.useState({});

  // Clear search state when closing
  const closeMovieSearch = () => {
    setOpenMovieSearch(null);
    setMovieSearchQuery('');
    setMovieSearchResults([]);
  };

  // Utility function to extract IMDB ID from various input formats
  const extractImdbId = input => {
    if (!input) return null;

    // Remove whitespace
    const trimmed = input.trim();

    // Match full IMDB URLs: https://www.imdb.com/title/tt1133589/
    const urlMatch = trimmed.match(/imdb\.com\/title\/(tt\d+)/i);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Match tt + number format: tt1133589
    const ttMatch = trimmed.match(/^(tt\d+)$/i);
    if (ttMatch) {
      return ttMatch[1];
    }

    // Match just numbers (assume it needs tt prefix): 1133589 or 749451
    const numberMatch = trimmed.match(/^\d+$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[0], 10);

      // For numbers >= 3000, pad to 7 digits with leading zeros
      // This handles cases like 749451 -> tt0749451
      if (number >= 3000) {
        const paddedNumber = number.toString().padStart(7, '0');
        return `tt${paddedNumber}`;
      }

      // For smaller numbers, use as-is (legacy behavior)
      return `tt${numberMatch[0]}`;
    }

    return null;
  };

  // Check if input looks like an IMDB ID
  const isImdbInput = input => {
    return extractImdbId(input) !== null;
  };

  // Map a single /features entry to the suggest_imdb result shape so the
  // existing render path doesn't need to special-case the fallback.
  const featuresAttrToResult = (attrs, imdbHint) => {
    if (!attrs) return null;
    const ft = (attrs.feature_type || '').toLowerCase();
    const kind =
      ft === 'tvshow' || ft === 'tv_series'
        ? 'tv series'
        : ft === 'episode'
          ? 'episode'
          : 'movie';
    const rawImdb = attrs.imdb_id || attrs.parent_imdb_id || imdbHint || '';
    const imdb = String(rawImdb).toLowerCase().startsWith('tt')
      ? rawImdb
      : rawImdb
        ? `tt${String(rawImdb).replace(/^0+/, '').padStart(7, '0')}`
        : '';
    return {
      id: imdb,
      name:
        attrs.title ||
        attrs.parent_title ||
        attrs.original_title ||
        imdb ||
        '(no title)',
      year: attrs.year || '',
      kind,
      source: 'features-api-fallback',
      pic: attrs.img_url || undefined,
    };
  };

  // Fallback for IMDB IDs unknown to suggest_imdb.php — pull the title from
  // the opensubtitles.com /features endpoint so the user can still attach
  // the entered IMDB id. Returns a single-element results array shaped like
  // the suggest_imdb response, or [] if features has nothing either.
  const searchFeaturesByImdb = async imdbId => {
    try {
      const cleanImdb = String(imdbId).toLowerCase().replace(/^tt/, '').replace(/^0+/, '');
      if (!cleanImdb) return [];
      const features = await OpenSubtitlesApiService.getFeaturesByImdbId(cleanImdb);
      const attrs = features?.data?.[0]?.attributes;
      const result = featuresAttrToResult(attrs, imdbId);
      return result ? [result] : [];
    } catch (err) {
      console.warn('Features fallback for IMDB id failed:', err?.message || err);
      return [];
    }
  };

  // Text-search fallback via opensubtitles.com /features?query=... . Used
  // when suggest_imdb.php is unreachable (Anubis 307 redirect, network
  // error, or genuinely empty). Returns up to N results in the suggest
  // shape (forum #55008 — even "Life of Brian" returned nothing because
  // every suggest call was being challenged before it could reach JSON).
  const searchFeaturesByQuery = async query => {
    try {
      if (!query || query.length < 2) return [];
      const features = await OpenSubtitlesApiService.searchFeatures(query);
      const rows = Array.isArray(features?.data) ? features.data : [];
      return rows
        .map(row => featuresAttrToResult(row?.attributes, null))
        .filter(Boolean)
        .slice(0, 20);
    } catch (err) {
      console.warn('Features text fallback failed:', err?.message || err);
      return [];
    }
  };

  // Debounced movie search
  React.useEffect(() => {
    if (!movieSearchQuery.trim()) {
      setMovieSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setMovieSearchLoading(true);
      try {
        const query = movieSearchQuery.trim();
        const imdbId = extractImdbId(query);

        // Best-effort suggest_imdb.php call. Wrapped in its own try so that
        // a network error or non-JSON body (the endpoint now sits behind
        // the Anubis bot challenge — returns HTTP 307 to /.within.website/
        // for any User-Agent, including real browsers, so JSON.parse throws)
        // does not skip the .com features fallback (forum #55008).
        const fetchSuggest = async key => {
          try {
            const response = await fetch(
              `https://www.opensubtitles.org/libs/suggest_imdb.php?m=${key}`
            );
            const ct = (response.headers.get('content-type') || '').toLowerCase();
            if (!response.ok || !ct.includes('json')) return null;
            const json = await response.json();
            return Array.isArray(json) ? json : null;
          } catch (err) {
            console.warn('suggest_imdb.php unavailable:', err?.message || err);
            return null;
          }
        };

        if (imdbId) {
          const suggest = await fetchSuggest(imdbId);
          if (suggest && suggest.length > 0) {
            setMovieSearchResults(suggest);
          } else {
            // suggest is blocked / empty — try .com /features by imdb id.
            const fallback = await searchFeaturesByImdb(imdbId);
            setMovieSearchResults(fallback);
          }
        } else {
          // Regular text search.
          const suggest = await fetchSuggest(encodeURIComponent(query));
          if (suggest && suggest.length > 0) {
            setMovieSearchResults(suggest);
          } else {
            // Text-mode fallback to .com /features?query=...
            const fallback = await searchFeaturesByQuery(query);
            setMovieSearchResults(fallback);
          }
        }
      } catch (error) {
        console.error('Movie search error:', error);
        setMovieSearchResults([]);
      } finally {
        setMovieSearchLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [movieSearchQuery]);

  // Click outside to close movie search
  React.useEffect(() => {
    const handleClickOutside = event => {
      if (openMovieSearch && !event.target.closest('[data-movie-search]')) {
        closeMovieSearch();
      }
    };

    if (openMovieSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMovieSearch]);

  // Handle opening movie search
  const handleOpenMovieSearch = React.useCallback(
    itemPath => {
      setOpenMovieSearch(openMovieSearch === itemPath ? null : itemPath);
    },
    [openMovieSearch]
  );

  // Handle movie search input
  const handleMovieSearch = query => {
    setMovieSearchQuery(query);
  };

  // Handle movie selection from search results
  const handleMovieSelect = async (itemPath, movie) => {
    // Close search interface
    closeMovieSearch();

    // Set loading state
    setMovieUpdateLoading(prev => ({ ...prev, [itemPath]: true }));

    try {
      // Create new movie guess object
      const newMovieGuess = {
        imdbid: movie.id,
        title: movie.name,
        year: movie.year,
        kind: movie.kind,
        reason: 'User selected',
      };

      // Call the parent component's movie change handler
      if (onMovieChange) {
        await onMovieChange(itemPath, newMovieGuess);
      }

      console.log('Movie updated successfully:', newMovieGuess);
    } catch (error) {
      console.error('Error updating movie:', error);
    } finally {
      // Clear loading state
      setMovieUpdateLoading(prev => ({ ...prev, [itemPath]: false }));
    }
  };

  return {
    // State
    openMovieSearch,
    movieSearchQuery,
    movieSearchResults,
    movieSearchLoading,
    movieUpdateLoading,

    // Actions
    handleOpenMovieSearch,
    handleMovieSearch,
    handleMovieSelect,
    closeMovieSearch,

    // Utilities
    extractImdbId,
    isImdbInput,
  };
};
