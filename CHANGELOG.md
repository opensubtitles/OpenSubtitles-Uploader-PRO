# Changelog

All notable changes to OpenSubtitles Uploader PRO will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-08-08

### Changed
- 🚀 RELEASE v1.5.35: Smart Download-Only Auto-Update System
- 1.5.18
- 📥 ENHANCE: Smart download-only auto-update system + automated changelog

## [1.5.35] - 2025-08-08

### Added
- Add v1.5.9 entries to CHANGELOG.md
- Add in-app changelog viewer with markdown rendering
- Remove CC from Hearing Impaired detection and add PSDH support
- Add comprehensive release process documentation to CLAUDE.md
- Add OpenSubtitles.com to acknowledgments
- Add MKV extraction progress indicators and WASM initialization v1.5.3

### Changed
- 1.5.18
- 📥 ENHANCE: Smart download-only auto-update system + automated changelog
- Test release v1.5.16 - Auto-updater verification
- Re-enable Tauri auto-updater with proper code signing
- Disable Tauri auto-updater until code signing is available
- Optimize release builds: Remove RPM, DEB, and MSI formats
- Improve dark mode text contrast in changelog overlay
- Enhance version management documentation in CLAUDE.md
- Update CHANGELOG.md with complete project history
- Remove Web Application from Downloads section in README
- Improve README formatting for supported file formats section
- Suppress Vite externalization warning for archive-wasm module dependency
- Organize project structure and clean up root directory
- Restructure README with user-focused content first
- Streamline release assets to essential formats only
- Update README with version-agnostic download links and universal macOS build

### Fixed
- Version bump to v1.5.17 for Windows build fix test
- Fix Windows build: Force bash shell for artifact upload
- Fix app icon visibility in dark mode
- Fix macOS DMG dark mode appearance
- Fix AdBlock test page state management and add uploader link
- Fix closure issue in test completion check
- Fix test completion detection for accurate recommendations
- Fix initial page load timing issue for test recommendations
- Fix incorrect 'No Internet Connection' recommendation when tests pass
- Fix CORS error in network connectivity test
- Fix 'Changelog' header text color for dark mode readability
- Fix changelog overlay dark mode styling
- Fix APP_VERSION in constants.js to match package.json (1.5.9)
- Fix IMDb ID search to handle short numeric IDs with zero padding
- Fix deploy.sh to work when run from any directory
- Fix false positive Hearing Impaired detection for NonHI patterns
- Update Tauri configuration for v1.5.4 and fix bundle targets format
- Ensure consistent Hearing Impaired behavior between paired and orphaned subtitles v1.5.4
- Fix releases link to point to latest release

## [1.5.17] - 2025-08-08

### Added
- Add v1.5.9 entries to CHANGELOG.md
- Add in-app changelog viewer with markdown rendering
- Remove CC from Hearing Impaired detection and add PSDH support
- Add comprehensive release process documentation to CLAUDE.md
- Add OpenSubtitles.com to acknowledgments
- Add MKV extraction progress indicators and WASM initialization v1.5.3

### Changed
- Test release v1.5.16 - Auto-updater verification
- Re-enable Tauri auto-updater with proper code signing
- Disable Tauri auto-updater until code signing is available
- Optimize release builds: Remove RPM, DEB, and MSI formats
- Improve dark mode text contrast in changelog overlay
- Enhance version management documentation in CLAUDE.md
- Update CHANGELOG.md with complete project history
- Remove Web Application from Downloads section in README
- Improve README formatting for supported file formats section
- Suppress Vite externalization warning for archive-wasm module dependency
- Organize project structure and clean up root directory
- Restructure README with user-focused content first
- Streamline release assets to essential formats only
- Update README with version-agnostic download links and universal macOS build

### Fixed
- Version bump to v1.5.17 for Windows build fix test
- Fix Windows build: Force bash shell for artifact upload
- Fix app icon visibility in dark mode
- Fix macOS DMG dark mode appearance
- Fix AdBlock test page state management and add uploader link
- Fix closure issue in test completion check
- Fix test completion detection for accurate recommendations
- Fix initial page load timing issue for test recommendations
- Fix incorrect 'No Internet Connection' recommendation when tests pass
- Fix CORS error in network connectivity test
- Fix 'Changelog' header text color for dark mode readability
- Fix changelog overlay dark mode styling
- Fix APP_VERSION in constants.js to match package.json (1.5.9)
- Fix IMDb ID search to handle short numeric IDs with zero padding
- Fix deploy.sh to work when run from any directory
- Fix false positive Hearing Impaired detection for NonHI patterns
- Update Tauri configuration for v1.5.4 and fix bundle targets format
- Ensure consistent Hearing Impaired behavior between paired and orphaned subtitles v1.5.4
- Fix releases link to point to latest release

