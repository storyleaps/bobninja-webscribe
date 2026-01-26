/**
 * Test file for non-standard code block detection
 *
 * Tests the normalizeNonPreCodeBlocks() function that handles syntax highlighters
 * that don't use <pre> tags (e.g., react-syntax-highlighter with <span> wrappers).
 *
 * Run with: node test-non-pre-code-blocks.js
 */

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// NORMALIZE NON-PRE CODE BLOCKS FUNCTION (extracted from tab-fetcher.js)
// ============================================================================

/**
 * Detect and normalize non-standard code blocks that don't use <pre> tags.
 * Some syntax highlighters (like react-syntax-highlighter) wrap code in
 * <span> or <div> with white-space:pre styling instead of using <pre> tags.
 * This converts them to standard <pre><code> structure before Turndown processes them.
 *
 * Detection heuristics (conservative, multi-signal approach):
 * 1. Look for containers with multiple sibling <code> elements (not inside <pre>)
 * 2. One <code> must appear to be line numbers (by class or content)
 * 3. Another <code> must contain actual code (syntax tokens or non-digit content)
 *
 * @param {Document} doc - DOM document to process
 */
function normalizeNonPreCodeBlocks(doc) {
  const allCodes = Array.from(doc.querySelectorAll('code'));
  const processed = new Set();

  for (const code of allCodes) {
    if (processed.has(code)) continue;
    // Skip if already inside a <pre> - those are handled by normalizeCodeBlocks()
    if (code.closest('pre')) continue;

    const parent = code.parentElement;
    if (!parent) continue;

    // Get sibling <code> elements (direct children of same parent)
    const siblingCodes = Array.from(parent.children).filter(el => el.tagName === 'CODE');
    if (siblingCodes.length < 2) continue;

    // Mark all siblings as processed to avoid duplicate handling
    siblingCodes.forEach(c => processed.add(c));

    // Identify which <code> is line numbers vs actual code
    let lineNumberCode = null;
    let actualCodeElement = null;

    for (const codeEl of siblingCodes) {
      const text = (codeEl.textContent || '').trim();

      // Check for line number indicators:
      // 1. Has children with known line-number classes
      const hasLineNumberChildren = codeEl.querySelector(
        '.react-syntax-highlighter-line-number, ' +
        '.line-number, .line-numbers, .linenumber, .linenumbers, ' +
        '.hljs-ln-numbers, .hljs-ln-n, [data-line-number]'
      );

      // 2. Content is only digits and whitespace (e.g., "1 2 3 4 5")
      const isOnlyDigits = /^[\d\s\n]+$/.test(text);

      if (hasLineNumberChildren || (isOnlyDigits && text.length > 0)) {
        lineNumberCode = codeEl;
      } else {
        // Check for syntax highlighting tokens (strong signal of actual code)
        const hasTokens = codeEl.querySelector(
          '.token, .punctuation, .keyword, .string, .number, ' +
          '[class*="hljs-"], [class*="prism-"]'
        );

        // Has tokens OR has non-digit content = actual code
        if (hasTokens || !isOnlyDigits) {
          actualCodeElement = codeEl;
        }
      }
    }

    // Only proceed if we confidently found both patterns
    if (lineNumberCode && actualCodeElement) {
      const codeText = actualCodeElement.textContent || '';

      // Try to detect language from various sources
      let language = '';
      const sources = [actualCodeElement, parent, parent.parentElement];
      for (const el of sources) {
        if (!el || !el.className) continue;
        const match = el.className.match(/language-(\S+)/);
        if (match) {
          language = match[1];
          break;
        }
      }

      // Create standard <pre><code> structure
      const pre = doc.createElement('pre');
      const newCode = doc.createElement('code');
      if (language) newCode.className = 'language-' + language;
      newCode.textContent = codeText;
      pre.appendChild(newCode);

      // Replace parent element with the new <pre>
      if (parent.parentNode) {
        parent.parentNode.replaceChild(pre, parent);
      }
    }
  }
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

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

function convertToMarkdown(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Apply the preprocessing
  normalizeNonPreCodeBlocks(doc);

  // Convert to markdown
  const turndownService = createTurndownService();
  return turndownService.turndown(doc.body.innerHTML);
}

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${expected}\n   Actual: ${actual}`);
  }
}

function assertContains(text, substring, message = '') {
  if (!text.includes(substring)) {
    throw new Error(`${message}\n   Expected to contain: "${substring}"\n   In: "${text.substring(0, 200)}..."`);
  }
}

function assertNotContains(text, substring, message = '') {
  if (text.includes(substring)) {
    throw new Error(`${message}\n   Expected NOT to contain: "${substring}"\n   In: "${text.substring(0, 200)}..."`);
  }
}

// ============================================================================
// TESTS
// ============================================================================

console.log('\n=== Testing Non-Pre Code Block Normalization ===\n');

// Test 1: React-syntax-highlighter pattern (from real sample)
test('react-syntax-highlighter with line numbers in span wrapper', () => {
  const html = `
    <span style="white-space: pre;">
      <code style="padding: 8px;">
        <span class="react-syntax-highlighter-line-number">1</span>
        <span class="react-syntax-highlighter-line-number">2</span>
        <span class="react-syntax-highlighter-line-number">3</span>
      </code>
      <code style="padding: 8px;">
        <span class="token punctuation">[</span>
        <span class="token punctuation">{</span>
        <span class="token string">"name"</span><span class="token punctuation">:</span> <span class="token string">"test"</span>
        <span class="token punctuation">}</span>
        <span class="token punctuation">]</span>
      </code>
    </span>
  `;
  const markdown = convertToMarkdown(html);

  // Should be a fenced code block, not inline code
  assertContains(markdown, '```', 'Should produce fenced code block');
  assertNotContains(markdown, '`1', 'Should not have line numbers as inline code');
  assertNotContains(markdown, '1 2 3', 'Should not include line numbers in output');
  assertContains(markdown, '"name"', 'Should contain actual code content');
});

