import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getBestMovieDetectionName } from '../utils/fileUtils.js';
import { HD_DETECTION_REGEX } from '../utils/constants.js';

export const SubtitleUploadOptions = ({
  subtitlePath,
  uploadOptions = {},
  onUpdateOptions,
  colors,
  isDark,
  subtitleFile,
  pairedVideoFile,
  onLocalStateChange,
  compactMode = false,
  isExpanded = false,
  onToggleExpanded = null,
  showExpandedInline = false, // New prop to show expanded content inline
  hashCheckResults, // Add hashCheckResults prop
  config = {} // Add config prop
}) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  
  // Use external state if in compact mode, otherwise use internal state
  const currentIsExpanded = compactMode ? isExpanded : internalIsExpanded;
  const toggleExpanded = compactMode ? onToggleExpanded : (() => setInternalIsExpanded(!internalIsExpanded));
  
  // If showExpandedInline is true, always show expanded content without toggle
  const shouldShowExpanded = showExpandedInline || (!compactMode && currentIsExpanded);
  
  const [hasSetReleaseName, setHasSetReleaseName] = useState(false);
  const [hasSetForeignParts, setHasSetForeignParts] = useState(false);
  const [hasSetHighDefinition, setHasSetHighDefinition] = useState(false);
  const [hasSetHearingImpaired, setHasSetHearingImpaired] = useState(false);
  const [hasSetAutoTranslation, setHasSetAutoTranslation] = useState(false);
  const [subtitleContent, setSubtitleContent] = useState(null);
  const [localHdValue, setLocalHdValue] = useState(null);
  const [localForeignPartsValue, setLocalForeignPartsValue] = useState(null);
  const [localHearingImpairedValue, setLocalHearingImpairedValue] = useState(null);
  const [localAutoTranslationValue, setLocalAutoTranslationValue] = useState(null);
  const [localReleaseNameValue, setLocalReleaseNameValue] = useState('');
  const [localCommentValue, setLocalCommentValue] = useState('');
  const [localTranslatorValue, setLocalTranslatorValue] = useState('');
  const [localMovieAkaValue, setLocalMovieAkaValue] = useState('');
  
  // Refs to track if we've already processed auto-detection for this file
  const processedForeignPartsRef = useRef(false);
  const processedHdRef = useRef(false);
  const processedHearingImpairedRef = useRef(false);
  
  // Reset processing flags when subtitle path changes
  useEffect(() => {
    processedForeignPartsRef.current = false;
    processedHdRef.current = false;
    processedHearingImpairedRef.current = false;
  }, [subtitlePath]);

  // Initialize translator with default value from config when subtitle path changes
  useEffect(() => {
    if (config.defaultTranslator && !uploadOptions?.subtranslator && !localTranslatorValue) {
      setLocalTranslatorValue(config.defaultTranslator);
      // Also notify parent component to update the options
      if (onUpdateOptions) {
        onUpdateOptions(subtitlePath, {
          ...uploadOptions,
          subtranslator: config.defaultTranslator
        });
      }
    }
  }, [subtitlePath, config.defaultTranslator, uploadOptions?.subtranslator, localTranslatorValue]);

  // Enhanced detection function that checks all file path elements
  const checkFeatureFromPath = (filePath, featureType) => {
    if (!filePath) return false;
    
    // Split path into all components (directory parts + filename)
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    
    // For hearing impaired, check filename-specific pattern first
    if (featureType === 'hearingimpaired' && pathParts.length > 0) {
      const filename = pathParts[pathParts.length - 1]; // Last part is the filename
      if (checkHearingImpairedFromFilename(filename)) {
        return true;
      }
    }
    
    // Check each part of the path
    for (const part of pathParts) {
      if (featureType === 'foreign' && checkForeignPartsFromString(part)) {
        return true;
      }
      if (featureType === 'hd' && checkHighDefinitionFromString(part)) {
        return true;
      }
      if (featureType === 'hearingimpaired' && checkHearingImpairedFromString(part)) {
        return true;
      }
    }
    
    return false;
  };

  // Check if string indicates foreign parts only
  const checkForeignPartsFromString = (str) => {
    if (!str) return false;
    // Enhanced regex with bracket notation and more patterns
    const foreignPartsRegex = /\[?forced\]?|foreign[.\s_-]?parts?|\[?partial\]?|alien[.\s_-]?language|native[.\s_-]?only|parts[.\s_-]?only|non[.\s_-]*english[.\s_-]?parts?|language[.\s_-]?only|\[?commentary\]?/i;
    return foreignPartsRegex.test(str);
  };

  // Check if string indicates high definition
  const checkHighDefinitionFromString = (str) => {
    if (!str) return false;
    // Use the shared HD detection pattern from constants
    return HD_DETECTION_REGEX.test(str);
  };

  // Check if string indicates hearing impaired
  const checkHearingImpairedFromString = (str) => {
    if (!str) return false;
    
    const lowerStr = str.toLowerCase();
    
    // First check for negative patterns that explicitly indicate NOT hearing impaired
    const negativePatterns = [
      'nonhi', 'non-hi', 'non_hi', 'non.hi',
      'nohi', 'no-hi', 'no_hi', 'no.hi',
      'nothi', 'not-hi', 'not_hi', 'not.hi'
    ];
    
    if (negativePatterns.some(pattern => lowerStr.includes(pattern))) {
      return false;
    }
    
    // Then check for positive HI patterns (removed CC, added PSDH)
    const hiRegex = /\bsdh\b|\bpsdh\b|\bhi\b|hi[_-]|[_-]hi/i;
    return hiRegex.test(str);
  };

  // Check if subtitle filename (without extension) ends with HI pattern
  const checkHearingImpairedFromFilename = (filename) => {
    if (!filename) return false;
    
    // Remove file extension
    const nameWithoutExtension = filename.replace(/\.(srt|ass|ssa|vtt|sub|idx|sup)$/i, '');
    const lowerName = nameWithoutExtension.toLowerCase();
    
    // First check for negative patterns
    const negativePatterns = [
      'nonhi', 'non-hi', 'non_hi', 'non.hi',
      'nohi', 'no-hi', 'no_hi', 'no.hi', 
      'nothi', 'not-hi', 'not_hi', 'not.hi'
    ];
    
    if (negativePatterns.some(pattern => lowerName.includes(pattern))) {
      return false;
    }
    
    // Check if it ends with HI pattern: [-_.]HI (case insensitive)
    const hiEndRegex = /[-_.]hi$/i;
    return hiEndRegex.test(nameWithoutExtension);
  };

  // Check if subtitle content indicates automatic translation
  const checkAutoTranslationFromContent = (content) => {
    if (!content) return false;
    // Regex pattern for automatic translation indicators
    const autoTranslationRegex = /<Aj>.*<\/I>|N'-t|{\\ An8}/i;
    return autoTranslationRegex.test(content);
  };

  // Load subtitle content for analysis
  useEffect(() => {
    if (subtitleFile && !subtitleContent && !hasSetAutoTranslation) {
      const loadSubtitleContent = async () => {
        try {
          // Read the subtitle file content
          const file = subtitleFile.file || subtitleFile;
          if (file && typeof file.text === 'function') {
            const content = await file.text();
            setSubtitleContent(content);
          } else if (file && file.content) {
            setSubtitleContent(file.content);
          }
        } catch (error) {
          console.error('Error reading subtitle file:', error);
        }
      };
      
      loadSubtitleContent();
    }
  }, [subtitleFile, subtitleContent, hasSetAutoTranslation]);

  // Initialize local state from uploadOptions - sync whenever uploadOptions change
  useEffect(() => {
    // Only update if there's a meaningful change to prevent cursor jumping
    if (uploadOptions?.moviereleasename !== localReleaseNameValue) {
      setLocalReleaseNameValue(uploadOptions?.moviereleasename || '');
    }
    if (uploadOptions?.subauthorcomment !== localCommentValue) {
      setLocalCommentValue(uploadOptions?.subauthorcomment || '');
    }
    if (uploadOptions?.subtranslator !== localTranslatorValue) {
      setLocalTranslatorValue(uploadOptions?.subtranslator || '');
    }
    if (uploadOptions?.movieaka !== localMovieAkaValue) {
      setLocalMovieAkaValue(uploadOptions?.movieaka || '');
    }
    
    // Update checkboxes
    if (uploadOptions?.hearingimpaired === '1' && localHearingImpairedValue !== '1') {
      setLocalHearingImpairedValue('1');
      setHasSetHearingImpaired(true);
    }
    if (uploadOptions?.highdefinition === '1' && localHdValue !== '1') {
      setLocalHdValue('1');
      setHasSetHighDefinition(true);
    }
    if (uploadOptions?.foreignpartsonly === '1' && localForeignPartsValue !== '1') {
      setLocalForeignPartsValue('1');
      setHasSetForeignParts(true);
    }
    if (uploadOptions?.automatictranslation === '1' && localAutoTranslationValue !== '1') {
      setLocalAutoTranslationValue('1');
      setHasSetAutoTranslation(true);
    }
  }, [uploadOptions?.moviereleasename, uploadOptions?.subauthorcomment, uploadOptions?.subtranslator, uploadOptions?.movieaka, uploadOptions?.hearingimpaired, uploadOptions?.highdefinition, uploadOptions?.foreignpartsonly, uploadOptions?.automatictranslation]);

  // Comprehensive upload options initialization - detects new features from file paths
  useEffect(() => {
    if (!subtitleFile && !pairedVideoFile) return;
    
    let needsUpdate = false;
    const updates = {};
    
    // HEARING IMPAIRED
    if (!hasSetHearingImpaired && !processedHearingImpairedRef.current) {
      let shouldBeHearingImpaired = false;
      
      // Check video file path first (higher priority for HI)
      if (pairedVideoFile && pairedVideoFile.fullPath) {
        shouldBeHearingImpaired = checkFeatureFromPath(pairedVideoFile.fullPath, 'hearingimpaired');
      }
      
      // If not found in video, check subtitle file path
      if (!shouldBeHearingImpaired && subtitleFile && subtitleFile.fullPath) {
        shouldBeHearingImpaired = checkFeatureFromPath(subtitleFile.fullPath, 'hearingimpaired');
      }
      
      if (shouldBeHearingImpaired) {
        updates.hearingimpaired = '1';
        setLocalHearingImpairedValue('1');
        setHasSetHearingImpaired(true);
        processedHearingImpairedRef.current = true;
        needsUpdate = true;
      }
    }
    
    // HIGH DEFINITION
    if (!hasSetHighDefinition && !processedHdRef.current) {
      let shouldBeHighDefinition = false;
      
      // Check video file path first (higher priority for HD)
      if (pairedVideoFile && pairedVideoFile.fullPath) {
        shouldBeHighDefinition = checkFeatureFromPath(pairedVideoFile.fullPath, 'hd');
      }
      
      // If not found in video, check subtitle file path
      if (!shouldBeHighDefinition && subtitleFile && subtitleFile.fullPath) {
        shouldBeHighDefinition = checkFeatureFromPath(subtitleFile.fullPath, 'hd');
      }
      
      if (shouldBeHighDefinition) {
        updates.highdefinition = '1';
        setLocalHdValue('1');
        setHasSetHighDefinition(true);
        processedHdRef.current = true;
        needsUpdate = true;
      }
    }
    
    // FOREIGN PARTS ONLY
    if (!hasSetForeignParts && !processedForeignPartsRef.current) {
      let shouldBeForeignParts = false;
      
      // Check subtitle file path first (higher priority for foreign parts)
      if (subtitleFile && subtitleFile.fullPath) {
        shouldBeForeignParts = checkFeatureFromPath(subtitleFile.fullPath, 'foreign');
      }
      
      // If not found in subtitle, check video file path
      if (!shouldBeForeignParts && pairedVideoFile && pairedVideoFile.fullPath) {
        shouldBeForeignParts = checkFeatureFromPath(pairedVideoFile.fullPath, 'foreign');
      }
      
      if (shouldBeForeignParts) {
        updates.foreignpartsonly = '1';
        setLocalForeignPartsValue('1');
        setHasSetForeignParts(true);
        processedForeignPartsRef.current = true;
        needsUpdate = true;
      }
    }
    
    // AUTO TRANSLATION (from subtitle content analysis)
    if (!hasSetAutoTranslation && subtitleContent) {
      let shouldBeAutoTranslation = false;
      
      // Check subtitle content for auto translation indicators
      shouldBeAutoTranslation = checkAutoTranslationFromContent(subtitleContent);
      
      if (shouldBeAutoTranslation) {
        updates.automatictranslation = '1';
        setLocalAutoTranslationValue('1');
        setHasSetAutoTranslation(true);
        needsUpdate = true;
      }
    }
    
    // Batch update all detected options
    if (needsUpdate) {
      const newOptions = {
        ...uploadOptions,
        ...updates
      };
      
      if (typeof onUpdateOptions === 'function') {
        setTimeout(() => {
          onUpdateOptions(subtitlePath, newOptions);
        }, 0);
      }
    }
    
  }, [subtitleFile?.fullPath, pairedVideoFile?.fullPath, subtitleContent, hasSetHearingImpaired, hasSetHighDefinition, hasSetForeignParts, hasSetAutoTranslation]);

  // Pre-fill release name on component mount
  useEffect(() => {
    // Only set release name if this component instance hasn't set it yet
    if ((subtitleFile || pairedVideoFile) && !hasSetReleaseName) {
      let detectionName;
      
      if (pairedVideoFile) {
        // For matched pairs, use video file name directly (has precedence)
        detectionName = pairedVideoFile.name;
      } else {
        // For orphaned subtitles, use smart detection (directory-based for generic names)
        detectionName = getBestMovieDetectionName(subtitleFile);
      }
      
      // Remove file extension if it exists (only common video/subtitle extensions)
      const releaseNameWithoutExtension = detectionName.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|srt|ass|ssa|vtt|sub|idx|sup)$/i, '');
      
      // Only set if we have a meaningful name (not empty)
      if (releaseNameWithoutExtension.trim()) {
        // Use React 18's automatic batching instead of setTimeout
        handleFieldChange('moviereleasename', releaseNameWithoutExtension);
        setHasSetReleaseName(true); // Mark that this component instance has set the release name
      }
    }
  }, [subtitleFile, pairedVideoFile, hasSetReleaseName]);


  const handleFieldChange = useCallback((field, value) => {
    const newOptions = {
      ...uploadOptions,
      [field]: value
    };
    
    if (typeof onUpdateOptions === 'function') {
      setTimeout(() => {
        onUpdateOptions(subtitlePath, newOptions);
      }, 0);
    } else {
      console.error('onUpdateOptions is not a function:', onUpdateOptions);
    }
    
    // Update local state for immediate UI feedback
    if (field === 'highdefinition') {
      setLocalHdValue(value);
    } else if (field === 'foreignpartsonly') {
      setLocalForeignPartsValue(value);
    } else if (field === 'hearingimpaired') {
      setLocalHearingImpairedValue(value);
    } else if (field === 'automatictranslation') {
      setLocalAutoTranslationValue(value);
    } else if (field === 'moviereleasename') {
      setLocalReleaseNameValue(value);
    } else if (field === 'subauthorcomment') {
      setLocalCommentValue(value);
    } else if (field === 'subtranslator') {
      setLocalTranslatorValue(value);
    } else if (field === 'movieaka') {
      setLocalMovieAkaValue(value);
    }
    
    // If user manually changes release name, mark it as manually set to prevent auto-detection
    if (field === 'moviereleasename') {
      setHasSetReleaseName(true);
    }
    
    // If user manually changes foreign parts, mark it as manually set to prevent auto-detection
    if (field === 'foreignpartsonly' && value !== uploadOptions.foreignpartsonly) {
      setHasSetForeignParts(true);
    }
    
    // If user manually changes high definition, mark it as manually set to prevent auto-detection
    if (field === 'highdefinition' && value !== uploadOptions.highdefinition) {
      setHasSetHighDefinition(true);
    }
    
    // If user manually changes hearing impaired, mark it as manually set to prevent auto-detection
    if (field === 'hearingimpaired' && value !== uploadOptions.hearingimpaired) {
      setHasSetHearingImpaired(true);
    }
    
    // If user manually changes automatic translation, mark it as manually set to prevent auto-detection
    if (field === 'automatictranslation' && value !== uploadOptions.automatictranslation) {
      setHasSetAutoTranslation(true);
    }
  }, [uploadOptions, subtitlePath, localReleaseNameValue, localCommentValue, localTranslatorValue, localMovieAkaValue]);

  const currentOptions = uploadOptions || {};

  // Notify parent component of local state changes
  useEffect(() => {
    if (onLocalStateChange) {
      setTimeout(() => {
        onLocalStateChange(subtitlePath, {
          localHdValue,
          localForeignPartsValue,
          localHearingImpairedValue,
          localAutoTranslationValue
        });
      }, 0);
    }
  }, [localHdValue, localForeignPartsValue, localHearingImpairedValue, localAutoTranslationValue, subtitlePath]);

  // Expanded content component - memoized to prevent recreation and focus loss
  const ExpandedContent = React.useMemo(() => (
    <div className="mt-2 p-3 rounded border space-y-2" 
         style={{
           backgroundColor: colors.cardBackground,
           borderColor: colors.border
         }}
         onClick={(e) => e.stopPropagation()}>
      
      {/* Author Comment - First and multiline */}
      <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-xs min-w-[80px] mt-1">
          <span title="Comment from subtitle author">💬</span>
          <span style={{ color: colors.textSecondary }}>Comment</span>
        </div>
        <div className="flex-1 relative">
          <textarea
            value={localCommentValue || currentOptions.subauthorcomment || ''}
            onChange={(e) => {
              handleFieldChange('subauthorcomment', e.target.value);
            }}
            placeholder="Comment from subtitle author (can be multiple lines)"
            rows={2}
            className="w-full px-2 py-1 text-xs rounded border resize-none"
            style={{
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
              color: colors.text,
              minHeight: '2.5rem',
              maxHeight: '8rem',
              overflow: 'hidden'
            }}
            onInput={(e) => {
              // Auto-resize textarea based on content
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          {config.globalComment && currentOptions.subauthorcomment === config.globalComment && (
            <div 
              className="absolute top-0 right-0 -mt-1 -mr-1 px-1 py-0.5 text-xs rounded-full text-white flex items-center gap-1"
              style={{
                backgroundColor: colors.info || colors.primary,
                fontSize: '10px'
              }}
              title="Global comment applied from config"
            >
              <span>🌐</span>
              <span>Global</span>
            </div>
          )}
        </div>
      </div>

      {/* Release Name */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-xs min-w-[80px]">
          <span title="Movie Release Name">📦</span>
          <span style={{ color: colors.textSecondary }}>Release</span>
        </div>
        <input
          type="text"
          value={localReleaseNameValue || currentOptions.moviereleasename || ''}
          onChange={(e) => {
            handleFieldChange('moviereleasename', e.target.value);
          }}
          placeholder="Release name (e.g., Movie.2023.1080p.BluRay.x264-GROUP)"
          className="flex-1 px-2 py-1 text-xs rounded border"
          style={{
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }}
        />
      </div>

      {/* Translator */}
      <div className="flex items-center gap-2 relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-xs min-w-[80px]">
          <span title="Subtitle Translator">🌐</span>
          <span style={{ color: colors.textSecondary }}>Translator</span>
        </div>
        <input
          type="text"
          value={localTranslatorValue || currentOptions.subtranslator || ''}
          onChange={(e) => handleFieldChange('subtranslator', e.target.value)}
          placeholder="Who translated the subtitles"
          className="flex-1 px-2 py-1 text-xs rounded border"
          style={{
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }}
        />
        {config.defaultTranslator && currentOptions.subtranslator === config.defaultTranslator && (
          <div 
            className="absolute top-0 right-0 -mt-1 -mr-1 px-1 py-0.5 text-xs rounded-full text-white flex items-center gap-1"
            style={{
              backgroundColor: colors.info || colors.primary,
              fontSize: '10px'
            }}
            title="Default translator applied from config"
          >
            <span>🌐</span>
            <span>Default</span>
          </div>
        )}
      </div>

      {/* Movie AKA (Movie Title in Subtitle Language) */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-xs min-w-[80px]">
          <span title="Movie title in subtitle language">🎬</span>
          <span style={{ color: colors.textSecondary }}>Movie AKA</span>
        </div>
        <input
          type="text"
          value={localMovieAkaValue || currentOptions.movieaka || ''}
          onChange={(e) => handleFieldChange('movieaka', e.target.value)}
          placeholder="Movie title in subtitle language (e.g., Le Film, Der Film)"
          className="flex-1 px-2 py-1 text-xs rounded border"
          style={{
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            color: colors.text
          }}
        />
      </div>

      {/* Checkboxes Row 1 */}
      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={currentOptions.hearingimpaired === '1' || localHearingImpairedValue === '1'}
            onChange={(e) => handleFieldChange('hearingimpaired', e.target.checked ? '1' : '0')}
            className="w-3 h-3"
            style={{ accentColor: colors.link }}
          />
          <span className="text-xs" title="Hearing Impaired">🦻</span>
          <span className="text-xs" style={{ color: colors.textSecondary }}>
            Hearing Impaired
          </span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={currentOptions.highdefinition === '1' || localHdValue === '1'}
            onChange={(e) => handleFieldChange('highdefinition', e.target.checked ? '1' : '0')}
            className="w-3 h-3"
            style={{ accentColor: colors.link }}
          />
          <span className="text-xs" title="High Definition">📺</span>
          <span className="text-xs" style={{ color: colors.textSecondary }}>
            High Definition
          </span>
        </label>
      </div>

      {/* Checkboxes Row 2 */}
      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={currentOptions.automatictranslation === '1' || localAutoTranslationValue === '1'}
            onChange={(e) => handleFieldChange('automatictranslation', e.target.checked ? '1' : '0')}
            className="w-3 h-3"
            style={{ accentColor: colors.link }}
          />
          <span className="text-xs" title="Automatic Translation">🤖</span>
          <span className="text-xs" style={{ color: colors.textSecondary }}>
            Auto Translation
          </span>
        </label>

        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={currentOptions.foreignpartsonly === '1' || localForeignPartsValue === '1'}
            onChange={(e) => handleFieldChange('foreignpartsonly', e.target.checked ? '1' : '0')}
            className="w-3 h-3"
            style={{ accentColor: colors.link }}
          />
          <span className="text-xs" title="Foreign Parts Only">🎭</span>
          <span className="text-xs" style={{ color: colors.textSecondary }}>
            Foreign Parts Only
          </span>
        </label>
      </div>

    </div>
  ), [
    isDark, 
    colors.border, 
    colors.cardBackground, 
    colors.text, 
    colors.textSecondary, 
    colors.link,
    currentOptions.subauthorcomment,
    currentOptions.moviereleasename,
    currentOptions.subtranslator,
    currentOptions.movieaka,
    currentOptions.hearingimpaired,
    currentOptions.highdefinition,
    currentOptions.automatictranslation,
    currentOptions.foreignpartsonly,
    localHearingImpairedValue,
    localHdValue,
    localAutoTranslationValue,
    localForeignPartsValue,
    handleFieldChange
  ]);

  return (
    <div className="" data-interactive>
      {/* Show toggle button only if not in inline mode */}
      {!showExpandedInline && (
        <button
          onClick={toggleExpanded}
          className="rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 flex items-center justify-between min-h-[28px]"
          style={{
            backgroundColor: isDark ? '#3a3a3a' : '#f8f9fa',
            color: colors.text,
            border: `1px solid ${colors.border}`
          }}
        >
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <span>Upload Options</span>
          </div>
          <span>{currentIsExpanded ? '▲' : '▼'}</span>
        </button>
      )}

      {/* Expanded Options */}
      {shouldShowExpanded && ExpandedContent}
    </div>
  );
};

// Alias for backward compatibility
export const SubtitleUploadOptionsPanel = (props) => (
  <SubtitleUploadOptions {...props} showExpandedInline={true} />
);