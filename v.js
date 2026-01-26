#!/usr/bin/env node

/**
 * Simple version checker
 * Returns the current version from manifest.json
 *
 * Usage: node v.js
 */

const fs = require('fs');
const path = require('path');

try {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(manifest.version);
} catch (error) {
  console.error('Error reading version:', error.message);
  process.exit(1);
}
