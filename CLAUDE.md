# Claude Code Instructions

## Build and Release Process

**IMPORTANT**: When asked to build and make a release:

- **ALWAYS** use GitHub Actions for building
- **NEVER** build locally unless specifically requested
- Use `gh workflow run "Build Desktop Apps" --field create_release=true` to trigger GitHub builds
- GitHub builds create releases for all platforms (Windows, macOS, Linux)
- Only build locally when explicitly asked: "build locally"

**FIXED**: The workflow now automatically creates releases if they don't exist, preventing "release not found" upload errors.

### Commands for releases:
```bash
# Trigger GitHub build and release (DEFAULT)
gh workflow run release.yml

# Check workflow status
gh run list --workflow=release.yml

# Monitor the build
gh run watch
```

### Local build commands (only when specifically requested):
```bash
# Local development
npm run tauri:dev

# Local production build
npm run tauri:build
```

## Version Management

**CRITICAL**: ALWAYS use the update-version script for version bumps:

```bash
# Bump version using the script (REQUIRED)
npm run update-version

# Then commit, tag and push
git add .
git commit -m "🚀 RELEASE: Version X.X.X - Description"
git tag vX.X.X
git push && git push --tags
```

**NEVER manually edit version numbers** in package.json, Cargo.toml, or tauri.conf.json - the script handles all files consistently.

After version bumps, always:
1. Use `npm run update-version` script
2. Commit changes with descriptive message
3. Create and push git tag
4. Trigger GitHub release workflow
5. Verify release creation

## Testing Commands

```bash
npm test          # Run test suite
npm run lint      # Run linter
npm run typecheck # Run TypeScript checks
```

## Update System Testing

To test the updater functionality without waiting for actual version changes:

```bash
# Build the app locally
npm run tauri:build

# Launch with test upgrade mode (forces update notifications)
./src-tauri/target/release/bundle/macos/OpenSubtitles\ Uploader\ PRO.app/Contents/MacOS/opensubtitles-uploader-pro --test-upgrade

# Alternative flag
./app --force-update
```

**Test mode features:**
- Forces "Update Available" notification even for same version
- Shows "🧪 TEST MODE" indicator in update notifications  
- Enables testing of entire download → install flow
- Tests signature validation fallback UI
- Verifies 20% milestone progress logging

### Debug Mode Command Line Logging

In debug builds, all command line parameters are logged to:
1. **Terminal/Console**: Rust println! statements show all arguments
2. **Browser DevTools**: JavaScript console.log shows all arguments
3. **Debug Helper**: Call `getDebugInfo()` in browser console for full launch details

**CLI Help and Version:**
```bash
# Show help
./app --help
./app -h

# Show version  
./app --version
./app -v
```

**Debug console output example:**
```
🔧 === COMMAND LINE LAUNCH INFO ===
🔧 Application launched with 3 arguments:
🔧   [0]: "./app"
🔧   [1]: "--test-upgrade"
🔧   [2]: "--verbose"
🔧 Flags detected:
🔧   Test upgrade mode: true
🔧   Verbose mode: true
🔧   Debug mode: false
🔧 === END LAUNCH INFO ===
```

**Test Download Functionality:**
- When you click "Download Update" in test mode, it simulates a complete download
- Shows realistic progress (0%, 20%, 40%, 60%, 80%, 100%)
- Creates a test file in temp directory
- Displays Install/Reveal buttons with test mode warning
- Perfect for testing the entire update workflow