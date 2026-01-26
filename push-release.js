#!/usr/bin/env node

/**
 * GitHub Release script for Webscribe Chrome Extension
 *
 * Usage: node push-release.js [notes]
 * Example: node push-release.js "Fixed bug in content extraction"
 *
 * This script:
 * 1. Reads the version from manifest.json
 * 2. Verifies the ZIP artifact exists in out/
 * 3. Creates a GitHub Release with the artifact attached
 * 4. Optionally includes release notes
 *
 * Prerequisites:
 * - GitHub CLI (gh) must be installed and authenticated
 * - Git tag must already exist (created by rls.js)
 * - ZIP artifact must exist (created by pkg.js)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MANIFEST_PATH = 'manifest.json';
const ZIP_PATH = 'out/webscribe-extension.zip';

// Color helpers for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Executes a shell command and returns output
 */
function exec(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    return output.trim();
  } catch (err) {
    if (!silent) {
      error(`Command failed: ${command}\n${err.message}`);
    }
    throw err;
  }
}

/**
 * Checks if GitHub CLI is installed and authenticated
 */
function checkGitHubCLI() {
  try {
    exec('gh --version', true);
    success('GitHub CLI (gh) is installed');
  } catch (err) {
    error('GitHub CLI (gh) is not installed. Install it from https://cli.github.com/');
  }

  try {
    exec('gh auth status', true);
    success('GitHub CLI is authenticated');
  } catch (err) {
    error('GitHub CLI is not authenticated. Run: gh auth login');
  }
}

/**
 * Reads version from manifest.json
 */
function getVersion() {
  const manifestPath = path.join(__dirname, MANIFEST_PATH);

  if (!fs.existsSync(manifestPath)) {
    error(`manifest.json not found at ${manifestPath}`);
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);

    if (!manifest.version) {
      error('No version field found in manifest.json');
    }

    return manifest.version;
  } catch (err) {
    error(`Failed to read manifest.json: ${err.message}`);
  }
}

/**
 * Verifies the ZIP artifact exists
 */
function checkArtifact() {
  const zipPath = path.join(__dirname, ZIP_PATH);

  if (!fs.existsSync(zipPath)) {
    error(`ZIP artifact not found at ${zipPath}\nRun: node pkg.js`);
  }

  const stats = fs.statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  success(`Found artifact: ${ZIP_PATH} (${sizeKB} KB)`);

  return zipPath;
}

/**
 * Checks if git tag exists
 */
function checkGitTag(version) {
  const tagName = `v${version}`;

  try {
    exec(`git rev-parse ${tagName}`, true);
    success(`Git tag ${tagName} exists`);
    return tagName;
  } catch (err) {
    error(`Git tag ${tagName} does not exist.\nRun: node rls.js ${version}`);
  }
}

/**
 * Checks if release already exists
 */
function checkExistingRelease(tagName) {
  try {
    exec(`gh release view ${tagName}`, true);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Creates GitHub Release
 */
function createRelease(tagName, zipPath, notes) {
  const releaseTitle = tagName;

  // Build the gh release create command
  let command = `gh release create "${tagName}" "${zipPath}"`;
  command += ` --title "${releaseTitle}"`;

  if (notes) {
    // Escape quotes in notes
    const escapedNotes = notes.replace(/"/g, '\\"');
    command += ` --notes "${escapedNotes}"`;
  } else {
    command += ` --notes "Release ${tagName}"`;
  }

  info(`\n📦 Creating GitHub Release ${tagName}...`);

  try {
    const output = exec(command);
    success('GitHub Release created successfully!');

    // Parse and display the release URL
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
    if (urlMatch) {
      log(`\n🔗 Release URL: ${urlMatch[0]}`, 'cyan');
    }

    return output;
  } catch (err) {
    error(`Failed to create GitHub Release: ${err.message}`);
  }
}

/**
 * Main function
 */
function main() {
  log('\n🚀 Starting GitHub Release process...', 'blue');

  // Parse arguments
  const args = process.argv.slice(2);
  const notes = args.join(' ') || '';

  if (notes) {
    info(`Release notes: "${notes}"`);
  }

  // Step 1: Check prerequisites
  info('\n🔍 Checking prerequisites...');
  checkGitHubCLI();

  // Step 2: Read version from manifest
  info('\n📋 Reading version from manifest.json...');
  const version = getVersion();
  success(`Version: ${version}`);

  // Step 3: Check git tag exists
  info('\n🏷️  Checking git tag...');
  const tagName = checkGitTag(version);

  // Step 4: Check if artifact exists
  info('\n📦 Checking build artifact...');
  const zipPath = checkArtifact();

  // Step 5: Check if release already exists
  info('\n🔎 Checking for existing release...');
  if (checkExistingRelease(tagName)) {
    warning(`GitHub Release ${tagName} already exists.`);
    info('To overwrite, delete the existing release first:');
    console.log(`  gh release delete ${tagName}`);
    process.exit(1);
  }
  success('No existing release found');

  // Step 6: Create the release
  createRelease(tagName, zipPath, notes);

  // Step 7: Summary
  log('\n✨ Release published successfully!', 'green');
  info('\nSummary:');
  console.log(`  Version: ${version}`);
  console.log(`  Tag: ${tagName}`);
  console.log(`  Artifact: ${ZIP_PATH}`);
  if (notes) {
    console.log(`  Notes: ${notes}`);
  }

  log('\n📌 Next steps:', 'yellow');
  console.log('  1. View release: gh release view ' + tagName);
  console.log('  2. Or visit: https://github.com/<owner>/<repo>/releases');
  console.log('  3. Upload ZIP to Chrome Web Store');
}

main();