## [1.5.9] - 2025-08-07

### Added
- In-app changelog viewer with markdown rendering
- Interactive changelog button in footer (replaces external GitHub link)
- Smart fetching system (tries local first, falls back to GitHub)
- Responsive modal design with theme support
- Loading states and error handling with retry functionality

### Fixed
- Improved dark mode styling for changelog overlay
- Better text contrast and readability in dark mode
- Enhanced close button styling for dark themes
- Fixed content area background and scrollbar styling

## [1.5.8] - 2025-08-07

### Added
- Proper Tauri updater configuration with native update checks
- Automatic changelog generation from commits
- Clickable changelog link in application footer
- Required Tauri plugins (updater, process) and dependencies

### Changed
- Replaced hardcoded version text with changelog link
- Enabled Tauri native auto-updater with proper API integration
- Updated GitHub workflow to include changelog in releases

### Fixed
- Fixed Tauri auto-update functionality that was previously disabled
- Improved update service implementation with proper error handling

## [1.5.7] - 2025-08-07

### Changed
- Refined Hearing Impaired detection system
- Removed CC from Hearing Impaired detection 
- Added PSDH (Programme Subtitles for the Deaf and Hard-of-hearing) support

## [1.5.6] - 2025-08-07

### Fixed
- Improved IMDb search functionality
- Fixed IMDb ID search to handle short numeric IDs with zero padding

### Changed
- Removed Web Application from Downloads section in README
- Improved README formatting for supported file formats section

## [1.5.5] - 2025-08-07

### Fixed
- Fixed false positive Hearing Impaired detection for NonHI patterns
- Suppressed Vite externalization warning for archive-wasm module dependency

### Changed
- Fixed deploy.sh to work when run from any directory

## [1.5.4] - 2025-08-07

### Fixed
- Ensured consistent Hearing Impaired behavior between paired and orphaned subtitles
- Updated Tauri configuration and fixed bundle targets format

### Added
- Comprehensive release process documentation to CLAUDE.md

### Changed
- Organized project structure and cleaned up root directory
- Restructured README with user-focused content first
- Added OpenSubtitles.com to acknowledgments
- Streamlined release assets to essential formats only
- Updated README with version-agnostic download links and universal macOS build

## [1.5.3] - 2025-08-07

### Added
- MKV extraction progress indicators and WASM initialization

## [1.5.2] - 2025-08-07

### Fixed
- Fixed MKV extraction config persistence
- Improved subtitle naming

## [1.5.0] - 2025-08-07

### Added
- Efficient MKV subtitle extraction with metadata caching
- MKV subtitle processing with better error handling and performance

### Changed
- Removed excessive debug logging from console output
- Fixed MKV subtitle extraction pairing with v1.8.1 API structure

## [1.4.7] - 2025-08-07

### Security
- Complete API key removal and security fix

## [1.4.6] - 2025-08-07

### Fixed
- Fixed macOS Universal Binary release upload
- Fixed XML character escaping for apostrophes in filenames

## [1.4.5] - 2025-08-07

### Added
- Unified session management system to prevent authentication errors

### Fixed
- Fixed authentication issue: AuthContext now reads remember_sid cookie

## [1.4.0] - 2025-08-07

### Added
- .env file loading support to deploy script
- OpenSubtitles API key support to deploy script
- Smart connectivity monitoring and ad blocker detection for desktop apps

### Fixed
- Improved deploy script to handle stale repository issues
- Fixed version synchronization across all configuration files
- Fixed Tauri 2.0 shell plugin configuration format

## [1.3.0] - 2025-08-07

### Added
- Comprehensive Intel build diagnostics and target verification
- Proper macOS universal binary creation with lipo
- macOS universal binary (Intel + Apple Silicon) support

### Fixed
- Fixed universal binary creation with comprehensive error handling
- Fixed Tauri 2.0 security capabilities configuration
- Fixed duplicate useAppUpdate import causing build error

## [1.2.0] - 2025-08-07

### Added
- Comprehensive token debugging for macOS login issues
- Custom update notifications and shell plugin ACL
- Multi-platform builds: macOS (Intel+ARM) and Windows support
- Comprehensive MKV processing, error handling, and tabbed config
- MKV subtitle extraction with real-time UI feedback

### Changed
- Improved debug logging UX: use ⚠️ for cache misses instead of ❌
- Disabled Tauri updater to prevent console errors in unsigned builds
- Updated Tauri app version to 1.2.0 to match package.json

