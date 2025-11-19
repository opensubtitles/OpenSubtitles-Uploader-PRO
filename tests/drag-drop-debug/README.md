# File & Directory Selection Debug Test ✅ FIXED

## Purpose

This test page helps debug and demonstrate file and directory selection behavior across different browsers, including:
- **Drag & Drop**: Multi-directory drag-and-drop
- **File Picker**: System dialog file selection
- **Directory Picker**: System dialog directory selection

## Problem (FIXED ✅)

**Chrome Bug**: When dragging and dropping 2+ directories in Chrome, only the first directory was processed.

**Root Cause**: Chrome invalidates `DataTransferItemList` after async operations begin, making subsequent items inaccessible.

**Fix Applied**: Capture all webkit entries synchronously in Phase 1, then process them asynchronously in Phase 2.

**Firefox**: Correctly processes all dropped directories (not affected by this bug).

## Usage

1. **Open the test page**:
   ```bash
   open tests/drag-drop-debug/drag-drop-test.html
   ```
   Or navigate to it in your browser.

2. **Test Methods**:

   **Option A - Drag & Drop**:
   - Drag 2 or more directories onto the drop zone
   - Observe the debug logs showing the fix in action

   **Option B - File Picker**:
   - Click "Select Files" button
   - Choose multiple files using system dialog
   - Works with: video files (.mp4, .mkv, .avi) and subtitles (.srt, .ass, .sub)

   **Option C - Directory Picker**:
   - Click "Select Directories" button
   - Choose a directory using system dialog
   - Browser will read all files from the selected directory
   - **Note**: Can only select ONE directory at a time (browser limitation)

3. **Compare Chrome vs Firefox**:
   - Test the same directories in Chrome
   - Test the same directories in Firefox
   - Both should now collect all files correctly!

## Fix Implementation ✅

The fix has been applied to both the test page and the main application (`src/services/fileProcessing.js`).

### Solution: Two-Phase Processing

**Phase 1 - Synchronous Capture** (before any async operations):
```javascript
const entries = [];
for (let i = 0; i < dt.items.length; i++) {
    const entry = dt.items[i].webkitGetAsEntry();
    if (entry) entries.push({ entry, index: i });
}
```

**Phase 2 - Async Processing** (after all entries are captured):
```javascript
for (const { entry, index } of entries) {
    if (entry.isDirectory) {
        await traverseDirectory(entry, ...);
    }
}
```

### Why This Works

- `webkitGetAsEntry()` is called synchronously for ALL items before any `await`
- Entries are stored in an array before Chrome invalidates the list
- Async traversal happens on the captured entries, not the invalidated list

## Debug Information Collected

The test page logs:

1. **Browser detection**: Chrome, Firefox, Safari, Edge
2. **Drop event details**: Number of items, files, types
3. **Item inspection**: For each dropped item:
   - `kind` (file/string)
   - `type` (MIME type)
   - `webkitGetAsEntry()` result
   - Entry properties (name, isFile, isDirectory, fullPath)
4. **Phase 1**: Synchronous capture of all entries
5. **Phase 2**: Async processing of captured entries
6. **Directory traversal**: Step-by-step traversal of each directory
7. **File collection**: Complete list of all files found
8. **File tree**: Organized view of collected files by directory

## Expected Results (After Fix)

### Chrome (Now Working ✅)
- Detects all dropped directories
- Phase 1: Captures all entries synchronously
- Phase 2: Processes all directories asynchronously
- Collects files from ALL directories

### Firefox (Always Worked)
- Detects all dropped directories
- Processes all directories (not affected by the bug)
- Collects files from ALL directories

## Testing Scenarios

### Scenario 1: Two Simple Directories
Drop two directories, each containing a few files.
- **Expected**: All files from both directories collected

### Scenario 2: Nested Directories
Drop directories with subdirectories to test recursive traversal.
- **Expected**: All files including nested subdirectories

### Scenario 3: Mixed Content
Drop directories with various file types (.mp4, .srt, .mkv, etc.)
- **Expected**: All media files properly filtered and collected

## Technical Details

### Chrome Bug Details

Chrome has a known issue where `DataTransferItemList` becomes invalidated when:
1. The drop event handler completes
2. Any async operation (`await`) is performed
3. The event loop cycles

This causes:
- `items.length` to become 0
- `webkitGetAsEntry()` to return null
- Subsequent items to be inaccessible

### Solution Pattern

This pattern should be used whenever processing drag-and-drop with directories:

```javascript
// ✅ CORRECT: Synchronous capture
const entries = items.map(item => item.webkitGetAsEntry()).filter(Boolean);
for (const entry of entries) {
    await processEntry(entry); // Safe to await now
}

// ❌ WRONG: Async operations during iteration
for (const item of items) {
    const entry = item.webkitGetAsEntry(); // May return null after first await
    await processEntry(entry); // Invalidates remaining items!
}
```

## Files

- `drag-drop-test.html` - Main test page with comprehensive logging and fix applied
- `README.md` - This file

## Status

✅ **FIXED** - Both Chrome and Firefox now handle multiple directory drops correctly!
