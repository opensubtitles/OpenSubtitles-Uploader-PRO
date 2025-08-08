#!/bin/bash

# Generate Changelog Script
# This script generates a changelog from git history and updates CHANGELOG.md

set -e

echo "🔄 Generating changelog from git history..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if we have Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to generate changelog."
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Make sure you're in the project root."
    exit 1
fi

# Check if CHANGELOG.md exists, create if it doesn't
if [ ! -f "CHANGELOG.md" ]; then
    echo "📝 Creating new CHANGELOG.md file..."
    cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to OpenSubtitles Uploader PRO will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

*This changelog is automatically updated from git commits. For more details on any release, see the [GitHub releases page](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases).*
EOF
fi

# Run the changelog generation script
echo "🔧 Running changelog generator..."
node scripts/generate-changelog.js

echo "✅ Changelog generation completed!"

# Show what was changed
if command -v git &> /dev/null; then
    if [ -n "$(git status --porcelain CHANGELOG.md 2>/dev/null)" ]; then
        echo "📋 Changes made to CHANGELOG.md:"
        git diff --no-index /dev/null CHANGELOG.md | grep "^+" | head -20 || true
    else
        echo "ℹ️ No changes made to CHANGELOG.md"
    fi
fi