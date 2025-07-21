# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based subtitle uploader application that integrates with the OpenSubtitles API. The application allows users to drag and drop video and subtitle files, automatically pairs them, detects subtitle languages, calculates movie hashes, and provides metadata enrichment through various services.

## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Build production version
- `npm run preview` - Preview production build locally
- `npm run update-version` - **IMPORTANT**: Update version references across codebase (run after changing version in package.json)

**IMPORTANT**: Never automatically run the development server (`npm run dev`). Always ask the user to restart the server if needed. The server should only be started by the user, not by Claude.

**CRITICAL**: Never automatically create git commits. Only create commits when explicitly asked by the user. All changes should be made and tested first, then wait for user instruction before committing.

## Version Management

**CRITICAL**: When updating the version in `package.json`, you MUST run `npm run update-version` to sync version references across the codebase.

The application displays version information in multiple places:
- `src/utils/constants.js` - APP_VERSION constant (displayed on the page)
- `README.md` - Version badge
- `package.json` - Main version source

**Process for version updates:**
1. Update version in `package.json`
2. Run `npm run update-version` to sync all version references
3. Commit and push changes

**Why this matters:** Without running the update script, the page will display the old version from `constants.js` while `package.json` has the new version, causing user confusion.

## Architecture

### Core Components

The application is structured around a main `SubtitleUploader` component that orchestrates multiple custom hooks and services:

**Main Component**: `src/components/SubtitleUploader.jsx`
- Central orchestrator that manages file processing, language detection, and movie metadata
- Uses multiple custom hooks for different concerns
- Handles file upload states and user interactions

**Custom Hooks** (in `src/hooks/`):
- `useFileHandling` - Manages file drop, processing, and pairing logic
- `useLanguageData` - Handles language data fetching and management
- `useLanguageDetection` - Processes subtitle language detection via OpenSubtitles API
- `useMovieGuess` - Integrates with GuessIt service for movie metadata (episode detection disabled)
- `useGuessIt` - Provides detailed file metadata extraction
- `useDebugMode` - Debug panel and logging functionality

**Note**: `useMovieGuess` currently has episode detection functionality disabled to prevent React setState during render warnings.

**Services** (in `src/services/`):
- `api/openSubtitlesApi.js` - OpenSubtitles REST API integration
- `api/xmlrpc.js` - XML-RPC client for legacy OpenSubtitles API
- `fileProcessing.js` - File system handling and drag-drop processing
- `movieHash.js` - Movie hash calculation service
- `cache.js` - Local storage caching system
- `guessItService.js` - GuessIt API integration for metadata extraction

### File Processing Flow

1. **Drop Zone**: Files are dropped into `DropZone` component
2. **File Processing**: `FileProcessingService` processes dropped items (supports directories)
3. **File Pairing**: `pairVideoAndSubtitleFiles` utility matches videos with subtitles
4. **Parallel Processing**: Multiple services run concurrently:
   - Movie hash calculation for video files
   - Language detection for subtitle files
   - Movie metadata guessing via GuessIt
   - Feature data fetching from OpenSubtitles API

### Key Utilities

- `src/utils/fileUtils.js` - File type detection, pairing logic, and validation
- `src/utils/constants.js` - API endpoints, cache keys, and configuration
- `src/utils/networkUtils.js` - Network request utilities with delays
- `src/utils/retryUtils.js` - Retry logic for API calls

## Technical Stack

- **React 18** with hooks-based architecture
- **Vite** for development and build tooling
- **Tailwind CSS** for styling
- **OpenSubtitles API** for language detection and metadata
- **GuessIt API** for movie metadata extraction
- **Local Storage** for caching API responses

## Key Features

### Currently Working Features ✅

- Drag and drop support for files and directories
- Automatic video/subtitle file pairing
- Language detection for subtitle files
- Movie hash calculation for video files
- Basic movie metadata enrichment (without episode detection)
- Upload state management per subtitle
- Debug mode with detailed logging
- Caching system for API responses
- Retry logic for network operations
- Movie poster display
- Basic TV series detection (shows as TV series)
- GuessIt metadata tags (quality, codecs, etc.)
- Manual movie search and selection
- Features data fetching and error handling

