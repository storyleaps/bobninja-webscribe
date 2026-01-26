/**
 * Test file for inline code link parsing bug
 *
 * Issue: When a link is wrapped in a <code> tag like:
 *   <code><a href="...">wss://example.com</a></code>
 *
 * Current output:  [wss://example.com](https://...)
 * Expected output: [`wss://example.com`](https://...)
 *
 * The backticks around the link text should be preserved to indicate
 * it's a code/technical reference.
 *
 * Run with: node test-inline-code-links.js
 */

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { tables } from 'turndown-plugin-gfm';

// ============================================================================
// TEST DATA
// ============================================================================

// Exact HTML structure from specs/251128_01_parsing_issues/01_html.html
const INLINE_CODE_LINK_HTML = `
<code><a target="_blank" href="/api/v1wss://ws.finnhub.io?token=">wss://ws.finnhub.io</a></code>
`;

// Various patterns of code-wrapped links
const CODE_LINK_VARIATIONS = [
  {
    name: 'WebSocket URL in code',
    html: '<code><a href="https://example.com">wss://ws.example.io</a></code>',
    expectedPattern: /\[`wss:\/\/ws\.example\.io`\]/
  },
  {
    name: 'HTTP URL in code',
    html: '<code><a href="https://api.example.com">https://api.example.com/v1</a></code>',
    expectedPattern: /\[`https:\/\/api\.example\.com\/v1`\]/
  },
  {
    name: 'Command in code link',
    html: '<code><a href="https://docs.example.com">npm install package</a></code>',
    expectedPattern: /\[`npm install package`\]/
  },
  {
    name: 'Function name in code link',
    html: '<code><a href="#api-ref">getData()</a></code>',
    expectedPattern: /\[`getData\(\)`\]/
  },
  {
    name: 'Regular link (not in code) - should NOT have backticks',
    html: '<a href="https://example.com">Click here</a>',
    expectedPattern: /\[Click here\]\(https:\/\/example\.com\)/,
    shouldNotMatch: /\[`Click here`\]/
  }
];

// Full page context for testing with Readability
const FULL_HTML_PAGE = `
<html lang="en">
<head>
    <title>Test Inline Code Links</title>
</head>
<body>
<article>
  <h1>API Documentation</h1>
  <div class="docs-text">
    <h2>WebSocket Connection</h2>
    <p><b>Method:</b> <code>Websocket</code></p>
    <p><b>Examples:</b></p>
    <p>${INLINE_CODE_LINK_HTML}</p>
    <p>You can also use <code><a href="https://docs.example.com">getData()</a></code> to fetch data.</p>
  </div>
</article>
</body>
</html>
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert HTML to Markdown using Turndown WITHOUT the fix
 */
function htmlToMarkdownWithoutFix(html) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined'
  });
  turndownService.use(tables);
  return turndownService.turndown(html);
}

/**
 * Add the codeWithLink custom rule to a Turndown service
 * This is the fix extracted from tab-fetcher.js
 */
function addCodeWithLinkRule(turndownService) {
  turndownService.addRule('codeWithLink', {
    filter: function (node) {
      // Match <code> elements that contain a single <a> child (possibly with whitespace)
      if (node.nodeName !== 'CODE') return false;
      if (node.parentNode && node.parentNode.nodeName === 'PRE') return false;

      // Check if the only meaningful child is an <a> element
      const children = Array.from(node.childNodes);
      const meaningfulChildren = children.filter(child => {
        if (child.nodeType === 3) { // Text node
          return child.textContent.trim() !== '';
        }
        return true;
      });

      return meaningfulChildren.length === 1 &&
             meaningfulChildren[0].nodeName === 'A';
    },
    replacement: function (content, node) {
      // Find the <a> element
      const link = node.querySelector('a');
      if (!link) return '`' + content + '`'; // Fallback

      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';
      const title = link.getAttribute('title');

      // Build markdown link with backticks around the text
      // Format: [`text`](url) or [`text`](url "title")
      const titlePart = title ? ' "' + title.replace(/"/g, '\\"') + '"' : '';
      return '[`' + text + '`](' + href + titlePart + ')';
    }
  });
}

/**
 * Convert HTML to Markdown using Turndown WITH the fix
 */
function htmlToMarkdown(html) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined'
  });
  turndownService.use(tables);
  addCodeWithLinkRule(turndownService);
  return turndownService.turndown(html);
}

/**
 * Full pipeline: Readability -> Turndown (with fix)
 */
function fullPipeline(html, withFix = true) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const documentClone = document.cloneNode(true);

  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    return { markdown: null, error: 'Readability failed' };
  }

  const markdown = withFix ?
    htmlToMarkdown(article.content) :
    htmlToMarkdownWithoutFix(article.content);
  return { markdown, articleContent: article.content };
}

// ============================================================================
// TESTS
// ============================================================================

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result.pass) {
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Expected: ${result.expected}`);
      console.log(`   Actual: ${result.actual}`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${name}`);
    console.log(`   ${error.message}`);
    failCount++;
  }
}

// ============================================================================
// TEST SUITE: Bug Reproduction (WITHOUT fix)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Bug Reproduction (WITHOUT fix)');
console.log('='.repeat(70) + '\n');

test('WITHOUT FIX: <code><a>...</a></code> wraps entire link in backticks', () => {
  const markdown = htmlToMarkdownWithoutFix(INLINE_CODE_LINK_HTML);

  // Bug: backticks wrap entire link syntax `[text](url)` instead of just text [`text`](url)
  const hasBuggyFormat = markdown.includes('`[wss://ws.finnhub.io]');

  return {
    pass: hasBuggyFormat,
    expected: 'Bug present: `[text](url)` format',
    actual: markdown.trim()
  };
});

