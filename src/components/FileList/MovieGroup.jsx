import React from 'react';
import { VideoFile } from './VideoFile.jsx';
import { SubtitleFile } from './SubtitleFile.jsx';
import { MovieDisplay } from '../MovieDisplay.jsx';

export const MovieGroup = ({
  group,
  movieGuesses,
  featuresByImdbId,
  featuresLoading,
  combinedLanguages,
  subtitleLanguages,
  openDropdowns,
  dropdownSearch,
  onSubtitleLanguageChange,
  onToggleDropdown,
  onDropdownSearch,
  onSubtitlePreview,
  getSubtitleLanguage,
  getLanguageOptionsForSubtitle,
  uploadStates,
  onToggleUpload,
  getUploadEnabled,
  onMovieChange,
  guessItData,
  getGuessItProcessingStatus,
  getFormattedTags,
  fetchFeaturesByImdbId,
  uploadResults,
  hashCheckResults,
  colors,
  isDark,
}) => {
  return (
    <div
      className="mb-6 rounded-lg p-4 shadow-sm"
      style={{ backgroundColor: colors.cardBackground, border: `1px solid ${colors.border}` }}
    >
      {/* Directory Header */}
      <div
        className="font-medium mb-3 flex items-center gap-2 text-sm"
        style={{ color: colors.link }}
      >
        <span>📁</span>
        <span>{group.directory}</span>
      </div>

      {/* Video File */}
      {group.video && (
        <VideoFile
          key={`${group.video.fullPath}-${group.video.movieHash || 'no-hash'}`}
          video={group.video}
          movieGuess={movieGuesses[group.video.fullPath]}
          features={
            group.video.movieGuess?.imdbid ? featuresByImdbId[group.video.movieGuess.imdbid] : null
          }
          onMovieChange={onMovieChange}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* Subtitle Files */}
      {group.subtitles.length > 0 && (
        <div className="space-y-2">
          {group.isOrphan && (
            <div className="space-y-2 mb-3">
              <div
                className="text-sm flex items-center gap-2"
                style={{ color: colors.warning || '#fbbf24' }}
              >
                <span>⚠️</span>
                <span>Orphaned subtitles (no matching video found)</span>
              </div>

              {/* Movie selection for orphaned subtitles */}
              {group.subtitles.length > 0 &&
                (() => {
                  // Use the first subtitle to get movie guess (they should all be the same movie)
                  const representativeSubtitle = group.subtitles[0];
                  const videoPath = representativeSubtitle.fullPath;
                  const subtitlePaths = group.subtitles.map(sub => sub.fullPath);

                  return (
                    <MovieDisplay
                      videoPath={videoPath}
                      movieGuesses={movieGuesses}
                      featuresByImdbId={featuresByImdbId}
                      featuresLoading={featuresLoading}
                      guessItData={guessItData}
                      movieUpdateLoading={{}} // Empty object since we don't track this at FileList level
                      onOpenMovieSearch={() => {}} // We'll use the built-in search functionality
                      fetchFeaturesByImdbId={fetchFeaturesByImdbId}
                      associatedSubtitles={subtitlePaths}
                      getUploadEnabled={getUploadEnabled}
                      onToggleUpload={onToggleUpload}
                      colors={colors}
                      isDark={isDark}
                    />
                  );
                })()}
            </div>
          )}
          {/* Show individual subtitle files for both orphaned and regular groups */}
          {group.subtitles.map((subtitle, idx) => (
            <SubtitleFile
              key={idx}
              subtitle={subtitle}
              combinedLanguages={combinedLanguages}
              subtitleLanguages={subtitleLanguages}
              openDropdowns={openDropdowns}
              dropdownSearch={dropdownSearch}
              onSubtitleLanguageChange={onSubtitleLanguageChange}
              onToggleDropdown={onToggleDropdown}
              onDropdownSearch={onDropdownSearch}
              onSubtitlePreview={onSubtitlePreview}
              getSubtitleLanguage={getSubtitleLanguage}
              getLanguageOptionsForSubtitle={getLanguageOptionsForSubtitle}
              uploadEnabled={getUploadEnabled(subtitle.fullPath)}
              onToggleUpload={onToggleUpload}
              uploadResults={uploadResults}
              hashCheckResults={hashCheckResults}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </div>
      )}

      {/* No subtitles message */}
      {group.video && group.subtitles.length === 0 && (
        <div className="text-sm italic text-center py-2" style={{ color: colors.textMuted }}>
          No subtitle files found for this video
        </div>
      )}
    </div>
  );
};
