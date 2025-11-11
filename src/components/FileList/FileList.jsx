import React from 'react';
import { MovieGroup } from './MovieGroup.jsx';
import { getBaseName } from '../../utils/fileUtils.js';

export const FileList = ({
  files,
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
  // Group files by movie (based on video file basename)
  const createMovieGroups = () => {
    const movieGroups = {};
    const videoFiles = files.filter(f => f.isVideo);
    const subtitleFiles = files.filter(f => f.isSubtitle);

    // Create groups for each video file
    videoFiles.forEach(video => {
      const baseName = getBaseName(video.name);
      const dir = video.fullPath.includes('/')
        ? video.fullPath.substring(0, video.fullPath.lastIndexOf('/'))
        : 'Root';
      const groupKey = `${dir}/${baseName}`;

      if (!movieGroups[groupKey]) {
        movieGroups[groupKey] = {
          video: video,
          subtitles: [],
          directory: dir,
          baseName: baseName,
        };
      }
    });

    // Add matching subtitles to each group
    subtitleFiles.forEach(subtitle => {
      const subtitleBaseName = getBaseName(subtitle.name);
      const dir = subtitle.fullPath.includes('/')
        ? subtitle.fullPath.substring(0, subtitle.fullPath.lastIndexOf('/'))
        : 'Root';

      // Find matching video group
      let matchedGroup = null;

      Object.values(movieGroups).forEach(group => {
        // Exact match
        if (group.baseName === subtitleBaseName && group.directory === dir) {
          matchedGroup = group;
        }
        // Prefix match (e.g., movie.en.srt matches movie.mp4)
        else if (subtitleBaseName.startsWith(group.baseName + '.') && group.directory === dir) {
          matchedGroup = group;
        }
      });

      if (matchedGroup) {
        matchedGroup.subtitles.push(subtitle);
      } else {
        // Create orphaned subtitle group
        const orphanKey = `${dir}/_orphan_${subtitleBaseName}`;
        if (!movieGroups[orphanKey]) {
          movieGroups[orphanKey] = {
            video: null,
            subtitles: [subtitle],
            directory: dir,
            baseName: subtitleBaseName,
            isOrphan: true,
          };
        } else {
          movieGroups[orphanKey].subtitles.push(subtitle);
        }
      }
    });

    return Object.entries(movieGroups);
  };

  const movieGroups = createMovieGroups();

  return (
    <div
      className="rounded-lg p-4 mb-6 shadow-sm"
      style={{ backgroundColor: colors.cardBackground, border: `1px solid ${colors.border}` }}
    >
      <h3 className="font-semibold mb-2" style={{ color: colors.text }}>
        Detected Files ({files.length}) - {files.filter(f => f.isVideo).length} videos,{' '}
        {files.filter(f => f.isSubtitle).length} subtitles
      </h3>

      {movieGroups.map(([groupKey, group]) => (
        <MovieGroup
          key={groupKey}
          group={group}
          movieGuesses={movieGuesses}
          featuresByImdbId={featuresByImdbId}
          featuresLoading={featuresLoading}
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
          uploadStates={uploadStates}
          onToggleUpload={onToggleUpload}
          getUploadEnabled={getUploadEnabled}
          onMovieChange={onMovieChange}
          guessItData={guessItData}
          getGuessItProcessingStatus={getGuessItProcessingStatus}
          getFormattedTags={getFormattedTags}
          fetchFeaturesByImdbId={fetchFeaturesByImdbId}
          uploadResults={uploadResults}
          hashCheckResults={hashCheckResults}
          colors={colors}
          isDark={isDark}
        />
      ))}
    </div>
  );
};
