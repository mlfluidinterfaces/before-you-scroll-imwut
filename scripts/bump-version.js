#!/usr/bin/env node

/**
 * Bump Version Script
 * 
 * Updates version in:
 * - package.json
 * - android/app/build.gradle (versionName and versionCode)
 * - app.config.js (version and runtimeVersion)
 * - android/app/src/main/res/values/strings.xml (expo_runtime_version)
 * 
 * Usage:
 *   npm run version:patch  (1.0.0 -> 1.0.1)
 *   npm run version:minor  (1.0.0 -> 1.1.0)
 *   npm run version:major  (1.0.0 -> 2.0.0)
 *   npm run version -- 1.2.3  (set specific version)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const BUILD_GRADLE = path.join(ROOT_DIR, 'android/app/build.gradle');
const APP_CONFIG = path.join(ROOT_DIR, 'app.config.js');
const STRINGS_XML = path.join(ROOT_DIR, 'android/app/src/main/res/values/strings.xml');

function parseVersion(versionString) {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}

function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function calculateVersionCode(version) {
  // Version code formula: (major * 10000) + (minor * 100) + patch
  return (version.major * 10000) + (version.minor * 100) + version.patch;
}

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return pkg.version;
}

function bumpVersion(currentVersion, bumpType) {
  const version = parseVersion(currentVersion);
  
  switch (bumpType) {
    case 'major':
      version.major++;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor++;
      version.patch = 0;
      break;
    case 'patch':
      version.patch++;
      break;
    default:
      // If it looks like a version number, use it directly
      if (/^\d+\.\d+\.\d+$/.test(bumpType)) {
        return bumpType;
      }
      throw new Error(`Invalid bump type: ${bumpType}. Use 'major', 'minor', 'patch', or a version number.`);
  }
  
  return formatVersion(version);
}

function updatePackageJson(newVersion) {
  console.log(`📦 Updating package.json...`);
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`   ✓ package.json version: ${newVersion}`);
}

function updateBuildGradle(newVersion) {
  console.log(`🤖 Updating Android build.gradle...`);
  let gradle = fs.readFileSync(BUILD_GRADLE, 'utf8');
  
  const version = parseVersion(newVersion);
  const versionCode = calculateVersionCode(version);
  
  // Update versionCode
  gradle = gradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`
  );
  
  // Update versionName
  gradle = gradle.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${newVersion}"`
  );
  
  fs.writeFileSync(BUILD_GRADLE, gradle);
  console.log(`   ✓ versionName: ${newVersion}`);
  console.log(`   ✓ versionCode: ${versionCode}`);
}

function updateAppConfig(newVersion) {
  console.log(`⚙️  Updating app.config.js...`);
  let config = fs.readFileSync(APP_CONFIG, 'utf8');
  
  // Update version field
  config = config.replace(
    /version:\s*"[^"]+"/,
    `version: "${newVersion}"`
  );
  
  // Update runtimeVersion fields (both iOS and Android)
  config = config.replace(
    /runtimeVersion:\s*"[^"]+"/g,
    `runtimeVersion: "${newVersion}"`
  );
  
  fs.writeFileSync(APP_CONFIG, config);
  console.log(`   ✓ app.config.js version: ${newVersion}`);
  console.log(`   ✓ app.config.js runtimeVersion: ${newVersion}`);
}

function updateStringsXml(newVersion) {
  console.log(`📱 Updating Android strings.xml...`);
  let stringsXml = fs.readFileSync(STRINGS_XML, 'utf8');
  
  // Update expo_runtime_version
  stringsXml = stringsXml.replace(
    /<string name="expo_runtime_version">[^<]+<\/string>/,
    `<string name="expo_runtime_version">${newVersion}</string>`
  );
  
  fs.writeFileSync(STRINGS_XML, stringsXml);
  console.log(`   ✓ strings.xml expo_runtime_version: ${newVersion}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: No bump type specified');
    console.error('Usage:');
    console.error('  npm run version:patch  (1.0.0 -> 1.0.1)');
    console.error('  npm run version:minor  (1.0.0 -> 1.1.0)');
    console.error('  npm run version:major  (1.0.0 -> 2.0.0)');
    console.error('  npm run version -- 1.2.3  (set specific version)');
    process.exit(1);
  }
  
  try {
    const bumpType = args[0];
    const currentVersion = getCurrentVersion();
    const newVersion = bumpVersion(currentVersion, bumpType);
    
    console.log(`\n🚀 Bumping version: ${currentVersion} → ${newVersion}\n`);
    
    updatePackageJson(newVersion);
    updateBuildGradle(newVersion);
    updateAppConfig(newVersion);
    updateStringsXml(newVersion);
    
    console.log(`\n✨ Version updated successfully!\n`);
    console.log(`Next steps:`);
    console.log(`  1. Review changes: git diff`);
    console.log(`  2. Build: npm run build:android`);
    console.log(`  3. Commit: git add . && git commit -m "Bump version to ${newVersion}"`);
    console.log(``);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
