import { useState, useEffect, useCallback, useRef } from 'react';
import { OpenSubtitlesApiService } from '../services/api/openSubtitlesApi.js';
import { XmlRpcService } from '../services/api/xmlrpc.js';
import { retryAsync } from '../utils/retryUtils.js';

// Global debug function to prevent duplicate logging
let globalDebugFunction = null;

// Singleton state to prevent multiple simultaneous loads across all component instances
const LanguageDataSingleton = {
  restApiLoaded: false,
  xmlRpcLoaded: false,
  dataCombined: false,
  restLoading: false,
  xmlRpcLoading: false,
  combining: false,
  combineTimeout: null,
  combineLogShown: false,
  combineCompleteLogShown: false,
  restData: null,
  xmlRpcData: null,
  combinedData: null,
  restRetryCount: 0,
  xmlRpcRetryCount: 0,
  maxRetries: 10,

  // Global logging function to prevent duplicates
  log(message) {
    if (
      globalDebugFunction &&
      !this.combineLogShown &&
      message.includes('Combining language data')
    ) {
      this.combineLogShown = true;
      globalDebugFunction(message);
    } else if (
      globalDebugFunction &&
      !this.combineCompleteLogShown &&
      message.includes('Languages:')
    ) {
      this.combineCompleteLogShown = true;
      globalDebugFunction(message);
    }
  },

  reset() {
    this.restApiLoaded = false;
    this.xmlRpcLoaded = false;
    this.dataCombined = false;
    this.restLoading = false;
    this.xmlRpcLoading = false;
    this.combining = false;
    this.combineLogShown = false;
    this.combineCompleteLogShown = false;
    this.restRetryCount = 0;
    this.xmlRpcRetryCount = 0;
    if (this.combineTimeout) {
      clearTimeout(this.combineTimeout);
      this.combineTimeout = null;
    }
  },
};

/**
 * Custom hook for managing language data from multiple APIs
 */
