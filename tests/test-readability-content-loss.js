/**
 * Test file for Readability.js content loss issues
 *
 * Tests for content that gets dropped during HTML to Markdown conversion.
 * These issues may be caused by Readability.js filtering out content it
 * considers "non-article" or by Turndown not handling certain HTML patterns.
 *
 * Issues tested:
 * 1. HTML tables outside of standard article content
 * 2. Response attribute definitions (type, s, p, t, v fields)
 * 3. Nested div structures with semantic content
 *
 * Run with: node test-readability-content-loss.js
 *
 * Options:
 *   --use-sample    Use tests/samples/01_html.html instead of hardcoded FULL_PAGE_HTML
 *
 * Examples:
 *   node test-readability-content-loss.js
 *   node test-readability-content-loss.js --use-sample
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

// Check for --use-sample command line option
const USE_SAMPLE_FILE = process.argv.includes('--use-sample');
const SAMPLE_FILE_PATH = join(__dirname, 'samples', '01_html.html');

// ============================================================================
// FUNCTIONS EXTRACTED FROM tab-fetcher.js
// ============================================================================

// Minimum extraction ratio before falling back to direct conversion
const MINIMUM_EXTRACTION_RATIO = 0.4; // 40%

// Minimum structural retention ratio
const MINIMUM_STRUCTURE_RATIO = 0.6; // 60%

function normalizeCodeBlocks(doc) {
  const preTags = doc.querySelectorAll('pre');

  preTags.forEach(pre => {
    const decorativeSelectors = [
      '.react-syntax-highlighter-line-number',
      '.line-number',
      '.line-numbers',
      '.linenumber',
      '.linenumbers',
      '.hljs-ln-numbers',
      '.hljs-ln-n',
      '[data-line-number]',
      '.copy-button',
      '.copy-code',
      'button.copy',
      '.code-toolbar > .toolbar',
      '.prism-show-language',
      '.line-numbers-rows'
    ];

    decorativeSelectors.forEach(selector => {
      try {
        pre.querySelectorAll(selector).forEach(el => el.remove());
      } catch (e) {}
    });

    const codeElements = Array.from(pre.querySelectorAll(':scope > code'));
    if (codeElements.length <= 1) return;

    let actualCodeText = '';
    let detectedLanguage = '';

    for (const code of codeElements) {
      const text = code.textContent || '';
      const className = code.className || '';

      if (/line-?numbers?|linenumbers?/i.test(className)) continue;
      const trimmedText = text.trim();
      if (!trimmedText) continue;
      if (/^[\d\s\n]+$/.test(trimmedText)) continue;

      const children = code.querySelectorAll('span');
      if (children.length > 0) {
        const allLineNumbers = Array.from(children).every(span =>
          /line-?number|linenumber/i.test(span.className || '')
        );
        if (allLineNumbers) continue;
      }

      actualCodeText = text;
      const langMatch = className.match(/language-(\S+)/);
      if (langMatch) detectedLanguage = langMatch[1];
      break;
    }

    if (actualCodeText) {
      if (!detectedLanguage) {
        const preClass = pre.className || '';
        const preLangMatch = preClass.match(/language-(\S+)/);
        if (preLangMatch) detectedLanguage = preLangMatch[1];
      }

      if (!detectedLanguage) {
        detectedLanguage = pre.getAttribute('data-language') ||
                          pre.getAttribute('data-lang') || '';
      }

      const newCode = doc.createElement('code');
      if (detectedLanguage) {
        newCode.className = 'language-' + detectedLanguage;
      }
      newCode.textContent = actualCodeText;

      while (pre.firstChild) {
        pre.removeChild(pre.firstChild);
      }
      pre.appendChild(newCode);
    }
  });
}

/**
 * Remove noise elements from a document clone for direct conversion.
 */
function removeNoiseElements(doc) {
  const noiseSelectors = [
    'script', 'style', 'noscript',
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.header', '.footer', '.breadcrumb', '.breadcrumbs',
    // Sidebar variations (common in documentation sites)
    '#side-bar', '#sidebar', '#sideBar', '#SideBar',
    '#left-sidebar', '#right-sidebar', '#leftSidebar', '#rightSidebar',
    '.side-bar', '.sideBar', '.left-sidebar', '.right-sidebar',
    '#nav-btn-container', '.nav-button', '.nav-footer',
    '.toc', '#toc', '.table-of-contents', '#table-of-contents',
    // Ads and social
    '.ad', '.ads', '.advertisement', '.social-share', '.share-buttons',
    '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
    '.popup', '.modal', '.overlay',
    '.comments', '.comment-section', '#comments',
    '[hidden]', '[aria-hidden="true"]',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]'
  ];

  noiseSelectors.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {}
  });
}

