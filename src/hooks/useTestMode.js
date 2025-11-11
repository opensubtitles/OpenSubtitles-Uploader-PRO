import { useState, useCallback } from 'react';

/**
 * Hook for managing test mode functionality
 * Captures real file processing scenarios for test generation
 */
export const useTestMode = () => {
  const [isTestMode, setIsTestMode] = useState(() => {
    // Check if we're in development and test mode is enabled
    const isDev = import.meta.env.DEV;
    const testModeEnabled = localStorage.getItem('uploader_test_mode') === 'true';
    return isDev && testModeEnabled;
  });

  const [testCases, setTestCases] = useState(() => {
    try {
      const stored = localStorage.getItem('uploader_test_cases');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [currentTestCase, setCurrentTestCase] = useState(null);

  const toggleTestMode = useCallback(() => {
    const newMode = !isTestMode;
    setIsTestMode(newMode);
    localStorage.setItem('uploader_test_mode', newMode.toString());

    if (!newMode) {
      setCurrentTestCase(null);
    }
  }, [isTestMode]);

  const startTestCase = useCallback(
    description => {
      if (!isTestMode) return;

      const testCase = {
        id: Date.now(),
        description,
        timestamp: new Date().toISOString(),
        originalFiles: [],
        pairedFiles: [],
        validationResults: {},
        status: 'recording',
      };

      setCurrentTestCase(testCase);
    },
    [isTestMode]
  );

  const recordFiles = useCallback(
    (files, pairedFiles) => {
      if (!isTestMode || !currentTestCase) return;

      const fileData = files.map(file => ({
        name: file.name,
        fullPath: file.fullPath,
        size: file.size,
        type: file.type,
        isVideo: file.isVideo,
        isSubtitle: file.isSubtitle,
        isMedia: file.isMedia,
        movieHash: file.movieHash,
        detectedLanguage: file.detectedLanguage,
        guessItData: file.guessItData,
        movieData: file.movieData,
        featuresData: file.featuresData,
      }));

      const pairData = pairedFiles.map(pair => ({
        id: pair.id,
        video: {
          name: pair.video.name,
          fullPath: pair.video.fullPath,
          movieHash: pair.video.movieHash,
          guessItData: pair.video.guessItData,
          movieData: pair.video.movieData,
          featuresData: pair.video.featuresData,
        },
        subtitles: pair.subtitles.map(sub => ({
          name: sub.name,
          fullPath: sub.fullPath,
          language: sub.language,
          detectedLanguage: sub.detectedLanguage,
          uploadLanguage: sub.uploadLanguage,
          movieData: sub.movieData,
          featuresData: sub.featuresData,
        })),
      }));

      setCurrentTestCase(prev => ({
        ...prev,
        originalFiles: fileData,
        pairedFiles: pairData,
        status: 'validating',
      }));
    },
    [isTestMode, currentTestCase]
  );

  const validatePairing = useCallback(
    validationResults => {
      if (!isTestMode || !currentTestCase) return;

      setCurrentTestCase(prev => ({
        ...prev,
        validationResults,
        status: 'completed',
      }));
    },
    [isTestMode, currentTestCase]
  );

  const saveTestCase = useCallback(
    expectedResults => {
      if (!isTestMode || !currentTestCase) return;

      const finalTestCase = {
        ...currentTestCase,
        expectedResults,
        status: 'saved',
      };

      const newTestCases = [...testCases, finalTestCase];
      setTestCases(newTestCases);
      localStorage.setItem('uploader_test_cases', JSON.stringify(newTestCases));
      setCurrentTestCase(null);

      return finalTestCase;
    },
    [isTestMode, currentTestCase, testCases]
  );

  const deleteTestCase = useCallback(
    id => {
      const newTestCases = testCases.filter(tc => tc.id !== id);
      setTestCases(newTestCases);
      localStorage.setItem('uploader_test_cases', JSON.stringify(newTestCases));
    },
    [testCases]
  );

  const exportTestCases = useCallback(() => {
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      testCases: testCases.map(tc => ({
        ...tc,
        // Remove sensitive data
        originalFiles: tc.originalFiles.map(f => ({
          name: f.name,
          fullPath: f.fullPath,
          size: f.size,
          type: f.type,
          isVideo: f.isVideo,
          isSubtitle: f.isSubtitle,
          isMedia: f.isMedia,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uploader-test-cases-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [testCases]);

  const importTestCases = useCallback(
    file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const importData = JSON.parse(e.target.result);
            if (importData.version && importData.testCases) {
              const newTestCases = [...testCases, ...importData.testCases];
              setTestCases(newTestCases);
              localStorage.setItem('uploader_test_cases', JSON.stringify(newTestCases));
              resolve(importData.testCases.length);
            } else {
              reject(new Error('Invalid test case format'));
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsText(file);
      });
    },
    [testCases]
  );

  const clearTestCases = useCallback(() => {
    setTestCases([]);
    localStorage.removeItem('uploader_test_cases');
  }, []);

  return {
    isTestMode,
    testCases,
    currentTestCase,
    toggleTestMode,
    startTestCase,
    recordFiles,
    validatePairing,
    saveTestCase,
    deleteTestCase,
    exportTestCases,
    importTestCases,
    clearTestCases,
  };
};
