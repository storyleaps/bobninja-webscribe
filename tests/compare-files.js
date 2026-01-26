/**
 * Compare 01_html.html (small) vs 02_html.html (full) to understand differences
 *
 * Run with: node compare-files.js
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const file01 = join(__dirname, 'samples', '01_html.html');
const file02 = join(__dirname, 'samples', '02_html.html');

const html01 = readFileSync(file01, 'utf-8');
const html02 = readFileSync(file02, 'utf-8');

console.log('='.repeat(70));
console.log('FILE COMPARISON: 01_html.html vs 02_html.html');
console.log('='.repeat(70));

console.log('\n### Basic Metrics ###\n');

console.log('01_html.html (small):');
console.log(`  Total size: ${html01.length} chars`);
console.log(`  Lines: ${html01.split('\n').length}`);

console.log('\n02_html.html (full):');
console.log(`  Total size: ${html02.length} chars`);
console.log(`  Lines: ${html02.split('\n').length}`);

const sizeRatio = html02.length / html01.length;
console.log(`\nSize ratio: ${sizeRatio.toFixed(1)}x larger`);

// ============================================================================
// Analyze structure
// ============================================================================

function analyzeStructure(html, label) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const bodyText = doc.body.textContent || doc.body.innerText || '';

  return {
    label,
    bodyTextLength: bodyText.length,
    tables: doc.querySelectorAll('table').length,
    h2s: doc.querySelectorAll('h2').length,
    h3s: doc.querySelectorAll('h3').length,
    divs: doc.querySelectorAll('div').length,
    sections: doc.querySelectorAll('section, .section, .endpoint-section').length,
    sidebar: doc.querySelector('#side-bar') ? 'YES' : 'NO',
    sidebarTextLength: doc.querySelector('#side-bar')?.textContent.length || 0,
  };
}

console.log('\n### HTML Structure ###\n');

const struct01 = analyzeStructure(html01, '01_html.html');
const struct02 = analyzeStructure(html02, '02_html.html');

console.log('Element counts:');
console.log(`  Tables: ${struct01.tables} → ${struct02.tables} (${struct02.tables - struct01.tables} more)`);
console.log(`  H2 headings: ${struct01.h2s} → ${struct02.h2s} (${struct02.h2s - struct01.h2s} more)`);
console.log(`  H3 headings: ${struct01.h3s} → ${struct02.h3s} (${struct02.h3s - struct01.h3s} more)`);
console.log(`  Divs: ${struct01.divs} → ${struct02.divs} (${struct02.divs - struct01.divs} more)`);
console.log(`  Sections: ${struct01.sections} → ${struct02.sections} (${struct02.sections - struct01.sections} more)`);

console.log(`\nSidebar: ${struct01.sidebar} → ${struct02.sidebar}`);
console.log(`Sidebar text: ${struct01.sidebarTextLength} → ${struct02.sidebarTextLength} chars`);

// ============================================================================
// Test Readability on both
// ============================================================================

function testReadability(html, label) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const bodyText = doc.body.textContent || doc.body.innerText || '';

  const docClone = doc.cloneNode(true);
  const reader = new Readability(docClone);
  const article = reader.parse();

  if (!article) {
    return { label, failed: true };
  }

  const extractionRatio = article.textContent.length / bodyText.length;

  return {
    label,
    failed: false,
    bodyTextLength: bodyText.length,
    extractedLength: article.textContent.length,
    extractionRatio,
    tablesInOriginal: doc.querySelectorAll('table').length,
    tablesInExtracted: (article.content.match(/<table/g) || []).length,
    h2sInOriginal: doc.querySelectorAll('h2').length,
    h2sInExtracted: (article.content.match(/<h2/g) || []).length,
  };
}

console.log('\n### Readability Extraction Results ###\n');

const result01 = testReadability(html01, '01_html.html');
const result02 = testReadability(html02, '02_html.html');

if (!result01.failed) {
  console.log('01_html.html (small):');
  console.log(`  Body text: ${result01.bodyTextLength} chars`);
  console.log(`  Extracted: ${result01.extractedLength} chars`);
  console.log(`  Extraction ratio: ${(result01.extractionRatio * 100).toFixed(1)}%`);
  console.log(`  Tables: ${result01.tablesInExtracted}/${result01.tablesInOriginal} (${(result01.tablesInExtracted/result01.tablesInOriginal * 100).toFixed(0)}%)`);
  console.log(`  H2s: ${result01.h2sInExtracted}/${result01.h2sInOriginal} (${(result01.h2sInExtracted/result01.h2sInOriginal * 100).toFixed(0)}%)`);
}

if (!result02.failed) {
  console.log('\n02_html.html (full):');
  console.log(`  Body text: ${result02.bodyTextLength} chars`);
  console.log(`  Extracted: ${result02.extractedLength} chars`);
  console.log(`  Extraction ratio: ${(result02.extractionRatio * 100).toFixed(1)}%`);
  console.log(`  Tables: ${result02.tablesInExtracted}/${result02.tablesInOriginal} (${(result02.tablesInExtracted/result02.tablesInOriginal * 100).toFixed(0)}%)`);
  console.log(`  H2s: ${result02.h2sInExtracted}/${result02.h2sInOriginal} (${(result02.h2sInExtracted/result02.h2sInOriginal * 100).toFixed(0)}%)`);
}

// ============================================================================
// Check for critical content
// ============================================================================

console.log('\n### Critical Content Check ###\n');

const criticalContent = [
  'finnhub-python',
  'finnhub-go',
  'Message type.',
  'Symbol.',
  'Last price.',
  'Volume.'
];

console.log('Content in 01_html.html Readability output:');
criticalContent.forEach(text => {
  const found = result01.failed ? false : (result01.extractedLength > 0 && html01.includes(text));
  console.log(`  ${found ? '✅' : '❌'} "${text}"`);
});

console.log('\nContent in 02_html.html Readability output:');
if (!result02.failed && result02.extractedLength > 0) {
  const dom = new JSDOM(html02);
  const doc = dom.window.document;
  const docClone = doc.cloneNode(true);
  const reader = new Readability(docClone);
  const article = reader.parse();

  criticalContent.forEach(text => {
    const found = article.content.includes(text);
    console.log(`  ${found ? '✅' : '❌'} "${text}"`);
  });
}

// ============================================================================
// Key differences
// ============================================================================

console.log('\n### Key Differences ###\n');

console.log('Potential issues in 02_html.html:');
console.log(`  - ${struct02.tables - struct01.tables} more tables (harder to detect which are critical)`);
console.log(`  - ${struct02.h2s - struct01.h2s} more h2 headings (dilutes the ratio)`);
console.log(`  - ${sizeRatio.toFixed(0)}x more content (changes extraction ratio dynamics)`);

if (!result02.failed) {
  const tableRetention = result02.tablesInExtracted / result02.tablesInOriginal;
  const h2Retention = result02.h2sInExtracted / result02.h2sInOriginal;
  const structureRatio = Math.min(tableRetention, h2Retention);

  console.log(`\nStructural retention in 02_html.html:`);
  console.log(`  Tables: ${(tableRetention * 100).toFixed(1)}%`);
  console.log(`  H2s: ${(h2Retention * 100).toFixed(1)}%`);
  console.log(`  Structure ratio (min): ${(structureRatio * 100).toFixed(1)}%`);
  console.log(`  Would trigger fallback (< 60%)? ${structureRatio < 0.6 ? 'YES' : 'NO'}`);
}

console.log('\n' + '='.repeat(70));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(70));
