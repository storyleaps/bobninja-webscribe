# Extractor Documentation

## Table of Contents

- [Extractor Documentation](#extractor-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Metadata Extraction](#metadata-extraction)
    - [What Metadata is Extracted](#what-metadata-is-extracted)
    - [Where Metadata is Extracted](#where-metadata-is-extracted)
    - [How Metadata is Used](#how-metadata-is-used)
  - [Markdown Conversion](#markdown-conversion)
    - [How Markdown Conversion Works](#how-markdown-conversion-works)
    - [Non-Pre Code Block Normalization](#non-pre-code-block-normalization)
    - [Noise Removal](#noise-removal)
    - [Confidence Scoring System](#confidence-scoring-system)
    - [Quality Heuristics](#quality-heuristics)
    - [When Markdown is Available](#when-markdown-is-available)
  - [Text Extraction Strategy](#text-extraction-strategy)
    - [Why innerText?](#why-innertext)
    - [Browser-Native Cleanup](#browser-native-cleanup)
  - [Processing Pipeline](#processing-pipeline)
    - [Input](#input)
    - [Cleanup Operations](#cleanup-operations)
    - [Output](#output)
  - [Whitespace Normalization](#whitespace-normalization)
    - [Excessive Blank Lines](#excessive-blank-lines)
    - [Line Ending Cleanup](#line-ending-cleanup)
    - [Trim Operations](#trim-operations)
  - [Error Handling](#error-handling)
    - [Try-Catch Wrapper](#try-catch-wrapper)
    - [Fallback Content](#fallback-content)
  - [Performance Characteristics](#performance-characteristics)
    - [Processing Time](#processing-time)
    - [Memory Usage](#memory-usage)
  - [Integration Points](#integration-points)
    - [Tab Fetcher Module](#tab-fetcher-module)
    - [Crawler Module](#crawler-module)
    - [Storage Module](#storage-module)
    - [Usage Pattern](#usage-pattern)

---

## Overview

The extraction system has three components (v2.16+):

1. **Metadata Extraction** (in `lib/tab-fetcher.js`) - Extracts descriptive metadata from page `<head>` tags
2. **Text Extraction** (in `lib/extractor-simple.js`) - Processes plain text content from `document.body.innerText`
3. **Markdown Conversion** (in `lib/tab-fetcher.js`) - Converts HTML to markdown using direct body conversion with preprocessing

**Files**:
- `lib/tab-fetcher.js` - Metadata extraction + markdown conversion + preprocessing
- `lib/extractor-simple.js` - Text content cleanup
- `lib/vendor/turndown.js` - HTML to Markdown converter
- `lib/vendor/turndown-plugin-gfm.js` - GitHub Flavored Markdown plugin (tables, strikethrough)

**Key Responsibilities**:
- Extract metadata from page head (title, description, Open Graph tags, etc.)
- Clean text content from `innerText`
- **Normalize non-pre code blocks** - Handle syntax highlighters without `<pre>` tags (v2.17+)
- **Normalize code blocks** - Handle syntax highlighters with line numbers (v2.12+)
- **Flatten block elements in links** - Prevent malformed markdown links (v2.16+)
- **Resolve relative URLs** - Convert to absolute URLs for standalone files (v2.16+)
- **Remove noise elements** (navigation, sidebars, ads, scripts) (v2.15+, enhanced v2.16+)
- **Convert to markdown** using Turndown with direct body conversion (v2.15+)
- **Calculate confidence score** (0-100%) for markdown quality
- Normalize whitespace
- Remove excessive blank lines
- Handle errors gracefully

**Design Philosophy**:
- **Leverage browser capabilities** - Let `innerText` do the heavy lifting
- **Dual format approach** - Provide both text (reliable) and markdown (structured)
- **Direct conversion** - Convert full page body after noise removal (no content loss)
- **Preprocessing pipeline** - Normalize DOM before conversion for cleaner output
- **Standalone markdown** - Output files work independently (absolute URLs, no broken links)
- **Always attempt conversion** - Calculate quality scores, decide later at display time
- **Metadata enrichment** - Capture descriptive metadata for better context

**Main Functions**:
```javascript
// In tab-fetcher.js - returns {html, text, metadata, markdown, markdownMeta}
export async function fetchRenderedContent(url, options)

// In extractor-simple.js
export function extractContent(text, url)
```

---

## Metadata Extraction

**Added in**: v2.5.0 / Database v4

### What Metadata is Extracted

The tab-fetcher extracts 12 metadata fields from the page's `<head>` section:

**Standard HTML Meta Tags**:
- `description` - Page description (`<meta name="description">`)
- `keywords` - Keywords (`<meta name="keywords">`)
- `author` - Content author (`<meta name="author">`)
- `generator` - Site generator/platform (`<meta name="generator">`)

**Open Graph Protocol**:
- `ogTitle` - Social sharing title (`<meta property="og:title">`)
- `ogDescription` - Social description (`<meta property="og:description">`)
- `ogType` - Content type (`<meta property="og:type">`)
- `ogSiteName` - Site name (`<meta property="og:site_name">`)

**Article Metadata**:
- `articleSection` - Article category (`<meta property="article:section">`)
- `articleTags` - Array of tags (`<meta property="article:tag">`)

**Other**:
- `canonical` - Canonical URL (`<link rel="canonical">`)
- `jsonLd` - Structured data from JSON-LD scripts (headline, description, name, author, type)

### Where Metadata is Extracted

Metadata extraction happens in `lib/tab-fetcher.js` in the `extractContent()` function:

```javascript
async function extractContent(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function extractMetadata() {
        // Extracts all 12 metadata fields from <head>
        // Returns object with only non-null values
      }

      return {
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        metadata: extractMetadata()  // v2.5.0+
      };
    }
  });
}
```

**Important**: Metadata extraction runs in the browser tab context with full DOM access, executed after the page has fully loaded and stabilized.

### How Metadata is Used

**Storage**:
- Metadata is stored as a JSON object in the `metadata` field of each page record
- **NOT included in content hash calculation** (hash only uses text content for deduplication)
- Stored alongside content, HTML, and other page data

**Display & Export**:
- Metadata is formatted and prepended to page content in all views
- Appears as a header section between the URL separator and the actual content
- Format example:
  ```
  ================================================================================
  URL: https://docs.example.com/page
  Description: Page description here
  Keywords: keyword1, keyword2
  Author: Author Name
  OG Title: Social sharing title
  Site Name: Site Name
  ================================================================================

  [Page content here...]
  ```

**Export Locations**:
- Single page view (modal display)
- Single page copy to clipboard
- Single page download (.txt or .md)
- Copy all pages to clipboard
- Download all as single .txt or .md file
- Download all as .zip (each file includes metadata)

---

## Markdown Conversion

**Added in**: v2.7.0 / Database v5
**Updated in**: v2.15.0 - Switched to direct conversion (removed Readability.js)
**Enhanced in**: v2.16.0 - Added preprocessing pipeline (link flattening, URL resolution, CSS Modules noise detection)

### How Markdown Conversion Works

Markdown conversion happens **in the tab context** (where DOM is available) during content extraction. As of v2.16.0, we use a **preprocessing pipeline** before Turndown conversion to ensure clean, standalone markdown output:

```javascript
// In tab-fetcher.js
async function extractContent(tabId) {
  // 1. Inject Turndown and GFM plugin into tab
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/vendor/turndown.js', 'lib/vendor/turndown-plugin-gfm.js']
  });

  // 2. Execute conversion in tab context
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Clone and prepare document with preprocessing pipeline
      const cleanDoc = document.cloneNode(true);
      const currentPageUrl = window.location.href;

      normalizeCodeBlocks(cleanDoc);           // Handle syntax highlighters
      flattenBlockElementsInAnchors(cleanDoc); // Fix malformed link text
      resolveRelativeUrls(cleanDoc, currentPageUrl); // Make URLs absolute
      removeNoiseElements(cleanDoc);           // Remove navigation/noise

      // Convert to markdown using Turndown
      const turndownService = new TurndownService({...});
      turndownService.use(turndownPluginGfm.tables);
      const markdown = turndownService.turndown(cleanDoc.body.innerHTML);

      return { html, text, metadata, markdown, markdownMeta };
    }
  });
}
```

**Pipeline:**
1. **Normalize non-pre code blocks** - Handle syntax highlighters without `<pre>` tags (react-syntax-highlighter with `<span>` wrappers) (v2.17+)
2. **Normalize code blocks** - Handle syntax highlighters with line numbers inside `<pre>` tags (v2.12+)
3. **Flatten block elements in anchors** - Prevent `[\n\ntext\n\n](url)` malformed links (v2.16+)
4. **Resolve relative URLs** - Convert `/path` to `https://domain.com/path` for standalone files (v2.16+)
5. **Remove noise elements** - Navigation, sidebars, ads, scripts, etc. (v2.15+, enhanced v2.16+)
6. **Turndown + GFM Tables Plugin** - Convert to clean markdown with table support
7. **Post-processing** - Clean up markdown formatting
8. **Quality assessment** - Calculate confidence score (0-1)
9. **Storage** - Save markdown + metadata alongside text

**Supported Elements:**
- Headers (h1-h6)
- Paragraphs
- Bold/italic text
- Code blocks and inline code (with special handling for `<code><a>` patterns)
- Lists (ordered and unordered)
- Links and images
- Blockquotes
- Horizontal rules
- **Tables** (with column alignment) - Added via turndown-plugin-gfm
- Strikethrough - Available via GFM plugin

### Non-Pre Code Block Normalization

**Added in**: v2.17.0

Some syntax highlighters (like react-syntax-highlighter) don't use standard `<pre>` tags. Instead, they wrap code in `<span>` or `<div>` with `white-space: pre` styling, using multiple sibling `<code>` elements - one for line numbers, one for the actual code.

**Problem**:
```html
<span style="white-space: pre;">
  <code>1 2 3 4 5 6 7 8 9</code>  <!-- Line numbers -->
  <code>[ { "symbol": "AAPL" } ]</code>  <!-- Actual code -->
</span>
```

Without normalization, Turndown treats both as inline code:
```markdown
`1 2 3 4 5 6 7 8 9` `[ { "symbol": "AAPL" } ]`
```

**Solution**:

The `normalizeNonPreCodeBlocks()` function detects this pattern and converts it to standard `<pre><code>` structure:

**Detection Heuristics** (conservative, multi-signal):
1. Look for multiple sibling `<code>` elements not inside `<pre>`
2. Identify which is line numbers (by class or digit-only content)
3. Identify which is actual code (syntax tokens or non-digit content)
4. Only convert when **both** patterns are confidently detected

**Line Number Detection**:
- Has children with classes: `.react-syntax-highlighter-line-number`, `.line-number`, `.hljs-ln-numbers`
- OR content is only digits and whitespace (e.g., "1 2 3 4 5")

**Actual Code Detection**:
- Has syntax highlighting tokens: `.token`, `.punctuation`, `.keyword`, `.string`
- OR contains non-digit content

**Output**:
```html
<pre><code>[ { "symbol": "AAPL" } ]</code></pre>
```

Which Turndown converts to:
````markdown
```
[ { "symbol": "AAPL" } ]
```
````

**Conservative Approach**: False positives are worse than false negatives. We only convert when we have high confidence, avoiding accidentally turning normal text into code blocks.

### Noise Removal

**Added in**: v2.14.0
**Enhanced in**: v2.15.0, v2.16.0

Before converting to markdown, noise elements are removed from the document to produce cleaner output. This replaces the previous Readability.js approach which could drop important content on documentation pages.

**Noise Selectors Removed:**

| Category | Selectors |
|----------|-----------|
| Scripts & Styles | `script`, `style`, `noscript` |
| Navigation | `nav`, `.navigation`, `.nav`, `.navbar`, `.menu`, `[role="navigation"]` |
| Layout | `header`, `footer`, `aside`, `.header`, `.footer` |
| Sidebars | `#sidebar`, `#side-bar`, `.sidebar`, `.side-bar`, `#left-sidebar`, `#right-sidebar` |
| TOC | `.toc`, `#toc`, `.table-of-contents`, `#table-of-contents` |
| Breadcrumbs | `.breadcrumb`, `.breadcrumbs` |
| CSS Modules (v2.16+) | `[class*="Sidebar__"]`, `[class*="Navigation__"]`, `[class*="NavBar__"]`, `[class*="Drawer__"]`, etc. |
| Material UI (v2.16+) | `[class^="MuiDrawer"]`, `[class^="MuiAppBar"]` |
| Data Attributes (v2.16+) | `[data-sidebar]`, `[data-drawer]`, `[data-navigation]` |
| Ads & Social | `.ad`, `.ads`, `.advertisement`, `.social-share`, `.share-buttons`, `.social-links` |
| Popups | `.cookie-banner`, `.cookie-notice`, `.gdpr`, `.consent`, `.popup`, `.modal`, `.overlay` |
| Comments | `.comments`, `.comment-section`, `#comments` |
| Author/Related | `.related-posts`, `.recommended`, `.author-bio`, `.author-card` |
| Promotions | `.newsletter`, `.subscribe`, `.signup-form`, `.promo`, `.banner` |
| Hidden | `[hidden]`, `[aria-hidden="true"]` |
| ARIA Roles | `[role="banner"]`, `[role="contentinfo"]`, `[role="complementary"]`, `[role="search"]` |

**CSS Modules Pattern Matching (v2.16+):**

Modern frameworks like Next.js, Create React App, and others use CSS Modules which generate hashed class names like `componentName_className__hash`. The noise removal now detects these patterns:

```javascript
// Matches: documentations_documentationSidebar__xkDcF
'[class*="Sidebar__"]'   // "Sidebar" followed by hash separator "__"

// Matches: styles_mainNavigation__abc123
'[class*="Navigation__"]'
```

This catches navigation elements even when class names are obfuscated, while remaining conservative (requires the `__` hash separator to avoid false positives).

**Benefits:**
- ✅ Preserves 100% of meaningful content
- ✅ Works for all page types (articles, documentation, API references)
- ✅ No content loss from SDK tables, API definitions, or secondary sections
- ✅ Predictable, deterministic behavior
- ✅ No ratio-based heuristics that can fail at scale
- ✅ Detects CSS Modules hashed class names (v2.16+)

### Confidence Scoring System

**Confidence Score**: 0.0 to 1.0 (displayed as 0-100%)

**Starting Score**: 0.85 (good confidence for direct conversion)

**Negative Factors** (reduce confidence):
- Content too short (< 200 chars): -0.3
- High link density (> 3.0 links per 100 chars): -0.2
- Too many sibling headings (> 20 H2s): -0.1

**Positive Factors** (increase confidence):
- Content length > 1000 chars: +0.05
- Has markdown structure (headers, code, lists): +0.1
- Has tables: +0.05

**Final Score**: Clamped to 0.0 - 1.0 range

### Quality Heuristics

**1. Content Length**:
```javascript
textLength < 200 → Too short (likely incomplete)
textLength >= 200 && < 100000 → Reasonable
textLength > 1000 → Good amount of content
```

**2. Link Density**:
```javascript
linkDensity = linkCount / (textLength / 100)
linkDensity > 3.0 → Likely index page with many links
```

**3. Markdown Structure**:
```javascript
hasHeaders = /^#{1,6}\s+.+$/m.test(markdown)
hasCodeBlocks = /```/.test(markdown)
hasLists = /^[-*+]\s+/m.test(markdown)
hasTables = /\|.+\|/.test(markdown)
hasStructure = hasHeaders || hasCodeBlocks || hasLists || hasTables
```

**4. Heading Analysis**:
```javascript
h2Count = (markdown.match(/^##\s+/gm) || []).length
h2Count > 20 → Many sibling headings (might be index page)
```

### When Markdown is Available

**Available (confidence ≥ 50%)**:
- Documentation article pages
- Blog posts
- Tutorial pages
- API reference pages

**Unavailable (confidence < 50%)**:
- Blog post index/archive pages
- Category/tag listing pages
- Search result pages
- Table of contents pages
- Repository file browsers

**User Control**:
- Threshold configurable (default 50%)
- Manual override in UI (can try viewing low-confidence markdown)
- Always stored regardless of confidence (decision made at display time)

**Metadata Structure**:
```javascript
markdownMeta: {
  confidence: 0.85,           // 0.0 to 1.0
  isArticle: true,            // confidence > 0.5
  title: "...",               // Page title
  byline: null,               // Author byline (if available)
  excerpt: "...",             // First 200 chars of content
  siteName: null,             // Site name (if available)
  textLength: 8420,           // Extracted text length
  linkDensity: 0.12,          // Links per 100 chars
  hasStructure: true,         // Has headers/code/lists/tables
  h2Count: 5,                 // Number of h2 headings
  hasTables: true             // Contains markdown tables
}
```

---

## Text Extraction Strategy

### Why innerText?

The extractor uses text from `document.body.innerText` instead of parsing HTML:

**Advantages**:
- ✅ **Browser-native** - Uses built-in DOM API
- ✅ **Automatic cleanup** - Scripts, styles, hidden elements removed
- ✅ **Entity decoding** - HTML entities decoded automatically
- ✅ **Whitespace handling** - Normalized according to CSS rules
- ✅ **No regex complexity** - Browser does the parsing
- ✅ **More reliable** - Handles any HTML structure

**Trade-offs**:
- ⚖️ **No formatting** - Plain text only (no Markdown headers, code blocks, etc.)
- ⚖️ **Requires tab rendering** - Must execute in browser context

### Browser-Native Cleanup

When you call `document.body.innerText`, the browser automatically:

1. **Removes invisible content**:
   - `<script>` and `<style>` tags
   - Elements with `display: none`
   - Elements with `visibility: hidden`
   - Content outside viewport (if applicable)

2. **Processes CSS**:
   - Applies whitespace rules
   - Respects line breaks from block elements
   - Handles `white-space` CSS property

3. **Decodes entities**:
   - `&amp;` → `&`
   - `&lt;` → `<`
   - `&nbsp;` → space
   - All other HTML entities

4. **Normalizes whitespace**:
   - Collapses multiple spaces (unless CSS preserves)
   - Adds newlines for block elements
   - Removes formatting characters

---

## Processing Pipeline

### Input

The extractor receives plain text from the tab-fetcher:

```javascript
// From tab-fetcher.js
const text = document.body.innerText;

// Passed to extractor
const cleaned = extractContent(text, url);
```

### Cleanup Operations

The extractor performs minimal cleanup:

```javascript
export function extractContent(text, url) {
  // 1. Remove excessive blank lines (more than 2)
  cleaned = text.replace(/\n{3,}/g, '\n\n');

  // 2. Trim whitespace from each line
  cleaned = cleaned.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // 3. Trim start and end
  cleaned = cleaned.trim();

  return cleaned;
}
```

### Output

**Clean plain text**:
- No HTML tags
- No excessive whitespace
- No trailing spaces on lines
- Ready for storage and export

---

## Whitespace Normalization

### Excessive Blank Lines

Remove runs of 3+ blank lines:

```javascript
cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
```

**Effect**:
- `\n\n\n\n` → `\n\n`
- Prevents overly spaced output
- Maintains readability

### Line Ending Cleanup

Trim whitespace from line ends:

```javascript
cleaned = cleaned.split('\n')
  .map(line => line.trimEnd())
  .join('\n');
```

**Effect**:
- Removes trailing spaces
- Cleaner diffs
- Better clipboard behavior

### Trim Operations

Final trim of entire content:

```javascript
cleaned = cleaned.trim();
```

**Effect**:
- Removes leading/trailing whitespace
- Clean start and end
- Professional output

---

## Error Handling

### Try-Catch Wrapper

Main function wrapped in try-catch:

```javascript
export function extractContent(text, url) {
  try {
    // Cleanup logic
  } catch (error) {
    console.error('Error cleaning text content:', error);
    return 'Error: Could not process content from this page.';
  }
}
```

### Fallback Content

If cleanup produces empty result:

```javascript
return cleaned || 'No content extracted from this page.';
```

**Fallback strategy**:
1. Try cleanup
2. If empty, return message
3. If error, return error message

---

## Performance Characteristics

### Processing Time

**Benchmarks** (approximate):

| Text Size | Processing Time |
|-----------|----------------|
| 10 KB | <0.1ms |
| 50 KB | <0.5ms |
| 100 KB | ~1ms |
| 500 KB | ~5ms |
| 1 MB | ~10ms |

**Negligible** compared to tab rendering time (3-10 seconds)

### Memory Usage

**Memory characteristics**:
- Input text: Original size
- Output text: ~95-98% of input (minimal change)
- Peak memory: ~2x input size (during split/join)

**Example**:
- 100 KB text → ~200 KB peak memory → ~98 KB output

---

## Integration Points

### Tab Fetcher Module

The tab fetcher provides the text:

```javascript
// tab-fetcher.js
const text = document.body.innerText;
return { html, text };
```

### Crawler Module

**Import**:
```javascript
import { extractContent } from './extractor-simple.js';
```

**Used in**: `CrawlJob.processUrl()`

### Storage Module

Cleaned content saved to database:

```javascript
const { html, text } = await this.fetchUrl(url);
const cleanedText = extractContent(text, url);
await savePage(this.jobId, url, url, cleanedText);
```

### Usage Pattern

```javascript
// Fetch from tab
const { html, text } = await fetchRenderedContent(url);

// Extract links from HTML
const links = extractLinksFromHtml(html, url, baseUrl);

// Clean text content
const cleaned = extractContent(text, url);

// Save to database
await savePage(jobId, url, url, cleaned);
```

**Flow**: Tab → innerText → Clean → IndexedDB