### Disabled Features ❌

- Episode-specific title formatting
- Episode-specific IMDb ID detection
- Episode-specific poster fetching
- Complex episode matching logic
- Season/episode number display in titles
- Episode-specific features data fetching

## File Structure Notes

- Components are organized by functionality in `src/components/`
- File list components are grouped under `src/components/FileList/`
- Custom hooks are separated by concern in `src/hooks/`
- Services are organized by API type in `src/services/api/`
- Utilities are grouped by purpose in `src/utils/`
- Configuration uses JSON files (vite.config.json, tailwind.config.json)

## Development Notes

- The application uses parallel processing to handle multiple files efficiently
- Processing states are tracked per file to prevent duplicate operations
- The pairing algorithm matches files based on name similarity and directory structure
- Debug mode provides detailed logging for troubleshooting file processing issues
- Browser capabilities are detected to optimize file handling behavior

### React setState During Render Prevention

**CRITICAL**: When working with this codebase, be extremely careful about React setState during render warnings. The following practices should be followed:

1. **Never call setState or state-updating functions directly in render**
2. **Use useEffect hooks for side effects, not direct function calls in render**
3. **Be cautious with useMemo and useCallback dependencies that might trigger state updates**
4. **Avoid complex nested state updates in component rendering**
5. **Use setTimeout or useEffect to defer state updates when needed**
6. **Test incrementally when adding back complex functionality**

### Current Safe Patterns

- ✅ Basic feature fetching with setTimeout delays
- ✅ Simple useMemo for basic data transformation
- ✅ useCallback for event handlers
- ✅ Direct prop passing without complex processing
- ❌ Complex episode detection logic in render
- ❌ Nested state updates in useMemo
- ❌ Direct API calls in render functions

## Episode-Specific Features (SUCCESSFULLY RESTORED)

**IMPORTANT**: Episode-specific features have been successfully restored using useEffect-based approach to avoid setState during render warnings.

**Current Status**:
- **Episode Matching**: Uses GuessIt data to match specific episodes within TV series ✅ **WORKING**
- **Episode-Specific IMDb IDs**: Correctly identifies episode-specific IMDb IDs for proper uploads ✅ **WORKING**
- **Episode Detection**: Detects season/episode numbers from filenames ✅ **WORKING**
- **Episode-Specific Display**: Shows "Resident Alien - S04E04 - Truth Hurts (2021)" format ✅ **WORKING**
- **Episode Features**: Fetches episode-specific subtitle counts and metadata from OpenSubtitles API ✅ **WORKING**
- **Episode Posters**: Automatically fetches and displays episode-specific posters when available ✅ **WORKING**
- **Smart Title Generation**: Uses parent_title + season/episode + original_title format for clarity ✅ **WORKING**

**SUCCESS**: All episode-specific features are now working correctly for both paired files and orphaned subtitles.

### Episode Detection Issue History

The application previously had comprehensive episode detection functionality that was causing React setState during render warnings. To resolve this issue, the following components were systematically disabled:

1. **MovieDisplay.jsx**: 
   - Disabled `findEpisodeMatch` function
   - Disabled `getBestMovieData` episode processing
   - Disabled episode-specific features data fetching
   - Disabled complex useMemo hooks that were causing setState calls

2. **useMovieGuess.js**:
   - Disabled `createEpisodeMovieData` function
   - Disabled TV series episode enhancement logic
   - Disabled episode-specific GuessIt processing

3. **MatchedPairs.jsx & OrphanedSubtitles.jsx**:
   - Temporarily disabled MovieDisplay components entirely
   - Later re-enabled with basic functionality only
   - Removed episode detection data passing

### Second setState During Render Issue (Current)

**Date**: 2025-07-16
**Issue**: After successfully restoring episode detection with proper IMDb IDs, attempting to enhance title formatting with `/features` endpoint data caused the setState during render warning to return.

