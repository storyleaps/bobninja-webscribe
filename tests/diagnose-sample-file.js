/**
 * Diagnostic test for the sample file (tests/samples/01_html.html)
 *
 * This test specifically checks what content is being lost when processing
 * the sample HTML file and helps identify the root cause.
 *
 * Run with: node test-sample-file-diagnosis.js
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

// ============================================================================
// LOAD SAMPLE FILE
// ============================================================================

const SAMPLE_FILE_PATH = join(__dirname, 'samples', '01_html.html');

if (!existsSync(SAMPLE_FILE_PATH)) {
  console.error(`❌ Sample file not found: ${SAMPLE_FILE_PATH}`);
  process.exit(1);
}

const SAMPLE_HTML = readFileSync(SAMPLE_FILE_PATH, 'utf-8');

console.log('='.repeat(70));
console.log('DIAGNOSTIC: Sample File Content Loss Analysis');
console.log(`File: ${SAMPLE_FILE_PATH}`);
console.log('='.repeat(70));

// ============================================================================
// FUNCTIONS (same as in tab-fetcher.js)
// ============================================================================

const MINIMUM_EXTRACTION_RATIO = 0.4;

function normalizeCodeBlocks(doc) {
  const preTags = doc.querySelectorAll('pre');
  preTags.forEach(pre => {
    const decorativeSelectors = [
      '.react-syntax-highlighter-line-number',
      '.line-number', '.line-numbers', '.linenumber', '.linenumbers',
      '.hljs-ln-numbers', '.hljs-ln-n', '[data-line-number]',
      '.copy-button', '.copy-code', 'button.copy',
      '.code-toolbar > .toolbar', '.prism-show-language', '.line-numbers-rows'
    ];
    decorativeSelectors.forEach(selector => {
      try { pre.querySelectorAll(selector).forEach(el => el.remove()); } catch (e) {}
    });
  });
}

function removeNoiseElements(doc) {
  const noiseSelectors = [
    'script', 'style', 'noscript',
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.header', '.footer', '.breadcrumb', '.breadcrumbs',
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

// ============================================================================
// STEP 1: Parse and analyze the original HTML
// ============================================================================

console.log('\n### STEP 1: Original HTML Analysis ###\n');

const dom = new JSDOM(SAMPLE_HTML);
const document = dom.window.document;

const bodyText = document.body.textContent || document.body.innerText || '';
console.log(`Original body text length: ${bodyText.length} chars`);

// Expected content that should be preserved
const expectedContent = [
  { name: 'Libraries heading', text: 'Libraries' },
  { name: 'Python SDK', text: 'finnhub-python' },
  { name: 'Go SDK', text: 'finnhub-go' },
  { name: 'Javascript SDK', text: 'Finnhub NPM' },
  { name: 'Ruby SDK', text: 'Finnhub Ruby' },
  { name: 'Kotlin SDK', text: 'Finnhub Kotlin' },
  { name: 'PHP SDK', text: 'Finnhub PHP' },
  { name: 'Open Data heading', text: 'Open Data' },
  { name: 'Trades heading', text: 'Trades - Last Price Updates' },
  { name: 'Response Attributes label', text: 'Response Attributes' },
  { name: 'type field', text: 'Message type.' },
  { name: 'data field', text: 'List of trades or price updates.' },
  { name: 's field (Symbol)', text: 'Symbol.' },
  { name: 'p field (Last price)', text: 'Last price.' },
  { name: 't field (timestamp)', text: 'UNIX milliseconds timestamp.' },
  { name: 'v field (Volume)', text: 'Volume.' },
  { name: 'c field (conditions)', text: 'trade conditions' },
];

console.log('\nExpected content in original HTML:');
expectedContent.forEach(({ name, text }) => {
  const found = SAMPLE_HTML.includes(text);
  console.log(`  ${found ? '✅' : '❌'} ${name}: "${text.substring(0, 40)}..."`);
});

// ============================================================================
// STEP 2: Check Readability extraction
// ============================================================================

console.log('\n### STEP 2: Readability.js Extraction ###\n');

const docClone1 = document.cloneNode(true);
normalizeCodeBlocks(docClone1);

const reader = new Readability(docClone1);
const article = reader.parse();

if (!article) {
  console.log('❌ Readability returned null');
} else {
  console.log(`Title: "${article.title}"`);
  console.log(`Content length: ${article.content.length} chars`);
  console.log(`Text length: ${article.textContent.length} chars`);

  const extractionRatio = article.textContent.length / bodyText.length;
  console.log(`\nExtraction ratio: ${(extractionRatio * 100).toFixed(1)}%`);
  console.log(`Minimum threshold: ${MINIMUM_EXTRACTION_RATIO * 100}%`);
  console.log(`Would trigger fallback? ${extractionRatio < MINIMUM_EXTRACTION_RATIO ? 'YES' : 'NO'}`);

  console.log('\nExpected content in Readability output:');
  expectedContent.forEach(({ name, text }) => {
    const found = article.content.includes(text);
    console.log(`  ${found ? '✅' : '❌'} ${name}`);
  });
}

// ============================================================================
// STEP 3: Check direct conversion with noise removal
// ============================================================================

console.log('\n### STEP 3: Direct Conversion (with noise removal) ###\n');

const docClone2 = document.cloneNode(true);
normalizeCodeBlocks(docClone2);
removeNoiseElements(docClone2);

const turndownService = createTurndownService();
const directMarkdown = turndownService.turndown(docClone2.body.innerHTML);

console.log(`Direct markdown length: ${directMarkdown.length} chars`);

console.log('\nExpected content in direct conversion:');
expectedContent.forEach(({ name, text }) => {
  const found = directMarkdown.includes(text);
  console.log(`  ${found ? '✅' : '❌'} ${name}`);
});

// ============================================================================
// STEP 4: Identify what noise removal is missing
// ============================================================================

console.log('\n### STEP 4: Noise Removal Analysis ###\n');

const docClone3 = document.cloneNode(true);

// Check for sidebar
const sidebar = docClone3.querySelector('#side-bar');
console.log(`Sidebar (#side-bar) present: ${sidebar ? 'YES' : 'NO'}`);
if (sidebar) {
  console.log(`  Sidebar text length: ${sidebar.textContent.length} chars`);
}

// Check for other potential noise elements
const potentialNoise = [
  { selector: '#side-bar', name: 'Sidebar' },
  { selector: '#nav-btn-container', name: 'Nav button container' },
  { selector: '.side-bar-header', name: 'Sidebar header' },
  { selector: '.nav-footer', name: 'Nav footer' },
  { selector: '.code-block', name: 'Code blocks (right column)' },
  { selector: '.horizontal-line', name: 'Horizontal lines' },
  { selector: '.language-select', name: 'Language selector dropdowns' },
];

console.log('\nPotential noise elements in original HTML:');
potentialNoise.forEach(({ selector, name }) => {
  const elements = docClone3.querySelectorAll(selector);
  if (elements.length > 0) {
    const totalText = Array.from(elements).reduce((acc, el) => acc + el.textContent.length, 0);
    console.log(`  ${selector}: ${elements.length} elements, ${totalText} chars`);
  }
});

// ============================================================================
// STEP 5: Test with enhanced noise removal
// ============================================================================

console.log('\n### STEP 5: Enhanced Noise Removal Test ###\n');

function removeNoiseElementsEnhanced(doc) {
  // Original selectors
  const noiseSelectors = [
    'script', 'style', 'noscript',
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.header', '.footer', '.breadcrumb', '.breadcrumbs',
    '.ad', '.ads', '.advertisement', '.social-share', '.share-buttons',
    '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
    '.popup', '.modal', '.overlay',
    '.comments', '.comment-section', '#comments',
    '[hidden]', '[aria-hidden="true"]',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    // ENHANCED: Add more selectors specific to this page structure
    '#side-bar',           // Sidebar navigation
    '#nav-btn-container',  // Navigation button
    '.nav-footer',         // Navigation footer
    '.code-block',         // Right-side code examples (might want to keep)
    '.horizontal-line',    // Decorative elements
  ];
  noiseSelectors.forEach(selector => {
    try { doc.querySelectorAll(selector).forEach(el => el.remove()); } catch (e) {}
  });
}

const docClone4 = document.cloneNode(true);
normalizeCodeBlocks(docClone4);
removeNoiseElementsEnhanced(docClone4);

const enhancedMarkdown = turndownService.turndown(docClone4.body.innerHTML);

console.log(`Enhanced markdown length: ${enhancedMarkdown.length} chars`);

console.log('\nExpected content in enhanced conversion:');
let enhancedPassCount = 0;
expectedContent.forEach(({ name, text }) => {
  const found = enhancedMarkdown.includes(text);
  if (found) enhancedPassCount++;
  console.log(`  ${found ? '✅' : '❌'} ${name}`);
});

console.log(`\nEnhanced conversion: ${enhancedPassCount}/${expectedContent.length} items preserved`);

// ============================================================================
// STEP 6: Compare Readability vs Enhanced Direct
// ============================================================================

console.log('\n### STEP 6: Comparison Summary ###\n');

let readabilityPassCount = 0;
let directPassCount = 0;

expectedContent.forEach(({ name, text }) => {
  const inReadability = article?.content.includes(text) || false;
  const inDirect = directMarkdown.includes(text);
  const inEnhanced = enhancedMarkdown.includes(text);

  if (inReadability) readabilityPassCount++;
  if (inDirect) directPassCount++;

  let status;
  if (inReadability && inDirect) {
    status = 'Both preserve';
  } else if (!inReadability && inDirect) {
    status = '⚠️  Readability drops';
  } else if (inReadability && !inDirect) {
    status = '⚠️  Direct drops';
  } else {
    status = '❌ Both drop';
  }

  console.log(`${name}: ${status}`);
});

console.log(`\nSummary:`);
console.log(`  Readability: ${readabilityPassCount}/${expectedContent.length}`);
console.log(`  Direct (original noise removal): ${directPassCount}/${expectedContent.length}`);
console.log(`  Direct (enhanced noise removal): ${enhancedPassCount}/${expectedContent.length}`);

// ============================================================================
// STEP 7: Output sample markdown
// ============================================================================

console.log('\n### STEP 7: Sample Output (Enhanced Conversion) ###\n');
console.log('First 3000 chars of enhanced markdown:');
console.log('-'.repeat(50));
console.log(enhancedMarkdown.substring(0, 3000));
console.log('-'.repeat(50));
if (enhancedMarkdown.length > 3000) {
  console.log('... (truncated)');
}

// ============================================================================
// TEST RESULTS
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('DIAGNOSIS COMPLETE');
console.log('='.repeat(70));

if (enhancedPassCount === expectedContent.length) {
  console.log('\n✅ Enhanced noise removal preserves all expected content');
  console.log('   The fix should add these selectors to removeNoiseElements():');
  console.log('   - #side-bar');
  console.log('   - #nav-btn-container');
  console.log('   - .nav-footer');
} else {
  console.log(`\n⚠️  Enhanced noise removal still missing ${expectedContent.length - enhancedPassCount} items`);
  console.log('   Further investigation needed');
}
