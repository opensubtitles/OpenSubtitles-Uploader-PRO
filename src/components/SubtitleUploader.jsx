import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";

// Import logo assets
import logoWhite from '../assets/os_logo_white_512x512.png';
import logoDark from '../assets/os_logo_dark_512x512.png';


// Import Tauri API to ensure it's loaded (only available in Tauri environment)
if (typeof window !== 'undefined' && window.location.protocol === 'tauri:') {
  try {
    import('@tauri-apps/api/core');
  } catch (e) {
    console.log('Tauri core not available in this environment');
  }
}

// Environment Detection - ALWAYS log this first for debugging support tickets
if (typeof window !== 'undefined') {
  // Log comprehensive environment info immediately
  console.log(`🔍 === SYSTEM ENVIRONMENT INFO (v${APP_VERSION}) ===`);
  console.log('🕐 App Start Time:', new Date().toISOString());
  console.log('📍 Current URL:', window.location.href);
  console.log('🌐 Protocol:', window.location.protocol);
  console.log('🖥️ Platform:', navigator.platform);
  console.log('📱 User Agent:', navigator.userAgent);
  console.log(`🏗️ App Version: OpenSubtitles Uploader PRO v${APP_VERSION}`);
  
  // Detect operating system
  const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);
  const isWindows = /Win/.test(navigator.platform);
  const isLinux = /Linux/.test(navigator.platform);
  
  // macOS specific detection
  if (isMac) {
    const isAppleSilicon = /Mac/.test(navigator.platform) && !navigator.userAgent.includes('Intel');
    const isIntel = /Mac/.test(navigator.platform) && navigator.userAgent.includes('Intel');
    console.log('🍎 macOS Details:');
    console.log('  - Apple Silicon (M1/M2/M3):', isAppleSilicon);
    console.log('  - Intel Processor:', isIntel);
  }
  
  // Tauri/Desktop detection
  const isTauri = (
    window.location.protocol === 'tauri:' ||
    window.location.href.startsWith('tauri://') ||
    window.location.origin.startsWith('tauri://') ||
    (typeof window !== 'undefined' && !!window.__TAURI__)
  );
  
  console.log('🖥️ Environment Type:');
  console.log('  - Desktop App (Tauri):', isTauri);
  console.log('  - Web Browser:', !isTauri);
  console.log('  - macOS:', isMac);
  console.log('  - Windows:', isWindows);  
  console.log('  - Linux:', isLinux);
  console.log('=======================================');
  
  // Make environment info globally available
  window.__ENVIRONMENT_INFO__ = {
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    url: window.location.href,
    protocol: window.location.protocol,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    isTauri,
    isMac,
    isWindows,
    isLinux,
    isAppleSilicon: isMac && !navigator.userAgent.includes('Intel'),
    isIntel: isMac && navigator.userAgent.includes('Intel')
  };
}

import { useDebugMode } from "../hooks/useDebugMode.js";
import { useFileHandling } from "../hooks/useFileHandling.js";
import { useLanguageData } from "../hooks/useLanguageData.js";
import { useLanguageDetection } from "../hooks/useLanguageDetection.js";
import { useMovieGuess } from "../hooks/useMovieGuess.js";
import { useGuessIt } from "../hooks/useGuessIt.js";
import { useUserSession } from "../hooks/useUserSession.js";
import { useCheckSubHash } from "../hooks/useCheckSubHash.js";
import { useVideoMetadata } from "../hooks/useVideoMetadata.js";
import { useWasmInitialization } from "../hooks/useWasmInitialization.js";
import { useAppUpdate } from "../hooks/useAppUpdate.js";
import { CacheService } from "../services/cache.js";
import { MovieHashService } from "../services/movieHash.js";
import { SubtitleUploadService } from "../services/subtitleUploadService.js";
import { detectVideoFileInfo, formatFileSize, getBestMovieDetectionName } from "../utils/fileUtils.js";
import { DropZone } from "./DropZone.jsx";
import { FileList } from "./FileList/FileList.jsx";
import { MatchedPairs } from "./MatchedPairs.jsx";
import { OrphanedSubtitles } from "./OrphanedSubtitles.jsx";
import { StatsPanel } from "./StatsPanel.jsx";
import { SubtitlePreview } from "./SubtitlePreview.jsx";
import { UploadButton } from "./UploadButton.jsx";
import { ApiHealthCheck } from "./ApiHealthCheck.jsx";
import { ConfigOverlay } from "./ConfigOverlay.jsx";
import { HelpOverlay } from "./HelpOverlay.jsx";
import ProgressOverlay from "./ProgressOverlay.jsx";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext.jsx";
import { getThemeStyles, createHoverHandlers } from "../utils/themeUtils.js";
import { APP_VERSION } from "../utils/constants.js";
import { SessionManager } from "../services/sessionManager.js";
import TestModePanel from "./TestModePanel.jsx";
import UserProfile from "./UserProfile.jsx";
import UpdateNotification from "./UpdateNotification.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

// Lazy load the DebugPanel component
const DebugPanel = lazy(() => import("./DebugPanel.jsx").then(module => ({ default: module.DebugPanel })));
const ChangelogOverlay = lazy(() => import("./ChangelogOverlay.jsx"));