**What Was Working Before This Issue**:
- ✅ Episode-specific IMDb IDs (e.g., 8690918) for proper uploads
- ✅ Basic episode detection (S00E?? format)
- ✅ Episode-specific features fetching
- ✅ Proper episode titles ("Resident Alien - S04E04 - Truth Hurts")

**What Caused the Issue**:
- Re-enabling `findEpisodeMatch` function in `MovieDisplay.jsx`
- Enhanced `getBestMovieData` useMemo with complex episode matching logic
- Using `/features` endpoint data in useMemo dependencies

**Root Cause**: The `findEpisodeMatch` function and enhanced `getBestMovieData` useMemo are causing setState during render because they process complex data transformations that trigger state updates in the render cycle.

**Solution Needed**: Move episode matching logic outside of render cycle, possibly to:
1. useEffect hooks for episode matching
2. Separate service/context for episode processing
3. Defer episode enhancement to avoid render-time processing
4. Use a separate state management system for episode data

### SOLUTION IMPLEMENTED (2025-07-16)

**✅ RESOLVED**: Successfully implemented useEffect-based episode enhancement approach.

**What Was Implemented**:
1. **Separate State Management**: Added `enhancedEpisodeData` state in MovieDisplay component
2. **useEffect-Based Processing**: Moved all /features endpoint processing to useEffect hook
3. **Deferred Title Updates**: Initial render shows basic data, then enhances with proper titles
4. **Two-Stage Rendering**: Basic episode detection first, then enhanced titles from /features API

**Technical Implementation**:
- Added `const [enhancedEpisodeData, setEnhancedEpisodeData] = React.useState(null)` to MovieDisplay
- Created dedicated useEffect for episode title enhancement that runs after render
- Enhanced data processing moved outside render cycle to prevent setState warnings
- Final movie data prefers enhanced data: `const finalMovieData = enhancedEpisodeData || getBestMovieData`

**Bug Fix for Orphaned Subtitles**:
- Fixed OrphanedSubtitles.jsx passing `guessItData={{}}` instead of `guessItData={guessItData}`
- This was preventing episode enhancement from working for orphaned subtitles

**Current Working State**:
- ✅ **Paired files**: Movie + subtitle files show proper episode titles
- ✅ **Orphaned subtitles**: Subtitle-only files show proper episode titles
- ✅ **Episode IMDb IDs**: Correctly uses episode-specific IMDb IDs for upload
- ✅ **No setState warnings**: All processing happens in useEffect, not during render
- ✅ **Proper titles**: Shows "Resident Alien - S04E04 - Truth Hurts (2021)" format

**Result**: Critical UX issue resolved - no more "S00E??" format, proper episode titles display correctly.

### Current Working State

The application currently works with the following functionality:

✅ **Working Features**:
- Basic movie detection via XML-RPC
- Basic TV series detection (shows as TV series, but no episode specifics)
- Features data fetching from OpenSubtitles API
- Movie posters and basic metadata display
- Checkbox functionality for subtitle selection
- Retry functionality for failed API calls
- GuessIt metadata tags display (quality, codecs, etc.)
- Upload functionality with validation
- Movie search and manual selection

❌ **Disabled Features**:
- Episode-specific title formatting
- Episode-specific IMDb ID detection
- Episode-specific poster fetching
- Episode-specific features data
- Complex episode matching logic
- Season/episode number display
- Episode-specific upload handling

### Technical Details of the Issue

The setState during render warnings occurred because:
1. MovieDisplay component was calling `fetchFeaturesByImdbId` during render
2. Episode detection logic was triggering state updates in render cycles
3. Complex useMemo dependencies were causing cascading state updates
4. GuessIt processing was triggering state changes during component rendering

The solution involved:
1. Disabling all episode-specific logic
2. Simplifying state management in MovieDisplay
3. Removing complex memoization that caused setState calls
4. Gradually re-enabling basic functionality without episode detection

### Re-enabling Process

