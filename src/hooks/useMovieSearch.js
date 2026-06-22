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
      if (!attrs) return [];
      const ft = (attrs.feature_type || '').toLowerCase();
      const kind =
        ft === 'tvshow' || ft === 'tv_series'
          ? 'tv series'
          : ft === 'episode'
            ? 'episode'
            : 'movie';
      const title =
        attrs.title ||
        attrs.parent_title ||
        attrs.original_title ||
        imdbId;
      return [
        {
          id: imdbId.toLowerCase().startsWith('tt') ? imdbId : `tt${cleanImdb.padStart(7, '0')}`,
          name: title,
          year: attrs.year || '',
          kind,
          source: 'features-api-fallback',
          pic: attrs.img_url || undefined,
        },
      ];
    } catch (err) {
      console.warn('Features fallback for IMDB id failed:', err?.message || err);
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

        // If it's an IMDB ID input, search using the IMDB ID directly
        if (imdbId) {
          const response = await fetch(
            `https://www.opensubtitles.org/libs/suggest_imdb.php?m=${imdbId}`
          );
          const results = await response.json();
          if (Array.isArray(results) && results.length > 0) {
            setMovieSearchResults(results);
          } else {
            // suggest_imdb.php has no record for this IMDB id (happens for
            // brand-new or niche titles not yet indexed on .org). Fall back
            // to opensubtitles.com /features which has a separate, fresher
            // catalog. Lets the user attach a valid IMDB id even when the
            // suggest endpoint is empty (forum #55000 — Rental Family 2025).
            const fallback = await searchFeaturesByImdb(imdbId);
            setMovieSearchResults(fallback);
          }
        } else {
          // Regular text search
          const response = await fetch(
            `https://www.opensubtitles.org/libs/suggest_imdb.php?m=${encodeURIComponent(query)}`
          );
          const results = await response.json();
          setMovieSearchResults(results || []);
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
