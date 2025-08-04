#!/usr/bin/env node

/**
 * Version Update Script
 * 
 * This script automatically updates version references across the codebase
 * by reading the version from package.json and updating:
 * - src/utils/constants.js (APP_VERSION)
 * - README.md (version badge)
 * 
 * Usage: node update-version.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read package.json to get the current version
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

console.log(`🔄 Updating version references to v${currentVersion}...`);

// Update constants.js
const constantsPath = path.join(__dirname, 'src/utils/constants.js');
let constantsContent = fs.readFileSync(constantsPath, 'utf8');

// Replace the APP_VERSION line
constantsContent = constantsContent.replace(
  /export const APP_VERSION = '[^']+';/,
  `export const APP_VERSION = '${currentVersion}';`
);

fs.writeFileSync(constantsPath, constantsContent);
console.log(`✅ Updated src/utils/constants.js to v${currentVersion}`);

// Update README.md
const readmePath = path.join(__dirname, 'README.md');
let readmeContent = fs.readFileSync(readmePath, 'utf8');

// Replace the version badge
readmeContent = readmeContent.replace(
  /version-[0-9.]+/g,
  `version-${currentVersion}`
);

fs.writeFileSync(readmePath, readmeContent);
console.log(`✅ Updated README.md to v${currentVersion}`);

// Update Tauri config
const tauriConfigPath = path.join(__dirname, 'src-tauri/tauri.conf.json');
let tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

tauriConfig.version = currentVersion;

fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2));
console.log(`✅ Updated src-tauri/tauri.conf.json to v${currentVersion}`);

console.log(`🎉 Version update complete! All references now point to v${currentVersion}`);