If episode detection needs to be re-enabled, it should be done carefully:
1. Use useEffect hooks instead of direct function calls in render
2. Implement proper state management to avoid setState during render
3. Consider using useCallback and useMemo more carefully
4. Test each component incrementally to identify specific causes
5. Consider moving episode detection to a separate service or context

## Upload System

The application includes a comprehensive upload validation and submission system:

- **Upload Button**: Large, prominent upload button that appears when paired files are available
- **Comprehensive Validation**: Ensures all requirements are met before allowing upload:
  - All selected subtitles must have identified movies with valid IMDb IDs
  - All selected subtitles must have assigned upload languages
  - Features data should be loaded for accurate metadata
- **Visual Feedback**: Clear indication of upload readiness with detailed error/warning messages
- **Upload Requirements Checklist**: Shows users exactly what needs to be completed
- **Smart IMDb Selection**: Currently uses main series IMDb IDs for TV shows (episode-specific IDs disabled)
- **Progress Tracking**: Shows count of ready subtitles vs. total selected subtitles

**Note**: Upload functionality works correctly with the current basic implementation, but TV shows will upload with series-level IMDb IDs rather than episode-specific IDs due to the disabled episode detection.

## RESOLVED: setState During Render Warning (2025-07-16)

**✅ ISSUE RESOLVED**: React warning when uploading subtitles has been fixed.

### Root Cause Identified

**Primary Cause**: `useDebugMode` hook was causing "Maximum update depth exceeded" and setState during render warnings.

**Error Messages**:
- `Warning: Cannot update a component (SubtitleUploaderInner) while rendering a different component (MatchedPairs)`
- `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render`

**Trigger**: Occurred when clicking "Upload Subtitles" button, especially for subtitles that already exist in the database

### Solution Implemented

**✅ Debug Mode Disabled**: The `useDebugMode` hook has been permanently disabled to prevent React warnings.
- All other hooks (GuessIt, CheckSubHash, VideoMetadata, LanguageDetection, MovieGuess) work correctly
- Full application functionality restored except debug panel
- Upload functionality works perfectly without warnings

**Current Status**:
- ✅ All core features working: episode detection, language detection, upload validation, etc.
- ✅ No React warnings during upload process
- 🚫 Debug mode disabled (root cause of the issue)

### Debug Mode Issue

**Problem**: The `useDebugMode` hook in `src/hooks/useDebugMode.js` has a fundamental setState during render issue that causes:
1. Maximum update depth exceeded warnings
2. setState during render warnings  
3. Infinite re-render loops

**✅ RESOLVED**: Debug mode hook fixed to prevent React warnings while maintaining debug functionality.

### Debug Mode Fix (2025-07-16)

**Problem**: The `useDebugMode` hook in `src/hooks/useDebugMode.js` was causing React warnings due to two issues:

1. **Infinite re-render loop**: The `originalConsole` object was being recreated on every render, causing the `useEffect` dependency array to trigger infinite re-renders.

2. **setState during render**: The `addDebugInfo` function was being called during the render cycle (especially during upload processing), causing "Cannot update a component while rendering a different component" warnings.

**Solution Applied**:

1. **Fixed `originalConsole` dependency issue**:
   ```javascript
   // BEFORE: Created new object on every render
   const originalConsole = {
     log: console.log,
     warn: console.warn,
     error: console.error,
     info: console.info
   };
   
   // AFTER: Stable reference with useRef
   const originalConsole = useRef({
     log: console.log,
     warn: console.warn,
     error: console.error,
     info: console.info
   });
   ```

2. **Added `setTimeout` deferrals to prevent setState during render**:
   ```javascript
   // BEFORE: Direct setState call
   setDebugInfo(prev => [...prev, message]);
   
   // AFTER: Deferred setState call
   setTimeout(() => {
     setDebugInfo(prev => [...prev, message]);
   }, 0);
   ```

3. **Updated dependency array**: Removed `originalConsole` from `useEffect` dependencies since it's now a stable `useRef`.

