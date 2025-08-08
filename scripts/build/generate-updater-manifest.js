#!/usr/bin/env node

/**
 * Generate Tauri updater manifest (latest.json)
 * This creates the proper format that Tauri updater expects
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

console.log(`📦 Generating updater manifest for version ${version}`);

// Calculate signature for files (if we have the private key)
function calculateSignature(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(fileContent).digest('hex');
    }
  } catch (error) {
    console.warn(`⚠️ Could not calculate signature for ${filePath}:`, error.message);
  }
  return null;
}

// Find platform-specific files in target directory
function findPlatformFiles() {
  const platforms = {};
  const targetDir = 'src-tauri/target';
  
  if (fs.existsSync(targetDir)) {
    // Look for Windows NSIS installer
    const windowsPattern = /\.exe$/;
    const windowsFiles = findFilesRecursive(targetDir, windowsPattern);
    if (windowsFiles.length > 0) {
      const exe = windowsFiles.find(f => f.includes('setup') || f.includes('installer'));
      if (exe) {
        platforms['windows-x86_64'] = {
          signature: calculateSignature(exe),
          url: `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/v${version}/${path.basename(exe)}`
        };
      }
    }
    
    // Look for macOS DMG
    const macosPattern = /\.dmg$/;
    const macosFiles = findFilesRecursive(targetDir, macosPattern);
    if (macosFiles.length > 0) {
      const dmg = macosFiles[0]; // Take first DMG found
      platforms['darwin-universal'] = {
        signature: calculateSignature(dmg),
        url: `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/v${version}/${path.basename(dmg)}`
      };
      // Also add separate entries for Intel and Apple Silicon
      platforms['darwin-x86_64'] = platforms['darwin-universal'];
      platforms['darwin-aarch64'] = platforms['darwin-universal'];
    }
    
    // Look for Linux AppImage
    const linuxPattern = /\.AppImage$/;
    const linuxFiles = findFilesRecursive(targetDir, linuxPattern);
    if (linuxFiles.length > 0) {
      const appimage = linuxFiles[0];
      platforms['linux-x86_64'] = {
        signature: calculateSignature(appimage),
        url: `https://github.com/opensubtitles/opensubtitles-uploader-pro/releases/download/v${version}/${path.basename(appimage)}`
      };
    }
  }
  
  return platforms;
}

function findFilesRecursive(dir, pattern) {
  const results = [];
  
  function search(currentDir) {
    try {
      const files = fs.readdirSync(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          search(fullPath);
        } else if (pattern.test(file)) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  search(dir);
  return results;
}

// Generate the updater manifest
const platforms = findPlatformFiles();
const manifest = {
  version: `v${version}`,
  notes: `OpenSubtitles Uploader PRO v${version} - Automatic update`,
  pub_date: new Date().toISOString(),
  platforms
};

// Write the manifest
const manifestPath = 'latest.json';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`✅ Updater manifest written to ${manifestPath}`);
console.log(`📋 Manifest contents:`, JSON.stringify(manifest, null, 2));

// Also log found files for debugging
Object.keys(platforms).forEach(platform => {
  console.log(`📁 ${platform}: ${platforms[platform].url}`);
});

if (Object.keys(platforms).length === 0) {
  console.error('❌ No platform files found! Make sure build has completed successfully.');
  process.exit(1);
}