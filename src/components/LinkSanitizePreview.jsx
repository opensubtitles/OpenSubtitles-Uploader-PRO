import React, { useEffect, useMemo } from 'react';
import { sanitizeSubtitle, categoryLabel } from '../services/subtitleSanitizer.js';
import { latin1ToDisplay } from '../utils/subtitleBytes.js';

/**
 * Review dialog for the "Remove links from subtitles" option.
 *
 * Shows every match the sanitizer found, line by line, with the removal
 * highlighted. Each match can be unchecked individually; the diff below
 * recomputes live. Nothing is written until "Remove selected" is pressed.
 */
export const LinkSanitizePreview = ({
  reports,
  onToggleMatch,
  onToggleFile,
  onApply,
  onCancel,
  colors,
  isDark,
}) => {
  const themeColors = colors || {
    cardBackground: '#fff',
    background: '#f4f4f4',
    border: '#ccc',
    text: '#000',
    textSecondary: '#454545',
    textMuted: '#808080',
    link: '#2878C0',
    linkHover: '#185DA0',
    success: '#4CAF50',
    error: '#E53935',
  };

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Recomputed on every toggle so the diff always reflects the current selection.
  const previews = useMemo(
    () =>
      reports.map(report => {
        const result = sanitizeSubtitle(report.original, { excludedIds: report.excludedIds });
        return {
          ...report,
          removedCues: result.removedCues,
          selectedCount: result.matches.filter(match => !match.excluded).length,
          diffs: result.diffs.map(diff => ({
            lineNumber: diff.lineNumber,
            before: latin1ToDisplay(diff.before),
            after: latin1ToDisplay(diff.after),
          })),
        };
      }),
    [reports]
  );

  const totalSelected = previews.reduce((total, report) => total + report.selectedCount, 0);
  const totalRemovedCues = previews.reduce((total, report) => total + report.removedCues, 0);

  const codeBackground = isDark ? '#1e1e1e' : '#f4f4f4';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-lg p-6 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl"
        style={{ backgroundColor: themeColors.cardBackground }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between mb-4 pb-4"
          style={{ borderBottom: `1px solid ${themeColors.border}` }}
        >
          <div>
            <h3 className="text-lg font-semibold" style={{ color: themeColors.text }}>
              Links found in {previews.length} subtitle{previews.length === 1 ? '' : 's'}
            </h3>
            <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
              Uncheck anything you want to keep. Nothing is changed until you confirm.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-2xl font-bold transition-colors"
            style={{ color: themeColors.textMuted }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Per-file match list + diff */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {previews.map(report => {
            const allSelected = report.excludedIds.size === 0;
            return (
              <div
                key={report.fullPath}
                className="rounded p-3"
                style={{ border: `1px solid ${themeColors.border}` }}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: themeColors.text }}
                      title={report.name}
                    >
                      {report.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                      {report.format.toUpperCase()} · {report.matches.length} match
                      {report.matches.length === 1 ? '' : 'es'}
                      {report.removedCues > 0 && (
                        <>
                          {' · '}
                          <span style={{ color: themeColors.error }}>
                            {report.removedCues} empty cue
                            {report.removedCues === 1 ? '' : 's'} dropped, rest renumbered
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleFile(report.fullPath, !allSelected)}
                    className="text-xs px-2 py-1 rounded whitespace-nowrap transition-colors"
                    style={{
                      color: themeColors.link,
                      border: `1px solid ${themeColors.border}`,
                    }}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {/* Matches */}
                <div className="space-y-1 mb-3">
                  {report.matches.map(match => (
                    <label
                      key={match.id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                      style={{ color: themeColors.text }}
                    >
                      <input
                        type="checkbox"
                        checked={!report.excludedIds.has(match.id)}
                        onChange={() => onToggleMatch(report.fullPath, match.id)}
                      />
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide"
                        style={{
                          backgroundColor: themeColors.background,
                          color: themeColors.textSecondary,
                        }}
                      >
                        {categoryLabel(match.category)}
                      </span>
                      <span style={{ color: themeColors.textMuted }}>line {match.lineNumber}</span>
                      <code
                        className="font-mono truncate"
                        style={{ color: themeColors.error }}
                        title={match.text}
                      >
                        {match.text}
                      </code>
                    </label>
                  ))}
                </div>

                {/* Live diff */}
                {report.diffs.length > 0 && (
                  <div
                    className="rounded text-xs font-mono p-2 overflow-x-auto"
                    style={{
                      backgroundColor: codeBackground,
                      border: `1px solid ${themeColors.border}`,
                    }}
                  >
                    {report.diffs.map(diff => (
                      <div key={diff.lineNumber} className="mb-1 last:mb-0 whitespace-pre-wrap">
                        <div style={{ color: themeColors.error }}>
                          − {diff.before || <em>(empty)</em>}
                        </div>
                        <div style={{ color: themeColors.success }}>
                          + {diff.after || <em>(line removed)</em>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 mt-4 pt-4"
          style={{ borderTop: `1px solid ${themeColors.border}` }}
        >
          <div className="text-xs" style={{ color: themeColors.textSecondary }}>
            {totalSelected} link{totalSelected === 1 ? '' : 's'} selected
            {totalRemovedCues > 0 &&
              `, ${totalRemovedCues} cue${totalRemovedCues === 1 ? '' : 's'} dropped`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded text-sm transition-colors"
              style={{
                color: themeColors.textSecondary,
                border: `1px solid ${themeColors.border}`,
              }}
            >
              Keep originals
            </button>
            <button
              onClick={onApply}
              disabled={totalSelected === 0}
              className="text-white px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
              style={{ backgroundColor: themeColors.link }}
            >
              Remove selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
