# Claude Code Instructions

## Build and Release Process

**IMPORTANT**: When asked to build and make a release:

- **ALWAYS** use GitHub Actions for building
- **NEVER** build locally unless specifically requested
- Use `gh workflow run "Build Desktop Apps" --field create_release=true` to trigger GitHub builds
- GitHub builds create releases for all platforms (Windows, macOS, Linux)
- Only build locally when explicitly asked: "build locally"

**IMPORTANT**: The workflow is now MANUAL-ONLY to prevent duplicate builds. No automatic builds on push/tag.

### Commands for releases:
```bash
# Trigger GitHub build and release (DEFAULT)
gh workflow run "Build Desktop Apps" --field create_release=true

# Check workflow status
gh run list --workflow="Build Desktop Apps"

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

**CRITICAL**: ALWAYS follow this EXACT sequence for releases to avoid version mismatches:

### ⚠️ MANDATORY Release Sequence:

```bash
# 1. FIRST - Bump version using the script (REQUIRED)
npm run update-version

# 2. SECOND - Generate changelog for this release (REQUIRED)
npm run generate-changelog

# 3. THIRD - Commit and tag the version bump
git add .
git commit -m "🚀 RELEASE: Version X.X.X - Description"
git tag vX.X.X
git push && git push --tags

# 4. FOURTH - Trigger builds/release ONLY after version is committed
gh workflow run build-desktop-apps.yml --field create_release=true
# OR make local build: npm run tauri:build

# 5. FIFTH - Create/publish GitHub release with proper version
gh release create vX.X.X --title "vX.X.X - Description" --notes "..."
```

### 🚨 CRITICAL RULES:

1. **NEVER build before version bump** - Always `npm run update-version` FIRST
2. **NEVER manually edit versions** - Script handles package.json, Cargo.toml, tauri.conf.json consistently
3. **NEVER skip version commit** - Git tag and version files must match exactly
4. **ALWAYS verify version sync** - Check that build output matches expected version number

### ❌ What NOT to do:
- Build first, then bump version (causes version mismatches)
- Manual version editing (causes inconsistencies)
- Skipping git tag creation (breaks release automation)
- Using different version numbers in different files

### ✅ Correct sequence prevents issues like:
- Release v1.6.14 containing v1.6.13 files (version mismatch)
- Inconsistent version numbers across package.json, Cargo.toml, tauri.conf.json
- GitHub releases with wrong version tags
- Missing latest.json updater manifest (breaks auto-updates)
- Incomplete multi-platform builds (missing Windows/Linux/macOS assets)

### 📦 REQUIRED Release Assets:

**NEVER release without ALL of these files:**
- `latest.json` - Tauri updater manifest (CRITICAL for auto-updates)
- Windows: `.exe` installer 
- macOS: `.dmg` universal binary
- Linux: `.AppImage` and/or `.deb` packages

**Auto-updater will FAIL without latest.json!**

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