function SubtitleUploaderInner() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = getThemeStyles(colors);
  const { isAuthenticated, user, isAnonymous } = useAuth();
  const { isStandalone, startAutoUpdates } = useAppUpdate();
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null); // For temporary info messages
  const [showChangelogOverlay, setShowChangelogOverlay] = useState(false);
  
  // Ref for auto-scrolling to matched pairs section
  const matchedPairsRef = useRef(null);
  
  // Function to show temporary notifications
  const showNotification = useCallback((message, type = 'info', duration = 5000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  }, []);
  const [previewSubtitle, setPreviewSubtitle] = useState(null);
  const [subtitleContent, setSubtitleContent] = useState('');
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [dropdownSearch, setDropdownSearch] = useState({});
  const [uploadStates, setUploadStates] = useState({}); // New state for upload enable/disable
  const [uploadResults, setUploadResults] = useState({}); // New state for upload results
  const [subcontentData, setSubcontentData] = useState({}); // New state for subcontent data
  const [uploadOptions, setUploadOptions] = useState({}); // New state for upload options (release name, comments, etc.)
  const [orphanedSubtitlesFps, setOrphanedSubtitlesFps] = useState({}); // New state for orphaned subtitles FPS
  const [uploadProgress, setUploadProgress] = useState({ 
    isUploading: false,
    isComplete: false,
    processed: 0, 
    total: 0,
    successful: 0,
    alreadyExists: 0,
    failed: 0,
    currentSubtitle: '',
    results: []
  }); // Enhanced upload progress tracking
  
  // File processing progress state
  const [processingProgress, setProcessingProgress] = useState({
    isProcessing: false,
    startTime: null,
    totalFiles: 0,
    processedFiles: 0,
    fileDiscovery: 0,
    fileDiscoveryTotal: 0,
    directoriesProcessed: 0,
    videoProcessing: 0,
    videoProcessingTotal: 0,
    subtitleProcessing: 0,
    subtitleProcessingTotal: 0,
    languageDetection: 0,
    languageDetectionTotal: 0,
    errors: 0,
    skipped: 0
  });
  
  // Default config values
  const defaultConfig = {
    uploadOptionsExpanded: false, // Default to collapsed (current behavior)
    globalComment: '', // Global comment for all subtitles
    defaultLanguage: '', // Default language for all subtitles (empty = auto-detect)
    defaultFps: '', // Default FPS for orphaned subtitles (empty = no default)
    defaultTranslator: '', // Default translator for all subtitles (empty = no default)
    uploadMovieHashOnly: false, // Only update movie hashes, don't upload subtitles (default = false)
    extractMkvSubtitles: true // Enable MKV subtitle extraction by default (v1.8.1 API)
  };

  // Config state - initialize with defaults and immediately load from localStorage
  const [config, setConfig] = useState(() => {
    // Try to load config from localStorage during initialization
    try {
      const savedConfig = localStorage.getItem('opensubtitles-uploader-config');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        return { ...defaultConfig, ...parsedConfig };
      }
    } catch (error) {
      console.error('Error loading config during initialization:', error);
    }
    return defaultConfig;
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hasDroppedFiles, setHasDroppedFiles] = useState(false); // Track if files have been dropped
  
  

  // Initialize session security on mount
  useEffect(() => {
    // Handle session ID security
    SessionManager.initializeSession();

    // Start auto-updates if running as standalone app
    if (isStandalone) {
      startAutoUpdates();
    }
  }, [isStandalone, startAutoUpdates]);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('opensubtitles-uploader-config', JSON.stringify(config));
    } catch (error) {
      console.error('Error saving config to localStorage:', error);
    }
  }, [config]);

  // Custom hooks - DEBUG MODE RE-ENABLED AFTER FIX
  const { 
    debugMode, 
    debugInfo, 
    addDebugInfo, 
    clearDebugInfo, 
    toggleDebugMode 
  } = useDebugMode();

  // Environment info is already logged at startup via console.log, no need to duplicate in debug panel



  const handleConfigToggle = useCallback(() => {
    setIsConfigOpen(prev => !prev);
  }, []);

  const handleConfigClose = useCallback(() => {
    setIsConfigOpen(false);
  }, []);

  // Help handlers
  const handleHelpToggle = useCallback(() => {
    setIsHelpOpen(prev => !prev);
  }, []);
  
  const handleHelpClose = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  // Progress management functions
  const initializeProgress = useCallback((totalFiles, directoriesProcessed = 1) => {
    setProcessingProgress({
      isProcessing: true,
      startTime: Date.now(),
      totalFiles,
      processedFiles: 0,
      fileDiscovery: 1, // Completed after file discovery
      fileDiscoveryTotal: 1, // Always 1 for directory discovery
      directoriesProcessed,
      videoProcessing: 0,
      videoProcessingTotal: 0,
      subtitleProcessing: 0,
      subtitleProcessingTotal: 0,
      languageDetection: 0,
      languageDetectionTotal: 0,
      errors: 0,
      skipped: 0
    });
  }, []);

  const updateProgress = useCallback((updates) => {
    setProcessingProgress(prev => ({
      ...prev,
      ...(typeof updates === 'function' ? updates(prev) : updates)
    }));
  }, []);

  const finalizeProgress = useCallback(() => {
    setProcessingProgress(prev => ({
      ...prev,
      isProcessing: false,
      processedFiles: prev.totalFiles
    }));
  }, []);

  const cancelProgress = useCallback(() => {
    setProcessingProgress(prev => ({
      ...prev,
      isProcessing: false
    }));
  }, []);

  
  // Mock debug functions to prevent errors (commented out)
  // const debugMode = false;
  // const debugInfo = [];
  // const addDebugInfo = () => {};
  // const clearDebugInfo = () => {};
  // const toggleDebugMode = () => {};

  const {
    files,
    pairedFiles,
    isDragOver,
    browserCapabilities,
    handleDrop,
    handleDragOver: originalHandleDragOver,
    handleDragLeave: originalHandleDragLeave,
    clearFiles,
    updateFile,
    setFiles
  } = useFileHandling(addDebugInfo, config);

  // Override drag handlers to prevent default behavior when files already dropped
  const handleDragOver = useCallback((e) => {
    if (hasDroppedFiles) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    originalHandleDragOver(e);
  }, [hasDroppedFiles, originalHandleDragOver]);

  const handleDragLeave = useCallback((e) => {
    if (hasDroppedFiles) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    originalHandleDragLeave(e);
  }, [hasDroppedFiles, originalHandleDragLeave]);

  const {
    combinedLanguages,
    languagesLoading,
    languagesError,
    subtitleLanguages,
    handleSubtitleLanguageChange,
    clearSubtitleLanguages,
    getLanguageInfo,
    getSubtitleLanguage,
    getLanguageOptionsForSubtitle
  } = useLanguageData(addDebugInfo);

  const { 
    processLanguageDetection,
    getLanguageProcessingStatus,
    clearLanguageProcessingState,
    clearAllLanguageState
  } = useLanguageDetection(addDebugInfo, updateFile);

  // RE-ENABLED: GuessIt hook (debug mode was the actual cause)
  const {
    guessItData,
    processGuessIt,
    clearGuessItProcessingState,
    clearAllGuessItState,
    getGuessItProcessingStatus,
    getFormattedTags,
    extractGuessItFromMovieData,
    setGuessItDataForFile
  } = useGuessIt(addDebugInfo);
  
  // Mock GuessIt functions to prevent errors (commented out)
  // const guessItData = {};
  // const processGuessIt = () => {};
  // const clearGuessItProcessingState = () => {};
  // const clearAllGuessItState = () => {};
  // const getGuessItProcessingStatus = () => 'none';
  // const getFormattedTags = () => [];
  // const extractGuessItFromMovieData = () => {};
  // const setGuessItDataForFile = () => {};

  const { 
    movieGuesses, 
    featuresByImdbId, 
    featuresLoading,
    processMovieGuess,
    processSubtitleMovieGuess,
    getProcessingStatus,
    clearProcessingState,
    clearAllState,
    fetchFeaturesByImdbId,
    setMovieGuess
  } = useMovieGuess(addDebugInfo, setGuessItDataForFile);

  const {
    userInfo,
    isLoading: userLoading,
    getUsername,
    isLoggedIn,
    getUserRank
  } = useUserSession(addDebugInfo);

  // RE-ENABLED: CheckSubHash hook (debug mode was the actual cause)
  const {
    hashCheckResults,
    hashCheckLoading,
    hashCheckProcessed,
    processSubtitleHashes,
    getHashCheckResult,
    fileExistsInDatabase,
    getHashCheckSummary,
    clearHashCheckResults
  } = useCheckSubHash(addDebugInfo);
  
  // Mock CheckSubHash functions to prevent errors (commented out)
  // const hashCheckResults = {};
  // const hashCheckLoading = {};
  // const hashCheckProcessed = {};
  // const processSubtitleHashes = () => {};
  // const getHashCheckResult = () => null;
  // const fileExistsInDatabase = () => false;
  // const getHashCheckSummary = () => ({});
  // const clearHashCheckResults = () => {};

  // RE-ENABLED: VideoMetadata hook (debug mode was the actual cause)
  const {
    videoMetadata,
    isFFmpegLoaded,
    extractVideoMetadata,
    processVideoFiles,
    clearVideoMetadata,
    clearAllVideoMetadata,
    getVideoMetadata,
    isMetadataLoading,
    getMetadataError,
    getUploadParameters,
    hasAnyMetadata,
    loadingCount: metadataLoadingCount,
    errorCount: metadataErrorCount,
    processedCount: metadataProcessedCount
  } = useVideoMetadata();

  // Initialize all WASM components at startup
  const {
    isLoading: wasmLoading,
    isInitialized: wasmInitialized,
    percentage: wasmPercentage,
    currentComponent: wasmCurrentComponent,
    ffmpegLoaded,
    guessitLoaded,
    ffmpegError,
    guessitError
  } = useWasmInitialization();
  
  // Mock VideoMetadata functions to prevent errors (commented out)
  // const videoMetadata = {};
  // const isFFmpegLoaded = false;
  // const extractVideoMetadata = () => {};
  // const processVideoFiles = () => {};
  // const clearVideoMetadata = () => {};
  // const clearAllVideoMetadata = () => {};
  // const getVideoMetadata = () => null;
  // const isMetadataLoading = () => false;
  // const getMetadataError = () => null;
  // const getUploadParameters = () => ({});
  // const hasAnyMetadata = () => false;
  // const metadataLoadingCount = 0;
  // const metadataErrorCount = 0;
  // const metadataProcessedCount = 0;

  // Track processed files to prevent reprocessing
  const processedFilesSet = useRef(new Set());
  
  // Track when state is reset to force useEffect re-execution
  const [stateResetKey, setStateResetKey] = useState(0);

  // Calculate orphaned subtitles (subtitles that are not paired with any video)
  const orphanedSubtitles = (() => {
    // Get all subtitle file paths that are in paired files
    const pairedSubtitlePaths = new Set();
    pairedFiles.forEach(pair => {
      if (pair.subtitles && pair.subtitles.length > 0) {
        pair.subtitles.forEach(subtitle => {
          pairedSubtitlePaths.add(subtitle.fullPath);
        });
      }
    });
    
    // Return subtitles that are not in any paired file
    const orphaned = files.filter(file => 
      file.isSubtitle && 
      !file.shouldRemove && 
      !pairedSubtitlePaths.has(file.fullPath)
    );
    
    
    return orphaned;
  })();

  // Apply global comment to all subtitles
  const applyGlobalCommentToAllSubtitles = useCallback((globalComment) => {
    const allSubtitlePaths = [];
    
    // Collect all subtitle paths from paired files
    pairedFiles.forEach(pair => {
      if (pair.subtitles && pair.subtitles.length > 0) {
        pair.subtitles.forEach(subtitle => {
          allSubtitlePaths.push(subtitle.fullPath);
        });
      }
    });
    
    // Add orphaned subtitles
    orphanedSubtitles.forEach(subtitle => {
      allSubtitlePaths.push(subtitle.fullPath);
    });
    
    // Update upload options for all subtitles
    if (allSubtitlePaths.length > 0) {
      setUploadOptions(prev => {
        const newOptions = { ...prev };
        allSubtitlePaths.forEach(path => {
          newOptions[path] = {
            ...newOptions[path],
            subauthorcomment: globalComment
          };
        });
        return newOptions;
      });
      
      addDebugInfo(`Applied global comment to ${allSubtitlePaths.length} subtitles: "${globalComment}"`);
    }
  }, [pairedFiles, orphanedSubtitles, addDebugInfo]);

  // Apply default language to all subtitles
  const applyDefaultLanguageToAllSubtitles = useCallback((defaultLanguage) => {
    const allSubtitlePaths = [];
    
    // Collect all subtitle paths from paired files
    pairedFiles.forEach(pair => {
      if (pair.subtitles && pair.subtitles.length > 0) {
        pair.subtitles.forEach(subtitle => {
          allSubtitlePaths.push(subtitle.fullPath);
        });
      }
    });
    
    // Add orphaned subtitles
    orphanedSubtitles.forEach(subtitle => {
      allSubtitlePaths.push(subtitle.fullPath);
    });
    
    // Update file data for all subtitles
    if (allSubtitlePaths.length > 0) {
      if (defaultLanguage) {
        const defaultLangInfo = combinedLanguages[defaultLanguage];
        if (defaultLangInfo) {
          allSubtitlePaths.forEach(path => {
            updateFile(path, {
              detectedLanguage: {
                language_code: defaultLanguage,
                confidence: 1.0,
                all_languages: [{
                  language_code: defaultLanguage,
                  confidence: 1.0
                }],
                source: 'config-default'
              }
            });
          });
          addDebugInfo(`Applied default language ${defaultLanguage} to ${allSubtitlePaths.length} existing subtitles`);
        } else {
          addDebugInfo(`❌ Default language ${defaultLanguage} not found in language data`);
        }
      } else {
        // Clear default language - would need to re-run detection
        addDebugInfo(`Default language cleared - existing subtitles will keep their current language`);
      }
    }
  }, [pairedFiles, orphanedSubtitles, addDebugInfo, combinedLanguages, updateFile]);

  // Apply default FPS to orphaned subtitles only
  const applyDefaultFpsToOrphanedSubtitles = useCallback((defaultFps) => {
    const orphanedSubtitlePaths = [];
    
    // Collect only orphaned subtitle paths
    orphanedSubtitles.forEach(subtitle => {
      orphanedSubtitlePaths.push(subtitle.fullPath);
    });
    
    // Update FPS for orphaned subtitles
    if (orphanedSubtitlePaths.length > 0) {
      setOrphanedSubtitlesFps(prev => {
        const newFps = { ...prev };
        orphanedSubtitlePaths.forEach(path => {
          newFps[path] = defaultFps;
        });
        return newFps;
      });
      
      if (defaultFps) {
        addDebugInfo(`Applied default FPS ${defaultFps} to ${orphanedSubtitlePaths.length} orphaned subtitles`);
      } else {
        addDebugInfo(`Cleared default FPS for ${orphanedSubtitlePaths.length} orphaned subtitles`);
      }
    }
  }, [orphanedSubtitles, addDebugInfo]);

  // Apply default FPS to new orphaned subtitles when they are detected
  useEffect(() => {
    if (config.defaultFps && orphanedSubtitles.length > 0) {
      const newSubtitles = orphanedSubtitles.filter(subtitle => 
        !orphanedSubtitlesFps.hasOwnProperty(subtitle.fullPath)
      );
      
      if (newSubtitles.length > 0) {
        setOrphanedSubtitlesFps(prev => {
          const newFps = { ...prev };
          newSubtitles.forEach(subtitle => {
            newFps[subtitle.fullPath] = config.defaultFps;
          });
          return newFps;
        });
        
        addDebugInfo(`Applied default FPS ${config.defaultFps} to ${newSubtitles.length} new orphaned subtitles`);
      }
    }
  }, [orphanedSubtitles, config.defaultFps, orphanedSubtitlesFps, addDebugInfo]);

  // Apply default translator to all subtitles
  const applyDefaultTranslatorToAllSubtitles = useCallback((defaultTranslator) => {
    const allSubtitlePaths = [];
    
    // Collect all subtitle paths from paired files
    pairedFiles.forEach(pair => {
      if (pair.subtitles && pair.subtitles.length > 0) {
        pair.subtitles.forEach(subtitle => {
          allSubtitlePaths.push(subtitle.fullPath);
        });
      }
    });
    
    // Add orphaned subtitles
    orphanedSubtitles.forEach(subtitle => {
      allSubtitlePaths.push(subtitle.fullPath);
    });
    
    // Update upload options for all subtitles
    if (allSubtitlePaths.length > 0) {
      setUploadOptions(prev => {
        const newOptions = { ...prev };
        allSubtitlePaths.forEach(path => {
          newOptions[path] = {
            ...newOptions[path],
            subtranslator: defaultTranslator
          };
        });
        return newOptions;
      });
      
      addDebugInfo(`Applied default translator "${defaultTranslator}" to ${allSubtitlePaths.length} subtitles`);
    }
  }, [pairedFiles, orphanedSubtitles, addDebugInfo]);

  // Config handlers (moved after all required variables are defined)
  const handleConfigChange = useCallback((newConfig) => {
    const oldConfig = config;
    setConfig(newConfig);
    addDebugInfo(`Config updated: ${JSON.stringify(newConfig)}`);
    
    // Apply global comment to all existing subtitles if it changed
    if (oldConfig.globalComment !== newConfig.globalComment) {
      applyGlobalCommentToAllSubtitles(newConfig.globalComment);
    }
    
    // Apply default language to all existing subtitles if it changed
    if (oldConfig.defaultLanguage !== newConfig.defaultLanguage) {
      applyDefaultLanguageToAllSubtitles(newConfig.defaultLanguage);
    }
    
    // Apply default FPS to all existing orphaned subtitles if it changed
    if (oldConfig.defaultFps !== newConfig.defaultFps) {
      applyDefaultFpsToOrphanedSubtitles(newConfig.defaultFps);
    }
    
    // Apply default translator to all existing subtitles if it changed
    if (oldConfig.defaultTranslator !== newConfig.defaultTranslator) {
      applyDefaultTranslatorToAllSubtitles(newConfig.defaultTranslator);
    }
  }, [addDebugInfo, config, applyGlobalCommentToAllSubtitles, applyDefaultLanguageToAllSubtitles, applyDefaultFpsToOrphanedSubtitles, applyDefaultTranslatorToAllSubtitles]);

  // Handle subtitle upload toggle
  const handleSubtitleUploadToggle = useCallback((subtitlePath, enabled) => {
    console.log(`🔄 DEBUG handleSubtitleUploadToggle called:`);
    console.log(`   - subtitlePath: "${subtitlePath}"`);
    console.log(`   - enabled: ${enabled}`);
    console.log(`   - Previous uploadStates:`, uploadStates);
    
    setUploadStates(prev => {
      const newStates = {
        ...prev,
        [subtitlePath]: enabled
      };
      console.log(`   - New uploadStates:`, newStates);
      return newStates;
    });
    addDebugInfo(`Upload ${enabled ? 'enabled' : 'disabled'} for: ${subtitlePath}`);
  }, [addDebugInfo, uploadStates]);

  // Handle upload options update
  const handleUploadOptionsUpdate = useCallback((subtitlePath, options) => {
    console.log(`🔧 DEBUG handleUploadOptionsUpdate called:`);
    console.log(`   - subtitlePath: "${subtitlePath}"`);
    console.log(`   - options:`, options);
    console.log(`   - options.foreignpartsonly: ${options.foreignpartsonly}`);
    console.log(`   - Previous uploadOptions:`, uploadOptions);
    
    setUploadOptions(prev => {
      const newOptions = {
        ...prev,
        [subtitlePath]: {
          ...(prev[subtitlePath] || {}), // Merge with existing options for this subtitle
          ...options                     // Add/overwrite with new options
        }
      };
      console.log(`   - New uploadOptions:`, newOptions);
      return newOptions;
    });
    addDebugInfo(`Upload options updated for: ${subtitlePath}`);
  }, [addDebugInfo, uploadOptions]);

  // Handle orphaned subtitles FPS change
  const handleOrphanedSubtitlesFpsChange = useCallback((subtitlePath, fps) => {
    setOrphanedSubtitlesFps(prev => ({
      ...prev,
      [subtitlePath]: fps
    }));
  }, []);

  // Get upload status for subtitle (default to true, but automatically disable invalid files)
  const getUploadEnabled = useCallback((subtitlePath) => {
    // Find the subtitle file to check its size
    const subtitle = [...files, ...orphanedSubtitles].find(file => file.fullPath === subtitlePath);
    
    if (!subtitle) {
      return uploadStates[subtitlePath] !== false;
    }
    
    // Automatically disable empty files (0 bytes)
    if (subtitle.size === 0) {
      return false;
    }
    
    // Check for small files (less than 512 bytes) not marked as foreign parts only
    // This matches backend validation: strlen($subtitle['subcontent']) < 512
    // Using file size as approximation since we can't read content synchronously
    if (subtitle.size < 512) {
      const options = uploadOptions[subtitlePath] || {};
      const isForeignPartsOnly = options.foreignpartsonly === '1';
      
      if (!isForeignPartsOnly) {
        return false; // Disable small files that aren't foreign parts only
      }
    }
    
    return uploadStates[subtitlePath] !== false; // Default to true unless explicitly set to false
  }, [uploadStates, files, orphanedSubtitles, uploadOptions]);

  // Handle upload action
  const handleUpload = useCallback(async (validationResult) => {
    addDebugInfo(`🚀 Starting upload of ${validationResult.readySubtitlesCount} subtitles`);
    
    // Set initial upload progress state
    setTimeout(() => {
      setUploadProgress({ 
        isUploading: true,
        isComplete: false,
        processed: 0, 
        total: validationResult.readySubtitlesCount,
        successful: 0,
        alreadyExists: 0,
        failed: 0,
        currentSubtitle: '',
        results: []
      });
    }, 0);
    
    try {
      const uploadResults = await SubtitleUploadService.processUpload({
        validationResult,
        pairedFiles,
        orphanedSubtitles,
        movieGuesses,
        featuresByImdbId,
        guessItData,
        getSubtitleLanguage,
        getUploadEnabled,
        uploadOptions,
        combinedLanguages,
        addDebugInfo,
        orphanedSubtitlesFps,
        onProgress: (processed, total, details = {}) => {
          setTimeout(() => {
            setUploadProgress(prev => ({ 
              ...prev,
              isUploading: true, 
              processed, 
              total,
              currentSubtitle: details.currentSubtitle || prev.currentSubtitle,
              successful: details.successful !== undefined ? details.successful : prev.successful,
              alreadyExists: details.alreadyExists !== undefined ? details.alreadyExists : prev.alreadyExists,
              failed: details.failed !== undefined ? details.failed : prev.failed,
              results: details.results || prev.results
            }));
          }, 0);
        },
        getVideoMetadata,
        config
      });

      // Process upload results and update state
      const newUploadResults = {};
      const newSubcontentData = {};
      
      uploadResults.success.forEach(videoResult => {
        if (videoResult.results) {
          videoResult.results.forEach(subtitleResult => {
            newUploadResults[subtitleResult.subtitlePath] = subtitleResult.response;
            // Store the exact subcontent that was sent to server
            if (subtitleResult.subcontent) {
              newSubcontentData[subtitleResult.subtitlePath] = subtitleResult.subcontent;
            }
          });
        }
      });
      
      // Defer state updates to avoid setState during render warnings
      setTimeout(() => {
        setUploadResults(newUploadResults);
        setSubcontentData(newSubcontentData);
      }, 0);

      // Log results to debug panel
      addDebugInfo('📊 UPLOAD RESULTS SUMMARY:');
      addDebugInfo(`✅ Successful uploads: ${uploadResults.success.length}`);
      addDebugInfo(`❌ Failed uploads: ${uploadResults.errors.length}`);
      addDebugInfo(`📈 Success rate: ${uploadResults.processedSubtitles}/${uploadResults.totalSubtitles} subtitles`);
      
      if (uploadResults.success.length > 0) {
        addDebugInfo('');
        addDebugInfo('🎉 SUCCESSFUL UPLOADS:');
        uploadResults.success.forEach((result, index) => {
          addDebugInfo(`${index + 1}. ${result.video} (${result.subtitles} subtitles)`);
          if (result.results) {
            result.results.forEach(subtitleResult => {
              const response = subtitleResult.response;
              
              // Check for error responses first
              if (response.status && response.status !== '200 OK') {
                addDebugInfo(`   - ${subtitleResult.subtitle}: ❌ Upload failed - ${response.status}`);
              } else if (response.alreadyindb === 1 || response.alreadyindb === '1') {
                // When alreadyindb=1, subtitle already exists in database (duplicate)
                const subtitleUrl = response.data;
                if (subtitleUrl && typeof subtitleUrl === 'string' && subtitleUrl.startsWith('http')) {
                  addDebugInfo(`   - ${subtitleResult.subtitle}: ⚠️ Duplicate found`);
                  addDebugInfo(`     🔗 View existing at: ${subtitleUrl}`);
                } else {
                  addDebugInfo(`   - ${subtitleResult.subtitle}: ⚠️ Duplicate found (ID: ${subtitleUrl})`);
                }
              } else if (response.alreadyindb === 0 || response.alreadyindb === '0') {
                // When alreadyindb=0, subtitle not uploaded yet, but found existing match
                const subtitleData = Array.isArray(response.data) ? response.data[0] : null;
                const subtitleId = subtitleData?.IDSubtitle;
                addDebugInfo(`   - ${subtitleResult.subtitle}: Not uploaded, uploading... (Found existing: ${subtitleId})`);
              } else if (response.status === '200 OK' && response.data && !response.alreadyindb) {
                // Successful new upload response (from UploadSubtitles)
                if (typeof response.data === 'string' && response.data.startsWith('http')) {
                  addDebugInfo(`   - ${subtitleResult.subtitle}: 🎉 Successfully uploaded as NEW subtitle!`);
                  addDebugInfo(`     🔗 View at: ${response.data}`);
                } else {
                  addDebugInfo(`   - ${subtitleResult.subtitle}: 🎉 Successfully uploaded as NEW subtitle!`);
                  addDebugInfo(`     📊 Response: ${JSON.stringify(response, null, 2)}`);
                }
              } else {
                // For other cases
                const subtitleId = typeof response.data === 'object' ? response.data?.IDSubtitle : response.data;
                addDebugInfo(`   - ${subtitleResult.subtitle}: Upload result (ID: ${subtitleId})`);
              }
            });
          }
        });
      }
      
      if (uploadResults.errors.length > 0) {
        addDebugInfo('');
        addDebugInfo('💥 FAILED UPLOADS:');
        uploadResults.errors.forEach((error, index) => {
          addDebugInfo(`${index + 1}. ${error.video || 'Unknown'}: ${error.error || error.message}`);
        });
      }
      
    } catch (error) {
      addDebugInfo(`💥 Upload process failed: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      // Mark upload as complete
      setTimeout(() => {
        setUploadProgress(prev => ({ 
          ...prev,
          isUploading: false,
          isComplete: true,
          // Ensure processed equals total for completion detection
          processed: prev.total || prev.processed
        }));
      }, 0);
    }
  }, [addDebugInfo, pairedFiles, orphanedSubtitles, movieGuesses, featuresByImdbId, guessItData, getSubtitleLanguage, getUploadEnabled, combinedLanguages]);

  // Handle movie change when user selects a different movie
  const handleMovieChange = async (videoPath, newMovieGuess) => {
    try {
      addDebugInfo(`Updating movie for ${videoPath}: ${newMovieGuess.title} (${newMovieGuess.imdbid})`);
      
      // Update the movie guess immediately (setTimeout removed - debug mode issues fixed)
      setMovieGuess(videoPath, newMovieGuess);
      
      // Fetch new features data for the new IMDb ID
      if (newMovieGuess.imdbid) {
        addDebugInfo(`Fetching features for new IMDb ID: ${newMovieGuess.imdbid}`);
        await fetchFeaturesByImdbId(newMovieGuess.imdbid);
        addDebugInfo(`Features fetched successfully for IMDb ID: ${newMovieGuess.imdbid}`);
      }
      
    } catch (error) {
      addDebugInfo(`Error updating movie: ${error.message}`);
      throw error;
    }
  };

  // Handle file selection from button
  const handleFileSelect = async (event) => {
    try {
      // If files have already been selected, prevent and refresh page
      // if (hasDroppedFiles) {
      //   event.preventDefault();
      //   window.location.reload();
      //   return;
      // }
      
      setError(null);
      
      // Mark that files have been selected
      setHasDroppedFiles(true);
      
      const selectedFiles = Array.from(event.target.files);
      
      if (selectedFiles.length === 0) {
        setHasDroppedFiles(false);
        return;
      }
      
      addDebugInfo(`🔄 ${selectedFiles.length} files selected via file input - adding to existing files...`);
      
      // Only clear states that need to be reset when adding new files
      // Don't clear everything - preserve existing files and their state
      setUploadResults({}); // Clear upload results for new upload session
      setPreviewSubtitle(null); // Clear preview
      setSubtitleContent(''); // Clear subtitle content
      
      // Reset upload progress only if not currently uploading
      if (!uploadProgress.isUploading) {
        setUploadProgress({ 
          isUploading: false,
          isComplete: false,
          processed: 0, 
          total: 0,
          successful: 0,
          alreadyExists: 0,
          failed: 0,
          currentSubtitle: '',
          results: []
        });
      }
      
      // Process selected files similar to FileProcessingService
      const processedFiles = [];
      
      for (const file of selectedFiles) {
        // Check if it's an archive file and extract contents
        const { isArchiveFile } = await import('../utils/fileUtils.js');
        if (isArchiveFile(file)) {
          try {
            addDebugInfo(`📦 Processing archive file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            const { ZipProcessingService } = await import('../services/zipProcessing.js');
            
            // Validate archive file size before processing
            const sizeValidation = ZipProcessingService.validateArchiveSize(file);
            if (!sizeValidation.isValid) {
              addDebugInfo(`❌ Archive file size validation failed: ${sizeValidation.error}`);
              setError(sizeValidation.error);
              setHasDroppedFiles(false);
              return;
            }
            
            const extractedFiles = await ZipProcessingService.processArchiveFile(file);
            addDebugInfo(`📦 Extracted ${extractedFiles.length} files from ${file.name}`);
            processedFiles.push(...extractedFiles);
            continue;
          } catch (error) {
            addDebugInfo(`❌ Error processing archive file ${file.name}: ${error.message}`);
            setError(`Error processing archive file ${file.name}: ${error.message}`);
            console.error(`Error processing archive file ${file.name}:`, error);
            setHasDroppedFiles(false);
            return;
          }
        }
        
        const isVideo = file.name.match(/\.(mp4|mkv|avi|mov|webm|flv|wmv|mpeg|mpg|ts|m2ts|mts|f4v|ogv|ogg|amv|nsv|yuv|nut|nuv|wtv|tivo|ty)$/i);
        const isSubtitle = file.name.match(/\.(srt|vtt|ass|ssa|sub|txt|smi|mpl|tmp)$/i);
        
        const processedFile = {
          file: file,
          fullPath: file.name,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          isVideo: isVideo,
          isSubtitle: isSubtitle,
          movieHash: null,
          detectedLanguage: null,
          recognized: true
        };
        
        // Debug MKV detection for file selection
        if (file.name.toLowerCase().endsWith('.mkv')) {
          console.log(`🔍 MKV file detected via file selection: ${file.name}`);
          addDebugInfo(`🔍 MKV file detected via file selection: ${file.name}`);
          
          if (isVideo) {
            // Check if MKV extraction is enabled in config (default: false)
            const extractMkvSubtitles = config.extractMkvSubtitles === true;
            
            if (extractMkvSubtitles) {
              // Mark this MKV file for subtitle extraction
              processedFile.hasMkvSubtitleExtraction = true;
              processedFile.mkvExtractionStatus = 'pending';
              
              console.log(`🎬 Detected MKV file via file selection: ${file.name}, will detect embedded subtitles...`);
              addDebugInfo(`🎬 MKV file detected: ${file.name}`);
              addDebugInfo(`📺 Subtitle detection will start automatically for this MKV file`);
            } else {
              console.log(`⚠️ MKV file ${file.name} detected but extraction is disabled in settings`);
              addDebugInfo(`⚠️ MKV file ${file.name} detected but extraction is disabled in settings`);
            }
          } else {
            console.log(`⚠️ MKV file ${file.name} not flagged for extraction: isVideo=${isVideo}`);
            addDebugInfo(`⚠️ MKV file ${file.name} not flagged for extraction: isVideo=${isVideo}`);
          }
        }
        
        // Only add valid media files
        if (processedFile.isVideo || processedFile.isSubtitle) {
          processedFiles.push(processedFile);
        }
      }
      
      addDebugInfo(`📁 Processed ${processedFiles.length} valid media files from file selection`);
      
      if (processedFiles.length > 0) {
        // Add new files to existing files instead of replacing them
        setFiles(prevFiles => {
          // Filter out duplicates based on fullPath and size
          const existingFilePaths = new Set(prevFiles.map(f => f.fullPath + '|' + f.size));
          const newFiles = processedFiles.filter(f => !existingFilePaths.has(f.fullPath + '|' + f.size));
          const duplicateCount = processedFiles.length - newFiles.length;
          
          if (duplicateCount > 0) {
            addDebugInfo(`📁 Skipped ${duplicateCount} duplicate files`);
            showNotification(
              `${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''} ${duplicateCount > 1 ? 'were' : 'was'} skipped (already added)`,
              'info',
              4000
            );
          }
          
          const combinedFiles = [...prevFiles, ...newFiles];
          addDebugInfo(`📁 Total files after adding: ${combinedFiles.length} (${prevFiles.length} existing + ${newFiles.length} new)`);
          
          // Show success notification for new files added
          if (newFiles.length > 0) {
            showNotification(
              `${newFiles.length} new file${newFiles.length > 1 ? 's' : ''} added successfully`,
              'info',
              3000
            );
          }
          
          // Process MKV files for subtitle detection and auto-extraction from new files
          const mkvFilesInNewFiles = newFiles.filter(file => file.hasMkvSubtitleExtraction);
          if (mkvFilesInNewFiles.length > 0) {
            addDebugInfo(`🎬 Starting MKV subtitle detection and auto-extraction for ${mkvFilesInNewFiles.length} file(s) from file selection`);
            
            // Start MKV detection and auto-extraction process asynchronously
            setTimeout(async () => {
              try {
                const { FileProcessingService } = await import('../services/fileProcessing.js');
                await FileProcessingService.processMkvExtractions(
                  mkvFilesInNewFiles,
                  // onFileUpdate callback
                  (filePath, updates) => {
                    setFiles(prevFiles => 
                      prevFiles.map(file => 
                        file.fullPath === filePath ? { ...file, ...updates } : file
                      )
                    );
                    if (updates.mkvExtractionStatus === 'extracting_all' && updates.extractedCount !== undefined) {
                      addDebugInfo(`MKV extraction progress: ${updates.extractedCount}/${updates.streamCount} subtitles extracted`);
                    } else {
                      addDebugInfo(`MKV status update: ${updates.mkvExtractionStatus}`);
                    }
                  },
                  // onSubtitleExtracted callback
                  (subtitleFile) => {
                    setFiles(prevFiles => [...prevFiles, subtitleFile]);
                    addDebugInfo(`Auto-extracted and paired: ${subtitleFile.name} (${subtitleFile.language}) from ${subtitleFile.originalMkvFile}`);
                  },
                  // addDebugInfo callback
                  addDebugInfo,
                  // config parameter
                  config
                );
              } catch (error) {
                console.error('MKV processing failed:', error);
                addDebugInfo(`MKV processing failed: ${error.message}`);
              }
            }, 100); // Small delay to ensure UI updates first
          }
          
          return combinedFiles;
        });
      } else {
        addDebugInfo('⚠️ No valid media files found in selection');
        setError('No valid video or subtitle files found. Please select .mp4, .mkv, .avi, .srt, .vtt, .ass files, archives (.zip, .rar, .7z, .tar, etc.), etc.');
        // Don't set hasDroppedFiles to false if we already have files
        if (files.length === 0) {
          setHasDroppedFiles(false);
        }
      }
      
      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      addDebugInfo(`❌ Error processing selected files: ${error.message}`);
      setError(`Error processing files: ${error.message}`);
      setHasDroppedFiles(false);
      throw error;
    }
  };

  // Handle file drop with processing
  const handleFileDropComplete = async (event) => {
    try {
      // If files have already been dropped, prevent default behavior and refresh page immediately
      // if (hasDroppedFiles) {
      //   event.preventDefault();
      //   event.stopPropagation();
      //   window.location.reload();
      //   return;
      // }
      
      setError(null);
      
      // Mark that files have been dropped
      setHasDroppedFiles(true);
      
      addDebugInfo('🔄 New files dropped - clearing ALL previous state...');
      
      // Clear all hook state completely (this will reset everything)
      clearAllState(); // Movie guesses, features, processing state
      clearAllGuessItState(); // GuessIt data and processing state
      clearAllLanguageState(); // Language detection processing state
      clearSubtitleLanguages(); // Subtitle language selections
      clearHashCheckResults(); // Clear CheckSubHash results
      clearAllVideoMetadata(); // Clear video metadata
      
      // Reset all UI state when new files are dropped
      setUploadResults({}); // Clear previous upload results
      setSubcontentData({}); // Clear previous subcontent data
      setUploadStates({}); // Reset upload enable/disable states
      setUploadOptions({}); // Reset upload options states
      setOpenDropdowns({}); // Close any open dropdowns
      setDropdownSearch({}); // Clear dropdown search states
      setPreviewSubtitle(null); // Close any preview
      setSubtitleContent('');
      
      // Clear processing state tracking
      processedFilesSet.current.clear();
      
      // Force useEffect to re-run by changing the reset key
      setStateResetKey(prev => prev + 1);
      
      addDebugInfo('✅ ALL previous state cleared completely, processing new files...');
      
      // Initialize progress tracking for file discovery
      initializeProgress(0); // Will be updated when files are counted
      updateProgress({ fileDiscovery: 1, fileDiscoveryTotal: 1 });
      
      // Now handle the new files
      await handleDrop(event);
      
      
    } catch (err) {
      setError(err.message);
      addDebugInfo(`Drop error: ${err.message}`);
      // Reset progress on error
      cancelProgress();
    }
  };

  // Process video files when files change
  useEffect(() => {
    if (files.length === 0) {
      // Clear processed files tracking when no files
      processedFilesSet.current.clear();
      return;
    }

    const videoFiles = files.filter(file => file.isVideo && !file.shouldRemove);
    const subtitleFiles = files.filter(file => file.isSubtitle && !file.shouldRemove);

    // Initialize progress tracking with correct totals
    if (files.length > 0 && processingProgress.isProcessing && processingProgress.totalFiles === 0) {
      // Count unique directories from file paths
      const directorySet = new Set();
      files.forEach(file => {
        const directory = file.fullPath.includes('/') ? 
          file.fullPath.substring(0, file.fullPath.lastIndexOf('/')) : 'Root';
        directorySet.add(directory);
      });
      const directoriesCount = directorySet.size;
      
      addDebugInfo(`📊 Initializing progress: ${files.length} files (${videoFiles.length} videos, ${subtitleFiles.length} subtitles) from ${directoriesCount} directories`);
      updateProgress({
        totalFiles: files.length,
        fileDiscovery: 1,
        fileDiscoveryTotal: 1,
        directoriesProcessed: directoriesCount,
        videoProcessingTotal: videoFiles.length,
        subtitleProcessingTotal: subtitleFiles.length,
        languageDetectionTotal: subtitleFiles.length
      });
    }

    addDebugInfo(`🔄 Processing: ${files.length} files (reset: ${stateResetKey})`);
    addDebugInfo(`📁 ${videoFiles.length} videos, ${subtitleFiles.length} subtitles`);
    
    // Log all file paths for debugging
    if (videoFiles.length > 0) {
      addDebugInfo(`🎥 Video files: ${videoFiles.map(f => f.name).join(', ')}`);
    }
    if (subtitleFiles.length > 0) {
      addDebugInfo(`📝 Subtitle files: ${subtitleFiles.map(f => f.name).join(', ')}`);
      
      // Process subtitle files for CheckSubHash
      processSubtitleHashes(subtitleFiles);
    }

    // Process video files for hashes, file info, and movie guessing
    videoFiles.forEach(async (videoFile, index) => {
      const fileId = `${videoFile.fullPath}_${videoFile.size}`;
      
      // Skip if already processed
      if (processedFilesSet.current.has(fileId)) {
        addDebugInfo(`⏭️ Skipping already processed video: ${videoFile.name}`);
        return;
      }
      
      // Mark as processing immediately
      processedFilesSet.current.add(fileId);
      addDebugInfo(`🎬 Starting processing video file: ${videoFile.name}`);
      
      
      try {
        addDebugInfo(`Processing video ${index + 1}/${videoFiles.length}: ${videoFile.name}`);
        
        // Add file type info immediately
        const fileInfo = detectVideoFileInfo(videoFile.file);
        updateFile(videoFile.fullPath, { 
          file_type: fileInfo.file_type, 
          file_kind: fileInfo.file_kind 
        });
        
        // Calculate movie hash with timeout and retry
        try {
          addDebugInfo(`Starting hash calculation for ${videoFile.name} (${formatFileSize(videoFile.size)})`);
          
          const hash = await MovieHashService.calculateMovieHashWithRetry(videoFile.file, addDebugInfo);
          
          addDebugInfo(`Hash calculated: ${hash}`);
          updateFile(videoFile.fullPath, { movieHash: hash });
          
          // Update video processing progress
          updateProgress(prev => {
            const newVideoProgress = prev.videoProcessing + 1;
            const newProcessedFiles = prev.processedFiles + 1;
            addDebugInfo(`📊 Video progress: ${newVideoProgress}/${prev.videoProcessingTotal}`);
            return {
              videoProcessing: newVideoProgress,
              processedFiles: newProcessedFiles
            };
          });
          
        } catch (hashError) {
          console.error(`Hash calculation error for ${videoFile.name}:`, hashError);
          updateFile(videoFile.fullPath, { movieHash: 'error' });
          addDebugInfo(`Hash calculation failed: ${hashError.message}`);
          
          // Update progress with error
          updateProgress(prev => {
            const newVideoProgress = prev.videoProcessing + 1;
            const newProcessedFiles = prev.processedFiles + 1;
            const newErrors = prev.errors + 1;
            addDebugInfo(`📊 Video progress (error): ${newVideoProgress}/${prev.videoProcessingTotal}`);
            return {
              videoProcessing: newVideoProgress,
              processedFiles: newProcessedFiles,
              errors: newErrors
            };
          });
        }

        // Extract video metadata (FPS, duration, etc.) for upload parameters
        try {
          addDebugInfo(`🎬 Extracting video metadata for ${videoFile.name}`);
          await extractVideoMetadata(videoFile.file, videoFile.fullPath);
          addDebugInfo(`✅ Video metadata extracted successfully for ${videoFile.name}`);
        } catch (metadataError) {
          console.error(`Video metadata extraction error for ${videoFile.name}:`, metadataError);
          addDebugInfo(`❌ Video metadata extraction failed: ${metadataError.message}`);
        }

        // Check if movie guess is needed
        const status = getProcessingStatus(videoFile.fullPath);
        if (!status.isProcessing && !status.isComplete && !status.hasFailed) {
          const delay = 1000 + index * 500;
          
          setTimeout(() => {
            const currentStatus = getProcessingStatus(videoFile.fullPath);
            if (!currentStatus.isProcessing && !currentStatus.isComplete) {
              processMovieGuess(videoFile).catch(error => {
                addDebugInfo(`Movie guess failed: ${error.message}`);
              });
            }
          }, delay);
        }

        // GuessIt processing will be handled automatically when movie guess completes
        // via the useEffect that watches movieGuesses changes
        
      } catch (error) {
        addDebugInfo(`Failed to process ${videoFile.name}: ${error.message}`);
        updateFile(videoFile.fullPath, { movieHash: 'error' });
        processedFilesSet.current.delete(fileId);
        
      }
    });

    // Process subtitle files for language detection
    subtitleFiles.forEach(async (subtitleFile, index) => {
      const fileId = `${subtitleFile.fullPath}_${subtitleFile.size}_lang`;
      
      // Skip if already processed
      if (processedFilesSet.current.has(fileId)) {
        addDebugInfo(`⏭️ Skipping already processed subtitle: ${subtitleFile.name}`);
        return;
      }
      
      addDebugInfo(`💬 Starting processing subtitle file: ${subtitleFile.name}`);
      
      // Skip language detection for files that have been pre-classified as non-subtitles
      if (subtitleFile.detectedLanguage && 
          typeof subtitleFile.detectedLanguage === 'object' && 
          subtitleFile.detectedLanguage.file_kind && 
          subtitleFile.detectedLanguage.file_kind === 'Unknown text file') {
        addDebugInfo(`Skipping language detection for ${subtitleFile.name} - already classified as ${subtitleFile.detectedLanguage.file_kind}`);
        return;
      }
      
      // Check if language detection is needed
      const status = getLanguageProcessingStatus(subtitleFile.fullPath);
      if (status.isProcessing || status.hasFailed) {
        return;
      }
      
      // Check if already has language detection result
      if (subtitleFile.detectedLanguage && 
          typeof subtitleFile.detectedLanguage === 'object' && 
          subtitleFile.detectedLanguage.language_code) {
        return;
      }
      
      processedFilesSet.current.add(fileId);
      
      
      const delay = 2000 + index * 500;
      
      setTimeout(() => {
        const currentStatus = getLanguageProcessingStatus(subtitleFile.fullPath);
        if (!currentStatus.isProcessing) {
          // Check if default language is set in config
          if (config.defaultLanguage) {
            addDebugInfo(`🔧 Using default language ${config.defaultLanguage} for ${subtitleFile.name} - skipping detection`);
            
            // Set the default language directly
            const defaultLangInfo = combinedLanguages[config.defaultLanguage];
            if (defaultLangInfo) {
              updateFile(subtitleFile.fullPath, {
                detectedLanguage: {
                  language_code: config.defaultLanguage,
                  confidence: 1.0,
                  all_languages: [{
                    language_code: config.defaultLanguage,
                    confidence: 1.0
                  }],
                  source: 'config-default'
                }
              });
              
              // Update progress for successful processing
              updateProgress(prev => {
                addDebugInfo(`📊 Subtitle progress: ${prev.subtitleProcessing + 1}/${prev.subtitleProcessingTotal} (default language)`);
                return {
                  subtitleProcessing: prev.subtitleProcessing + 1,
                  languageDetection: prev.languageDetection + 1,
                  processedFiles: prev.processedFiles + 1
                };
              });
            } else {
              addDebugInfo(`❌ Default language ${config.defaultLanguage} not found in language data`);
              // Fall back to normal detection
              processLanguageDetection(subtitleFile).then(() => {
                // Same logic as below...
                const updatedFile = files.find(f => f.fullPath === subtitleFile.fullPath);
                if (updatedFile?.shouldRemove) {
                  setFiles(prevFiles => 
                    prevFiles.filter(file => file.fullPath !== subtitleFile.fullPath)
                  );
                  addDebugInfo(`Removed ${subtitleFile.name} - not a subtitle file`);
                  
                  updateProgress(prev => ({
                    subtitleProcessing: prev.subtitleProcessing + 1,
                    languageDetection: prev.languageDetection + 1,
                    processedFiles: prev.processedFiles + 1,
                    skipped: prev.skipped + 1
                  }));
                } else {
                  updateProgress(prev => {
                    addDebugInfo(`📊 Subtitle progress: ${prev.subtitleProcessing + 1}/${prev.subtitleProcessingTotal}`);
                    return {
                      subtitleProcessing: prev.subtitleProcessing + 1,
                      languageDetection: prev.languageDetection + 1,
                      processedFiles: prev.processedFiles + 1
                    };
                  });
                }
              }).catch(error => {
                addDebugInfo(`Language detection failed: ${error.message}`);
                processedFilesSet.current.delete(fileId);
                
                updateProgress(prev => ({
                  subtitleProcessing: prev.subtitleProcessing + 1,
                  languageDetection: prev.languageDetection + 1,
                  processedFiles: prev.processedFiles + 1,
                  errors: prev.errors + 1
                }));
              });
            }
          } else {
            // Use normal language detection
            processLanguageDetection(subtitleFile).then(() => {
              // Check if file should be removed (detected as non-subtitle)
              const updatedFile = files.find(f => f.fullPath === subtitleFile.fullPath);
              if (updatedFile?.shouldRemove) {
                setFiles(prevFiles => 
                  prevFiles.filter(file => file.fullPath !== subtitleFile.fullPath)
                );
                addDebugInfo(`Removed ${subtitleFile.name} - not a subtitle file`);
                
                // Update progress with skipped file
                updateProgress(prev => ({
                  subtitleProcessing: prev.subtitleProcessing + 1,
                  languageDetection: prev.languageDetection + 1,
                  processedFiles: prev.processedFiles + 1,
                  skipped: prev.skipped + 1
                }));
              } else {
                // Update progress for successful processing
                updateProgress(prev => {
                  addDebugInfo(`📊 Subtitle progress: ${prev.subtitleProcessing + 1}/${prev.subtitleProcessingTotal}`);
                  return {
                    subtitleProcessing: prev.subtitleProcessing + 1,
                    languageDetection: prev.languageDetection + 1,
                    processedFiles: prev.processedFiles + 1
                  };
                });
              }
              
              // Note: Already marked as processed when processing started
            }).catch(error => {
              addDebugInfo(`Language detection failed: ${error.message}`);
              processedFilesSet.current.delete(fileId);
              
              // Update progress with error
              updateProgress(prev => ({
                subtitleProcessing: prev.subtitleProcessing + 1,
                languageDetection: prev.languageDetection + 1,
                processedFiles: prev.processedFiles + 1,
                errors: prev.errors + 1
              }));
            });
          }
        }
      }, delay);
    });

    // Process orphaned subtitles for movie guessing
    const orphanedSubtitles = subtitleFiles.filter(subtitle => {
      // Check if this subtitle has a matching video file
      const subtitleBaseName = subtitle.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const subtitleDir = subtitle.fullPath.includes('/') ? 
        subtitle.fullPath.substring(0, subtitle.fullPath.lastIndexOf('/')) : 'Root';
      
      // Look for matching video in same directory
      const hasMatchingVideo = videoFiles.some(video => {
        const videoBaseName = video.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const videoDir = video.fullPath.includes('/') ? 
          video.fullPath.substring(0, video.fullPath.lastIndexOf('/')) : 'Root';
        
        return videoDir === subtitleDir && (
          videoBaseName === subtitleBaseName || 
          subtitleBaseName.startsWith(videoBaseName + '.')
        );
      });
      
      return !hasMatchingVideo;
    });

    // Process movie guessing for orphaned subtitles
    orphanedSubtitles.forEach(async (subtitleFile, index) => {
      const fileId = `${subtitleFile.fullPath}_${subtitleFile.size}_movie`;
      
      // Skip if already processed
      if (processedFilesSet.current.has(fileId)) {
        return;
      }
      
      // Check if we can reuse movie identification from a video file in the same directory
      const subtitleDir = subtitleFile.fullPath.includes('/') ? 
        subtitleFile.fullPath.substring(0, subtitleFile.fullPath.lastIndexOf('/')) : 'Root';
      
      // Look for existing movie data from video files in the same directory
      const existingMovieData = Object.entries(movieGuesses).find(([videoPath, movieData]) => {
        if (movieData && typeof movieData === 'object' && movieData.imdbid) {
          const videoDir = videoPath.includes('/') ? 
            videoPath.substring(0, videoPath.lastIndexOf('/')) : 'Root';
          return videoDir === subtitleDir;
        }
        return false;
      });
      
      if (existingMovieData) {
        const [videoPath, movieData] = existingMovieData;
        const videoFileName = videoPath.split('/').pop();
        addDebugInfo(`🔄 Reusing movie identification for orphaned subtitle ${subtitleFile.name} from video ${videoFileName}: ${movieData.title} (${movieData.year})`);
        
        // Set the movie data for this orphaned subtitle
        setMovieGuess(subtitleFile.fullPath, {
          ...movieData,
          reason: `Reused from video: ${videoFileName}`
        });
        
        processedFilesSet.current.add(fileId);
        return;
      }
      
      // Check if movie guess is needed
      const status = getProcessingStatus(subtitleFile.fullPath);
      if (!status.isProcessing && !status.isComplete && !status.hasFailed) {
        processedFilesSet.current.add(fileId);
        
        const delay = 3000 + index * 500; // Start after language detection
        
        setTimeout(() => {
          const currentStatus = getProcessingStatus(subtitleFile.fullPath);
          if (!currentStatus.isProcessing && !currentStatus.isComplete) {
            processSubtitleMovieGuess(subtitleFile).catch(error => {
              addDebugInfo(`Orphaned subtitle movie guess failed: ${error.message}`);
              processedFilesSet.current.delete(fileId);
            });
          }
        }, delay);
      }
    });

    if (orphanedSubtitles.length > 0) {
      addDebugInfo(`📝 Found ${orphanedSubtitles.length} orphaned subtitles - starting movie identification`);
    }

  }, [files.length, stateResetKey, initializeProgress, updateProgress, processingProgress.isProcessing, config.defaultLanguage, combinedLanguages]);



  // Extract GuessIt data from movie guesses when they become available
  useEffect(() => {
    Object.entries(movieGuesses).forEach(([filePath, movieData]) => {
      // Check if this is a valid movie data object
      if (movieData && typeof movieData === 'object' && movieData !== 'guessing' && movieData !== 'error' && movieData !== 'no-match') {
        // Check if we don't already have GuessIt data for this file
        const currentGuessItStatus = getGuessItProcessingStatus(filePath);
        if (!currentGuessItStatus.isComplete && !currentGuessItStatus.isProcessing) {
          // Find the video file for this path
          const videoFile = files.find(f => f.fullPath === filePath && f.isVideo);
          if (videoFile) {
            if (movieData.guessit) {
              // Extract GuessIt data from XML-RPC response
              addDebugInfo(`Extracting GuessIt data from XML-RPC for: ${videoFile.name}`);
              extractGuessItFromMovieData(movieData, filePath, videoFile.name);
            } else {
              // No GuessIt data in XML-RPC response, use fallback API with delay
              addDebugInfo(`No GuessIt data in XML-RPC response for: ${videoFile.name}, using fallback API`);
              setTimeout(() => {
                const stillNeedGuessIt = getGuessItProcessingStatus(filePath);
                if (!stillNeedGuessIt.isComplete && !stillNeedGuessIt.isProcessing) {
                  processGuessIt(videoFile, movieGuesses).catch(error => {
                    addDebugInfo(`GuessIt fallback failed: ${error.message}`);
                  });
                }
              }, 500); // Small delay to avoid race conditions
            }
          }
        }
      }
    });
  }, [movieGuesses, extractGuessItFromMovieData, getGuessItProcessingStatus, processGuessIt, files, addDebugInfo]);

  // Process GuessIt data for orphaned subtitles
  useEffect(() => {
    orphanedSubtitles.forEach(async (subtitleFile) => {
      const filePath = subtitleFile.fullPath;
      const status = getGuessItProcessingStatus(filePath);
      
      // Skip if already processed or processing
      if (status.isComplete || status.isProcessing) {
        return;
      }
      
      try {
        // Get the best name for movie detection (use parent directory for generic names)
        const detectionName = getBestMovieDetectionName(subtitleFile);
        const originalName = subtitleFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
        
        // Log what name we're using for detection
        if (detectionName !== originalName) {
          addDebugInfo(`GuessIt using parent directory "${detectionName}" for generic subtitle "${originalName}"`);
        }
        
        // Create modified subtitle file with detection name (same as movie detection)
        const modifiedSubtitleFile = {
          ...subtitleFile,
          name: detectionName + '.srt', // Add .srt extension for processing
          detectionReason: detectionName !== originalName ? 'parent-directory' : 'filename'
        };
        
        // Process GuessIt data for orphaned subtitle using the same name logic as movie detection
        await processGuessIt(modifiedSubtitleFile, movieGuesses);
        addDebugInfo(`✅ GuessIt processing completed for orphaned subtitle: ${subtitleFile.name} (using: ${detectionName})`);
      } catch (error) {
        addDebugInfo(`❌ GuessIt processing failed for orphaned subtitle ${subtitleFile.name}: ${error.message}`);
      }
    });
  }, [orphanedSubtitles, getGuessItProcessingStatus, processGuessIt, movieGuesses, addDebugInfo]);

  // Handle subtitle preview
  const handleSubtitlePreview = async (subtitle) => {
    try {
      addDebugInfo(`Opening preview for: ${subtitle.name}`);
      setPreviewSubtitle(subtitle);
      
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(subtitle.file, 'utf-8');
      });
      
      setSubtitleContent(text);
      addDebugInfo(`Loaded ${text.length} characters for preview`);
    } catch (error) {
      addDebugInfo(`Error loading subtitle preview: ${error.message}`);
      setSubtitleContent('Error loading subtitle content.');
    }
  };

  const closeSubtitlePreview = () => {
    setPreviewSubtitle(null);
    setSubtitleContent('');
  };

  // Dropdown management
  const toggleDropdown = (subtitlePath) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [subtitlePath]: !prev[subtitlePath]
    }));
  };

  const handleDropdownSearch = (subtitlePath, searchTerm) => {
    setDropdownSearch(prev => ({
      ...prev,
      [subtitlePath]: searchTerm
    }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if any dropdowns are open
      const hasOpenDropdowns = Object.values(openDropdowns).some(isOpen => isOpen);
      if (!hasOpenDropdowns) return;

      // Close all dropdowns if clicking outside
      const isClickInsideDropdown = event.target.closest('[data-dropdown]');
      if (!isClickInsideDropdown) {
        setOpenDropdowns({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdowns]);

  // Clear all cache
  const clearAllCache = () => {
    const success = CacheService.clearAllCache();
    if (success) {
      addDebugInfo("All cache cleared from localStorage.");
      // Reset language data
      window.location.reload(); // Simple way to reset all state
    } else {
      addDebugInfo("Error clearing cache.");
    }
  };

  // Clear files and related state
  const handleClearFiles = () => {
    clearFiles();
    clearDebugInfo();
    setError(null);
    setPreviewSubtitle(null);
    setSubtitleContent('');
    setOpenDropdowns({});
    setDropdownSearch({});
    setUploadStates({}); // Clear upload states
    setUploadOptions({}); // Clear upload options
    setUploadResults({}); // Clear upload results
    setHasDroppedFiles(false); // Reset drop state to allow files to be dropped again
    setSubcontentData({}); // Clear subcontent data
    
    // Clear processing state
    processedFilesSet.current.clear();
    
    // Clear progress state
    cancelProgress();
    
    // Clear CheckSubHash results
    clearHashCheckResults();
    
    // Clear all processing states
    files.forEach(file => {
      clearProcessingState(file.fullPath);
      clearLanguageProcessingState(file.fullPath);
      clearGuessItProcessingState(file.fullPath);
    });
  };

  // Clean up processed files tracking when files are cleared
  useEffect(() => {
    if (files.length === 0) {
      processedFilesSet.current.clear();
    }
  }, [files.length]);

  // Auto-close progress overlay when processing is complete
  useEffect(() => {
    if (processingProgress.isProcessing && 
        processingProgress.processedFiles >= processingProgress.totalFiles && 
        processingProgress.totalFiles > 0) {
      // Check if all stages are complete
      const allStagesComplete = 
        processingProgress.fileDiscovery >= processingProgress.fileDiscoveryTotal &&
        (processingProgress.videoProcessingTotal === 0 || processingProgress.videoProcessing >= processingProgress.videoProcessingTotal) &&
        (processingProgress.subtitleProcessingTotal === 0 || processingProgress.subtitleProcessing >= processingProgress.subtitleProcessingTotal) &&
        (processingProgress.languageDetectionTotal === 0 || processingProgress.languageDetection >= processingProgress.languageDetectionTotal);
      
      if (allStagesComplete) {
        // Add a small delay to show completion, then close
        setTimeout(() => {
          finalizeProgress();
        }, 1500);
      }
    }
  }, [
    processingProgress.processedFiles, 
    processingProgress.totalFiles, 
    processingProgress.isProcessing,
    processingProgress.fileDiscovery,
    processingProgress.fileDiscoveryTotal,
    processingProgress.videoProcessing,
    processingProgress.videoProcessingTotal,
    processingProgress.subtitleProcessing,
    processingProgress.subtitleProcessingTotal,
    processingProgress.languageDetection,
    processingProgress.languageDetectionTotal,
    finalizeProgress
  ]);

  // Apply global comment to new subtitles when files change
  useEffect(() => {
    if (config.globalComment && (pairedFiles.length > 0 || orphanedSubtitles.length > 0)) {
      // Small delay to ensure files are processed first
      setTimeout(() => {
        applyGlobalCommentToAllSubtitles(config.globalComment);
      }, 100);
    }
  }, [pairedFiles.length, orphanedSubtitles.length, config.globalComment, applyGlobalCommentToAllSubtitles]);

  // Apply default translator to new subtitles when files change
  useEffect(() => {
    if (config.defaultTranslator && (pairedFiles.length > 0 || orphanedSubtitles.length > 0)) {
      // Small delay to ensure files are processed first
      setTimeout(() => {
        applyDefaultTranslatorToAllSubtitles(config.defaultTranslator);
      }, 100);
    }
  }, [pairedFiles.length, orphanedSubtitles.length, config.defaultTranslator, applyDefaultTranslatorToAllSubtitles]);


  // Filter successful pairs
  const successfulPairs = pairedFiles.filter(pair => pair.video && pair.subtitles.length > 0);
  
  const hasUploadableContent = successfulPairs.length > 0 || orphanedSubtitles.length > 0;

  // Auto-scroll to matched pairs section when content becomes available
  useEffect(() => {
    if (hasUploadableContent && matchedPairsRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        matchedPairsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 500);
    }
  }, [hasUploadableContent]);

  const hasUnpairedFiles = files.length > 0 && successfulPairs.length === 0;


  // Show loading screen until all WASM components are loaded
  if (wasmLoading || !wasmInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
            Loading Components
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={styles.background}>
      {/* Update Notification */}
      <UpdateNotification />
      
      {/* Unified API and Ad Blocker Warning */}
      <ApiHealthCheck onApiBlocked={(reason) => {
        addDebugInfo(`🚫 API blocked by ${reason}: Ad blocker or network issue detected`);
      }} />
      
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="border-b-4 shadow-sm mb-6 p-6" style={{...styles.card, borderBottomColor: colors.success}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a 
                href="https://www.opensubtitles.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
              >
                <img 
                  src={isDark ? logoDark : logoWhite}
                  alt="OpenSubtitles Logo" 
                  className="h-16 w-auto"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'block';
                  }}
                />
                <div className="text-4xl hidden" style={{display: 'none'}}>🎬</div>
              </a>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold" style={styles.text}>
                    OpenSubtitles Uploader <span style={styles.link}>PRO</span>
                  </h1>
                  <span 
                    className="px-2 py-1 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: colors.success + '20',
                      color: colors.success,
                      border: `1px solid ${colors.success}40`
                    }}
                  >
                    v{APP_VERSION}
                  </span>
                </div>
                <p style={styles.textSecondary}>
                  Professional subtitle contribution tool for{' '}
                  <a 
                    href="https://www.opensubtitles.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline transition-all"
                    style={styles.link}
                    {...createHoverHandlers(colors, styles.link, styles.linkHover)}
                  >
                    OpenSubtitles.org
                  </a>
                </p>
              </div>
            </div>
            
            {/* User Info and Theme Toggle - Right Side */}
            <div className="flex flex-col items-end gap-1">
              {/* User Profile */}
              <UserProfile />
              
              {/* Action Buttons Row */}
              <div className="flex items-center gap-2">
                {/* Config Button */}
                <button
                  onClick={handleConfigToggle}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-xs"
                  style={{
                    backgroundColor: isDark ? colors.background : colors.cardBackground,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`
                  }}
                  {...createHoverHandlers(colors, 
                    {
                      backgroundColor: isDark ? colors.background : colors.cardBackground,
                      color: colors.textSecondary,
                      borderColor: colors.border
                    },
                    {
                      backgroundColor: colors.background,
                      color: colors.link,
                      borderColor: colors.link
                    }
                  )}
                  title="Open configuration"
                >
                  <span>⚙️</span>
                  <span>Config</span>
                </button>

                {/* Help Button */}
                <button
                  onClick={handleHelpToggle}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-xs"
                  style={{
                    backgroundColor: isDark ? colors.background : colors.cardBackground,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`
                  }}
                  {...createHoverHandlers(colors, 
                    {
                      backgroundColor: isDark ? colors.background : colors.cardBackground,
                      color: colors.textSecondary,
                      borderColor: colors.border
                    },
                    {
                      backgroundColor: colors.background,
                      color: colors.link,
                      borderColor: colors.link
                    }
                  )}
                  title="Help & Features"
                >
                  <span>❓</span>
                  <span>Help</span>
                </button>
                
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-xs"
                  style={{
                    backgroundColor: isDark ? colors.background : colors.cardBackground,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`
                  }}
                  {...createHoverHandlers(colors, 
                    {
                      backgroundColor: isDark ? colors.background : colors.cardBackground,
                      color: colors.textSecondary,
                      borderColor: colors.border
                    },
                    {
                      backgroundColor: colors.background,
                      color: colors.link,
                      borderColor: colors.link
                    }
                  )}
                  title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                >
                  <span>{isDark ? '☀️' : '🌙'}</span>
                  <span>{isDark ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Drop Zone */}
        <DropZone
          isDragOver={isDragOver}
          onDrop={handleFileDropComplete}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          browserCapabilities={browserCapabilities}
          hasFiles={files.length > 0}
          onClearFiles={handleClearFiles}
          colors={colors}
          isDark={isDark}
          onFileSelect={handleFileSelect}
        />


        {/* Error Display */}
        {error && (
          <div className="rounded-lg p-4 mb-6" 
               style={{
                 backgroundColor: colors.cardBackground, 
                 border: `1px solid ${colors.border}`
               }}>
            <p style={{color: colors.error}}>⚠️ {error}</p>
            {(error.includes('blocked') || error.includes('Brave')) && navigator.userAgent.includes('Brave') && (
              <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded text-orange-800 text-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <span>🛡️</span>
                  <strong>Brave Browser Detected - Action Required:</strong>
                </div>
                <div className="space-y-1">
                  <p>1. Click the Shield icon (🛡️) in your address bar</p>
                  <p>2. Turn off "Shields" for this site</p>
                  <p>3. Refresh the page</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notification Display */}
        {notification && (
          <div className="rounded-lg p-3 mb-4 transition-all duration-300 ease-in-out" 
               style={{
                 backgroundColor: notification.type === 'info' ? colors.cardBackground : colors.cardBackground,
                 border: `1px solid ${notification.type === 'info' ? colors.success : colors.warning}`,
                 borderLeft: `4px solid ${notification.type === 'info' ? colors.success : colors.warning}`
               }}>
            <div className="flex items-center gap-2">
              <span>{notification.type === 'info' ? '💡' : '⚠️'}</span>
              <p style={{color: colors.text, margin: 0, fontSize: '14px'}}>{notification.message}</p>
            </div>
          </div>
        )}

        {/* File List - Show ungrouped files if no successful pairs and no orphaned subtitles */}
        {hasUnpairedFiles && orphanedSubtitles.length === 0 && (
          <FileList
            files={files}
            movieGuesses={movieGuesses}
            featuresByImdbId={featuresByImdbId}
            featuresLoading={featuresLoading}
            combinedLanguages={combinedLanguages}
            subtitleLanguages={subtitleLanguages}
            openDropdowns={openDropdowns}
            dropdownSearch={dropdownSearch}
            onSubtitleLanguageChange={handleSubtitleLanguageChange}
            onToggleDropdown={toggleDropdown}
            onDropdownSearch={handleDropdownSearch}
            onSubtitlePreview={handleSubtitlePreview}
            getSubtitleLanguage={getSubtitleLanguage}
            getLanguageOptionsForSubtitle={getLanguageOptionsForSubtitle}
            uploadStates={uploadStates}
            onToggleUpload={handleSubtitleUploadToggle}
            getUploadEnabled={getUploadEnabled}
            onMovieChange={handleMovieChange}
            guessItData={guessItData}
            getGuessItProcessingStatus={getGuessItProcessingStatus}
            getFormattedTags={getFormattedTags}
            fetchFeaturesByImdbId={fetchFeaturesByImdbId}
            uploadResults={uploadResults}
            hashCheckResults={hashCheckResults}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* Matched Pairs */}
        {hasUploadableContent && (
          <div ref={matchedPairsRef}>
            <MatchedPairs
            pairedFiles={pairedFiles}
            movieGuesses={movieGuesses}
            featuresByImdbId={featuresByImdbId}
            featuresLoading={featuresLoading}
            combinedLanguages={combinedLanguages}
            subtitleLanguages={subtitleLanguages}
            openDropdowns={openDropdowns}
            dropdownSearch={dropdownSearch}
            onSubtitleLanguageChange={handleSubtitleLanguageChange}
            onToggleDropdown={toggleDropdown}
            onDropdownSearch={handleDropdownSearch}
            onSubtitlePreview={handleSubtitlePreview}
            getSubtitleLanguage={getSubtitleLanguage}
            getLanguageOptionsForSubtitle={getLanguageOptionsForSubtitle}
            onMovieChange={handleMovieChange}
            guessItData={guessItData}
            getGuessItProcessingStatus={getGuessItProcessingStatus}
            getFormattedTags={getFormattedTags}
            uploadStates={uploadStates}
            onToggleUpload={handleSubtitleUploadToggle}
            getUploadEnabled={getUploadEnabled}
            fetchFeaturesByImdbId={fetchFeaturesByImdbId}
            uploadResults={uploadResults}
            hashCheckResults={hashCheckResults}
            uploadOptions={uploadOptions}
            onUpdateUploadOptions={handleUploadOptionsUpdate}
            config={config}
            colors={colors}
            isDark={isDark}
            getVideoMetadata={getVideoMetadata}
            isMetadataLoading={isMetadataLoading}
            getMetadataError={getMetadataError}
          />
          </div>
        )}

        {/* Orphaned Subtitles */}
        {orphanedSubtitles.length > 0 && (
          <OrphanedSubtitles
            orphanedSubtitles={orphanedSubtitles}
            movieGuesses={movieGuesses}
            featuresByImdbId={featuresByImdbId}
            featuresLoading={featuresLoading}
            combinedLanguages={combinedLanguages}
            subtitleLanguages={subtitleLanguages}
            openDropdowns={openDropdowns}
            dropdownSearch={dropdownSearch}
            onSubtitleLanguageChange={handleSubtitleLanguageChange}
            onToggleDropdown={toggleDropdown}
            onDropdownSearch={handleDropdownSearch}
            onSubtitlePreview={handleSubtitlePreview}
            getSubtitleLanguage={getSubtitleLanguage}
            getLanguageOptionsForSubtitle={getLanguageOptionsForSubtitle}
            uploadStates={uploadStates}
            onToggleUpload={handleSubtitleUploadToggle}
            getUploadEnabled={getUploadEnabled}
            onMovieChange={handleMovieChange}
            guessItData={guessItData}
            getGuessItProcessingStatus={getGuessItProcessingStatus}
            getFormattedTags={getFormattedTags}
            fetchFeaturesByImdbId={fetchFeaturesByImdbId}
            uploadResults={uploadResults}
            uploadOptions={uploadOptions}
            onUpdateUploadOptions={handleUploadOptionsUpdate}
            hashCheckResults={hashCheckResults}
            config={config}
            colors={colors}
            isDark={isDark}
            orphanedSubtitlesFps={orphanedSubtitlesFps}
            onOrphanedSubtitlesFpsChange={handleOrphanedSubtitlesFpsChange}
          />
        )}

        {/* Stats Panel */}
        {hasUploadableContent && (
          <StatsPanel
            pairedFiles={pairedFiles}
            files={files}
            orphanedSubtitles={orphanedSubtitles}
            getUploadEnabled={getUploadEnabled}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* Upload Button - Only show for logged in users */}
        {hasUploadableContent && isAuthenticated && (
          <div data-upload-results>
          <UploadButton
            pairedFiles={pairedFiles}
            orphanedSubtitles={orphanedSubtitles}
            movieGuesses={movieGuesses}
            featuresByImdbId={featuresByImdbId}
            guessItData={guessItData}
            getSubtitleLanguage={getSubtitleLanguage}
            getUploadEnabled={getUploadEnabled}
            onUpload={handleUpload}
            uploadProgress={uploadProgress}
            hashCheckResults={hashCheckResults}
            hashCheckLoading={hashCheckLoading}
            hashCheckProcessed={hashCheckProcessed}
            getHashCheckSummary={getHashCheckSummary}
            colors={colors}
            isDark={isDark}
          />
          </div>
        )}

        {/* Login Required Message for Anonymous Users */}
        {hasUploadableContent && !isAuthenticated && (
          <div 
            className="p-8 rounded-xl text-center mt-6"
            style={{
              backgroundColor: colors.cardBackground,
              border: `2px solid ${colors.warning}`,
              boxShadow: `0 8px 32px ${colors.shadow}`,
              background: `linear-gradient(135deg, ${colors.cardBackground} 0%, ${colors.background} 100%)`
            }}
          >
              <div style={{ 
                color: colors.warning, 
                fontSize: '48px', 
                marginBottom: '16px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
              }}>
                🔑
              </div>
              <div style={{ 
                color: colors.text, 
                fontSize: '24px', 
                fontWeight: '600',
                marginBottom: '12px' 
              }}>
                Login Required to Upload
              </div>
              <div style={{ 
                color: colors.textSecondary, 
                fontSize: '16px',
                marginBottom: '32px',
                maxWidth: '500px',
                margin: '0 auto 32px auto',
                lineHeight: '1.6'
              }}>
                Your subtitle files are ready for upload! Please log in to your OpenSubtitles account to continue with the upload process.
              </div>
              <button
                onClick={() => {
                  // This will be handled by the UserProfile component
                  // User can click on the profile to access login
                }}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl transition-all transform"
                style={{
                  backgroundColor: colors.success,
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '18px',
                  fontWeight: '600',
                  boxShadow: `0 4px 16px ${colors.shadow}`,
                  border: 'none'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = colors.successHover || colors.primary;
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 8px 24px ${colors.shadow}`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = colors.success;
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = `0 4px 16px ${colors.shadow}`;
                }}
              >
                <span style={{ fontSize: '20px' }}>🚀</span>
                Login to Upload
              </button>
          </div>
        )}

        {/* Subtitle Preview Modal */}
        {previewSubtitle && (
          <SubtitlePreview
            subtitle={previewSubtitle}
            content={subtitleContent}
            onClose={closeSubtitlePreview}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* Config Overlay */}
        <ConfigOverlay
          isOpen={isConfigOpen}
          onClose={handleConfigClose}
          config={config}
          onConfigChange={handleConfigChange}
          colors={colors}
          isDark={isDark}
          combinedLanguages={combinedLanguages}
        />

        {/* Help Overlay */}
        <HelpOverlay
          isOpen={isHelpOpen}
          onClose={handleHelpClose}
          colors={colors}
          isDark={isDark}
        />

        {/* Progress Overlay */}
        <ProgressOverlay
          isVisible={processingProgress.isProcessing}
          onCancel={cancelProgress}
          progress={processingProgress}
          colors={colors}
          isDark={isDark}
          startTime={processingProgress.startTime}
        />


        {/* Debug Panel */}
        <Suspense fallback={<div className="mt-6 p-4 rounded-lg text-center" style={{backgroundColor: colors.cardBackground, color: colors.textSecondary}}>Loading debug panel...</div>}>
          <DebugPanel
            debugMode={debugMode}
            debugInfo={debugInfo}
            languagesLoading={languagesLoading}
            languagesError={languagesError}
            movieGuesses={movieGuesses}
            featuresByImdbId={featuresByImdbId}
            hashCheckResults={hashCheckResults}
            hashCheckLoading={hashCheckLoading}
            hashCheckProcessed={hashCheckProcessed}
            getHashCheckSummary={getHashCheckSummary}
            toggleDebugMode={toggleDebugMode}
            clearAllCache={clearAllCache}
            colors={colors}
            isDark={isDark}
          />
        </Suspense>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center text-sm" 
             style={{borderTopColor: colors.border, color: colors.textSecondary}}>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowChangelogOverlay(true)}
                className="hover:underline transition-all flex items-center gap-1"
                style={styles.link}
                {...createHoverHandlers(colors, styles.link, styles.linkHover)}
              >
                <span>📋</span>
                Changelog v{APP_VERSION}
              </button>
              <span className="text-xs opacity-60">•</span>
              <a 
                href="/#/adblock"
                className="hover:underline transition-all flex items-center gap-1"
                style={styles.link}
                {...createHoverHandlers(colors, styles.link, styles.linkHover)}
              >
                <span>🛡️</span>
                Test Connectivity
              </a>
              <span className="text-xs opacity-60">•</span>
              <a 
                href="https://github.com/opensubtitles/opensubtitles-uploader-pro" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline transition-all flex items-center gap-1"
                style={styles.link}
                {...createHoverHandlers(colors, styles.link, styles.linkHover)}
              >
                <span>📦</span>
                GitHub Repository
              </a>
              <span className="text-xs opacity-60">•</span>
              <a 
                href="https://www.opensubtitles.org/upload" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline transition-all flex items-center gap-1"
                style={styles.link}
                {...createHoverHandlers(colors, styles.link, styles.linkHover)}
                title="Use the original OpenSubtitles uploader"
              >
                <span>🔄</span>
                Legacy Uploader
              </a>
            </div>
            <p className="text-xs opacity-75">
              Built with ❤️ for the OpenSubtitles community
            </p>
          </div>
        </div>
      </div>
      
      

      {/* Test Mode Panel - Only shows in development */}
      <TestModePanel 
        files={files} 
        pairedFiles={pairedFiles} 
        onStartTestCase={(description) => {
          addDebugInfo(`🧪 Started test case: ${description}`);
        }}
      />

      {/* Changelog Overlay */}
      <Suspense fallback={null}>
        <ChangelogOverlay
          isOpen={showChangelogOverlay}
          onClose={() => setShowChangelogOverlay(false)}
          colors={colors}
          isDark={isDark}
        />
      </Suspense>
    </div>
  );
}

// Main component wrapped with theme provider
export default function SubtitleUploader() {
  return (
    <ThemeProvider>
      <SubtitleUploaderInner />
    </ThemeProvider>
  );
}