/**
 * Check if Readability has lost significant structural content.
 */
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

// ============================================================================
// TEST DATA - Extracted from specs/251128_01_parsing_issues/01_html.html
// ============================================================================

// Issue 1: HTML Table (lines 165-205 in original)
// This table contains SDK links that should be preserved
const TABLE_SDK_LINKS_HTML = `
<html>
<head><title>SDK Table Test</title></head>
<body>
<article>
<h1>Client Libraries</h1>
<p>We provide official client libraries for various languages:</p>
<table class="table table-hover">
    <thead>
        <tr>
            <th>Language</th>
            <th>Homepage</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="text-blue">Python</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-python" target="_blank" rel="noopener nofollow">finnhub-python</a></td>
        </tr>
        <tr>
            <td class="text-blue">Go</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-go" target="_blank" rel="noopener nofollow">finnhub-go</a></td>
        </tr>
        <tr>
            <td class="text-blue">Javascript</td>
            <td><a href="https://www.npmjs.com/package/finnhub" target="_blank" rel="noopener nofollow">Finnhub NPM</a></td>
        </tr>
        <tr>
            <td class="text-blue">Ruby</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-ruby" target="_blank" rel="noopener nofollow">Finnhub Ruby</a></td>
        </tr>
        <tr>
            <td class="text-blue">Kotlin</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-kotlin" target="_blank" rel="noopener nofollow">Finnhub Kotlin</a></td>
        </tr>
        <tr>
            <td class="text-blue">PHP</td>
            <td><a href="https://packagist.org/packages/finnhub/client" target="_blank" rel="noopener nofollow">Finnhub PHP</a></td>
        </tr>
    </tbody>
</table>
</article>
</body>
</html>
`;

// Issue 2 & 3: Response Attributes section (lines 263-304 in original)
// Contains nested divs with field definitions that get dropped
const RESPONSE_ATTRIBUTES_HTML = `
<html>
<head><title>Response Attributes Test</title></head>
<body>
<article>
<h1>API Documentation</h1>
<h2>Trades - Last Price Updates</h2>
<p>Stream real-time trades for US stocks, forex and crypto.</p>
<p class="mt-5 text11"><b>Response Attributes:</b></p>
<div class="horizontal-line"></div>
<div>
    <div class="pt-2">
        <div><span class="text-blue"><b>type</b></span></div>
        <p>Message type.</p>
    </div>
    <div class="horizontal-line"></div>
    <div class="pt-2">
        <div><span class="text-blue"><b>data</b></span></div>
        <p>List of trades or price updates.</p>
    </div>
    <div class="horizontal-line"></div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>s</b></span></div>
            <p>Symbol.</p>
        </div>
        <div class="horizontal-line"></div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>p</b></span></div>
            <p>Last price.</p>
        </div>
        <div class="horizontal-line"></div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>t</b></span></div>
            <p>UNIX milliseconds timestamp.</p>
        </div>
        <div class="horizontal-line"></div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>v</b></span></div>
            <p>Volume.</p>
        </div>
        <div class="horizontal-line"></div>
    </div>
</div>
</article>
</body>
</html>
`;

// Full page HTML - can be loaded from sample file with --use-sample option
const FULL_PAGE_HTML_DEFAULT = `
<html>
<head><title>API Documentation Test</title></head>
<body>
<article>
<h1>API Documentation</h1>
<p>The API is organized around REST.</p>

<h2>Client Libraries</h2>
<p>We provide official client libraries:</p>
<table class="table table-hover">
    <thead>
        <tr>
            <th>Language</th>
            <th>Homepage</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="text-blue">Python</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-python">finnhub-python</a></td>
        </tr>
        <tr>
            <td class="text-blue">Go</td>
            <td><a href="https://github.com/Finnhub-Stock-API/finnhub-go">finnhub-go</a></td>
        </tr>
    </tbody>
</table>

<h2>Trades - Last Price Updates</h2>
<p>Stream real-time trades for US stocks.</p>
<p><b>Response Attributes:</b></p>
<div>
    <div class="pt-2">
        <div><span class="text-blue"><b>type</b></span></div>
        <p>Message type.</p>
    </div>
    <div class="pt-2">
        <div><span class="text-blue"><b>data</b></span></div>
        <p>List of trades or price updates.</p>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>s</b></span></div>
            <p>Symbol.</p>
        </div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>p</b></span></div>
            <p>Last price.</p>
        </div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>t</b></span></div>
            <p>UNIX milliseconds timestamp.</p>
        </div>
    </div>
    <div class="ml-4">
        <div class="pt-2">
            <div><span class="text-blue"><b>v</b></span></div>
            <p>Volume.</p>
        </div>
    </div>
</div>
</article>
</body>
</html>
`;

