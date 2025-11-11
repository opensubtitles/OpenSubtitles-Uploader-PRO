import {
  VIDEO_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  VIDEO_MIME_TYPES,
  SUBTITLE_MIME_TYPES,
  ARCHIVE_MIME_TYPES,
} from './constants.js';

/**
 * Format IMDb ID to ensure proper 7-digit format with leading zeros
 * Examples: 749451 -> 0749451, 133093 -> 0133093, 1234567 -> 1234567
 * @param {string|number} imdbId - Raw IMDb ID (with or without 'tt' prefix)
 * @returns {string} - Properly formatted IMDb ID (7 digits, no 'tt' prefix)
 */
export const formatImdbId = imdbId => {
  if (!imdbId) return '';

  // Convert to string and remove 'tt' prefix if present
  let id = imdbId.toString().toLowerCase().replace(/^tt/, '');

  // Pad to 7 digits with leading zeros
  return id.padStart(7, '0');
};

/**
 * Generate properly formatted IMDb URL
 * @param {string|number} imdbId - Raw IMDb ID (with or without 'tt' prefix)
 * @returns {string} - Complete IMDb URL with properly formatted ID
 */
export const getImdbUrl = imdbId => {
  if (!imdbId) return '';

  const formattedId = formatImdbId(imdbId);
  return `https://www.imdb.com/title/tt${formattedId}/`;
};

/**
 * Check if a file is a video file based on extension
 */
export const isVideoFile = fileOrName => {
  const fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
  const lower = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
};

/**
 * Detect if file content is actually a subtitle based on content analysis
 * @param {string} content - File content to analyze
 * @returns {boolean} - True if content appears to be subtitle format
 */
export const isSubtitleContent = content => {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 3) {
    return false; // Too short to be a subtitle
  }

  // Check for common subtitle patterns
  let timelineMatches = 0;
  let sequenceMatches = 0;
  let webvttMarker = false;
  let assMarker = false;

  // Check for WebVTT marker
  if (lines[0] === 'WEBVTT' || lines[0].startsWith('WEBVTT')) {
    webvttMarker = true;
  }

  // Check for ASS/SSA marker
  if (lines[0].startsWith('[Script Info]') || lines.some(line => line.startsWith('[V4+ Styles]'))) {
    assMarker = true;
  }

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i];

    // Check for SRT sequence numbers (1, 2, 3, etc.)
    if (/^\d+$/.test(line)) {
      sequenceMatches++;
    }

    // Check for time patterns
    // SRT: 00:00:01,000 --> 00:00:05,000
    // WebVTT: 00:00:01.000 --> 00:00:05.000
    if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(line)) {
      timelineMatches++;
    }

    // Check for WebVTT time patterns
    if (/^\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}/.test(line)) {
      timelineMatches++;
    }
  }

  // Decision logic
  if (webvttMarker || assMarker) {
    return true;
  }

  // For SRT format, we need both sequence numbers and timelines
  if (sequenceMatches >= 2 && timelineMatches >= 2) {
    return true;
  }

  // If we have many timeline patterns, it's likely a subtitle
  if (timelineMatches >= 3) {
    return true;
  }

  return false;
};

/**
 * Check if a file is a subtitle file based on extension (excluding .txt)
 */
export const isSubtitleFile = fileOrName => {
  const fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
  const lower = fileName.toLowerCase();

  // For .txt files, we cannot determine from filename alone
  // They need content analysis
  if (lower.endsWith('.txt')) {
    return false; // Will be determined by content analysis later
  }

  return SUBTITLE_EXTENSIONS.some(ext => lower.endsWith(ext));
};

/**
 * Check if a file is an archive file based on extension
 */
export const isArchiveFile = fileOrName => {
  const fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
  const lower = fileName.toLowerCase();
  return ARCHIVE_EXTENSIONS.some(ext => lower.endsWith(ext));
};

/**
 * Get base name of a file (without extension)
 */
export const getBaseName = fileName => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) return fileName;
  return fileName.substring(0, lastDotIndex);
};

/**
 * Format file size in human readable format
 */
export const formatFileSize = bytes => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Detect video file type from extension
 */
