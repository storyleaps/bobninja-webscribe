/**
 * Test specifically for structural content loss detection
 *
 * This test validates that the structural loss check (tables, h2 headings)
 * correctly triggers fallback even when extraction ratio looks acceptable.
 *
 * Run with: node test-structural-loss-check.js
 */

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { tables } from 'turndown-plugin-gfm';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MINIMUM_EXTRACTION_RATIO = 0.4;
const MINIMUM_STRUCTURE_RATIO = 0.6;

// Load sample file
const SAMPLE_FILE_PATH = join(__dirname, 'samples', '01_html.html');
if (!existsSync(SAMPLE_FILE_PATH)) {
  console.error(`❌ Sample file not found: ${SAMPLE_FILE_PATH}`);
  process.exit(1);
}
const SAMPLE_HTML = readFileSync(SAMPLE_FILE_PATH, 'utf-8');

// ============================================================================
// FUNCTIONS
// ============================================================================

function normalizeCodeBlocks(doc) {
  const preTags = doc.querySelectorAll('pre');
  preTags.forEach(pre => {
    const decorativeSelectors = [
      '.react-syntax-highlighter-line-number', '.line-number', '.line-numbers',
      '.linenumber', '.linenumbers', '.hljs-ln-numbers', '.hljs-ln-n',
      '[data-line-number]', '.copy-button', '.copy-code', 'button.copy',
      '.code-toolbar > .toolbar', '.prism-show-language', '.line-numbers-rows'
    ];
    decorativeSelectors.forEach(selector => {
      try { pre.querySelectorAll(selector).forEach(el => el.remove()); } catch (e) {}
    });
  });
}

function removeNoiseElements(doc) {
  const noiseSelectors = [
    'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.header', '.footer', '.breadcrumb', '.breadcrumbs',
    '#side-bar', '#sidebar', '#sideBar', '#SideBar',
    '#left-sidebar', '#right-sidebar', '#leftSidebar', '#rightSidebar',
    '.side-bar', '.sideBar', '.left-sidebar', '.right-sidebar',
    '#nav-btn-container', '.nav-button', '.nav-footer',
    '.toc', '#toc', '.table-of-contents', '#table-of-contents',
    '.ad', '.ads', '.advertisement', '.social-share', '.share-buttons',
    '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
    '.popup', '.modal', '.overlay',
    '.comments', '.comment-section', '#comments',
    '[hidden]', '[aria-hidden="true"]',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]'
  ];
  noiseSelectors.forEach(selector => {
    try { doc.querySelectorAll(selector).forEach(el => el.remove()); } catch (e) {}
  });
}

function checkStructuralLoss(originalDoc, extractedHtml) {
  const originalClone = originalDoc.cloneNode(true);
  removeNoiseElements(originalClone);

  const originalTables = originalClone.querySelectorAll('table').length;
  const originalH2s = originalClone.querySelectorAll('h2').length;

  const extractedDom = new JSDOM(extractedHtml);
  const extractedDoc = extractedDom.window.document;
  const extractedTables = extractedDoc.querySelectorAll('table').length;
  const extractedH2s = extractedDoc.querySelectorAll('h2').length;

  const tableRatio = originalTables > 0 ? extractedTables / originalTables : 1;
  const h2Ratio = originalH2s > 0 ? extractedH2s / originalH2s : 1;
  const structureRatio = Math.min(tableRatio, h2Ratio);

  return {
    originalTables,
    extractedTables,
    originalH2s,
    extractedH2s,
    tableRatio,
    h2Ratio,
    structureRatio,
    hasSignificantLoss: structureRatio < MINIMUM_STRUCTURE_RATIO
  };
}

function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined'
  });
  turndownService.use(tables);
  return turndownService;
}

function convertBodyDirectly(dom) {
  const cleanDoc = dom.window.document.cloneNode(true);
  normalizeCodeBlocks(cleanDoc);
  removeNoiseElements(cleanDoc);

  const turndownService = createTurndownService();
  const markdown = turndownService.turndown(cleanDoc.body.innerHTML);

  return { markdown, usedFallback: true };
}

// ============================================================================
// MAIN TEST
// ============================================================================

console.log('='.repeat(70));
console.log('TEST: Structural Loss Detection for Sample File');
console.log('='.repeat(70));

