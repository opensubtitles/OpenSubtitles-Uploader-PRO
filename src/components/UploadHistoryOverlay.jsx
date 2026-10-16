import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadLedgerService } from '../services/uploadLedgerService.js';
import { UserService } from '../services/userService.js';
import { formatTimeUntil } from '../utils/uploadLimitPolicy.js';

/**
 * Local upload ledger viewer — how many uploads, when, and current allowance.
 *
 * Reads only from local storage; it never queries the server, so it reflects
 * what this device did rather than the account's full upload history.
 */

const STATUS_META = {
  success: { icon: '✅', label: 'Uploaded' },
  exists: { icon: '📄', label: 'Already in DB' },
  failed: { icon: '❌', label: 'Failed' },
  unknown: { icon: '❔', label: 'Unknown' },
};

const formatWhen = ts => {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const UploadHistoryOverlay = ({ isOpen, onClose, userInfo, colors, isDark }) => {
  const [history, setHistory] = useState(null);
  const [filter, setFilter] = useState('all');

  const themeColors = colors || {};

  const refresh = useCallback(() => {
    setHistory(UploadLedgerService.getUploadHistory(userInfo));
  }, [userInfo]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen, refresh]);

  // Keep the countdown and window usage honest while the overlay stays open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [isOpen, refresh]);

  const visibleEntries = useMemo(() => {
    if (!history) return [];
    if (filter === 'all') return history.entries;
    if (filter === 'counted') return history.entries.filter(entry => entry.counted);
    return history.entries.filter(entry => entry.status === filter);
  }, [history, filter]);

  if (!isOpen) return null;

  const summary = history?.summary;
  const limitState = history?.limitState;
  const ranks = UserService.getEffectiveRanks(userInfo);

  const statCard = (label, value, hint) => (
    <div
      key={label}
      className="rounded-lg p-3 flex-1 min-w-[110px]"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : themeColors.background,
        border: `1px solid ${themeColors.border}`,
      }}
    >
      <div className="text-2xl font-bold" style={{ color: themeColors.text }}>
        {value}
      </div>
      <div className="text-xs font-medium" style={{ color: themeColors.textSecondary }}>
        {label}
      </div>
      {hint && (
        <div className="text-xs mt-0.5" style={{ color: themeColors.textMuted }}>
          {hint}
        </div>
      )}
    </div>
  );

  const filterButton = (key, label, count) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className="px-3 py-1 rounded text-sm transition-colors"
      style={{
        backgroundColor: filter === key ? themeColors.link : 'transparent',
        color: filter === key ? '#fff' : themeColors.textSecondary,
        border: `1px solid ${filter === key ? themeColors.link : themeColors.border}`,
      }}
    >
      {label}
      {count !== undefined ? ` (${count})` : ''}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.75)' }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: themeColors.cardBackground }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 border-b"
          style={{ borderBottomColor: themeColors.border }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📒</span>
            <div>
              <h2 className="text-xl font-bold" style={{ color: themeColors.text }}>
                My Uploads
              </h2>
              <p className="text-sm" style={{ color: themeColors.textSecondary }}>
                {UserService.getUsername(userInfo)}
                {ranks.length > 0 ? ` — ${ranks.join(', ')}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : themeColors.border,
              color: themeColors.text,
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.3)' : themeColors.border}`,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* How much */}
          <div className="flex gap-3 flex-wrap mb-4">
            {statCard('Last hour', summary?.lastHour ?? 0)}
            {statCard('Last 24 hours', summary?.last24h ?? 0, `${summary?.counted24h ?? 0} counted`)}
            {statCard('Last 7 days', summary?.last7d ?? 0, `${summary?.counted7d ?? 0} counted`)}
            {statCard('Last 30 days', summary?.last30d ?? 0)}
          </div>

          {/* Allowance */}
          <div
            className="rounded-lg p-4 mb-4"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : themeColors.background,
              border: `1px solid ${limitState?.blocked ? themeColors.error : themeColors.border}`,
            }}
          >
            {limitState?.enforced ? (
              <>
                <div
                  className="font-medium mb-2 flex items-center gap-2"
                  style={{ color: limitState.blocked ? themeColors.error : themeColors.text }}
                >
                  <span>{limitState.blocked ? '⛔' : '📊'}</span>
                  <span>
                    {limitState.blocked
                      ? 'Upload limit reached'
                      : `${limitState.allowance} subtitle uploads left right now`}
                  </span>
                </div>
                <div className="space-y-2">
                  {limitState.windows.map(window => {
                    const pct = Math.min(100, Math.round((window.used / window.limit) * 100));
                    return (
                      <div key={window.key}>
                        <div
                          className="flex justify-between text-xs mb-1"
                          style={{ color: themeColors.textSecondary }}
                        >
                          <span>Uploaded {window.spanLabel}</span>
                          <span>
                            {window.used} / {window.limit}
                            {window.remaining === 0 && window.nextSlotAt
                              ? ` — next slot in ${formatTimeUntil(window.nextSlotAt)}`
                              : ''}
                          </span>
                        </div>
                        <div
                          className="h-2 rounded overflow-hidden"
                          style={{ backgroundColor: themeColors.border }}
                        >
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor:
                                window.remaining === 0
                                  ? themeColors.error
                                  : pct > 80
                                    ? themeColors.warning
                                    : themeColors.success,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs mt-3" style={{ color: themeColors.textMuted }}>
                  {limitState.reason}. Only new uploads count — duplicates and failures do not.
                </p>
              </>
            ) : (
              <div className="font-medium flex items-center gap-2" style={{ color: themeColors.text }}>
                <span>{limitState?.status === 'unranked' ? '🚫' : '♾️'}</span>
                <span>
                  {limitState?.status === 'unranked'
                    ? 'Your rank cannot upload subtitles'
                    : 'No upload limits for your rank'}
                </span>
                <span className="text-xs font-normal" style={{ color: themeColors.textMuted }}>
                  ({limitState?.reason})
                </span>
              </div>
            )}
          </div>

          {/* When */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {filterButton('all', 'All', summary?.total)}
            {filterButton('counted', 'Counted', summary?.counted)}
            {filterButton('success', 'Uploaded', summary?.byStatus?.success)}
            {filterButton('exists', 'Already in DB', summary?.byStatus?.exists)}
            {filterButton('failed', 'Failed', summary?.byStatus?.failed)}
          </div>

          {visibleEntries.length === 0 ? (
            <div className="text-center py-10" style={{ color: themeColors.textSecondary }}>
              No uploads recorded on this device yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: themeColors.textSecondary }}>
                    <th className="text-left py-2 pr-3 font-medium">When</th>
                    <th className="text-left py-2 pr-3 font-medium">Subtitle</th>
                    <th className="text-left py-2 pr-3 font-medium">Movie</th>
                    <th className="text-left py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry, index) => {
                    const meta = STATUS_META[entry.status] || STATUS_META.unknown;
                    return (
                      <tr
                        key={`${entry.ts}-${index}`}
                        style={{ borderTop: `1px solid ${themeColors.border}` }}
                      >
                        <td
                          className="py-2 pr-3 whitespace-nowrap"
                          style={{ color: themeColors.textSecondary }}
                        >
                          {formatWhen(entry.ts)}
                        </td>
                        <td className="py-2 pr-3" style={{ color: themeColors.text }}>
                          <span className="break-all">{entry.filename}</span>
                          {entry.anonymous && (
                            <span
                              className="ml-2 px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: themeColors.border,
                                color: themeColors.textSecondary,
                              }}
                            >
                              anonymous
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3" style={{ color: themeColors.textSecondary }}>
                          {entry.url ? (
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              style={{ color: themeColors.link }}
                            >
                              {entry.movieName || 'View'}
                            </a>
                          ) : (
                            entry.movieName || '—'
                          )}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <span style={{ color: themeColors.textSecondary }}>
                            {meta.icon} {meta.label}
                          </span>
                          {!entry.counted && entry.status === 'success' && (
                            <span className="ml-1" style={{ color: themeColors.textMuted }}>
                              (not counted)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between gap-3 flex-wrap"
          style={{ borderTopColor: themeColors.border, backgroundColor: themeColors.background }}
        >
          <span className="text-xs" style={{ color: themeColors.textMuted }}>
            Stored locally on this device, kept for 30 days. Not your full account history.
          </span>
          {/* No "clear history" action on purpose: the ledger IS the limit
              record, so a clear button would be a one-click limit reset. */}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: themeColors.link, color: 'white' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadHistoryOverlay;
