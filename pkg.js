#!/usr/bin/env node

/**
 * Package script for Webscribe Chrome Extension
 * Creates a ZIP file ready for Chrome Web Store upload
 *
 * Usage: node pkg.js
 * Output: out/webscribe-extension.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const OUTPUT_DIR = 'out';
const ZIP_NAME = 'webscribe-extension.zip';

// Files and folders to include
const INCLUDE = [
  'manifest.json',
  'service-worker.js',
  'popup-dist/',
  'lib/',
  'storage/',
  'icons/',
];

// Files and patterns to exclude (even if inside included folders)
const EXCLUDE_PATTERNS = [
  '.DS_Store',
  '*.md',
  '.git*',
];

function main() {
  const rootDir = __dirname;
  const outDir = path.join(rootDir, OUTPUT_DIR);
  const zipPath = path.join(outDir, ZIP_NAME);

  console.log('📦 Packaging Webscribe Extension...\n');

  // 1. Create output directory if it doesn't exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`✓ Created ${OUTPUT_DIR}/ directory`);
  }

  // 2. Remove existing ZIP if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
    console.log(`✓ Removed existing ${ZIP_NAME}`);
  }

  // 3. Build the zip command
  const includeArgs = INCLUDE.join(' ');
  const excludeArgs = EXCLUDE_PATTERNS.map(p => `-x "${p}"`).join(' ');

  const zipCommand = `zip -r "${zipPath}" ${includeArgs} ${excludeArgs}`;

  // 4. Execute zip command
  console.log(`✓ Creating ZIP archive...\n`);

  try {
    execSync(zipCommand, {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch (error) {
    console.error('✗ Failed to create ZIP:', error.message);
    process.exit(1);
  }

  // 5. Get file info
  const stats = fs.statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  // 6. List contents
  console.log('Package contents:');
  console.log('─'.repeat(40));

  try {
    const listing = execSync(`unzip -l "${zipPath}"`, { encoding: 'utf-8' });
    const lines = listing.split('\n');
    const fileCount = lines.find(l => l.includes('files'))?.match(/(\d+)\s+files/)?.[1] || '?';

    // Show summary of top-level items
    INCLUDE.forEach(item => {
      const icon = item.endsWith('/') ? '📁' : '📄';
      console.log(`  ${icon} ${item}`);
    });

    console.log('─'.repeat(40));
    console.log(`\n✅ Package created successfully!\n`);
    console.log(`   📦 ${ZIP_NAME}`);
    console.log(`   📍 ${zipPath}`);
    console.log(`   📊 ${sizeKB} KB (${fileCount} files)\n`);

  } catch (error) {
    console.log(`\n✅ Package created: ${zipPath} (${sizeKB} KB)\n`);
  }

  console.log('Next steps:');
  console.log('  1. Go to https://chrome.google.com/webstore/devconsole');
  console.log('  2. Click "New Item" or select your extension');
  console.log('  3. Upload the ZIP file from the out/ folder\n');
}

main();
