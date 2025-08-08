# Claude Code Documentation

This file contains important information for working with this codebase in Claude Code.

## Project Overview

OpenSubtitles Uploader PRO is a React-based application for uploading subtitles to OpenSubtitles.org. It features both web and desktop (Tauri) versions with comprehensive authentication, file processing, and update management.

## Development Workflow

### Version Management

The project uses centralized version management through `package.json`. When updating versions:

1. Update version in `package.json`
2. Run `npm run update-version` to sync version across all files:
   - `src-tauri/tauri.conf.json`
   - `src/utils/constants.js`

### Release Process

1. **Update Version**: Bump version in package.json
2. **Generate Changelog**: Run changelog generation script
3. **Build**: Create production builds for all platforms
4. **Tag**: Create git tag for the release
5. **Release**: GitHub Actions will automatically build and publish

## Changelog Generation

### Automatic Changelog Updates

The project includes automated changelog generation from git commit history:

#### Scripts Available

- **`scripts/generate-changelog.sh`** - Shell script wrapper for changelog generation
- **`scripts/generate-changelog.js`** - Node.js script that processes git history

#### GitHub Actions Workflow

The `.github/workflows/update-changelog.yml` workflow automatically:

- Runs on every push to main branch
- Runs on every release publication  
- Can be triggered manually via workflow_dispatch
- Generates changelog from git commits since last tag
- Commits and pushes updated CHANGELOG.md

#### Manual Changelog Generation

To manually generate/update the changelog:

```bash
# Run the shell script (recommended)
./scripts/generate-changelog.sh

# Or run the Node.js script directly  
node scripts/generate-changelog.js
```

#### Commit Message Conventions

The changelog generator categorizes commits based on keywords and emojis:

- **Security**: 🔒 🛡️ security, vulnerability
- **Fixed**: 🐛 🔧 fix, bug, patch, repair
- **Added**: ✨ 🎉 📦 feat, add, new, implement, create  
- **Changed**: 💥 ⚠️ break, change, update, improve, enhance, refactor
- **Removed**: 🗑️ remove, delete

#### Changelog Format

The generated changelog follows [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Version] - YYYY-MM-DD

### Added
- New features

### Changed  
- Changes to existing functionality

### Fixed
- Bug fixes

### Security
- Security improvements

### Removed
- Removed features
```

#### Best Practices for Commits

For optimal changelog generation, use clear commit messages:

```bash
# Good examples:
git commit -m "✨ Add dark mode toggle to settings"
git commit -m "🐛 Fix file upload progress indicator"  
git commit -m "🔧 Improve error handling in auth service"
git commit -m "🔒 Update dependencies to fix security vulnerabilities"

# The script will clean up conventional commit prefixes:
git commit -m "feat: add dark mode toggle" → "Add dark mode toggle"
git commit -m "fix(auth): resolve login timeout" → "Resolve login timeout"  
```

#### Skipped Commits

The changelog generator automatically skips:

- Version bump commits
- Merge commits  
- Auto-update changelog commits
- Commits with conventional commit prefixes (cleaned up automatically)

## Testing Commands

To run tests and ensure code quality:

```bash
npm test          # Run unit tests
npm run lint      # Run ESLint
npm run build     # Test production build
```

## Key Architecture

- **Frontend**: React with hooks and context
- **Desktop**: Tauri 2.0 framework
- **API**: Integration with OpenSubtitles XML-RPC and REST APIs
- **State Management**: React Context + hooks
- **Styling**: Tailwind CSS with dark/light theme support
- **File Processing**: Custom services for video/subtitle parsing

## Important Files

- `src/services/updateService.js` - Auto-update functionality
- `src/hooks/useAppUpdate.js` - Update state management  
- `src/components/UpdateNotification.jsx` - Update UI
- `src/utils/constants.js` - App constants and version
- `src-tauri/tauri.conf.json` - Tauri configuration

## Build Commands

```bash
npm run dev          # Development server
npm run build        # Production web build
npm run tauri:dev    # Tauri development
npm run tauri:build  # Tauri production build
```

---

*This documentation is maintained for Claude Code to understand the project structure and workflows.*