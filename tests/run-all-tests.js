#!/usr/bin/env node
/**
 * Test runner for Webscribe
 * Runs all test files and reports combined results
 *
 * Usage:
 *   npm test           # Run all tests
 *   node run-all-tests.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find all test files (test-*.js)
const testFiles = readdirSync(__dirname)
  .filter(f => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              WEBSCRIBE - MARKDOWN CONVERSION TESTS                    ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log(`\nFound ${testFiles.length} test file(s):\n`);
testFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
console.log('');

let totalPassed = 0;
let totalFailed = 0;
let filesRun = 0;

/**
 * Run a single test file and capture results
 */
function runTestFile(filename) {
  return new Promise((resolve) => {
    const filePath = join(__dirname, filename);
    const child = spawn('node', [filePath], {
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      // Extract pass/fail counts from output
      const passMatch = stdout.match(/✅ Passed: (\d+)/);
      const failMatch = stdout.match(/❌ Failed: (\d+)/);

      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;

      resolve({ filename, code, passed, failed });
    });
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  for (const file of testFiles) {
    console.log('\n' + '─'.repeat(70));
    console.log(`RUNNING: ${file}`);
    console.log('─'.repeat(70) + '\n');

    const result = await runTestFile(file);
    totalPassed += result.passed;
    totalFailed += result.failed;
    filesRun++;

    if (result.code !== 0) {
      console.log(`\n⚠️  ${file} exited with code ${result.code}`);
    }
  }

  // Print final summary
  console.log('\n' + '═'.repeat(70));
  console.log('                        FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\n  Test files run: ${filesRun}`);
  console.log(`  ✅ Total passed: ${totalPassed}`);
  console.log(`  ❌ Total failed: ${totalFailed}`);
  console.log(`  📊 Total tests:  ${totalPassed + totalFailed}`);

  if (totalFailed === 0) {
    console.log('\n  🎉 ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('\n  ⚠️  SOME TESTS FAILED\n');
    process.exit(1);
  }
}

runAllTests();
