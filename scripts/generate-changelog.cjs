#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('patch')) {
    return 'Fixed';
  } else if (msg.includes('feat') || msg.includes('add') || msg.includes('new')) {
    return 'Added';
  } else if (msg.includes('break') || msg.includes('remove') || msg.includes('deprecat')) {
    return 'Changed';
  } else if (msg.includes('security')) {
    return 'Security';
  } else {
    return 'Changed';
  }
}

function formatCommitForChangelog(commit) {
  const [hash, ...messageParts] = commit.split(' ');
  const message = messageParts.join(' ');
  
  // Skip version bump commits
  if (message.toLowerCase().includes('bump version') || message.toLowerCase().includes('version to')) {
    return null;
  }
  
  return `- ${message.charAt(0).toUpperCase() + message.slice(1)}`;
}

function generateChangelogSection(version, commits) {
  const today = new Date().toISOString().split('T')[0];
  const categories = {
    'Added': [],
    'Changed': [],
    'Fixed': [],
    'Security': []
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
  }
  
  // Find where to insert the new section
  const lines = existingChangelog.split('\n');
  const insertIndex = lines.findIndex(line => line.startsWith('## [')) || 
                     lines.findIndex(line => line.includes('---')) || 
                     lines.length;
  
  // Insert new section
  lines.splice(insertIndex, 0, newSection);
  
  // Write updated changelog
  fs.writeFileSync(changelogPath, lines.join('\n'));
  
  console.log(`Changelog updated with version ${currentVersion}`);
  console.log(`Added ${commits.length} commits to changelog`);
}

if (require.main === module) {
  updateChangelog();
}

module.exports = { updateChangelog };