// ============================================================================
// TEST SUITE: Fix Verification (WITH fix)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Fix Verification (WITH fix)');
console.log('='.repeat(70) + '\n');

test('WITH FIX: <code><a>...</a></code> has backticks inside brackets', () => {
  const markdown = htmlToMarkdown(INLINE_CODE_LINK_HTML);

  // Fixed: backticks inside brackets [`text`](url)
  const hasCorrectFormat = markdown.includes('[`wss://ws.finnhub.io`]');

  return {
    pass: hasCorrectFormat,
    expected: '[`wss://ws.finnhub.io`](/api/v1wss://ws.finnhub.io?token=)',
    actual: markdown.trim()
  };
});

test('WITH FIX: Full pipeline produces correct format', () => {
  const result = fullPipeline(FULL_HTML_PAGE, true);
  const markdown = result.markdown || '';

  const hasCorrectFormat = markdown.includes('[`wss://ws.finnhub.io`]') ||
                           markdown.includes('[`getData()`]');

  return {
    pass: hasCorrectFormat,
    expected: 'Link text wrapped in backticks inside brackets',
    actual: hasCorrectFormat ? 'Correct format' : 'Incorrect format'
  };
});

// ============================================================================
// TEST SUITE: Basic Turndown Behavior (should still work)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Basic Turndown Behavior');
console.log('='.repeat(70) + '\n');

test('Regular <code>text</code> still works', () => {
  const html = '<code>const x = 1</code>';
  const markdown = htmlToMarkdown(html);

  return {
    pass: markdown === '`const x = 1`',
    expected: '`const x = 1`',
    actual: markdown
  };
});

test('Regular <a> links still work', () => {
  const html = '<a href="https://example.com">Example</a>';
  const markdown = htmlToMarkdown(html);

  return {
    pass: markdown === '[Example](https://example.com)',
    expected: '[Example](https://example.com)',
    actual: markdown
  };
});

test('<a><code>text</code></a> (reverse order) still works', () => {
  const html = '<a href="https://example.com"><code>example.com</code></a>';
  const markdown = htmlToMarkdown(html);

  // This pattern has code inside link - should have backticks
  const hasBackticks = markdown.includes('`');

  return {
    pass: hasBackticks,
    expected: 'Has backticks',
    actual: markdown
  };
});

// ============================================================================
// TEST SUITE: Pattern Variations
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Pattern Variations');
console.log('='.repeat(70) + '\n');

CODE_LINK_VARIATIONS.forEach(({ name, html, expectedPattern, shouldNotMatch }) => {
  test(name, () => {
    const markdown = htmlToMarkdown(html);
    const matches = expectedPattern.test(markdown);
    const wrongMatch = shouldNotMatch ? shouldNotMatch.test(markdown) : false;

    return {
      pass: matches && !wrongMatch,
      expected: `Matches: ${expectedPattern}`,
      actual: markdown
    };
  });
});

// ============================================================================
// SAMPLE OUTPUT
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('SAMPLE OUTPUT: Before and After Fix');
console.log('='.repeat(70) + '\n');

console.log('Input HTML:');
console.log('-'.repeat(40));
console.log(INLINE_CODE_LINK_HTML.trim());
console.log('-'.repeat(40));

console.log('\nWITHOUT FIX (buggy):');
console.log('-'.repeat(40));
console.log(htmlToMarkdownWithoutFix(INLINE_CODE_LINK_HTML));
console.log('-'.repeat(40));

console.log('\nWITH FIX (correct):');
console.log('-'.repeat(40));
console.log(htmlToMarkdown(INLINE_CODE_LINK_HTML));
console.log('-'.repeat(40));

console.log('\nExpected:');
console.log('-'.repeat(40));
console.log('[`wss://ws.finnhub.io`](/api/v1wss://ws.finnhub.io?token=)');
console.log('-'.repeat(40));

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log(`\n✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n🎉 All tests passed!');
} else {
  console.log('\n⚠️  Some tests failed - this confirms the bug exists.');
}

console.log('\n' + '='.repeat(70));
console.log('FIX IMPLEMENTATION');
console.log('='.repeat(70));
console.log(`
ROOT CAUSE:
When Turndown processes <code><a href="...">text</a></code>:
1. Children are processed first: <a> → [text](url)
2. Then <code> wraps result: \`[text](url)\`
3. Result: backticks around ENTIRE link syntax (wrong)

SOLUTION:
Custom Turndown rule 'codeWithLink' added to tab-fetcher.js that:
1. Detects <code> elements containing only an <a> child
2. Extracts href and text from the link
3. Returns [\`text\`](url) - backticks INSIDE brackets (correct)

The fix is implemented in:
- lib/tab-fetcher.js (lines 654-689)
`);
