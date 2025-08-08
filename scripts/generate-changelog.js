#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCommitsSinceLastTag() {
  try {
    // Get the last tag
    const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    console.log(`Last tag: ${lastTag}`);
    
    // Get commits since last tag
    const commits = execSync(`git log ${lastTag}..HEAD --oneline --no-merges`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(line => line.trim());
    
    return { lastTag, commits };
  } catch (error) {
    // If no tags exist, get all commits
    console.log('No tags found, getting all commits');
    const commits = execSync('git log --oneline --no-merges', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(line => line.trim());
    
    return { lastTag: null, commits };
  }
}

function categorizeCommit(message) {
  const msg = message.toLowerCase();
  
  // More comprehensive categorization based on conventional commits and emojis
  if (msg.includes('🔒') || msg.includes('🛡️') || msg.includes('security') || msg.includes('vulnerabil')) {
    return 'Security';
  } else if (msg.includes('🐛') || msg.includes('🔧') || msg.includes('fix') || msg.includes('bug') || msg.includes('patch') || msg.includes('repair')) {
    return 'Fixed';
  } else if (msg.includes('✨') || msg.includes('🎉') || msg.includes('📦') || msg.includes('feat') || msg.includes('add') || msg.includes('new') || msg.includes('implement') || msg.includes('create')) {
    return 'Added';
  } else if (msg.includes('💥') || msg.includes('⚠️') || msg.includes('break') || msg.includes('remove') || msg.includes('deprecat') || msg.includes('change') || msg.includes('update') || msg.includes('improve') || msg.includes('enhance') || msg.includes('refactor')) {
    return 'Changed';
  } else if (msg.includes('🗑️') || msg.includes('remove') || msg.includes('delete')) {
    return 'Removed';
  } else {
    return 'Changed';
  }
}

function formatCommitForChangelog(commit) {
  const [hash, ...messageParts] = commit.split(' ');
  let message = messageParts.join(' ');
  
  // Skip version bump commits and merge commits
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('bump version') || 
      lowerMessage.includes('version to') || 
      lowerMessage.includes('merge branch') ||
      lowerMessage.includes('merge pull request') ||
      lowerMessage.includes('auto-update changelog')) {
    return null;
  }
  
  // Clean up common prefixes and emojis for better readability
  message = message.replace(/^(feat|fix|docs|style|refactor|test|chore|build|ci|perf)(\(.+\))?:\s*/i, '');
  
  // Ensure first letter is capitalized
  message = message.charAt(0).toUpperCase() + message.slice(1);
  
  // Remove trailing period if present
  message = message.replace(/\.$/, '');
  
  return `- ${message}`;
}

function generateChangelogSection(version, commits) {
  const today = new Date().toISOString().split('T')[0];
  const categories = {
    'Added': [],
    'Changed': [],
    'Fixed': [],
    'Security': [],
    'Removed': []
  };
  
  commits.forEach(commit => {
    const formatted = formatCommitForChangelog(commit);
    if (formatted) {
      const category = categorizeCommit(commit);
      categories[category].push(formatted);
    }
  });
  
  let section = `## [${version}] - ${today}\n\n`;
  
  Object.entries(categories).forEach(([category, items]) => {
    if (items.length > 0) {
      section += `### ${category}\n${items.join('\n')}\n\n`;
    }
  });
  
  return section;
}

function updateChangelog() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  // Get current version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  
  // Get commits since last tag
  const { lastTag, commits } = getCommitsSinceLastTag();
  
  if (commits.length === 0) {
    console.log('No new commits found since last tag');
    return;
  }
  
  console.log(`Found ${commits.length} commits since ${lastTag || 'beginning'}`);
  
  // Generate new changelog section
  const newSection = generateChangelogSection(currentVersion, commits);
  
  // Read existing changelog
  let existingChangelog = '';
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  } else {
    // Create basic changelog structure if file doesn't exist
    existingChangelog = `# Changelog

All notable changes to OpenSubtitles Uploader PRO will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

*This changelog is automatically updated from git commits. For more details on any release, see the [GitHub releases page](https://github.com/opensubtitles/opensubtitles-uploader-pro/releases).*`;
  }
  
  // Find where to insert the new section
  const lines = existingChangelog.split('\n');
  let insertIndex = lines.findIndex(line => line.startsWith('## ['));
  
  // If no existing version sections found, insert before the footer
  if (insertIndex === -1) {
    insertIndex = lines.findIndex(line => line.includes('---'));
    if (insertIndex === -1) {
      insertIndex = lines.length;
    }
  }
  
  // Check if this version already exists
  const versionExists = lines.some(line => line.includes(`## [${currentVersion}]`));
  if (versionExists) {
    console.log(`Version ${currentVersion} already exists in changelog, skipping update`);
    return;
  }
  
  // Insert new section
  lines.splice(insertIndex, 0, newSection.trimEnd(), '');
  
  // Write updated changelog
  fs.writeFileSync(changelogPath, lines.join('\n'));
  
  console.log(`Changelog updated with version ${currentVersion}`);
  console.log(`Added ${commits.length} commits to changelog`);
}

// Check if this is the main module (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
  updateChangelog();
}

export { updateChangelog };