**Files Modified**:
- `src/hooks/useDebugMode.js` - Fixed hook implementation
- `src/components/SubtitleUploader.jsx` - Re-enabled debug mode after fix

**Result**: Debug mode now works perfectly without React warnings, providing full debug panel functionality during upload operations.

### Future Reference for Similar Issues

**Pattern Recognition**: When encountering "setState during render" or "Maximum update depth exceeded" warnings:

1. **Check for object dependencies in useEffect**: Objects created in render will cause infinite re-renders
2. **Look for setState calls during render**: Functions called during render that update state need to be deferred
3. **Use `setTimeout(..., 0)` to defer state updates**: This moves the setState call out of the render cycle
4. **Use `useRef` for stable object references**: Prevents dependency array issues in useEffect

**Common Culprits**:
- Debug/logging functions called during render
- useEffect with changing object dependencies
- State updates triggered by prop changes during render
- Console interception that updates state synchronously

### Debugging Process and Attempted Solutions

#### 1. Initial Investigation (Completed)
- **Root Cause Hypothesis**: setState calls happening during render cycle in upload process
- **Files Modified**: 
  - `src/components/SubtitleUploader.jsx` - Added setTimeout() wrappers to defer setState calls
  - `src/components/MatchedPairs.jsx` - Various state management fixes

#### 2. SubtitleUploader.jsx Fixes Applied (Completed)
**Problem**: Multiple setState calls in upload process happening during render
**Solution**: Wrapped problematic setState calls in `setTimeout(..., 0)` to defer until after render:

```javascript
// Upload Results - Lines 243-247
setTimeout(() => {
  setUploadResults(newUploadResults);
  setSubcontentData(newSubcontentData);
}, 0);

// Upload Progress - Lines 203-209, 223-227, 317-319
setTimeout(() => {
  setUploadProgress({ isUploading: true, processed: 0, total: validationResult.readySubtitlesCount });
}, 0);

// Movie Changes - Lines 322-326
setTimeout(() => {
  setMovieGuess(videoPath, newMovieGuess);
}, 0);
```

**Result**: Warning persisted, indicating the issue is not in SubtitleUploader.jsx

#### 3. MatchedPairs.jsx Systematic Elimination (In Progress)

**Approach**: Systematically disable state variables and complex functions to isolate the setState during render source.

**Phase 1 - Movie Search State Variables (Completed)**:
```javascript
// DISABLED - Lines 124-128
// const [openMovieSearch, setOpenMovieSearch] = React.useState(null);
// const [movieSearchQuery, setMovieSearchQuery] = React.useState('');
// const [movieSearchResults, setMovieSearchResults] = React.useState([]);
// const [movieSearchLoading, setMovieSearchLoading] = React.useState(false);
// const [movieUpdateLoading, setMovieUpdateLoading] = React.useState({});
```

**Phase 2 - Local Upload States (Completed)**:
```javascript
// DISABLED - Line 129
// const [localUploadStates, setLocalUploadStates] = React.useState({});
```

**Phase 3 - Complex Data Processing Functions (Completed)**:
```javascript
// DISABLED - Lines 214-218
const getBestMovieData = (videoPath) => {
  // Return basic movie data only to isolate setState during render issue
  return movieGuesses[videoPath];
};
```

**Phase 4 - Movie Search UI and Handlers (Completed)**:
- Disabled debounced search useEffect
- Disabled movie search handlers
- Disabled movie search UI interface
- Disabled click outside handlers

**Phase 5 - Prop Function Calls (Completed)**:
- Disabled `getUploadEnabled()` calls - hardcoded to `true`
- Disabled `getSubtitleLanguage()` calls - hardcoded display
- Disabled `getLanguageOptionsForSubtitle()` calls - empty array
- Disabled `onToggleUpload()` calls - empty function
- Disabled conditional rendering based on upload state

**Phase 6 - Complex Render Logic (Completed)**:
- Disabled language-specific subtitle count calculation (lines 708-709)
- Simplified all conditional rendering
- Removed complex data processing in render