// Test 2: Line numbers detected by content (digits only)
test('line numbers detected by digit-only content', () => {
  const html = `
    <div>
      <code>1
2
3
4</code>
      <code>const x = 1;
const y = 2;</code>
    </div>
  `;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '```', 'Should produce fenced code block');
  assertContains(markdown, 'const x = 1', 'Should contain actual code');
  assertNotContains(markdown, '1\n2\n3\n4', 'Should not include line numbers');
});

// Test 3: Single code element should NOT be converted
test('single code element is not affected', () => {
  const html = `<p>Use the <code>console.log()</code> function</p>`;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '`console.log()`', 'Single inline code should remain inline');
  assertNotContains(markdown, '```', 'Should not create fenced code block');
});

// Test 4: Code inside <pre> should be skipped (handled by other function)
test('code inside pre is not processed', () => {
  const html = `
    <pre>
      <code>1 2 3</code>
      <code>actual code</code>
    </pre>
  `;
  const markdown = convertToMarkdown(html);

  // Since we're not running normalizeCodeBlocks, this will have issues
  // but the important thing is normalizeNonPreCodeBlocks doesn't touch it
  // This test mainly ensures no errors occur
  assertNotContains(markdown, 'Error', 'Should not error');
});

// Test 5: Two code elements without line number pattern - no conversion
test('two code elements without line number pattern are not converted', () => {
  const html = `
    <div>
      <code>first snippet</code>
      <code>second snippet</code>
    </div>
  `;
  const markdown = convertToMarkdown(html);

  // Neither looks like line numbers, so should remain as inline code
  assertContains(markdown, '`first snippet`', 'Should remain as inline code');
  assertContains(markdown, '`second snippet`', 'Should remain as inline code');
});

// Test 6: Highlight.js line number pattern
test('highlight.js line number pattern', () => {
  const html = `
    <span>
      <code>
        <span class="hljs-ln-numbers">1</span>
        <span class="hljs-ln-numbers">2</span>
      </code>
      <code>
        <span class="hljs-keyword">function</span> test() {}
      </code>
    </span>
  `;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '```', 'Should produce fenced code block');
  assertContains(markdown, 'function', 'Should contain actual code');
});

// Test 7: Preserves JSON structure
test('preserves JSON structure in output', () => {
  const html = `
    <span style="white-space: pre;">
      <code>1
2
3</code>
      <code>[
  {
    "symbol": "AAPL",
    "name": "Apple Inc."
  }
]</code>
    </span>
  `;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '```', 'Should produce fenced code block');
  assertContains(markdown, '"symbol": "AAPL"', 'Should preserve JSON structure');
  assertContains(markdown, '"name": "Apple Inc."', 'Should preserve all fields');
});

