import React, { useState, useEffect, useRef } from 'react';
import UpdateSettings from './UpdateSettings.jsx';

export const ConfigOverlay = ({ isOpen, onClose, config, onConfigChange, colors, isDark, combinedLanguages }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [activeTab, setActiveTab] = useState('general');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [fpsDropdownOpen, setFpsDropdownOpen] = useState(false);
  const [fpsSearchTerm, setFpsSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const fpsDropdownRef = useRef(null);

  // FPS options for dropdown
  const fpsOptions = [
    { value: '', label: 'Select FPS' },
    { value: '23.976', label: '23.976 FPS - NTSC Film' },
    { value: '24', label: '24 FPS - Cinema' },
    { value: '25', label: '25 FPS - PAL' },
    { value: '29.97', label: '29.97 FPS - NTSC' },
    { value: '30', label: '30 FPS - True NTSC' },
    { value: '47.952', label: '47.952 FPS - Double NTSC' },
    { value: '48', label: '48 FPS - HFR' },
    { value: '50', label: '50 FPS - PAL HFR' },
    { value: '59.94', label: '59.94 FPS - NTSC HFR' },
    { value: '60', label: '60 FPS - True HFR' },
    { value: '100', label: '100 FPS - Double PAL' },
    { value: '119.88', label: '119.88 FPS - Double NTSC' },
    { value: '120', label: '120 FPS - UHFR' }
  ];

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check language dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLanguageDropdownOpen(false);
        setLanguageSearch('');
      }
      
      // Check FPS dropdown
      if (fpsDropdownRef.current && !fpsDropdownRef.current.contains(event.target)) {
        setFpsDropdownOpen(false);
        setFpsSearchTerm('');
      }
    };

    if (isLanguageDropdownOpen || fpsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLanguageDropdownOpen, fpsDropdownOpen]);

  const handleChange = (key, value) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const toggleLanguageDropdown = () => {
    setIsLanguageDropdownOpen(prev => !prev);
    setLanguageSearch('');
  };

  const handleLanguageSelect = (languageCode) => {
    const finalLanguageCode = languageCode === 'auto-detect' ? '' : languageCode;
    handleChange('defaultLanguage', finalLanguageCode);
    setIsLanguageDropdownOpen(false);
    setLanguageSearch('');
  };

  const handleLanguageSearch = (searchTerm) => {
    setLanguageSearch(searchTerm);
  };

  // Get the current language display
  const getCurrentLanguageDisplay = () => {
    if (!localConfig.defaultLanguage) {
      return '🔍 Auto-detect language';
    }
    
    const lang = combinedLanguages?.[localConfig.defaultLanguage];
    if (lang) {
      return `${lang.flag} ${lang.displayName}`;
    }
    
    return `${localConfig.defaultLanguage.toUpperCase()}`;
  };

  // Get filtered language options for dropdown
  const getFilteredLanguageOptions = () => {
    const options = [
      {
        code: 'auto-detect',
        flag: '🔍',
        displayName: 'Auto-detect language',
        iso639: 'auto',
        canUpload: true
      }
    ];

    if (combinedLanguages) {
      const langOptions = Object.entries(combinedLanguages)
        .filter(([_, lang]) => lang.canUpload)
        .sort(([_, a], [__, b]) => a.displayName.localeCompare(b.displayName))
        .map(([code, lang]) => ({
          code,
          flag: lang.flag,
          displayName: lang.displayName,
          iso639: lang.iso639,
          languageName: lang.languageName,
          canUpload: lang.canUpload
        }));
      
      options.push(...langOptions);
    }

    // Filter based on search term
    if (languageSearch) {
      const search = languageSearch.toLowerCase();
      return options.filter(lang => 
        lang.displayName?.toLowerCase().includes(search) ||
        lang.iso639?.toLowerCase().includes(search) ||
        lang.languageName?.toLowerCase().includes(search)
      );
    }

    return options;
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="relative w-full max-w-md mx-4 rounded-xl shadow-2xl border-2 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          boxShadow: `0 25px 50px -12px ${colors.shadow}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab Navigation */}
        <div className="flex border-b" style={{ borderBottomColor: colors.border }}>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general' ? 'border-b-2' : ''
            }`}
            style={{
              color: activeTab === 'general' ? colors.link : colors.textSecondary,
              borderBottomColor: activeTab === 'general' ? colors.link : 'transparent',
              backgroundColor: activeTab === 'general' ? colors.background : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'general') {
                e.target.style.backgroundColor = colors.hoverBackground || (isDark ? '#3a3a3a' : '#f5f5f5');
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'general') {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'processing' ? 'border-b-2' : ''
            }`}
            style={{
              color: activeTab === 'processing' ? colors.link : colors.textSecondary,
              borderBottomColor: activeTab === 'processing' ? colors.link : 'transparent',
              backgroundColor: activeTab === 'processing' ? colors.background : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'processing') {
                e.target.style.backgroundColor = colors.hoverBackground || (isDark ? '#3a3a3a' : '#f5f5f5');
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'processing') {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Processing
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              {/* Default Language Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: colors.text }}>
              Default Language
            </label>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Select a default language for all subtitles, or use auto-detect
            </p>
            <div className="relative" ref={dropdownRef}>
              {/* Dropdown Button */}
              <button
                onClick={toggleLanguageDropdown}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 text-left flex items-center justify-between min-h-[40px]"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.link;
                  e.target.style.boxShadow = `0 0 0 2px ${colors.link}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span>{getCurrentLanguageDisplay()}</span>
                <span className="ml-2">{isLanguageDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {/* Dropdown Menu */}
              {isLanguageDropdownOpen && (
                <div 
                  className="absolute top-full left-0 mt-1 rounded-lg shadow-lg z-50 min-w-full max-h-60 overflow-hidden"
                  style={{
                    backgroundColor: colors.cardBackground,
                    border: `1px solid ${colors.border}`,
                    boxShadow: `0 10px 25px -5px ${colors.shadow}`,
                  }}
                >
                  {/* Search Input */}
                  <div className="p-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <input
                      type="text"
                      placeholder="Type to search languages..."
                      value={languageSearch}
                      onChange={(e) => handleLanguageSearch(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = colors.link;
                        e.target.style.boxShadow = `0 0 0 2px ${colors.link}20`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = colors.border;
                        e.target.style.boxShadow = 'none';
                      }}
                      autoFocus
                    />
                  </div>

                  {/* Language Options */}
                  <div className="max-h-48 overflow-y-auto">
                    {getFilteredLanguageOptions().map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageSelect(lang.code)}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                        style={{ color: colors.text }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = isDark ? '#444444' : '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.displayName}</span>
                        {lang.iso639 && lang.iso639 !== 'auto' && (
                          <span style={{ color: colors.textSecondary }}>
                            ({lang.iso639.toUpperCase()})
                          </span>
                        )}
                      </button>
                    ))}
                    {getFilteredLanguageOptions().length === 0 && (
                      <div className="px-3 py-2 text-sm text-center" style={{ color: colors.textSecondary }}>
                        No languages found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {localConfig.defaultLanguage && (
              <div className="flex items-center gap-2 text-xs" style={{ color: colors.success }}>
                <span>✓</span>
                <span>Language detection will be skipped for all subtitles</span>
              </div>
            )}
          </div>
          
          {/* Minimal separator line */}
          <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />
          
          {/* Default FPS Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: colors.text }}>
              Default FPS (Orphaned Subtitles)
            </label>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Pre-select FPS for all orphaned subtitles (subtitles without video files)
            </p>
            <div className="relative" ref={fpsDropdownRef}>
              <button
                type="button"
                onClick={() => setFpsDropdownOpen(!fpsDropdownOpen)}
                className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 text-left flex items-center justify-between min-h-[40px]"
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.link;
                  e.target.style.boxShadow = `0 0 0 2px ${colors.link}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span>
                  {localConfig.defaultFps ? 
                    fpsOptions.find(fps => fps.value === localConfig.defaultFps)?.label || `${localConfig.defaultFps} FPS` :
                    'Select FPS'
                  }
                </span>
                <span className="ml-2">{fpsDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {fpsDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 rounded-lg shadow-lg z-50 min-w-full max-h-60 overflow-hidden"
                     style={{
                       backgroundColor: colors.cardBackground,
                       border: `1px solid ${colors.border}`,
                       boxShadow: `0 10px 25px -5px ${colors.shadow}`,
                     }}>
                  {/* Search input */}
                  <div className="p-3" style={{borderBottom: `1px solid ${colors.border}`}}>
                    <input
                      type="text"
                      placeholder="Type to search FPS..."
                      value={fpsSearchTerm}
                      onChange={(e) => setFpsSearchTerm(e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = colors.link;
                        e.target.style.boxShadow = `0 0 0 2px ${colors.link}20`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = colors.border;
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  {/* FPS options */}
                  <div className="max-h-48 overflow-y-auto">
                    {fpsOptions
                      .filter(fps => {
                        if (!fpsSearchTerm) return true;
                        const search = fpsSearchTerm.toLowerCase();
                        return (
                          fps.label.toLowerCase().includes(search) ||
                          fps.value.toString().includes(search)
                        );
                      })
                      .map((fps) => (
                        <button
                          key={fps.value}
                          type="button"
                          onClick={() => {
                            handleChange('defaultFps', fps.value);
                            setFpsDropdownOpen(false);
                            setFpsSearchTerm('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:opacity-90 transition-opacity"
                          style={{
                            backgroundColor: localConfig.defaultFps === fps.value ? colors.link : 'transparent',
                            color: localConfig.defaultFps === fps.value ? '#fff' : colors.text,
                          }}
                          onMouseEnter={(e) => {
                            if (localConfig.defaultFps !== fps.value) {
                              e.target.style.backgroundColor = colors.hoverBackground || (isDark ? '#3a3a3a' : '#f5f5f5');
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (localConfig.defaultFps !== fps.value) {
                              e.target.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {fps.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
            {localConfig.defaultFps && (
              <div className="flex items-center gap-2 text-xs" style={{ color: colors.success }}>
                <span>✓</span>
                <span>All orphaned subtitles will be pre-selected with {localConfig.defaultFps} FPS</span>
              </div>
            )}
          </div>
          
          {/* Minimal separator line */}
          <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />
          
          {/* Global Comment Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: colors.text }}>
              Global Comment
            </label>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              This comment will be applied to all subtitles (current and future)
            </p>
            <textarea
              value={localConfig.globalComment || ''}
              onChange={(e) => handleChange('globalComment', e.target.value)}
              placeholder="Enter a comment that will be applied to all subtitles..."
              className="w-full px-3 py-2 text-sm rounded-lg border resize-none transition-colors focus:outline-none focus:ring-2"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
                focusRingColor: colors.primary,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = colors.primary;
                e.target.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.border;
                e.target.style.boxShadow = 'none';
              }}
              rows="3"
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                {localConfig.globalComment?.length || 0}/500 characters
              </span>
              {localConfig.globalComment && (
                <button
                  onClick={() => handleChange('globalComment', '')}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    color: colors.error,
                    backgroundColor: colors.error + '10',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = colors.error + '20';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = colors.error + '10';
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          {/* Minimal separator line */}
          <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />
          
          {/* Default Translator Setting */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: colors.text }}>
              Default Translator
            </label>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Pre-fill translator field for all subtitles (current and future)
            </p>
            <input
              type="text"
              value={localConfig.defaultTranslator || ''}
              onChange={(e) => handleChange('defaultTranslator', e.target.value)}
              placeholder="Enter default translator name..."
              className="w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = colors.primary;
                e.target.style.boxShadow = `0 0 0 2px ${colors.primary}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = colors.border;
                e.target.style.boxShadow = 'none';
              }}
              maxLength={32}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: colors.textSecondary }}>
                {localConfig.defaultTranslator?.length || 0}/32 characters
              </span>
              {localConfig.defaultTranslator && (
                <button
                  onClick={() => handleChange('defaultTranslator', '')}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    color: colors.error,
                    backgroundColor: colors.error + '10',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = colors.error + '20';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = colors.error + '10';
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {localConfig.defaultTranslator && (
              <div className="flex items-center gap-2 text-xs" style={{ color: colors.success }}>
                <span>✓</span>
                <span>All subtitles will be pre-filled with "{localConfig.defaultTranslator}"</span>
              </div>
            )}
          </div>
          
            </>
          )}

          {/* Processing Tab */}
          {activeTab === 'processing' && (
            <>
              {/* Default Expanded State */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium" style={{ color: colors.text }}>
                Default Expanded State
              </label>
              <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Set whether upload options are expanded by default
              </p>
            </div>
            <div className="ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.uploadOptionsExpanded}
                  onChange={(e) => handleChange('uploadOptionsExpanded', e.target.checked)}
                  className="sr-only peer"
                />
                <div 
                  className="w-11 h-6 rounded-full peer transition-colors duration-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{
                    backgroundColor: localConfig.uploadOptionsExpanded ? colors.success : colors.border,
                  }}
                />
              </label>
            </div>
          </div>
          
          {/* Minimal separator line */}
          <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />
          
              {/* MKV Subtitle Extraction Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium" style={{ color: colors.text }}>
                Extract Subtitles from MKV
              </label>
              <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Automatically detect and extract embedded subtitles from MKV files
              </p>
            </div>
            <div className="ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.extractMkvSubtitles === true} // Default to true, persists to localStorage
                  onChange={(e) => handleChange('extractMkvSubtitles', e.target.checked)}
                  className="sr-only peer"
                />
                <div 
                  className="w-11 h-6 rounded-full peer transition-colors duration-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{
                    backgroundColor: (localConfig.extractMkvSubtitles === true) ? colors.success : colors.border,
                  }}
                />
              </label>
            </div>
          </div>
          
          {/* Minimal separator line */}
          <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />
          
          {/* Upload MovieHash Only Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium" style={{ color: colors.text }}>
                Upload MovieHash Only
              </label>
              <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Only update movie hashes without uploading subtitle files
              </p>
            </div>
            <div className="ml-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.uploadMovieHashOnly === true}
                  onChange={(e) => handleChange('uploadMovieHashOnly', e.target.checked)}
                  className="sr-only peer"
                />
                <div 
                  className="w-11 h-6 rounded-full peer transition-colors duration-200 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{
                    backgroundColor: (localConfig.uploadMovieHashOnly === true) ? colors.success : colors.border,
                  }}
                />
              </label>
            </div>
          </div>
          {localConfig.uploadMovieHashOnly === true && (
            <div className="flex items-center gap-2 text-xs" style={{ color: colors.warning || colors.error }}>
              <span>⚠️</span>
              <span>Subtitles will not be uploaded, only movie hashes will be updated</span>
            </div>
          )}
            </>
          )}

          {/* Shared settings (only Update Settings for now) */}
          <div className="space-y-4">
            {/* Minimal separator line */}
            <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.3 }} />

          {/* Update Settings */}
          <UpdateSettings />
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-4 border-t"
          style={{ borderTopColor: colors.border }}
        >
          <div className="text-xs" style={{ color: colors.textSecondary }}>
            Settings are saved automatically
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            style={{
              backgroundColor: colors.success,
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = colors.successHover || colors.primary;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = colors.success;
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};