#### 4. Current State of MatchedPairs.jsx (Heavily Disabled)

**What's Currently Disabled**:
- ✅ All movie search functionality
- ✅ All local upload state management
- ✅ Complex episode data processing
- ✅ Most prop function calls
- ✅ Complex subtitle count calculations
- ✅ Conditional rendering based on upload states

**What's Still Active**:
- ❌ Basic component rendering
- ❌ MovieDisplay component rendering
- ❌ SubtitleUploadOptions component rendering
- ❌ Basic prop passing

**Result**: Warning still persists, pointing to same line (125) even though that line is now a comment.

### Key Findings

1. **React Stack Trace Inaccuracy**: The stack trace pointing to line 125 is inaccurate since that line is now a comment
2. **Issue Not in State Variables**: Disabling all state variables didn't resolve the issue
3. **Issue Not in Complex Functions**: Disabling complex data processing didn't resolve the issue
4. **Issue Not in Prop Functions**: Disabling most prop function calls didn't resolve the issue
5. **Issue Likely in Child Components**: The problem is probably in `<MovieDisplay>` or `<SubtitleUploadOptions>` components

### Next Steps for New Claude Session

1. **Focus on Child Components**: Investigate `MovieDisplay.jsx` and `SubtitleUploadOptions.jsx` for setState during render
2. **Check for useEffect Dependencies**: Look for useEffect hooks that might be triggering state updates during render
3. **Examine Prop Passing**: Check if props being passed to child components are causing state updates
4. **Consider React DevTools**: Use React DevTools profiler to identify the exact component causing the issue
5. **Gradual Re-enabling**: Once the issue is resolved, gradually re-enable disabled functionality

### Code Recovery

To restore the MatchedPairs.jsx component to working state after fixing the setState issue:

1. **Re-enable State Variables**: Uncomment lines 124-129
2. **Re-enable Movie Search**: Uncomment movie search functionality
3. **Re-enable Prop Functions**: Restore getUploadEnabled, getSubtitleLanguage, etc.
4. **Re-enable Complex Logic**: Restore getBestMovieData and subtitle count calculations
5. **Test Incrementally**: Add back one feature at a time to ensure no regression

### Files Modified During This Session

- `src/components/SubtitleUploader.jsx` - Added setTimeout wrappers for setState calls
- `src/components/MatchedPairs.jsx` - Extensively disabled functionality for debugging
- `CLAUDE.md` - This documentation

### Warning Pattern

The warning consistently occurs when:
1. User clicks "Upload Subtitles" button
2. Application processes subtitles that already exist in database
3. Some component in the MatchedPairs render tree triggers setState during render
4. React detects the violation and throws the warning

The issue is specifically tied to the upload process and subtitle database checking, not general rendering.

## CheckSubHash Duplicate Detection Feature (2025-07-17)

**✅ IMPLEMENTED**: CheckSubHash duplicate detection functionality has been successfully implemented for matched pairs.

### Current Status

**✅ Working for Matched Pairs**:
- Detects duplicate subtitles in the OpenSubtitles database using file hash
- Shows encouraging message: "💡 Duplicate found, but still good to upload for additional metadata."
- Provides direct link to existing subtitle on OpenSubtitles.org
- Appears as a clean, separate line below Upload Options
- Does not interfere with main UI design

**❌ Not Working for Orphaned Subtitles**:
- CheckSubHash results are `undefined` for orphaned subtitles
- Feature disabled until CheckSubHash service processes orphaned files
- Orphaned subtitles can still be uploaded normally

### Technical Implementation

**Location**: 
- `src/components/MatchedPairs.jsx` (lines 778-840) - Working implementation
- `src/components/OrphanedSubtitles.jsx` (lines 555-560) - Disabled/placeholder

**Data Structure Expected**:
```javascript
hashCheckResults[subtitlePath] = {
  subtitleUrl: "https://www.opensubtitles.org/search/idsubtitlefile-1961760233",
  subtitleId: 1961760233,
  exists: true,
  status: "exists"
}
```