### Fixed
- Fixed Tauri 2.0 bundle configuration validation
- Fixed episode title display to filter out null values
- Converted FPS dropdowns to searchable design matching language dropdowns
- Fixed logo display logic for dark/light theme switching

## [1.1.22] - 2025-08-07

### Changed
- Version bump and codebase cleanup

## [1.1.2] - 2025-08-07

### Added
- Configuration overlay with enhanced help system
- Improved ZIP processing
- Native desktop app support with Tauri framework
- GitHub Actions workflows for automated desktop app builds
- Comprehensive authentication system with XML-RPC LogIn/LogOut
- Comprehensive auto-update system for standalone desktop app

### Fixed
- Fixed file selection button by replacing non-existent processFilesInBatches
- Fixed Ubuntu package names for GitHub Actions workflows
- Fixed Tauri API build issues
- Fixed drag and drop functionality in Tauri standalone app
- Fixed webkit2gtk package dependencies

### Changed
- Upgraded to Tauri 2.0 with proper webkit2gtk-4.1 support
- Added runtime environment indicator for debugging
- Implemented auto-scroll to Matched Pairs section after file processing
- Implemented username persistence for login dialog

## [1.1.0] - 2025-08-07

### Added
- New ZIP processing service
- File selection button to drop zone with one-time usage restriction
- Reusable MovieSearch component
- Shared movie search hook

### Fixed
- Fixed HD detection inconsistency and cleaned up excessive logging
- Updated movie search API to use correct suggest_imdb.php endpoint

## [1.0.9] - 2025-08-07

### Fixed
- Fixed movie search API endpoint to use correct suggest.php
- Fixed movie change functionality for orphaned subtitles
- Fixed FPS transmission in TryUploadSubtitles for both matched pairs and orphaned subtitles

## [1.0.8] - 2025-08-07

### Fixed
- Fixed JavaScript initialization error
- Enhanced config overlay with searchable language dropdown
- Added comprehensive upload logging to debug NetworkError issues
- Removed session expiry - sessions now persist permanently
- Implemented session ID security fix to prevent accidental sharing

## [1.0.7] - 2025-08-07

### Fixed
- Fixed progress overlay display and completion logic
- Streamlined debug output
- Fixed CheckSubHash for orphaned subtitles

## [1.0.6] - 2025-08-07

### Fixed
- Comprehensive text input fixes

## [1.0.5] - 2025-08-07

### Fixed
- Language dropdown fixes and UX improvements

## [1.0.4] - 2025-08-07

### Fixed
- Comprehensive upload options fixes
- Episode detection improvements

## [1.0.3] - 2025-08-07

### Added
- Video metadata extraction with FFmpeg integration

### Fixed
- Enhanced video metadata display and improved UX
- Fixed networkUtils import in videoMetadataService

## [1.0.2] - 2025-08-07

### Added
- Documented version management process in CLAUDE.md
- Centralized version management

### Fixed
- Fixed version display
- Refactored render logic to prevent React hooks order issues
- Fixed episode detection with useEffect-based enhancement
- Fixed episode display by fetching episode-specific features data
- Fixed infinite loop and restored all auto-detection features

## [1.0.1] - 2025-08-07

### Added
- Code splitting to optimize bundle size and performance
- CheckSubHash functionality for subtitle duplicate checking
- Automatic hearing impaired detection from file paths
- Comprehensive upload options UI with improved positioning

### Fixed
- Fixed interactive element click handling for better UX
- Fixed episode display showing "S00E??" format
- Updated GitHub repository URLs to opensubtitles-uploader-pro
- Auto-unselect subtitles that already exist in database
- Fixed CheckSubHash URL format and response parsing
- Fixed dark mode styling for CheckSubHash display

## [1.0.0] - 2025-08-07

### Added
- Initial release of OpenSubtitles Uploader PRO
- Login requirement for uploader functionality
- GitHub Actions CI and test badge
- Drag & drop interface for subtitle files
- Automatic video/subtitle pairing
- Language detection and movie recognition
- Movie hash calculation
- Support for multiple subtitle formats
- Dark/light theme support
- Comprehensive error handling
- Session management
- Progress indicators
- Debug panel and logging
- Stats panel
- Help overlay
- Configuration options

### Features
- Professional React-based subtitle uploader
- Integration with OpenSubtitles APIs
- Automatic file pairing and metadata enrichment
- Real-time upload progress
- Comprehensive subtitle validation
- Multi-language support
- Responsive design
- Cross-platform compatibility

---

*This changelog is automatically updated from git commits. For more details on any release, see the [GitHub releases page](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases).*