export const detectVideoFileInfo = file => {
  const extension = file.name.toLowerCase().split('.').pop();
  const mimeToInfo = {
    mp4: { file_type: 'mp4', file_kind: 'MPEG-4 Video' },
    mkv: { file_type: 'mkv', file_kind: 'Matroska Video' },
    avi: { file_type: 'avi', file_kind: 'AVI Video' },
    mov: { file_type: 'mov', file_kind: 'QuickTime Video' },
    webm: { file_type: 'webm', file_kind: 'WebM Video' },
    flv: { file_type: 'flv', file_kind: 'Flash Video' },
    wmv: { file_type: 'wmv', file_kind: 'Windows Media Video' },
    mpeg: { file_type: 'mpeg', file_kind: 'MPEG Video' },
    mpg: { file_type: 'mpg', file_kind: 'MPEG Video' },
    '3gp': { file_type: '3gp', file_kind: '3GP Video' },
    m4v: { file_type: 'm4v', file_kind: 'iTunes Video' },
    ts: { file_type: 'ts', file_kind: 'MPEG Transport Stream' },
    vob: { file_type: 'vob', file_kind: 'DVD Video' },
    ogv: { file_type: 'ogv', file_kind: 'Ogg Video' },
  };

  return (
    mimeToInfo[extension] || { file_type: extension, file_kind: `${extension.toUpperCase()} Video` }
  );
};

/**
 * Check if file is media file by extension or MIME type
 */
export const isMediaFile = file => {
  const fileName = file.name;
  const fileType = file.type;

  let isVideo = isVideoFile(fileName);
  let isSubtitle = isSubtitleFile(fileName);
  let isArchive = isArchiveFile(fileName);
  let fileKind = null;

  // For .txt files, default to "Unknown text file" and require content analysis
  if (fileName.toLowerCase().endsWith('.txt')) {
    isSubtitle = false; // Default to false, will be determined by content analysis
    fileKind = 'Unknown text file';
  }

  // If no extension detected, check MIME type
  if (!isVideo && !isSubtitle && !isArchive) {
    if (VIDEO_MIME_TYPES.includes(fileType)) {
      isVideo = true;
    } else if (SUBTITLE_MIME_TYPES.includes(fileType)) {
      // Don't override .txt files with MIME type - they need content analysis
      if (!fileName.toLowerCase().endsWith('.txt')) {
        isSubtitle = true;
      }
    } else if (ARCHIVE_MIME_TYPES.includes(fileType)) {
      isArchive = true;
    } else if (fileType.startsWith('text/')) {
      // For other text extensions, check if they're subtitle extensions
      const extension = fileName.toLowerCase().split('.').pop();

      if (extension !== 'txt') {
        const isLikelySubtitle = SUBTITLE_EXTENSIONS.some(
          ext => ext.slice(1) === extension // Remove the dot from extension for comparison
        );
        if (isLikelySubtitle) {
          isSubtitle = true;
        }
      }
      // .txt files remain as "Unknown text file"
    }
  }

  return { isVideo, isSubtitle, isArchive, isMedia: isVideo || isSubtitle || isArchive, fileKind };
};

/**
 * Pair video and subtitle files based on naming conventions
 */
