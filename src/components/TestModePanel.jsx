import React, { useState, useRef } from 'react';
import { useTestMode } from '../hooks/useTestMode';

const TestModePanel = ({ files, pairedFiles, onStartTestCase }) => {
  const {
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
  } = useTestMode();

  const [description, setDescription] = useState('');
  const [validationState, setValidationState] = useState({});
  const [expectedResults, setExpectedResults] = useState({});
  const fileInputRef = useRef(null);

  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleStartTestCase = () => {
    if (!description.trim()) return;

    startTestCase(description);
    recordFiles(files, pairedFiles);
    onStartTestCase?.(description);
    setDescription('');
  };

  const handleValidateParent = (pairId, field, value) => {
    setValidationState(prev => ({
      ...prev,
      [pairId]: {
        ...prev[pairId],
        [field]: value,
      },
    }));
  };

  const handleValidateSubtitle = (pairId, subtitleIndex, field, value) => {
    const key = `${pairId}_sub_${subtitleIndex}`;
    setValidationState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSaveTestCase = () => {
    const results = {
      expectedPairs: pairedFiles.length,
      pairValidations: validationState,
      expectedResults,
    };

    saveTestCase(results);
    setValidationState({});
    setExpectedResults({});
  };

  const handleFileImport = event => {
    const file = event.target.files[0];
    if (file) {
      importTestCases(file)
        .then(count => alert(`Imported ${count} test cases`))
        .catch(error => alert(`Import failed: ${error.message}`));
    }
  };

  if (!isTestMode) {
    return (
      <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow">
        <button onClick={toggleTestMode} className="text-sm font-medium">
          Enable Test Mode
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg w-96 max-h-screen overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-800">Test Mode</h3>
          <button onClick={toggleTestMode} className="text-red-500 hover:text-red-700 text-sm">
            Disable
          </button>
        </div>

        {!currentTestCase && (
          <div className="space-y-2">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Test case description..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <button
              onClick={handleStartTestCase}
              disabled={!description.trim() || files.length === 0}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              Start Test Case
            </button>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          <div>Files: {files.length}</div>
          <div>Pairs: {pairedFiles.length}</div>
          <div>Test Cases: {testCases.length}</div>
        </div>
      </div>

      {currentTestCase && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-800 mb-2">
            Recording: {currentTestCase.description}
          </h4>

          <div className="space-y-3">
            {pairedFiles.map((pair, pairIndex) => (
              <div key={pair.id} className="bg-gray-50 p-3 rounded">
                <div className="font-medium text-sm mb-2">{pair.video.name}</div>

                <div className="space-y-2">
                  {/* Video validation */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`video-${pair.id}`}
                      checked={validationState[pair.id]?.videoCorrect || false}
                      onChange={e =>
                        handleValidateParent(pair.id, 'videoCorrect', e.target.checked)
                      }
                    />
                    <label htmlFor={`video-${pair.id}`} className="text-sm">
                      Video correctly identified
                    </label>
                  </div>

                  {/* IMDB validation */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`imdb-${pair.id}`}
                      checked={validationState[pair.id]?.imdbCorrect || false}
                      onChange={e => handleValidateParent(pair.id, 'imdbCorrect', e.target.checked)}
                    />
                    <label htmlFor={`imdb-${pair.id}`} className="text-sm">
                      IMDB data correct
                    </label>
                  </div>

                  {/* Subtitle validations */}
                  {pair.subtitles.map((subtitle, subIndex) => (
                    <div key={subIndex} className="ml-4 border-l-2 border-blue-200 pl-2">
                      <div className="text-xs text-gray-600 mb-1">{subtitle.name}</div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`sub-paired-${pair.id}-${subIndex}`}
                            checked={
                              validationState[`${pair.id}_sub_${subIndex}`]?.pairedCorrectly ||
                              false
                            }
                            onChange={e =>
                              handleValidateSubtitle(
                                pair.id,
                                subIndex,
                                'pairedCorrectly',
                                e.target.checked
                              )
                            }
                          />
                          <label htmlFor={`sub-paired-${pair.id}-${subIndex}`} className="text-xs">
                            Paired correctly
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`sub-lang-${pair.id}-${subIndex}`}
                            checked={
                              validationState[`${pair.id}_sub_${subIndex}`]?.languageCorrect ||
                              false
                            }
                            onChange={e =>
                              handleValidateSubtitle(
                                pair.id,
                                subIndex,
                                'languageCorrect',
                                e.target.checked
                              )
                            }
                          />
                          <label htmlFor={`sub-lang-${pair.id}-${subIndex}`} className="text-xs">
                            Language detected correctly
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`sub-movie-${pair.id}-${subIndex}`}
                            checked={
                              validationState[`${pair.id}_sub_${subIndex}`]?.movieDataCorrect ||
                              false
                            }
                            onChange={e =>
                              handleValidateSubtitle(
                                pair.id,
                                subIndex,
                                'movieDataCorrect',
                                e.target.checked
                              )
                            }
                          />
                          <label htmlFor={`sub-movie-${pair.id}-${subIndex}`} className="text-xs">
                            Movie data correct
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}

                  {pair.subtitles.length === 0 && (
                    <div className="text-xs text-orange-600">
                      No subtitles paired (orphaned video)
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Orphaned subtitles */}
            {files.filter(
              f =>
                f.isSubtitle &&
                !pairedFiles.some(p => p.subtitles.some(s => s.fullPath === f.fullPath))
            ).length > 0 && (
              <div className="bg-orange-50 p-3 rounded">
                <div className="font-medium text-sm mb-2 text-orange-800">Orphaned Subtitles</div>
                <div className="space-y-2">
                  {files
                    .filter(
                      f =>
                        f.isSubtitle &&
                        !pairedFiles.some(p => p.subtitles.some(s => s.fullPath === f.fullPath))
                    )
                    .map((subtitle, orphanIndex) => {
                      const orphanId = `orphan_${orphanIndex}`;
                      return (
                        <div key={subtitle.fullPath} className="border-l-2 border-orange-200 pl-2">
                          <div className="text-xs text-orange-600 mb-1 font-medium">
                            {subtitle.name}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`orphan-movie-${orphanId}`}
                                checked={validationState[orphanId]?.movieIdentified || false}
                                onChange={e =>
                                  handleValidateParent(
                                    orphanId,
                                    'movieIdentified',
                                    e.target.checked
                                  )
                                }
                              />
                              <label htmlFor={`orphan-movie-${orphanId}`} className="text-xs">
                                Movie/series identified correctly
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`orphan-episode-${orphanId}`}
                                checked={validationState[orphanId]?.episodeDetected || false}
                                onChange={e =>
                                  handleValidateParent(
                                    orphanId,
                                    'episodeDetected',
                                    e.target.checked
                                  )
                                }
                              />
                              <label htmlFor={`orphan-episode-${orphanId}`} className="text-xs">
                                Episode info detected correctly (if TV show)
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`orphan-lang-${orphanId}`}
                                checked={validationState[orphanId]?.languageCorrect || false}
                                onChange={e =>
                                  handleValidateParent(
                                    orphanId,
                                    'languageCorrect',
                                    e.target.checked
                                  )
                                }
                              />
                              <label htmlFor={`orphan-lang-${orphanId}`} className="text-xs">
                                Language detected correctly
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`orphan-imdb-${orphanId}`}
                                checked={validationState[orphanId]?.imdbCorrect || false}
                                onChange={e =>
                                  handleValidateParent(orphanId, 'imdbCorrect', e.target.checked)
                                }
                              />
                              <label htmlFor={`orphan-imdb-${orphanId}`} className="text-xs">
                                IMDB data correct
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`orphan-tags-${orphanId}`}
                                checked={validationState[orphanId]?.tagsCorrect || false}
                                onChange={e =>
                                  handleValidateParent(orphanId, 'tagsCorrect', e.target.checked)
                                }
                              />
                              <label htmlFor={`orphan-tags-${orphanId}`} className="text-xs">
                                GuessIt tags correct
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <textarea
              value={expectedResults.notes || ''}
              onChange={e => setExpectedResults(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about expected behavior..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              rows="3"
            />

            <button
              onClick={handleSaveTestCase}
              className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              Save Test Case
            </button>
          </div>
        </div>
      )}

      {/* Test Cases Management */}
      <div className="p-4">
        <h4 className="font-medium text-gray-800 mb-2">Test Cases ({testCases.length})</h4>

        <div className="space-y-2 mb-4">
          <button
            onClick={exportTestCases}
            disabled={testCases.length === 0}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            Export Test Cases
          </button>

          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
            >
              Import
            </button>
            <button
              onClick={clearTestCases}
              disabled={testCases.length === 0}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto">
          {testCases.map(testCase => (
            <div key={testCase.id} className="bg-gray-50 p-2 rounded mb-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {testCase.description}
                </div>
                <button
                  onClick={() => deleteTestCase(testCase.id)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Delete
                </button>
              </div>
              <div className="text-xs text-gray-600">
                {testCase.pairedFiles.length} pairs •{' '}
                {new Date(testCase.timestamp).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestModePanel;
