# Scripts Directory

This directory contains utility and build scripts for the OpenSubtitles Uploader PRO project.

## Structure

### `/build/`
Build-related scripts and configurations:
- `build-version.js` - Build version tracking utility
- `build-version.json` - Build version configuration
- `update-version.js` - Version synchronization across files
- `deploy.sh` - Production deployment script
- `setup.sh` - Development environment setup script

### `/utils/`
Utility scripts for development and debugging:
- `clear-ffmpeg-cache.js` - FFmpeg cache cleanup script (run in browser console)
- `quick-cache-fix.js` - Quick cache fix for development issues

### `/embed-api-keys.js`
API key embedding script for production builds (runs during build process).

## Usage

### Version Management
```bash
# Update all version references across the codebase
npm run update-version
```

### Development Setup
```bash
# Run initial project setup
./scripts/build/setup.sh
```

### Cache Utilities
If you encounter FFmpeg caching issues during development:
1. Open browser developer console
2. Copy and paste the contents of `scripts/utils/clear-ffmpeg-cache.js`
3. Press Enter to execute the cache cleanup

## Notes

- All build scripts should be run from the project root directory
- Cache utility scripts are designed to run in the browser console
- Deploy script contains production-specific configurations