**Design Approach**:
- Completely separate from main UI components
- Added as standalone line in parent components (not in SubtitleUploadOptions)
- Uses same logic for both MatchedPairs and OrphanedSubtitles
- No duplicate code - identical implementation in both components

### User Experience

**Message**: "💡 Duplicate found, but still good to upload for additional metadata."
**Link**: "View existing subtitle" - links directly to the existing subtitle page
**Positioning**: Appears below Upload Options as a subtle, encouraging note
**Styling**: Simple text with underlined link, no background or border

### Integration Points

**Props Required**:
- `hashCheckResults` - Object containing CheckSubHash results keyed by file path
- Results must be processed into consistent object structure
- Both MatchedPairs and OrphanedSubtitles receive this prop from SubtitleUploader

**Files Modified**:
- `src/components/MatchedPairs.jsx` - Added CheckSubHash note implementation
- `src/components/OrphanedSubtitles.jsx` - Added CheckSubHash note (disabled)
- `src/components/SubtitleUploadOptions.jsx` - Removed CheckSubHash logic (moved to parents)

### Future Enhancement for Orphaned Subtitles

To enable CheckSubHash for orphaned subtitles:
1. Configure CheckSubHash service to process orphaned subtitle files
2. Ensure results are stored with correct file path keys
3. Create same object structure as matched pairs
4. Remove the `return null;` placeholder in OrphanedSubtitles.jsx

The implementation is already in place and will work automatically once CheckSubHash service provides data for orphaned subtitles.

## Upload Logging and NetworkError Debugging (2025-07-17)

**✅ IMPLEMENTED**: Comprehensive upload logging has been added to debug NetworkError issues during subtitle uploads.

### Problem Description

Users occasionally encounter "NetworkError when attempting to fetch resource" during uploads, but the uploads often succeed despite this error. This creates confusion and makes it difficult to diagnose whether the issue is a real failure or a network timing problem.

### Solution Implemented

**Enhanced Network Request Logging**:
- Added detailed logging to XML-RPC service for both `TryUploadSubtitles` and `UploadSubtitles` methods
- Logs complete request/response cycle including headers, body sizes, and timing
- Enhanced error detection specifically for NetworkError/fetch failures
- Improved user messages distinguishing network vs API errors

**Files Modified**:
- `src/services/api/xmlrpc.js` - Added comprehensive network request logging
- `src/services/subtitleUploadService.js` - Enhanced error handling and user messages
- `src/utils/networkUtils.js` - Better error reporting in delayedFetch utility

### Console Logging Output

When uploads are processed, the console now shows detailed logs:

```
🌐 TryUploadSubtitles: Starting network request...
🌐 TryUploadSubtitles: URL: https://api.opensubtitles.org/xml-rpc
🌐 TryUploadSubtitles: Headers: {...}
🌐 TryUploadSubtitles: Body length: 2847 chars
🌐 TryUploadSubtitles: Response received
🌐 TryUploadSubtitles: Status: 200 OK
🌐 TryUploadSubtitles: Headers: {...}
🌐 TryUploadSubtitles: XML response length: 156 chars
✅ TryUploadSubtitles: Parsed response successfully
```

**For Network Errors**:
```
❌ TryUploadSubtitles: Request failed with error: TypeError: Failed to fetch
❌ TryUploadSubtitles: This appears to be a network connectivity issue
❌ TryUploadSubtitles: Error details: { name: 'TypeError', message: 'Failed to fetch', stack: '...' }
```

### NetworkError Detection

The system now specifically detects NetworkError conditions:
- **Detection**: Identifies `TypeError` with 'fetch' message indicating network issues
- **User Messages**: Shows "NetworkError: ... (Upload may have succeeded despite this error)"
- **Debug Context**: Provides helpful hints about likely causes (DNS, timeouts, connection issues)
- **Success Indication**: Notes that uploads may have succeeded despite the error

### Benefits