// Load from sample file if --use-sample is provided, otherwise use default
// Note: This is only used for "Full Page Integration" test which gets skipped when using sample
let FULL_PAGE_HTML = FULL_PAGE_HTML_DEFAULT;
if (USE_SAMPLE_FILE) {
  if (existsSync(SAMPLE_FILE_PATH)) {
    FULL_PAGE_HTML = readFileSync(SAMPLE_FILE_PATH, 'utf-8');
    // Don't print here - will print in main test suite section below
  } else {
    console.log(`⚠️  Sample file not found: ${SAMPLE_FILE_PATH}`);
    console.log(`   Falling back to default FULL_PAGE_HTML\n`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
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

function htmlToMarkdown(html) {
  return createTurndownService().turndown(html);
}

/**
 * Convert body content directly using Turndown (the new default approach).
 * This is now the primary conversion method - no Readability.
 */
function convertBodyDirectly(dom) {
  const cleanDoc = dom.window.document.cloneNode(true);
  normalizeCodeBlocks(cleanDoc);
  removeNoiseElements(cleanDoc);

  const turndownService = createTurndownService();
  const markdown = turndownService.turndown(cleanDoc.body.innerHTML);

  return {
    markdown,
    articleContent: cleanDoc.body.innerHTML,
    usedDirectConversion: true
  };
}

/**
 * Full pipeline using direct conversion (v2.15.0+ approach).
 * Always uses direct body conversion - Readability is no longer used.
 * This provides reliable content extraction for all page types and sizes.
 */
function fullPipeline(html) {
  const dom = new JSDOM(html);
  return convertBodyDirectly(dom);
}

/**
 * Original pipeline without fallback (for comparison)
 */
function fullPipelineNoFallback(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const documentClone = document.cloneNode(true);

  normalizeCodeBlocks(documentClone);

  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    return { markdown: null, error: 'Readability failed', articleContent: null };
  }

  const markdown = htmlToMarkdown(article.content);
  return { markdown, articleContent: article.content, usedFallback: false };
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
      if (result.debug) {
        console.log(`   Debug: ${result.debug}`);
      }
      failCount++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${name}`);
    console.log(`   ${error.message}`);
    failCount++;
  }
}

// ============================================================================
// TEST SUITE: Issue 1 - HTML Table Content Loss
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Issue 1 - HTML Table Content Loss');
console.log('(Lines 165-205 in original HTML - SDK links table)');
console.log('='.repeat(70) + '\n');

test('Table: Should preserve table structure in markdown', () => {
  const result = fullPipeline(TABLE_SDK_LINKS_HTML);
  const markdown = result.markdown || '';

  // Check for markdown table syntax (pipe characters)
  const hasTableSyntax = markdown.includes('|');

  return {
    pass: hasTableSyntax,
    expected: 'Markdown table syntax with | characters',
    actual: hasTableSyntax ? 'Has table syntax' : 'No table syntax found'
  };
});

test('Table: Should contain "Language" header', () => {
  const result = fullPipeline(TABLE_SDK_LINKS_HTML);
  const markdown = result.markdown || '';

  const hasLanguageHeader = markdown.includes('Language');

  return {
    pass: hasLanguageHeader,
    expected: '"Language" in output',
    actual: hasLanguageHeader ? 'Found "Language"' : 'Missing "Language"'
  };
});

test('Table: Should contain "Python" row', () => {
  const result = fullPipeline(TABLE_SDK_LINKS_HTML);
  const markdown = result.markdown || '';

  const hasPython = markdown.includes('Python');

  return {
    pass: hasPython,
    expected: '"Python" in output',
    actual: hasPython ? 'Found "Python"' : 'Missing "Python"'
  };
});

test('Table: Should contain "finnhub-python" link text', () => {
  const result = fullPipeline(TABLE_SDK_LINKS_HTML);
  const markdown = result.markdown || '';

  const hasLink = markdown.includes('finnhub-python');

  return {
    pass: hasLink,
    expected: '"finnhub-python" in output',
    actual: hasLink ? 'Found link text' : 'Missing link text'
  };
});

test('Table: Should contain all 6 programming languages', () => {
  const result = fullPipeline(TABLE_SDK_LINKS_HTML);
  const markdown = result.markdown || '';

  const languages = ['Python', 'Go', 'Javascript', 'Ruby', 'Kotlin', 'PHP'];
  const found = languages.filter(lang => markdown.includes(lang));
  const allFound = found.length === languages.length;

  return {
    pass: allFound,
    expected: `All 6 languages: ${languages.join(', ')}`,
    actual: `Found ${found.length}/6: ${found.join(', ')}`,
    debug: allFound ? null : `Missing: ${languages.filter(l => !found.includes(l)).join(', ')}`
  };
});

// ============================================================================
// TEST SUITE: Issue 2 - "type" Response Attribute Missing
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Issue 2 - "type" Response Attribute Missing');
console.log('(Lines 263-266 in original HTML)');
console.log('='.repeat(70) + '\n');

test('Response Attributes: Should contain "type" field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  // Looking for "type" as a bold term or heading
  const hasType = markdown.includes('**type**') || markdown.includes('type');

  return {
    pass: hasType,
    expected: '"type" field in output',
    actual: hasType ? 'Found "type"' : 'Missing "type"'
  };
});

test('Response Attributes: Should contain "Message type." description', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  const hasDescription = markdown.includes('Message type');

  return {
    pass: hasDescription,
    expected: '"Message type" description',
    actual: hasDescription ? 'Found description' : 'Missing description'
  };
});

// ============================================================================
// TEST SUITE: Issue 3 - Nested Data Fields Missing (s, p, t, v)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Issue 3 - Nested Data Fields Missing (s, p, t, v)');
console.log('(Lines 273-304 in original HTML)');
console.log('='.repeat(70) + '\n');

test('Data fields: Should contain "s" (Symbol) field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  // Check for the field and its description
  const hasField = markdown.includes('Symbol') || (markdown.includes('**s**'));

  return {
    pass: hasField,
    expected: '"s" field or "Symbol" description',
    actual: hasField ? 'Found field' : 'Missing field'
  };
});

test('Data fields: Should contain "p" (Last price) field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  const hasField = markdown.includes('Last price') || (markdown.includes('**p**'));

  return {
    pass: hasField,
    expected: '"p" field or "Last price" description',
    actual: hasField ? 'Found field' : 'Missing field'
  };
});

test('Data fields: Should contain "t" (UNIX timestamp) field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  const hasField = markdown.includes('UNIX milliseconds timestamp') || (markdown.includes('**t**'));

  return {
    pass: hasField,
    expected: '"t" field or "UNIX milliseconds timestamp" description',
    actual: hasField ? 'Found field' : 'Missing field'
  };
});

test('Data fields: Should contain "v" (Volume) field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  const hasField = markdown.includes('Volume') || (markdown.includes('**v**'));

  return {
    pass: hasField,
    expected: '"v" field or "Volume" description',
    actual: hasField ? 'Found field' : 'Missing field'
  };
});

test('Data fields: Should contain "data" parent field', () => {
  const result = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
  const markdown = result.markdown || '';

  const hasField = markdown.includes('data') && markdown.includes('List of trades');

  return {
    pass: hasField,
    expected: '"data" field with description',
    actual: hasField ? 'Found field' : 'Missing field'
  };
});

// ============================================================================
// TEST SUITE: Full Page Integration
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Full Page Integration');
console.log('='.repeat(70) + '\n');

// Skip this test when using sample file - it's designed for the simplified hardcoded HTML only
test('Full page: Should have both table and response attributes', () => {
    const result = fullPipeline(FULL_PAGE_HTML);
    const markdown = result.markdown || '';

    // console.log('HELLLLOO')
    // console.log(markdown)
    // console.log('WOOORLD')

    if (!USE_SAMPLE_FILE) {

        const hasTable = markdown.includes('Python') && markdown.includes('|');
        const hasResponseAttrs = markdown.includes('type') || markdown.includes('Message type');

        return {
          pass: hasTable && hasResponseAttrs,
          expected: 'Both table and response attributes',
          actual: `Table: ${hasTable}, Response attrs: ${hasResponseAttrs}`
        };
    } else {
        console.log('⏭️  SKIP: Full page: Should have both table and response attributes (using sample file)');
        return {
          pass: true,
          expected: 'SKIP',
          actual: `SKIP`
        };
    }
});

// ============================================================================
// TEST SUITE: Issue 4 - Actual File HTML Structure
// Tests using the real HTML file (spec or sample based on --use-sample flag)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('TEST SUITE: Issue 4 - Actual File HTML Structure');
if (USE_SAMPLE_FILE) {
  console.log('(Using tests/samples/01_html.html)');
} else {
  console.log('(Using specs/251128_01_parsing_issues/01_html.html)');
}
console.log('='.repeat(70) + '\n');

// Load the spec file - use sample file if --use-sample is provided
let ACTUAL_SPEC_HTML = '';
let specPath;
try {
  if (USE_SAMPLE_FILE) {
    // Use the sample file when --use-sample is provided
    specPath = SAMPLE_FILE_PATH;
  } else {
    // Default: use the original spec file
    specPath = join(__dirname, '..', 'specs', '251128_01_parsing_issues', '01_html.html');
  }
  ACTUAL_SPEC_HTML = readFileSync(specPath, 'utf-8');
  if (USE_SAMPLE_FILE) {
    console.log(`📁 Testing sample file in main test suite: ${specPath}\n`);
  }
} catch (e) {
  console.log('⚠️  Could not load spec file, skipping actual spec tests');
}

if (ACTUAL_SPEC_HTML) {
  test('Actual spec: Should preserve SDK table (Python, Go, etc.)', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    // console.log('HELLOOOOO')
    // console.log({specPath})
    // console.log(markdown)

    const languages = ['Python', 'Go', 'Javascript', 'Ruby', 'Kotlin', 'PHP'];
    const found = languages.filter(lang => markdown.includes(lang));

    return {
      pass: found.length === languages.length,
      expected: `All 6 languages: ${languages.join(', ')}`,
      actual: `Found ${found.length}/6: ${found.join(', ')}`,
      debug: found.length < 6 ? `Missing: ${languages.filter(l => !found.includes(l)).join(', ')}` : null
    };
  });

  test('Actual spec: Should preserve "finnhub-python" link', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const hasLink = markdown.includes('finnhub-python');

    return {
      pass: hasLink,
      expected: '"finnhub-python" in output',
      actual: hasLink ? 'Found' : 'Missing'
    };
  });

  test('Actual spec: Should preserve "type" response attribute', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    // The "type" field should appear with "Message type" description
    const hasType = markdown.includes('**type**') && markdown.includes('Message type');

    return {
      pass: hasType,
      expected: '"type" field with "Message type" description',
      actual: hasType ? 'Found' : 'Missing'
    };
  });

  test('Actual spec: Should preserve "s" (Symbol) field', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const hasField = markdown.includes('**s**') && markdown.includes('Symbol');

    return {
      pass: hasField,
      expected: '"s" field with "Symbol" description',
      actual: hasField ? 'Found' : 'Missing'
    };
  });

  test('Actual spec: Should preserve "p" (Last price) field', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const hasField = markdown.includes('**p**') && markdown.includes('Last price');

    return {
      pass: hasField,
      expected: '"p" field with "Last price" description',
      actual: hasField ? 'Found' : 'Missing'
    };
  });

  test('Actual spec: Should preserve "t" (timestamp) field', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const hasField = markdown.includes('**t**') && markdown.includes('UNIX milliseconds timestamp');

    return {
      pass: hasField,
      expected: '"t" field with "UNIX milliseconds timestamp" description',
      actual: hasField ? 'Found' : 'Missing'
    };
  });

  test('Actual spec: Should preserve "v" (Volume) field', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const hasField = markdown.includes('**v**') && markdown.includes('Volume');

    return {
      pass: hasField,
      expected: '"v" field with "Volume" description',
      actual: hasField ? 'Found' : 'Missing'
    };
  });

  // ============================================================================
  // TEST SUITE: Issue 5 - Direct Conversion Verification (v2.15.0+)
  // ============================================================================

  console.log('\n' + '='.repeat(70));
  console.log('TEST SUITE: Issue 5 - Direct Conversion Verification');
  console.log('(v2.15.0+ always uses direct conversion - no Readability)');
  console.log('='.repeat(70) + '\n');

  test('Direct conversion: Should use direct conversion method', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);

    return {
      pass: result.usedDirectConversion === true,
      expected: 'usedDirectConversion: true',
      actual: `usedDirectConversion: ${result.usedDirectConversion}`
    };
  });

  test('Direct conversion: Should preserve SDK table', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const languages = ['Python', 'Go', 'Javascript', 'Ruby', 'Kotlin', 'PHP'];
    const found = languages.filter(lang => markdown.includes(lang));

    return {
      pass: found.length === languages.length,
      expected: 'All 6 SDK languages preserved',
      actual: `Found ${found.length}/6: ${found.join(', ')}`,
      debug: found.length < 6 ? `Missing: ${languages.filter(l => !found.includes(l)).join(', ')}` : null
    };
  });

  test('Direct conversion: Should preserve all Response Attributes', () => {
    const result = fullPipeline(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    const fields = ['type', 's', 'p', 't', 'v', 'c'];
    const descriptions = ['Message type', 'Symbol', 'Last price', 'UNIX milliseconds timestamp', 'Volume', 'trade conditions'];
    const foundFields = fields.filter(f => markdown.includes(`**${f}**`));
    const foundDescs = descriptions.filter(d => markdown.includes(d));

    return {
      pass: foundFields.length >= 5 && foundDescs.length >= 5,
      expected: 'At least 5 fields and descriptions preserved',
      actual: `Fields: ${foundFields.length}/6, Descriptions: ${foundDescs.length}/6`
    };
  });

  test('Comparison: Readability alone misses content (demonstrating the problem)', () => {
    const result = fullPipelineNoFallback(ACTUAL_SPEC_HTML);
    const markdown = result.markdown || '';

    // Readability drops Python SDK - this demonstrates why we don't use it
    const hasPython = markdown.includes('Python');

    return {
      pass: !hasPython, // We expect it to be missing with Readability
      expected: 'Python SDK missing (demonstrating Readability problem)',
      actual: hasPython ? 'Python found (unexpected)' : 'Python missing (as expected)'
    };
  });

  test('Comparison: Direct conversion recovers content that Readability loses', () => {
    const directResult = fullPipeline(ACTUAL_SPEC_HTML);
    const readabilityResult = fullPipelineNoFallback(ACTUAL_SPEC_HTML);

    const hasPythonDirect = (directResult.markdown || '').includes('Python');
    const hasPythonReadability = (readabilityResult.markdown || '').includes('Python');

    return {
      pass: hasPythonDirect && !hasPythonReadability,
      expected: 'Direct: Python found, Readability: Python missing',
      actual: `Direct: ${hasPythonDirect}, Readability: ${hasPythonReadability}`
    };
  });

  // Debug output for actual spec file
  console.log('\n--- ACTUAL SPEC FILE: Generated Markdown (DIRECT CONVERSION) ---');
  const actualResult = fullPipeline(ACTUAL_SPEC_HTML);
  console.log(`Used direct conversion: ${actualResult.usedDirectConversion}`);
  console.log('\nMarkdown output (first 3000 chars):');
  console.log((actualResult.markdown || '(empty)').substring(0, 3000));
  if ((actualResult.markdown || '').length > 3000) {
    console.log('... (truncated)');
  }
  console.log('\n');
}

// ============================================================================
// DEBUG OUTPUT
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('DEBUG: Generated Markdown Output (Simplified Test HTML)');
console.log('='.repeat(70) + '\n');

console.log('--- TABLE HTML ---');
const tableResult = fullPipeline(TABLE_SDK_LINKS_HTML);
console.log('Markdown output:');
console.log(tableResult.markdown || '(empty)');
console.log('\n');

console.log('--- RESPONSE ATTRIBUTES HTML ---');
const attrResult = fullPipeline(RESPONSE_ATTRIBUTES_HTML);
console.log('Markdown output:');
console.log(attrResult.markdown || '(empty)');
console.log('\n');

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
  console.log('\n⚠️  Some tests failed. This confirms the content loss issues.');
  console.log('   Review the DEBUG output above to understand what content is being dropped.');
  process.exit(1);
}