const dom = new JSDOM(SAMPLE_HTML);
const document = dom.window.document;

// Step 1: Get original text length
const originalText = document.body.textContent || document.body.innerText || '';
const originalTextLength = originalText.length;

console.log(`\nOriginal body text: ${originalTextLength} chars`);

// Step 2: Run Readability
const docClone = document.cloneNode(true);
normalizeCodeBlocks(docClone);

const reader = new Readability(docClone);
const article = reader.parse();

if (!article) {
  console.log('❌ Readability failed');
  process.exit(1);
}

const extractedTextLength = article.textContent.length;
const extractionRatio = extractedTextLength / originalTextLength;

console.log(`Readability extracted: ${extractedTextLength} chars`);
console.log(`Extraction ratio: ${(extractionRatio * 100).toFixed(1)}%`);
console.log(`Threshold: ${MINIMUM_EXTRACTION_RATIO * 100}%`);
console.log(`Would trigger fallback (ratio check)? ${extractionRatio < MINIMUM_EXTRACTION_RATIO ? 'YES' : 'NO'}`);

// Step 3: Check structural loss
console.log('\n### Structural Loss Check ###\n');
const structureCheck = checkStructuralLoss(document, article.content);

console.log(`Original tables (after noise removal): ${structureCheck.originalTables}`);
console.log(`Extracted tables: ${structureCheck.extractedTables}`);
console.log(`Table retention ratio: ${(structureCheck.tableRatio * 100).toFixed(0)}%`);

console.log(`\nOriginal h2 headings (after noise removal): ${structureCheck.originalH2s}`);
console.log(`Extracted h2 headings: ${structureCheck.extractedH2s}`);
console.log(`H2 retention ratio: ${(structureCheck.h2Ratio * 100).toFixed(0)}%`);

console.log(`\nStructure retention ratio: ${(structureCheck.structureRatio * 100).toFixed(0)}%`);
console.log(`Threshold: ${MINIMUM_STRUCTURE_RATIO * 100}%`);
console.log(`Has significant structural loss? ${structureCheck.hasSignificantLoss ? 'YES' : 'NO'}`);

// Step 4: Verify expected content
console.log('\n### Content Verification ###\n');

const expectedContent = [
  'finnhub-python',
  'finnhub-go',
  'Finnhub NPM',
  'Message type.',
  'Symbol.',
  'Last price.',
  'Volume.'
];

const readabilityMarkdown = createTurndownService().turndown(article.content);

console.log('Content in Readability output:');
let readabilityMissing = 0;
expectedContent.forEach(text => {
  const found = readabilityMarkdown.includes(text);
  if (!found) readabilityMissing++;
  console.log(`  ${found ? '✅' : '❌'} "${text}"`);
});

const directResult = convertBodyDirectly(dom);

console.log('\nContent in Direct conversion output:');
let directMissing = 0;
expectedContent.forEach(text => {
  const found = directResult.markdown.includes(text);
  if (!found) directMissing++;
  console.log(`  ${found ? '✅' : '❌'} "${text}"`);
});

// Step 5: Final verdict
console.log('\n' + '='.repeat(70));
console.log('VERDICT');
console.log('='.repeat(70));

console.log(`\nExtraction ratio check: ${extractionRatio >= MINIMUM_EXTRACTION_RATIO ? 'PASS (no fallback)' : 'FAIL (triggers fallback)'}`);
console.log(`Structural loss check: ${structureCheck.hasSignificantLoss ? 'FAIL (triggers fallback)' : 'PASS (no fallback)'}`);
console.log(`\nFallback should be triggered? ${extractionRatio < MINIMUM_EXTRACTION_RATIO || structureCheck.hasSignificantLoss ? 'YES' : 'NO'}`);

console.log(`\nReadability missing content: ${readabilityMissing}/${expectedContent.length} items`);
console.log(`Direct conversion missing content: ${directMissing}/${expectedContent.length} items`);

if (structureCheck.hasSignificantLoss) {
  console.log('\n✅ Structural loss check successfully detects content loss');
  console.log('   Fallback mechanism will preserve all content');
} else {
  console.log('\n⚠️  Structural loss check did NOT detect the issue');
  console.log('   The threshold may need adjustment');
}
