# MKV Subtitle Extraction Test

This is a minimal test to verify MKV subtitle extraction works using the `@opensubtitles/video-metadata-extractor` npm package.

## Purpose

Test the exact approach used in the working demo from https://github.com/opensubtitles/video-metadata-extractor-js

## How it works

1. Uses `dataTransfer.files[0]` directly for drop events (NO WebKit FileEntry API)
2. Calls `extractAllSubtitles()` from the npm package via CDN
3. Logs everything to help debug

## Usage

1. Open `index.html` in Chrome
2. Drop an MKV file
3. Click "Extract Subtitles"
4. Check the console log

## Key Differences from Main App

- **Direct file access**: Uses `e.dataTransfer.files[0]` instead of `webkitGetAsEntry()`
- **No React**: Plain HTML/JS to eliminate any framework issues
- **CDN import**: Loads package via jsdelivr CDN instead of bundled

## Expected Behavior

- Should show file info correctly
- Should extract subtitles without "File could not be read! Code=-1" error
- Should display extracted subtitle files with language info

## Testing

Compare this working demo with the main app implementation to identify the exact difference causing the issue.