export const useLanguageData = addDebugInfo => {
  const [languageMap, setLanguageMap] = useState({});
  const [xmlRpcLanguages, setXmlRpcLanguages] = useState([]);
  const [combinedLanguages, setCombinedLanguages] = useState({});
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [languagesError, setLanguagesError] = useState(null);
  const [subtitleLanguages, setSubtitleLanguages] = useState({});

  const languagesLoadedRef = useRef(false);
  const xmlRpcLanguagesRef = useRef(false);
  const combinedRef = useRef(false);

  // Set global debug function on first hook instance
  if (!globalDebugFunction) {
    globalDebugFunction = addDebugInfo;
  }

  // Load supported languages from REST API
  const loadLanguages = useCallback(async () => {
    if (LanguageDataSingleton.restApiLoaded || LanguageDataSingleton.restLoading) {
      if (LanguageDataSingleton.restData) {
        setLanguageMap(LanguageDataSingleton.restData);
      }
      return;
    }

    // Check if we've exceeded max retries
    if (LanguageDataSingleton.restRetryCount >= LanguageDataSingleton.maxRetries) {
      addDebugInfo(
        `❌ REST API: Max retries (${LanguageDataSingleton.maxRetries}) exceeded. Skipping language loading.`
      );
      setLanguagesError(`Max retries exceeded (${LanguageDataSingleton.maxRetries})`);
      setLanguagesLoading(false);
      return;
    }

    LanguageDataSingleton.restLoading = true;
    LanguageDataSingleton.restRetryCount++;
    addDebugInfo(
      `📥 Loading REST API languages... (attempt ${LanguageDataSingleton.restRetryCount}/${LanguageDataSingleton.maxRetries})`
    );
    setLanguagesLoading(true);
    setLanguagesError(null);

    try {
      const { data, fromCache } = await retryAsync(
        () => OpenSubtitlesApiService.getSupportedLanguages(),
        3, // 3 retries per attempt
        5000, // 5 second base delay
        (attempt, maxAttempts) => {
          if (attempt > 1) {
            addDebugInfo(`🔄 REST API retry ${attempt}/${maxAttempts}...`);
          }
        }
      );

      LanguageDataSingleton.restData = data;
      LanguageDataSingleton.restApiLoaded = true;
      setLanguageMap(data);
      addDebugInfo(
        `✅ REST: ${Object.keys(data).length} languages ${fromCache ? '(cached)' : '(API)'}`
      );
    } catch (error) {
      addDebugInfo(
        `❌ Error loading languages (attempt ${LanguageDataSingleton.restRetryCount}): ${error.message}`
      );
      setLanguagesError(error.message);
      setLanguageMap({});

      // If not at max retries, allow another attempt later
      if (LanguageDataSingleton.restRetryCount < LanguageDataSingleton.maxRetries) {
        addDebugInfo(
          `⏳ Will retry in 10 seconds... (${LanguageDataSingleton.restRetryCount}/${LanguageDataSingleton.maxRetries} attempts)`
        );
        setTimeout(() => {
          LanguageDataSingleton.restLoading = false;
          loadLanguages();
        }, 10000);
        return;
      } else {
        addDebugInfo(`🛑 Max retries reached. Language loading disabled.`);
      }
    } finally {
      setLanguagesLoading(false);
      LanguageDataSingleton.restLoading = false;
    }
  }, [addDebugInfo]);

  // Load XML-RPC languages
  const loadXmlRpcLanguages = useCallback(async () => {
    if (LanguageDataSingleton.xmlRpcLoaded || LanguageDataSingleton.xmlRpcLoading) {
      if (LanguageDataSingleton.xmlRpcData) {
        setXmlRpcLanguages(LanguageDataSingleton.xmlRpcData);
      }
      return;
    }

    // Check if we've exceeded max retries
    if (LanguageDataSingleton.xmlRpcRetryCount >= LanguageDataSingleton.maxRetries) {
      addDebugInfo(
        `❌ XML-RPC: Max retries (${LanguageDataSingleton.maxRetries}) exceeded. Skipping language loading.`
      );
      return;
    }

    LanguageDataSingleton.xmlRpcLoading = true;
    LanguageDataSingleton.xmlRpcRetryCount++;
    addDebugInfo(
      `📥 Loading XML-RPC languages... (attempt ${LanguageDataSingleton.xmlRpcRetryCount}/${LanguageDataSingleton.maxRetries})`
    );

    try {
      const { data, fromCache } = await retryAsync(
        () => XmlRpcService.getSubLanguages(),
        3, // 3 retries per attempt
        2000, // 2 second base delay (XML-RPC is usually faster)
        (attempt, maxAttempts) => {
          if (attempt > 1) {
            addDebugInfo(`🔄 XML-RPC retry ${attempt}/${maxAttempts}...`);
          }
        }
      );

      LanguageDataSingleton.xmlRpcData = data;
      LanguageDataSingleton.xmlRpcLoaded = true;
      setXmlRpcLanguages(data);
      addDebugInfo(`✅ XML-RPC: ${data.length} languages ${fromCache ? '(cached)' : '(API)'}`);
    } catch (error) {
      addDebugInfo(
        `❌ XML-RPC GetSubLanguages failed (attempt ${LanguageDataSingleton.xmlRpcRetryCount}): ${error.message}`
      );

      // If not at max retries, allow another attempt later
      if (LanguageDataSingleton.xmlRpcRetryCount < LanguageDataSingleton.maxRetries) {
        addDebugInfo(
          `⏳ XML-RPC will retry in 5 seconds... (${LanguageDataSingleton.xmlRpcRetryCount}/${LanguageDataSingleton.maxRetries} attempts)`
        );
        setTimeout(() => {
          LanguageDataSingleton.xmlRpcLoading = false;
          loadXmlRpcLanguages();
        }, 5000);
        return;
      } else {
        addDebugInfo(`🛑 XML-RPC max retries reached.`);
      }
    } finally {
      LanguageDataSingleton.xmlRpcLoading = false;
    }
  }, [addDebugInfo]);

  // Combine language data from both APIs
  const combineLanguageData = useCallback(() => {
    if (xmlRpcLanguages.length === 0 || Object.keys(languageMap).length <= 1) {
      return;
    }

    // Prevent multiple combines on page reload
    if (LanguageDataSingleton.dataCombined || LanguageDataSingleton.combining) {
      if (LanguageDataSingleton.combinedData) {
        setCombinedLanguages(LanguageDataSingleton.combinedData);
      }
      return;
    }

    LanguageDataSingleton.combining = true;

    // Use singleton logging to prevent duplicates
    LanguageDataSingleton.log('🔗 Combining language data...');

    const combined = {};
    let matchedCount = 0;
    let unmatchedXmlRpc = 0;
    let unmatchedRest = 0;

    // Start with XML-RPC languages (upload enabled)
    xmlRpcLanguages.forEach(xmlLang => {
      const iso639 = xmlLang.ISO639?.toLowerCase();
      if (!iso639) return;

      // Find matching REST API language
      const restLang = Object.entries(languageMap).find(
        ([key, lang]) =>
          key.toLowerCase() === iso639 || lang.language_code?.toLowerCase() === iso639
      )?.[1];

      if (restLang) {
        combined[iso639] = {
          subLanguageID: xmlLang.SubLanguageID,
          languageName: xmlLang.LanguageName,
          iso639: xmlLang.ISO639,
          flag: restLang.flag,
          language_code: restLang.language_code,
          originalName: restLang.originalName,
          iso639_3: restLang.iso639_3,
          canUpload: true,
          displayName: restLang.name || xmlLang.LanguageName,
        };
        matchedCount++;
      } else {
        combined[iso639] = {
          subLanguageID: xmlLang.SubLanguageID,
          languageName: xmlLang.LanguageName,
          iso639: xmlLang.ISO639,
          flag: '🏳️',
          canUpload: true,
          displayName: xmlLang.LanguageName,
        };
        unmatchedXmlRpc++;
      }
    });

    // Add REST API languages that weren't in XML-RPC (detection only)
    Object.entries(languageMap).forEach(([code, restLang]) => {
      if (code === 'default') return;

      const iso639 = restLang.iso639_3?.toLowerCase() || restLang.language_code?.toLowerCase();
      if (!iso639 || combined[iso639]) return;

      combined[iso639] = {
        flag: restLang.flag,
        language_code: restLang.language_code,
        originalName: restLang.originalName,
        iso639_3: restLang.iso639_3,
        canUpload: false,
        displayName: restLang.name,
      };
      unmatchedRest++;
    });

    LanguageDataSingleton.combinedData = combined;
    LanguageDataSingleton.dataCombined = true;
    LanguageDataSingleton.combining = false;

    setCombinedLanguages(combined);

    // Use singleton logging to prevent duplicates
    LanguageDataSingleton.log(
      `✅ Languages: ${matchedCount} matched, ${unmatchedXmlRpc} XML-RPC only, ${unmatchedRest} REST only`
    );
  }, [xmlRpcLanguages, languageMap, addDebugInfo]);

  // Handle subtitle language selection
  const handleSubtitleLanguageChange = useCallback((subtitlePath, languageCode) => {
    setSubtitleLanguages(prev => ({
      ...prev,
      [subtitlePath]: languageCode,
    }));
  }, []);

  // Clear subtitle language selections (for fresh file drops)
  const clearSubtitleLanguages = useCallback(() => {
    setSubtitleLanguages({});
  }, []);

  // Get language info
  const getLanguageInfo = useCallback(
    languageCode => {
      if (!languageCode) {
        return { flag: '🏳️', name: 'Unknown' };
      }

      let code;
      if (typeof languageCode === 'object' && languageCode.language_code) {
        code = languageCode.language_code.toLowerCase();
      } else if (typeof languageCode === 'string') {
        code = languageCode.toLowerCase();
      } else {
        return { flag: '🏳️', name: 'Unknown' };
      }

      if (languageMap[code]) {
        return languageMap[code];
      }
      return { flag: '🏳️', name: code.toUpperCase() };
    },
    [languageMap]
  );

  // Get selected language for subtitle
  const getSubtitleLanguage = useCallback(
    subtitle => {
      const selected = subtitleLanguages[subtitle.fullPath];
      if (selected) return selected;

      // Default to detected language if available
      if (
        subtitle.detectedLanguage &&
        typeof subtitle.detectedLanguage === 'object' &&
        subtitle.detectedLanguage.language_code
      ) {
        return subtitle.detectedLanguage.language_code.toLowerCase();
      }

      return '';
    },
    [subtitleLanguages]
  );

  // Sibling-language families. fasttext returns one top guess; for languages
  // where the script/text is near-identical across variants (Chinese
  // Simplified vs Traditional vs Cantonese, Portuguese vs Brazilian,
  // Spanish-Spain vs Latin America, French-France vs Canada) the picked
  // variant is often wrong but a close sibling is right. We pre-rank every
  // sibling in the same family so the user can pick the correct variant
  // without scrolling the alphabetic tail (forum #55000 item 3).
  //
  // Keyed by lowercase code (either ISO 639-1 / ISO 639-2/T / OS-specific).
  // Codes that don't exist in combinedLanguages are silently ignored, so
  // listing extra aliases is safe.
  // Codes drawn from OS XML-RPC SubLanguage table (export_languages.php) so
  // they match the keys used in combinedLanguages. Aliases (ISO 639-1
  // 2-letter, ISO 639-2/T 3-letter, and OS extensions like 'pob'/'spl')
  // sit side-by-side because fasttext + REST API return varying forms.
  const LANGUAGE_FAMILIES = [
    // Chinese: simplified (chi/zh), traditional (zht/zt), bilingual (zhe/ze),
    // Cantonese (zhc/zc) — every track in a Chinese release tends to be
    // mis-mapped to "chi" by fasttext, so cross-promote them all.
    ['zh', 'zho', 'chi', 'zhs', 'zhi', 'zht', 'zt', 'zhe', 'ze', 'zhc', 'zc', 'yue', 'nan', 'wuu'],
    // Portuguese: PT (por/pt), Brazil (pob/pb), Mozambique (pom/pm).
    ['pt', 'por', 'pob', 'pb', 'pom', 'pm', 'pt-br', 'pt-pt'],
    // Spanish: generic (spa/es), Latin America (spl/ea), Europe (spn/sp).
    ['es', 'spa', 'spl', 'ea', 'spn', 'sp', 'es-mx', 'es-419', 'es-es'],
    // French: every variant rolls up to 'fre' on OS, but keep aliases.
    ['fr', 'fre', 'fra', 'frc', 'fr-ca', 'fr-fr'],
    // English (US/GB) — same key on OS, kept for fasttext aliases.
    ['en', 'eng', 'en-us', 'en-gb'],
    // Scandinavian — Bokmål/Nynorsk are technically Norwegian variants,
    // and Danish + Swedish are close enough that fasttext frequently
    // confuses them. User-reported (forum #55008): NO surfaced DK as a
    // sibling but DK didn't surface NO. Single cluster fixes both
    // directions.
    ['nb', 'nob', 'nn', 'nno', 'no', 'nor', 'da', 'dan', 'sv', 'swe'],
    // Serbo-Croatian cluster — Serbian (scc/sr), Croatian (hrv/hr),
    // Bosnian (bos/bs), Montenegrin (mne/me). Plus catch-all 'sh'.
    ['sr', 'srp', 'scc', 'hr', 'hrv', 'bs', 'bos', 'sh', 'mne', 'me'],
  ];
  // Get language options for subtitle dropdown
  const getLanguageOptionsForSubtitle = useCallback(
    subtitle => {
      const options = [];

      // Add detected languages first
      if (
        subtitle.detectedLanguage &&
        typeof subtitle.detectedLanguage === 'object' &&
        subtitle.detectedLanguage.all_languages
      ) {
        subtitle.detectedLanguage.all_languages
          .sort((a, b) => b.confidence - a.confidence)
          .forEach(lang => {
            const code = lang.language_code.toLowerCase();
            const combinedLang = combinedLanguages[code];
            if (combinedLang && combinedLang.canUpload) {
              options.push({
                code,
                ...combinedLang,
                confidence: lang.confidence,
                isDetected: true,
              });
            }
          });
      }

      // Promote siblings of any detected code so close variants surface at
      // the top of the dropdown instead of getting buried in the alphabetic
      // tail. Synthetic confidence sits just below the lowest detected
      // confidence so siblings sort under their parent detection.
      const detectedCodes = new Set(options.map(opt => opt.code));
      if (options.length > 0) {
        const minDetectedConf = Math.min(
          ...options.map(o => (typeof o.confidence === 'number' ? o.confidence : 0))
        );
        const siblingConf = Math.max(0, minDetectedConf - 0.05);
        const siblingCodes = new Set();
        const findFamily = c => {
          if (!c) return null;
          const lc = c.toLowerCase();
          return LANGUAGE_FAMILIES.find(f => f.includes(lc)) || null;
        };
        for (const opt of [...options]) {
          const fam = findFamily(opt.code);
          if (!fam) continue;
          for (const sib of fam) {
            if (sib === opt.code) continue;
            if (detectedCodes.has(sib) || siblingCodes.has(sib)) continue;
            const combinedLang = combinedLanguages[sib];
            if (!combinedLang || !combinedLang.canUpload) continue;
            options.push({
              code: sib,
              ...combinedLang,
              confidence: siblingConf,
              isDetected: true,
              isSibling: true,
            });
            siblingCodes.add(sib);
          }
        }
        // Keep ordering: detected (by confidence) -> siblings (by confidence)
        options.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        for (const sib of siblingCodes) detectedCodes.add(sib);
      }

      // Add other upload-enabled languages
      Object.entries(combinedLanguages)
        .filter(([code, lang]) => lang.canUpload && !detectedCodes.has(code))
        .sort(([_, a], [__, b]) => a.displayName.localeCompare(b.displayName))
        .forEach(([code, lang]) => {
          options.push({
            code,
            ...lang,
            isDetected: false,
          });
        });

      return options;
    },
    [combinedLanguages]
  );

  // Initialize language loading
  useEffect(() => {
    loadLanguages();
    loadXmlRpcLanguages();

    // Cleanup function for StrictMode
    return () => {
      // Reset refs if component unmounts during StrictMode double-render
      if (!languageMap || Object.keys(languageMap).length === 0) {
        languagesLoadedRef.current = false;
      }
      if (!xmlRpcLanguages || xmlRpcLanguages.length === 0) {
        xmlRpcLanguagesRef.current = false;
      }
    };
  }, [loadLanguages, loadXmlRpcLanguages, languageMap, xmlRpcLanguages]);

  // Combine language data when both APIs have loaded
  useEffect(() => {
    const languageMapSize = Object.keys(languageMap).length;

    // If singleton already has combined data, use it
    if (LanguageDataSingleton.dataCombined && LanguageDataSingleton.combinedData) {
      setCombinedLanguages(LanguageDataSingleton.combinedData);
      return;
    }

    if (
      xmlRpcLanguages.length > 0 &&
      languageMapSize > 1 &&
      !LanguageDataSingleton.dataCombined &&
      !LanguageDataSingleton.combining
    ) {
      // Use timeout to debounce multiple rapid calls from StrictMode
      if (LanguageDataSingleton.combineTimeout) {
        clearTimeout(LanguageDataSingleton.combineTimeout);
      }

      LanguageDataSingleton.combineTimeout = setTimeout(() => {
        combineLanguageData();
        LanguageDataSingleton.combineTimeout = null;
      }, 10);
    }
  }, [xmlRpcLanguages, languageMap, combineLanguageData]);

  return {
    languageMap,
    xmlRpcLanguages,
    combinedLanguages,
    languagesLoading,
    languagesError,
    subtitleLanguages,
    handleSubtitleLanguageChange,
    clearSubtitleLanguages,
    getLanguageInfo,
    getSubtitleLanguage,
    getLanguageOptionsForSubtitle,
    loadLanguages,
    loadXmlRpcLanguages,
  };
};
