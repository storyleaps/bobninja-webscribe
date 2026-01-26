/**
 * Diagnose why the solution breaks with 02_html.html (full file)
 *
 * Run with: node diagnose-02-html.js
 */

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { tables } from 'turndown-plugin-gfm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const html = readFileSync(join(__dirname, 'samples', '02_html.html'), 'utf-8');

console.log('='.repeat(70));
console.log('DIAGNOSIS: Why Solution Breaks with 02_html.html');
console.log('='.repeat(70));

const dom = new JSDOM(html);
const doc = dom.window.document;

// ============================================================================
// STEP 1: Understand the scale problem
// ============================================================================

console.log('\n### STEP 1: The Scale Problem ###\n');

const bodyText = doc.body.textContent || doc.body.innerText || '';
const allH2s = doc.querySelectorAll('h2');
const allTables = doc.querySelectorAll('table');

console.log(`Total body text: ${bodyText.length} chars`);
console.log(`Total h2 headings: ${allH2s.length}`);
console.log(`Total tables: ${allTables.length}`);

// ============================================================================
// STEP 2: What Readability extracts
// ============================================================================

console.log('\n### STEP 2: Readability Extraction ###\n');

const docClone = doc.cloneNode(true);
const reader = new Readability(docClone);
const article = reader.parse();

if (!article) {
  console.log('❌ Readability failed');
  process.exit(1);
}

const extractionRatio = article.textContent.length / bodyText.length;
console.log(`Extracted: ${article.textContent.length} chars`);
console.log(`Extraction ratio: ${(extractionRatio * 100).toFixed(1)}%`);
console.log(`Threshold: 40%`);
console.log(`Passes extraction check? ${extractionRatio >= 0.4 ? 'YES ✅' : 'NO ❌'}`);

const extractedDom = new JSDOM(article.content);
const extractedDoc = extractedDom.window.document;
const extractedTables = extractedDoc.querySelectorAll('table').length;
const extractedH2s = extractedDoc.querySelectorAll('h2').length;

console.log(`\nTables extracted: ${extractedTables}/${allTables.length} (${(extractedTables/allTables.length * 100).toFixed(1)}%)`);
console.log(`H2s extracted: ${extractedH2s}/${allH2s.length} (${(extractedH2s/allH2s.length * 100).toFixed(1)}%)`);

const structureRatio = Math.min(extractedTables/allTables.length, extractedH2s/allH2s.length);
console.log(`Structure ratio: ${(structureRatio * 100).toFixed(1)}%`);
console.log(`Threshold: 60%`);
console.log(`Passes structure check? ${structureRatio >= 0.6 ? 'YES ✅' : 'NO ❌'}`);

// ============================================================================
// STEP 3: Identify which sections are dropped
// ============================================================================

console.log('\n### STEP 3: Which Sections Are Dropped? ###\n');

// List first 20 h2 headings in original
console.log('First 20 h2 headings in original:');
Array.from(allH2s).slice(0, 20).forEach((h2, i) => {
  const text = h2.textContent.trim().substring(0, 40);
  console.log(`  ${i + 1}. ${text}`);
});

console.log('\nFirst 20 h2 headings in Readability output:');
const extractedH2Elements = extractedDoc.querySelectorAll('h2');
Array.from(extractedH2Elements).slice(0, 20).forEach((h2, i) => {
  const text = h2.textContent.trim().substring(0, 40);
  console.log(`  ${i + 1}. ${text}`);
});

// Check which critical sections are missing
const criticalSections = [
  { name: 'Libraries', selector: '#library' },
  { name: 'Websocket Trades', selector: '#websocket-trades' },
];

console.log('\nCritical sections in original HTML:');
criticalSections.forEach(({ name, selector }) => {
  const el = doc.querySelector(selector);
  const found = el !== null;
  console.log(`  ${found ? '✅' : '❌'} ${name} (${selector})`);
  if (found) {
    const h2 = el.querySelector('h2');
    console.log(`      h2 text: "${h2?.textContent.trim().substring(0, 50)}"`);
  }
});

console.log('\nCritical sections in Readability output:');
criticalSections.forEach(({ name }) => {
  // Check by content
  const foundLibraries = article.content.includes('finnhub-python');
  const foundTrades = article.content.includes('Trades - Last Price Updates');

  if (name === 'Libraries') {
    console.log(`  ${foundLibraries ? '✅' : '❌'} ${name} (check: finnhub-python)`);
  } else if (name === 'Websocket Trades') {
    console.log(`  ${foundTrades ? '✅' : '❌'} ${name} (check: Trades - Last Price Updates)`);
  }
});

// ============================================================================
// STEP 4: The fundamental problem
// ============================================================================

console.log('\n### STEP 4: The Fundamental Problem ###\n');

console.log('WHY RATIO-BASED CHECKS FAIL AT SCALE:');
console.log('');
console.log('Small file (01_html.html):');
console.log(`  - 8 h2 headings total`);
console.log(`  - Drops 1 h2 → 7/8 = 88% (passes 60% threshold)`);
console.log(`  - But that 1 h2 is the critical "Libraries" section! ❌`);
console.log('');
console.log('Large file (02_html.html):');
console.log(`  - 116 h2 headings total`);
console.log(`  - Drops 7 h2s → 109/116 = 94% (passes 60% threshold) ✅`);
console.log(`  - But those 7 h2s include critical sections! ❌`);
console.log('');
console.log('THE ISSUE:');
console.log('  When you have 100+ sections, losing 5-10 critical sections');
console.log('  barely moves the ratio. The structural check becomes useless.');
console.log('');
console.log('EXAMPLE:');
console.log('  Losing 1 section out of 8 = 12.5% drop → DETECTABLE');
console.log('  Losing 1 section out of 116 = 0.9% drop → INVISIBLE');
console.log('');

console.log('CONCLUSION:');
console.log('  ❌ Ratio-based approach does NOT generalize to large files');
console.log('  ✅ Need content-based verification instead');

console.log('\n' + '='.repeat(70));
console.log('ROOT CAUSE IDENTIFIED');
console.log('='.repeat(70));

console.log('\nThe solution worked for the small file by LUCK, not by design.');
console.log('It failed to generalize because:');
console.log('  1. Ratios become meaningless at scale (116 sections)');
console.log('  2. Readability keeps "most" content but drops critical pieces');
console.log('  3. We need ABSOLUTE checks, not RELATIVE ratios');