This comprehensive logging helps identify:
- **Network Timeouts**: When requests time out but uploads succeed
- **DNS Issues**: When domain resolution fails
- **Connection Problems**: When network connection is unstable
- **API Response Issues**: When API returns unexpected responses
- **Request/Response Cycle**: Full visibility into upload process

### User Experience Improvements

- **Better Error Messages**: Distinguishes between network connectivity issues and actual API failures
- **Success Possibility**: Warns users that uploads may have succeeded despite NetworkError
- **Detailed Debug Info**: Provides context for troubleshooting in debug panel
- **Error Type Tracking**: Categorizes errors for better analysis

### Usage for Debugging

When encountering "NetworkError when attempting to fetch resource":
1. Open browser dev tools console
2. Look for 🌐 network request logs
3. Check if request reached the server (status logged)
4. Verify if response was received (XML response length logged)
5. Look for specific error patterns in the logs

This implementation provides complete visibility into the upload process, making it much easier to diagnose whether NetworkError represents a real failure or just a network timing issue where the upload actually succeeded.

## API Key Embedding System (2025-07-21)

**✅ IMPLEMENTED**: Compile-time API key embedding system for secure binary distribution.

### Overview

The application now supports embedding the OpenSubtitles API key directly into the compiled binary at build time, providing a secure distribution method for desktop applications without exposing credentials in environment variables or config files.

### Implementation Details

**Components**:
- `scripts/embed-api-keys.js` - Script that generates embedded constants file at build time
- `src/utils/embeddedConstants.js` - Generated file with embedded API keys (auto-generated, not tracked in git)
- `vite.config.js` - Enhanced with `embedApiKeysPlugin` and global `define` configuration
- `src/utils/constants.js` - Updated to prioritize embedded keys over environment variables

**Build Process Integration**:
1. **Vite Plugin**: Automatically runs the embedding script during production builds
2. **Global Constants**: Vite's `define` feature injects `__EMBEDDED_OPENSUBTITLES_API_KEY__` at compile time
3. **Dual Mode Support**: Development uses environment variables, production uses embedded keys

**Environment Variables**:
- `OPENSUBTITLES_API_KEY` - Primary environment variable for production builds
- `VITE_OPENSUBTITLES_API_KEY` - Fallback environment variable for development

### GitHub Actions Integration

**Build Workflow Enhanced**:
- `OPENSUBTITLES_API_KEY` secret added to build environment
- `NODE_ENV=production` set during Tauri builds
- API key automatically embedded in desktop application binaries

### Deploy Script Integration

**Production Builds**:
- Deploy script sets `NODE_ENV=production` before building
- Ensures API key embedding is triggered during server deployments
- Maintains backward compatibility with environment variable fallback

### Security Benefits

1. **No Exposed Credentials**: API keys are compiled into binary, not stored in config files
2. **Environment Independence**: Desktop apps work without requiring users to set environment variables
3. **Build-Time Validation**: Warns if API keys are missing during production builds
4. **Fallback Support**: Gracefully falls back to environment variables in development

### Usage

**Development Mode**:
```bash
npm run dev  # Uses VITE_OPENSUBTITLES_API_KEY from .env
```

**Production Build**:
```bash
export OPENSUBTITLES_API_KEY="your_api_key_here"
export NODE_ENV=production
npm run build  # Embeds API key in binary
```

**Manual Embedding**:
```bash
node scripts/embed-api-keys.js  # Generates embedded constants file
```

### Files Modified

- `scripts/embed-api-keys.js` - New embedding script
- `vite.config.js` - Added embedding plugin and global defines
- `src/utils/constants.js` - Updated API key resolution logic
- `.github/workflows/build-desktop-apps.yml` - Added API key environment variables
- `deploy.sh` - Added production environment variable setting

### Validation

The system includes comprehensive validation:
- Build-time warnings for missing API keys
- Runtime validation of embedded constants
- Console logging indicating which API key source is being used
- Error handling for missing or invalid configurations

This implementation ensures that desktop applications can be distributed with embedded API credentials while maintaining security and developer experience.