# Claude Code Instructions

## Commit and Release Notes Style

- **Do NOT add** the "🤖 Generated with Claude Code" footer to commits or releases
- **Do NOT add** "Co-Authored-By: Claude" to commits or releases
- Keep commit messages and release notes clean and professional

## Build and Release Process

**IMPORTANT**: When asked to build and make a release:

- **ALWAYS** use GitHub Actions for building
- **NEVER** build locally unless specifically requested
- **Pushing the tag is what releases.** `build-desktop-apps.yml` triggers on
  `push.tags: ['v*']`, builds all platforms, and publishes the release itself.
- Only build locally when explicitly asked: "build locally"

### 🚨 Do NOT dispatch the build workflow manually

`gh workflow run "Build Desktop Apps"` is **destructive on a non-tag ref** and
there is never a reason to run it:

- It takes **no inputs**. The workflow declares a bare `workflow_dispatch:`, so
  `--field create_release=true` fails — that input does not exist.
- On a non-tag ref the version falls back to `VERSION="v$(package.json version)"`.
  On a branch whose `package.json` still holds the shipped version, the final
  step runs `gh release upload "$VERSION" latest.json --clobber` and **overwrites
  the updater manifest on the live release**.
- Dispatching it *and* pushing the tag starts two builds racing for the same
  release.

Push the tag and stop. To verify a build before releasing, push to a `chore/**`
branch — `verify-build.yml` compiles all three platforms and uploads nothing.

### Commands for releases:
```bash
# Check workflow status (the tag push starts it automatically)
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
# 1. Bump package.json. `npm run update-version` does NOT increment anything -
#    it only propagates package.json's CURRENT version, so set it first.
npm version X.X.X --no-git-tag-version

# 2. Propagate into constants.js, README.md, tauri.conf.json, Cargo.toml
npm run update-version

# 3. Let Cargo.lock pick up the new package version too
cargo update -p opensubtitles-uploader-pro --offline --manifest-path src-tauri/Cargo.toml

# 4. Pull PAST GitHub releases into the in-app changelog view
#    (this cannot describe the release being cut - see note below)
npm run generate-changelog

# 5. Verify before committing
npm test && npm run build

# 6. Commit. The BODY of this commit becomes the published release notes.
git commit -F - <<'MSG'
🚀 RELEASE: Version X.X.X - Short description

<user-facing release notes go here>
MSG

# 7. Push the branch. Plain `main` is ambiguous in this repo (a stale TAG named
#    `main` shadows the branch), so always use the full ref.
git push origin refs/heads/main:refs/heads/main

# 8. Push the tag. THIS builds and publishes the release. Nothing else to run.
git tag vX.X.X && git push origin refs/tags/vX.X.X
```

**Release notes come from the commit message.** The `Ensure release exists` step
runs `git log -1 --format='%B'`, strips the leading `🚀 RELEASE: `, and passes the
rest to `gh release create --notes`. The release commit body *is* the changelog
users read — write it for them, not for the git log.

**`npm run generate-changelog` is unrelated to that.** It pulls *already
published* GitHub releases into `src/data/changelog.json` for the in-app
changelog view, so the release being cut will only appear there in the *next*
release.

**Beware the stale `main` tag.** A tag named `main` exists alongside the branch,
so every bare `main` reference is ambiguous: `git push origin main` fails, and
`git diff main` silently diffs against the tag and unrelated history. Use
`refs/heads/main`, and `git switch main` rather than `git checkout main`.

### 🚨 CRITICAL RULES:

1. **NEVER build before version bump** - bump `package.json` FIRST, then propagate
2. **NEVER manually edit versions** - the script keeps all five files consistent
   (package.json, constants.js, tauri.conf.json, Cargo.toml, Cargo.lock)
3. **NEVER skip version commit** - Git tag and version files must match exactly
4. **NEVER dispatch the build workflow** - see the warning above; the tag push is
   the whole release mechanism
5. **ALWAYS verify version sync** - check that build output matches expected version

### ❌ What NOT to do:
- Build first, then bump version (causes version mismatches)
- Manual version editing (causes inconsistencies)
- Skipping git tag creation (breaks release automation)
- Using different version numbers in different files
- Running `npm run update-version` and expecting it to increment (it does not)
- Dispatching "Build Desktop Apps" manually (no inputs; clobbers live assets
  from a branch; races the tag build)
- `git push origin main` or `git diff main` (ambiguous — stale `main` tag)

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

Presence is not enough — `latest.json` can exist while pointing at the *wrong*
version (that is exactly what a stray workflow dispatch does to it). Verify the
contents after the build finishes:

```bash
gh release view vX.X.X --json assets --jq '[.assets[].name]'
curl -sL "https://github.com/opensubtitles/OpenSubtitles-Uploader-PRO/releases/download/vX.X.X/latest.json" \
  | node -p "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); j.version + ' | ' + Object.keys(j.platforms).join(', ')"
```

Expect `vX.X.X` and all five targets: `windows-x86_64`, `darwin-universal`,
`darwin-x86_64`, `darwin-aarch64`, `linux-x86_64`.

## Testing Commands

```bash
npm test          # Run test suite
npm run lint      # Run linter
npm run typecheck # Run TypeScript checks
```

**`npm run lint` does not pass on a clean tree.** It reports a standing baseline
of pre-existing errors (32 as of v1.10.1, mostly `no-undef` on `React` in older
files) plus a few hundred warnings. Do not read that as breakage you caused, and
do not go fix it as a side quest. Lint only what you touched:

```bash
npx eslint <files you changed>
```

To confirm you added nothing new, compare the totals across a stash:

```bash
git stash -u && npm run lint 2>&1 | grep '^✖'; git stash pop && npm run lint 2>&1 | grep '^✖'
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

## Security Guidelines

### 🔒 CRITICAL: Token and Session Security

**NEVER log tokens, session IDs, or any authentication data in plain text!**

```javascript
// ❌ NEVER DO THIS - Security vulnerability
console.log('Token:', token.substring(0, 10) + '...'); // Still exposes partial token!
console.log('Session ID:', sessionId); // Exposes full session ID!

// ✅ ALWAYS USE SECURITY UTILITY
import { logSensitiveData } from '../utils/securityUtils.js';
logSensitiveData('🔐 Token received', token, 'token'); // Shows: [HIDDEN]
```

**Security Rules:**
1. **ALWAYS use `logSensitiveData()`** from `securityUtils.js` for any authentication data
2. **NEVER show partial tokens** (even `token.substring(0, 5)` is a vulnerability)
3. **NEVER log session IDs, cookies, or authentication headers** in plain text
4. **Use `[HIDDEN]` replacement** for all sensitive data in logs
5. **Audit all console.log statements** to ensure no token leakage

**Approved Security Functions:**
```javascript
// Import the security utility
import { logSensitiveData, hideSensitiveData, createSafeDebugObject } from '../utils/securityUtils.js';

// Safe logging
logSensitiveData('🔐 Using token', token, 'token');           // [HIDDEN]
logSensitiveData('🔍 Session found', sessionId, 'session');   // [HIDDEN]

// Safe string formatting
const safeToken = hideSensitiveData(token, 'token');          // [HIDDEN]

// Safe debug objects
const safeDebug = createSafeDebugObject(userData, ['token', 'sessionId']);
```

**Why This Matters:**
- Tokens in logs can be extracted and used maliciously
- Browser console logs are visible to anyone with developer tools access
- Log files should be safe to share for debugging without exposing credentials
- Compliance with security standards requires protecting authentication data