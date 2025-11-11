import React from 'react';

const ProgressOverlay = ({ isVisible, onCancel, progress, colors, isDark, startTime }) => {
  if (!isVisible) return null;

  const timeElapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const totalFiles = progress.totalFiles || 0;
  const processedFiles = progress.processedFiles || 0;
  const overallProgress = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

  // Calculate stage progress
  const stages = [
    {
      name: 'File Discovery',
      icon: '📁',
      progress: progress.fileDiscovery || 0,
      total: progress.fileDiscoveryTotal || 0,
      color: colors.success,
      description: `${progress.totalFiles || 0} files from ${progress.directoriesProcessed || 0} directories`,
    },
    {
      name: 'Video Processing',
      icon: '🎬',
      progress: progress.videoProcessing || 0,
      total: progress.videoProcessingTotal || 0,
      color: colors.link,
      description: `${progress.videoProcessing || 0} / ${progress.videoProcessingTotal || 0} videos`,
    },
    {
      name: 'Subtitle Processing',
      icon: '📝',
      progress: progress.subtitleProcessing || 0,
      total: progress.subtitleProcessingTotal || 0,
      color: colors.warning,
      description: `${progress.subtitleProcessing || 0} / ${progress.subtitleProcessingTotal || 0} subtitles`,
    },
    {
      name: 'Language Detection',
      icon: '🌐',
      progress: progress.languageDetection || 0,
      total: progress.languageDetectionTotal || 0,
      color: colors.info || colors.link,
      description: `${progress.languageDetection || 0} / ${progress.languageDetectionTotal || 0} detections`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-4xl rounded-lg p-6 shadow-2xl"
        style={{
          backgroundColor: colors.cardBackground,
          border: `1px solid ${colors.border}`,
          maxHeight: '80vh',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin text-2xl">🔄</div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              Processing Files...
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: colors.error,
              color: 'white',
              border: 'none',
              fontWeight: '500',
            }}
            onMouseEnter={e => {
              e.target.style.backgroundColor = colors.errorHover || colors.error;
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.target.style.backgroundColor = colors.error;
              e.target.style.transform = 'scale(1)';
            }}
          >
            Cancel
          </button>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-medium" style={{ color: colors.text }}>
              Overall Progress
            </span>
            <span className="text-lg font-bold" style={{ color: colors.link }}>
              {overallProgress}%
            </span>
          </div>
          <div
            className="w-full h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.border }}
          >
            <div
              className="h-full transition-all duration-300 ease-out"
              style={{
                width: `${overallProgress}%`,
                backgroundColor: colors.link,
                background: `linear-gradient(90deg, ${colors.link}, ${colors.linkHover})`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              {processedFiles} of {totalFiles} files processed
            </span>
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              {timeString} elapsed
            </span>
          </div>
        </div>

        {/* Individual Stage Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stages.map((stage, index) => {
            const stageProgress =
              stage.total > 0 ? Math.round((stage.progress / stage.total) * 100) : 0;
            const isActive = stage.progress > 0 && stage.progress < stage.total;
            const isComplete = stage.progress >= stage.total && stage.total > 0;

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{stage.icon}</span>
                    <span className="font-medium" style={{ color: colors.text }}>
                      {stage.name}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: stage.color }}>
                    {stageProgress}%
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.border }}
                >
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${stageProgress}%`,
                      backgroundColor: stage.color,
                      background: isActive
                        ? `linear-gradient(90deg, ${stage.color}, ${stage.color}AA)`
                        : stage.color,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: colors.textSecondary }}>
                    {stage.description}
                  </span>
                  {isComplete && (
                    <span className="text-xs" style={{ color: colors.success }}>
                      ✓ Complete
                    </span>
                  )}
                  {isActive && (
                    <span className="text-xs animate-pulse" style={{ color: stage.color }}>
                      ● Processing...
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error/Skip Summary */}
        {(progress.errors > 0 || progress.skipped > 0) && (
          <div
            className="mt-4 p-3 rounded-lg"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center gap-4 text-sm">
              {progress.errors > 0 && (
                <span style={{ color: colors.error }}>❌ {progress.errors} errors</span>
              )}
              {progress.skipped > 0 && (
                <span style={{ color: colors.warning }}>⏭️ {progress.skipped} skipped</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressOverlay;
