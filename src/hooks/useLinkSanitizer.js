import { useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeSubtitle } from '../services/subtitleSanitizer.js';
import { readFileAsLatin1, createFileFromLatin1 } from '../utils/subtitleBytes.js';

/**
 * Scans dropped subtitles for links and holds the result until the user
 * approves it in the preview dialog. Nothing is modified without confirmation.
 *
 * Edits run over a byte-preserving latin1 view (see utils/subtitleBytes.js) so
 * files in cp1250/cp1251/Big5 keep their original encoding byte-for-byte.
 *
 * @param {Array<Object>} files - file objects from useFileHandling
 * @param {boolean} enabled - config.stripUrls
 * @param {Function} updateFile - updateFile(fullPath, updates) from useFileHandling
 * @param {Function} addDebugInfo
 */
export const useLinkSanitizer = (files, enabled, updateFile, addDebugInfo) => {
  const [reports, setReports] = useState([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  /** fullPaths already scanned, so re-renders and pairing updates do not rescan. */
  const scannedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;

    const pending = files.filter(
      file =>
        file.isSubtitle && !file.shouldRemove && file.file && !scannedRef.current.has(file.fullPath)
    );
    if (pending.length === 0) return;

    let cancelled = false;

    const scan = async () => {
      setIsScanning(true);
      const found = [];

      for (const entry of pending) {
        scannedRef.current.add(entry.fullPath);
        try {
          const original = await readFileAsLatin1(entry.file);
          const result = sanitizeSubtitle(original);
          if (result.matches.length === 0) continue;

          found.push({
            fullPath: entry.fullPath,
            name: entry.name,
            original,
            format: result.format,
            // Reported for the file-level summary; the dialog recomputes the
            // diff live as the user toggles individual matches.
            matches: result.matches,
            excludedIds: new Set(),
          });
        } catch (error) {
          addDebugInfo?.(`Link scan failed for ${entry.name}: ${error.message}`);
        }
      }

      if (cancelled) return;
      setIsScanning(false);
      if (found.length > 0) {
        setReports(prev => [...prev, ...found]);
        setIsReviewOpen(true);
        addDebugInfo?.(
          `Found links in ${found.length} subtitle file(s): ${found.reduce(
            (total, report) => total + report.matches.length,
            0
          )} match(es)`
        );
      }
    };

    scan();

    return () => {
      cancelled = true;
    };
  }, [files, enabled, addDebugInfo]);

  /** Toggles one match on/off in the preview without applying anything yet. */
  const toggleMatch = useCallback((fullPath, matchId) => {
    setReports(prev =>
      prev.map(report => {
        if (report.fullPath !== fullPath) return report;
        const excludedIds = new Set(report.excludedIds);
        if (excludedIds.has(matchId)) {
          excludedIds.delete(matchId);
        } else {
          excludedIds.add(matchId);
        }
        return { ...report, excludedIds };
      })
    );
  }, []);

  /** Toggles every match of one file at once. */
  const toggleFile = useCallback((fullPath, enabledFlag) => {
    setReports(prev =>
      prev.map(report => {
        if (report.fullPath !== fullPath) return report;
        return {
          ...report,
          excludedIds: enabledFlag ? new Set() : new Set(report.matches.map(match => match.id)),
        };
      })
    );
  }, []);

  /** Writes the approved edits back into the file list. */
  const applyChanges = useCallback(() => {
    let changedFiles = 0;
    let removedMatches = 0;

    for (const report of reports) {
      const result = sanitizeSubtitle(report.original, { excludedIds: report.excludedIds });
      if (!result.changed) continue;

      const entry = files.find(file => file.fullPath === report.fullPath);
      if (!entry?.file) continue;

      const replacement = createFileFromLatin1(entry.file, result.content);
      updateFile(report.fullPath, {
        file: replacement,
        size: replacement.size,
        linksSanitized: {
          removed: result.matches.filter(match => !match.excluded).length,
          removedCues: result.removedCues,
        },
      });
      changedFiles += 1;
      removedMatches += result.matches.filter(match => !match.excluded).length;
    }

    addDebugInfo?.(`Stripped ${removedMatches} link(s) from ${changedFiles} file(s)`);
    setReports([]);
    setIsReviewOpen(false);
  }, [reports, files, updateFile, addDebugInfo]);

  /** Leaves every file exactly as it was. */
  const dismiss = useCallback(() => {
    addDebugInfo?.('Link stripping skipped by user');
    setReports([]);
    setIsReviewOpen(false);
  }, [addDebugInfo]);

  /** Lets a fresh drop of the same path be scanned again. */
  const resetScanState = useCallback(() => {
    scannedRef.current = new Set();
    setReports([]);
    setIsReviewOpen(false);
  }, []);

  return {
    reports,
    isReviewOpen,
    isScanning,
    toggleMatch,
    toggleFile,
    applyChanges,
    dismiss,
    resetScanState,
  };
};
