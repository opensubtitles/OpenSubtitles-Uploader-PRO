# Claude Code Instructions

## Build and Release Process

**IMPORTANT**: When asked to build and make a release:

- **ALWAYS** use GitHub Actions for building
- **NEVER** build locally unless specifically requested
- Use `gh workflow run release.yml` to trigger GitHub builds
- GitHub builds create releases for all platforms (Windows, macOS, Linux)
- Only build locally when explicitly asked: "build locally"

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

After version bumps, always:
1. Commit changes
2. Create and push git tag
3. Trigger GitHub release workflow
4. Verify release creation

## Testing Commands

```bash
npm test          # Run test suite
npm run lint      # Run linter
npm run typecheck # Run TypeScript checks
```