// Test 8: Language detection from class
test('detects language from class attribute', () => {
  const html = `
    <span class="language-javascript">
      <code>1 2 3</code>
      <code class="language-javascript">const x = 1;</code>
    </span>
  `;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '```javascript', 'Should include language hint');
});

// Test 9: Real-world sample structure from 02_html.html
test('real-world sample: financialmodelingprep structure', () => {
  const html = `
    <div class="widgets_udocCodeBlock__PuGy8">
      <div class="sc-gswNZR iQDTlX">
        <span style="font-size: inherit; background: rgb(254, 254, 254); display: flex; white-space: pre;">
          <code style="padding: 8px 10px 8px 8px; float: left;">
            <span class="react-syntax-highlighter-line-number">1</span>
            <span class="react-syntax-highlighter-line-number">2</span>
            <span class="react-syntax-highlighter-line-number">3</span>
            <span class="react-syntax-highlighter-line-number">4</span>
            <span class="react-syntax-highlighter-line-number">5</span>
            <span class="react-syntax-highlighter-line-number">6</span>
            <span class="react-syntax-highlighter-line-number">7</span>
            <span class="react-syntax-highlighter-line-number">8</span>
            <span class="react-syntax-highlighter-line-number">9</span>
          </code>
          <code style="padding: 8px;">
            <span class="token punctuation">[</span>
            <span class="token punctuation">{</span>
            <span class="token" style="color: green;">"symbol"</span><span class="token punctuation">:</span> <span class="token" style="color: green;">"AAPL"</span><span class="token punctuation">,</span>
            <span class="token" style="color: green;">"name"</span><span class="token punctuation">:</span> <span class="token" style="color: green;">"Apple Inc."</span><span class="token punctuation">,</span>
            <span class="token" style="color: green;">"currency"</span><span class="token punctuation">:</span> <span class="token" style="color: green;">"USD"</span><span class="token punctuation">,</span>
            <span class="token" style="color: green;">"exchangeFullName"</span><span class="token punctuation">:</span> <span class="token" style="color: green;">"NASDAQ Global Select"</span><span class="token punctuation">,</span>
            <span class="token" style="color: green;">"exchange"</span><span class="token punctuation">:</span> <span class="token" style="color: green;">"NASDAQ"</span>
            <span class="token punctuation">}</span>
            <span class="token punctuation">]</span>
          </code>
        </span>
      </div>
    </div>
  `;
  const markdown = convertToMarkdown(html);

  assertContains(markdown, '```', 'Should produce fenced code block');
  assertNotContains(markdown, '`1 2 3', 'Should not have line numbers as inline code');
  assertNotContains(markdown, '1 2 3 4 5 6 7 8 9', 'Should not include line numbers');
  assertContains(markdown, '"symbol"', 'Should contain symbol field');
  assertContains(markdown, '"AAPL"', 'Should contain AAPL value');
  assertContains(markdown, '"exchange"', 'Should contain exchange field');
  assertContains(markdown, '"NASDAQ"', 'Should contain NASDAQ value');
});

// Test 10: Actual sample file - tests/samples/02_html.html
test('actual sample file: 02_html.html code block detection', () => {
  const samplePath = path.join(__dirname, 'samples', '02_html.html');
  const html = fs.readFileSync(samplePath, 'utf8');
  const markdown = convertToMarkdown(html);

  // Should NOT have the problematic inline code pattern with line numbers
  assertNotContains(markdown, '`1 2 3 4 5 6 7 8 9`', 'Should not have line numbers as inline code');

  // Should have proper fenced code blocks
  assertContains(markdown, '```', 'Should produce fenced code blocks');

  // The JSON response should be in a code block, not inline
  // Check that the JSON content is present
  assertContains(markdown, '"symbol"', 'Should contain symbol field from JSON');
  assertContains(markdown, '"AAPL"', 'Should contain AAPL value from JSON');

  // Verify the code block contains the JSON structure
  const codeBlockMatch = markdown.match(/```[\s\S]*?"symbol"[\s\S]*?"AAPL"[\s\S]*?```/);
  if (!codeBlockMatch) {
    throw new Error('JSON response should be inside a fenced code block');
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n=== Test Summary ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