export const pairVideoAndSubtitleFiles = allFiles => {
  // Only log debug messages if there are actually files to process
  if (allFiles.length > 0) {
  }

  const videoFiles = allFiles.filter(file => file.isVideo && !file.shouldRemove);
  const subtitleFiles = allFiles.filter(file => file.isSubtitle && !file.shouldRemove);

  if (allFiles.length > 0) {
  }

  const pairs = [];
  const usedSubtitles = new Set();

  videoFiles.forEach((videoFile, videoIndex) => {
    const videoBaseName = getBaseName(videoFile.name);
    const videoDir = videoFile.fullPath.includes('/')
      ? videoFile.fullPath.substring(0, videoFile.fullPath.lastIndexOf('/'))
      : 'Root';
    const matchingSubtitles = [];

    subtitleFiles.forEach(subtitleFile => {
      if (usedSubtitles.has(subtitleFile.fullPath)) return;

      const subtitleBaseName = getBaseName(subtitleFile.name);
      const subtitleDir = subtitleFile.fullPath.includes('/')
        ? subtitleFile.fullPath.substring(0, subtitleFile.fullPath.lastIndexOf('/'))
        : 'Root';

      let isMatch = false;
      let matchType = '';

      // Check if subtitle is in a subtitle subdirectory
      const subtitleDirLower = subtitleDir.toLowerCase();
      const isInSubtitleDir =
        subtitleDirLower.endsWith('/subtitles') ||
        subtitleDirLower.endsWith('/subtitle') ||
        subtitleDirLower.endsWith('/subs') ||
        subtitleDirLower.endsWith('/sub');

      if (isInSubtitleDir) {
        const subtitleParentDir = subtitleDir.substring(0, subtitleDir.lastIndexOf('/'));
        if (subtitleParentDir === videoDir) {
          isMatch = true;
          matchType = 'subtitle directory match';
        } else {
          // Handle nested directories with similar names
          // Check if subtitle parent dir contains video dir name or vice versa
          const videoDirName = videoDir.split('/').pop();
          const subtitleParentDirName = subtitleParentDir.split('/').pop();

          // Remove brackets and normalize for comparison
          const normalizeForComparison = str =>
            str
              .replace(/[\[\]()]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();

          const normalizedVideoDir = normalizeForComparison(videoDirName);
          const normalizedSubtitleParentDir = normalizeForComparison(subtitleParentDirName);

          if (normalizedVideoDir === normalizedSubtitleParentDir) {
            isMatch = true;
            matchType = 'subtitle directory match (normalized names)';
          }
        }
      }

      // Check if subtitle is in the same directory as video
      if (!isMatch && videoDir === subtitleDir) {
        // Special handling for .txt files - only match if they have subtitle-like naming
        if (subtitleFile.name.toLowerCase().endsWith('.txt')) {
          // For .txt files, only match if filename clearly relates to the video
          if (videoBaseName === subtitleBaseName) {
            isMatch = true;
            matchType = 'exact match - default language';
          } else if (subtitleBaseName.startsWith(videoBaseName + '.')) {
            const languagePart = subtitleBaseName.substring(videoBaseName.length + 1);
            if (/^[a-z]{2}(-[a-z]{2})?$/i.test(languagePart)) {
              isMatch = true;
              matchType = `language: ${languagePart}`;
            } else if (
              languagePart.toLowerCase().includes('sub') ||
              languagePart.toLowerCase().includes('caption') ||
              languagePart.toLowerCase().includes('cc')
            ) {
              isMatch = true;
              matchType = 'subtitle-related suffix - default language';
            }
            // Don't match other .txt files with non-subtitle suffixes
          }
        } else {
          // Non-.txt files use the original logic
          if (videoBaseName === subtitleBaseName) {
            isMatch = true;
            matchType = 'exact match - default language';
          } else if (subtitleBaseName.startsWith(videoBaseName + '.')) {
            const languagePart = subtitleBaseName.substring(videoBaseName.length + 1);
            if (/^[a-z]{2}(-[a-z]{2})?$/i.test(languagePart)) {
              isMatch = true;
              matchType = `language: ${languagePart}`;
            } else {
              isMatch = true;
              matchType = 'non-language suffix - default language';
            }
          }
        }
      }

      if (isMatch) {
        matchingSubtitles.push({
          subtitle: subtitleFile,
          language: 'default',
        });
      }
    });

    matchingSubtitles.forEach(match => {
      usedSubtitles.add(match.subtitle.fullPath);
    });

    const pair = {
      video: videoFile, // This should preserve the original video object with movieHash
      subtitles: matchingSubtitles.map(match => ({
        ...match.subtitle,
        language: match.language,
      })),
      id: videoFile.fullPath,
    };

    pairs.push(pair);
  });

  // Only log if there were files to process
  if (allFiles.length > 0) {
  }
  return pairs;
};

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance between strings
 */
export const levenshteinDistance = (str1, str2) => {
  if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);

  const matrix = [];

  // Initialize first row and column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Check if two titles are similar enough to be considered duplicates
 * @param {string} title1 - First title
 * @param {string} title2 - Second title
 * @param {number} maxDistance - Maximum allowed edit distance (default: 1)
 * @returns {boolean} - True if titles are too similar to display both
 */
export const areTitlesSimilar = (title1, title2, maxDistance = 1) => {
  if (!title1 || !title2) return false;

  // Normalize strings: lowercase, trim, remove extra spaces
  const normalize = str => str.toLowerCase().trim().replace(/\s+/g, ' ');

  const normalizedTitle1 = normalize(title1);
  const normalizedTitle2 = normalize(title2);

  // Exact match after normalization
  if (normalizedTitle1 === normalizedTitle2) {
    return true;
  }

  // Check Levenshtein distance
  const distance = levenshteinDistance(normalizedTitle1, normalizedTitle2);
  return distance <= maxDistance;
};

/**
 * Get the best name for movie detection from a subtitle file
 * For generic names (like en.srt, eng.srt), use parent directory name
 * @param {Object} subtitleFile - The subtitle file object
 * @returns {string} - The best name to use for movie detection
 */
export const getBestMovieDetectionName = subtitleFile => {
  const fullPath = subtitleFile.fullPath;
  const fileName = subtitleFile.name;

  // Remove subtitle extension and language codes more conservatively
  // First remove common subtitle extensions
  let baseName = fileName.replace(/\.(srt|vtt|ass|ssa|sub|idx|sup|sbv|dfxp|ttml|xml)$/i, '');

  // Then remove language codes from the end (handles .eng.srt, .sk.srt, etc.)
  baseName = baseName.replace(
    /\.(chi|eng|spa|por|fre|ger|ita|dut|swe|nor|dan|fin|hun|hrv|srp|bul|rum|gre|tur|ara|heb|hin|tha|vie|ind|may|tgl|ukr|cat|eus|glg|cym|gle|mlt|isl|lav|lit|est|slv|mkd|sqi|bos|mne|ces|slk|rus|pol|jpn|kor|sk|cz|fr|de|es|it|pt|nl|sv|no|da|fi|hu|hr|sr|bg|ro|el|tr|ar|he|hi|th|vi|id|ms|tl|ca|eu|gl|cy|ga|mt|is|lv|lt|et|sl|mk|sq|bs|me|cs|ru|pl|zh|ja|ko)$/i,
    ''
  );

  // Language codes and common generic patterns
  const genericPatterns = [
    // 2-letter ISO codes
    /^(en|fr|de|es|it|pt|nl|sv|no|da|fi|hu|hr|sr|bg|ro|el|tr|ar|he|hi|th|vi|id|ms|tl|uk|ca|eu|gl|cy|ga|mt|is|lv|lt|et|sl|mk|sq|bs|me|cs|sk|ru|pl|zh|ja|ko)$/i,
    // 3-letter ISO codes
    /^(eng|fre|ger|spa|ita|por|dut|swe|nor|dan|fin|hun|hrv|srp|bul|rum|gre|tur|ara|heb|hin|tha|vie|ind|may|tgl|ukr|cat|eus|glg|cym|gle|mlt|isl|lav|lit|est|slv|mkd|sqi|bos|mne|ces|slk|rus|pol|chi|jpn|kor|cze|nob|baq|fil)$/i,
    // Full language names
    /^(english|french|german|spanish|italian|portuguese|dutch|swedish|norwegian|danish|finnish|hungarian|croatian|serbian|bulgarian|romanian|greek|turkish|arabic|hebrew|hindi|thai|vietnamese|indonesian|malay|tagalog|ukrainian|catalan|basque|galician|welsh|irish|maltese|icelandic|latvian|lithuanian|estonian|slovenian|macedonian|albanian|bosnian|montenegrin|czech|slovak|russian|polish|chinese|japanese|korean|traditional|simplified)$/i,
    // Language name variants and regional variants
    /^(chinese.*simplified|chinese.*traditional|simplified.*chinese|traditional.*chinese|portuguese.*brazil|portuguese.*portugal|spanish.*spain|spanish.*latin|latin.*american|latin.*america|brazilian|european|canadian)$/i,
    // Language variants with parentheses (Chinese, Portuguese, Spanish, etc.)
    /^(chinese|portuguese|spanish|english|french|german|italian|dutch|norwegian|swedish|danish|finnish|polish|russian)\s*\(.*\)$/i,
    // Subtitle modifiers and types
    /^(forced|sdh|hearing|impaired|commentary|director|audio.*description)$/i,
    // Complex patterns with brackets, codes, and modifiers
    /^(english.*\[.*\]|.*\[.*forced.*\]|.*\[.*sdh.*\]|.*\[.*hi.*\])$/i,
    // SDH and HI patterns with codes
    /^(sdh\..+|.+\.hi|.+\.sdh)$/i,
    // Language with space followed by language names (ca English, en English, etc.)
    /^(en|fr|de|es|it|pt|nl|sv|no|da|fi|hu|hr|sr|bg|ro|el|tr|ar|he|hi|th|vi|id|ms|tl|uk|ca|eu|gl|cy|ga|mt|is|lv|lt|et|sl|mk|sq|bs|me|cs|sk|ru|pl|zh|ja|ko)\s+(english|french|german|spanish|italian|portuguese|dutch|swedish|norwegian|danish|finnish|hungarian|croatian|serbian|bulgarian|romanian|greek|turkish|arabic|hebrew|hindi|thai|vietnamese|indonesian|malay|tagalog|ukrainian|catalan|basque|galician|welsh|irish|maltese|icelandic|latvian|lithuanian|estonian|slovenian|macedonian|albanian|bosnian|montenegrin|czech|slovak|russian|polish|chinese|japanese|korean|traditional|simplified)$/i,
    // Regional identifiers
    /^(traditional|simplified|brazilian|european|canadian|latin|american|spain|portugal|brazil).*$/i,
    // Common subtitle patterns (4+ chars since we changed the rule)
    /^(subtitle|subtitles|subs)$/i,
    // Mixed patterns with language codes
    /^(en_|eng_|_en|_eng|en-|eng-|-en|-eng).*$/i,
  ];

  // Check if the base name is too generic or short
  const isGeneric = baseName.length < 4 || genericPatterns.some(pattern => pattern.test(baseName));

  if (isGeneric) {
    // Get path parts and work backwards to find the best directory name
    const pathParts = fullPath.split('/');

    // Work backwards through directories to find the best movie name
    // Start from the parent directory (skip the filename itself)
    for (let i = pathParts.length - 2; i >= 0; i--) {
      const dirName = pathParts[i];

      // Skip directories with less than 5 characters (covers subs, subz, en, eng, etc.)
      // Also skip generic subtitle directory names that start with these patterns
      const subtitleDirectoryPrefixes = [
        'subtitles',
        'captions',
        'subs',
        'subtitle',
        'caption',
        'sub',
        'titulky',
        'popisky',
        'tit',
        'subtítulos',
        'sous-titres',
        'légendes',
        'untertitel',
        'beschriftungen',
        'sottotitoli',
        'didascalie',
        'legendas',
        'napisy',
        'napisi',
        'преводи',
        'натписи',
        'субтитры',
        'титры',
        'субтитри',
        'титри',
        'subtitrări',
        'legende',
        'subtitrari',
        'titluri',
        'titrat',
        'përshkrime',
        'titrai',
        'antraštės',
        'titri',
        'paraksti',
        'pealkirjad',
        'subtiitrid',
        'szöveg',
        'felirat',
        'ترجمات',
        'تسميات',
        'כתוביות',
        '字幕',
        '자막',
        'คำบรรยาย',
        'คำอธิบายภาพ',
        'អត្ថបទរត់',
        'ចំណងជើង',
        'စာတန်းထိုး',
        'සබ්ටයිටල්',
        'ඇසුරුම්',
        'උපශීර්ෂ',
        'उपशीर्षक',
        'कैप्शन',
        'উপশিরোনাম',
        'ক্যাপশন',
        'சான்றுரை',
        'படவுரை',
        'ఉపశీర్షికలు',
        'శీర්షికలు',
        'സബ്‌ടൈറ്റിലുകൾ',
        'മൊഴിമാറ്റങ്ങൾ',
        'શીર્ષક',
        'કેપ્શન',
        'ਪਿਆਸ',
        'ਸੁਰਖੀਆਂ',
        'subtítols',
        'llegendes',
        'subtitraj',
        'subtekstoj',
        'subtitoloj',
        'klarigoj',
        'épígraf',
        'përkthime',
        'تێبینی',
        'لێدوان',
        'subtitulaciones',
        'descripciones',
        'subtítułi',
        'subtítolos',
        'capcions',
        'titoli',
        'tituli',
        'opisi',
        'subtitrações',
        'ምልክቶች',
        'መግለጫዎች',
        'subtitulaĵoj',
        'subskribaĵoj',
      ];

      // Skip very short directories (language codes like en, fr, eng, etc.) or subtitle directory patterns
      const isVeryShort = dirName.length <= 3;
      const isSubtitlePattern = subtitleDirectoryPrefixes.some(prefix =>
        dirName.toLowerCase().startsWith(prefix.toLowerCase())
      );
      const isGenericDir = isVeryShort || isSubtitlePattern;

      if (!isGenericDir) {
        // This looks like a valid movie directory name
        return dirName;
      }
    }

    // If we get here, no suitable directory was found (all were too short)
    // This is unlikely but just in case, fall back to the longest directory
    if (pathParts.length > 1) {
      // Find the longest directory name as fallback
      let longestDir = '';
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (pathParts[i].length > longestDir.length) {
          longestDir = pathParts[i];
        }
      }
      if (longestDir.length > 0) {
        return longestDir;
      }
    }
  }

  // Fall back to original file name if no better option found
  return baseName;
};
