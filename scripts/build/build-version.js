#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Build version tracking
const BUILD_VERSION_FILE = 'build-version.json';
const BASE_VERSION = '1.1';
const PATCH_VERSION = 5;

// Get or create build version data
let buildData = { buildNumber: 0 };
if (fs.existsSync(BUILD_VERSION_FILE)) {
  try {
    buildData = JSON.parse(fs.readFileSync(BUILD_VERSION_FILE, 'utf8'));
  } catch (e) {
    console.log('🔄 Creating new build version file');
  }
}

// Increment build number and create 3-part semver
buildData.buildNumber++;
const patchWithBuild = PATCH_VERSION + buildData.buildNumber;
const newVersion = `${BASE_VERSION}.${patchWithBuild}`;

console.log(`🚀 Auto-incrementing build version to: ${newVersion}`);

// Save build data
fs.writeFileSync(BUILD_VERSION_FILE, JSON.stringify(buildData, null, 2));

// Update package.json
const packageJsonPath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Update Tauri config
const tauriConfigPath = 'src-tauri/tauri.conf.json';
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
tauriConfig.version = newVersion;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');

// Update Cargo.toml
const cargoTomlPath = 'src-tauri/Cargo.toml';
let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
cargoContent = cargoContent.replace(/^version = ".*"$/m, `version = "${newVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoContent);

console.log(`✅ Updated all version references to ${newVersion}`);
console.log(`📊 Build number: ${buildData.buildNumber}`);

// Update constants.js
const constantsPath = 'src/utils/constants.js';
let constantsContent = fs.readFileSync(constantsPath, 'utf8');
constantsContent = constantsContent.replace(/export const APP_VERSION = '.*';/, `export const APP_VERSION = '${newVersion}';`);
fs.writeFileSync(constantsPath, constantsContent);

console.log(`🎯 Ready to build version ${newVersion}`);