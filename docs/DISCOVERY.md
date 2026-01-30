# Discovery Documentation

## Table of Contents

- [Discovery Documentation](#discovery-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Discovery Strategies](#discovery-strategies)
    - [Two-Phase Discovery](#two-phase-discovery)
    - [Sitemap-First Approach](#sitemap-first-approach)
    - [Continuous Link Extraction](#continuous-link-extraction)
  - [DOM-Based Link Extraction](#dom-based-link-extraction)
    - [Overview](#dom-extraction-overview)
    - [Extraction Sources](#extraction-sources)
    - [SPA Route Discovery](#spa-route-discovery)
    - [Benefits Over Regex](#benefits-over-regex)
  - [Sitemap Discovery](#sitemap-discovery)
    - [Sitemap Detection](#sitemap-detection)
    - [Sitemap Index Support](#sitemap-index-support)
    - [Timeout Configuration](#timeout-configuration)
    - [Sitemap Fetching](#sitemap-fetching)
    - [Error Handling](#error-handling)
    - [Base Path Filtering](#base-path-filtering)
  - [Sitemap Parsing](#sitemap-parsing)
    - [Regex-Based Parsing](#regex-based-parsing)
    - [Pattern Matching](#pattern-matching)
    - [CDATA Handling](#cdata-handling)
    - [URL Validation](#url-validation)
  - [Link Extraction from HTML (Regex Fallback)](#link-extraction-from-html-regex-fallback)
    - [Multiple Regex Patterns](#multiple-regex-patterns)
    - [Protocol Filtering](#protocol-filtering)
    - [Relative URL Resolution](#relative-url-resolution)
  - [External Link Depth Tracking](#external-link-depth-tracking)
    - [Depth Calculation](#depth-calculation)
    - [Return Format](#return-format)
  - [URL Canonicalization](#url-canonicalization)
    - [Canonicalization Process](#canonicalization-process)
    - [Normalization Rules](#normalization-rules)
    - [Integration with Utils](#integration-with-utils)
  - [Base Path Filtering](#base-path-filtering-1)
    - [Filtering Logic](#filtering-logic)
    - [Subdirectory Captures](#subdirectory-captures)
    - [Cross-Origin Prevention](#cross-origin-prevention)
  - [Deduplication Strategy](#deduplication-strategy)
    - [Set-Based Deduplication](#set-based-deduplication)
    - [Canonical URL Uniqueness](#canonical-url-uniqueness)
    - [Multiple Discovery Prevention](#multiple-discovery-prevention)
  - [Initial URL Discovery](#initial-url-discovery)
    - [discoverInitialUrls Function](#discoverinitialurls-function)
    - [Fallback Strategy](#fallback-strategy)
    - [Set Combination](#set-combination)
  - [Service Worker Compatibility](#service-worker-compatibility)
    - [No DOMParser](#no-domparser)
    - [Regex-Only Parsing](#regex-only-parsing)
    - [Performance Trade-offs](#performance-trade-offs)
  - [Edge Cases](#edge-cases)
    - [Missing Sitemap](#missing-sitemap)
    - [Malformed XML](#malformed-xml)
    - [Invalid URLs](#invalid-urls)
    - [Circular References](#circular-references)
  - [Performance Considerations](#performance-considerations)
    - [Sitemap Size](#sitemap-size)
    - [Regex Performance](#regex-performance)
    - [Memory Usage](#memory-usage)
  - [Integration Points](#integration-points)
    - [Crawler Module](#crawler-module)
    - [Utils Module](#utils-module)
    - [Usage Patterns](#usage-patterns)

---

## Overview

The discovery module handles URL discovery through two complementary strategies: parsing sitemap.xml files and extracting links from HTML pages. It uses regex-based parsing to work in service workers where DOMParser is unavailable.

**File**: `lib/discovery.js`

**Key Responsibilities**:
- Fetch and parse sitemap.xml (including sitemap index files)
- Recursively parse nested sitemaps with timeout protection
- Extract links from HTML using regex
- Canonicalize and normalize URLs
- Filter URLs to base path(s) - supports multiple base URLs
- Support strict vs loose path matching modes
- Skip non-crawlable files (documents, media, archives)
- Deduplicate discovered URLs
- Provide initial URL set for crawling

**Key Design Constraint**:
- **No DOMParser available in service workers**
- All parsing done with regular expressions
- Trade-off: Less robust but compatible

---

## Discovery Strategies

### Two-Phase Discovery

The discovery module operates in two phases:

1. **Initial Discovery**: Try sitemap.xml first
2. **Continuous Discovery**: Extract links from each crawled page

**Benefits**:
- Fast initial discovery via sitemap (if available)
- Comprehensive coverage via link extraction
- Handles sites without sitemaps
- Discovers dynamically linked pages

### Sitemap-First Approach

Always attempt sitemap discovery first:

```javascript
const sitemapUrls = await discoverFromSitemap(baseUrl);
if (sitemapUrls && sitemapUrls.length > 0) {
  // Use sitemap URLs
} else {
  // Fall back to crawling from base URL
}
```

**Advantages**:
- Instant discovery of all documented pages
- No need to crawl entire site
- Respects site's intended structure

### Continuous Link Extraction

During crawling, extract links from every page:

```javascript
const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));
```

**Advantages**:
- Discovers pages missing from sitemap
- Finds dynamically linked content
- Handles sites without sitemaps

---

## DOM-Based Link Extraction

### Overview {#dom-extraction-overview}

The primary link extraction method uses DOM APIs directly in the browser tab context. This runs after JavaScript has fully executed, capturing dynamically generated links that regex-based extraction would miss.

**File**: `lib/tab-fetcher.js` (extractLinks function within extractContent)

**Key Benefits**:
- Captures links after JavaScript execution
- Accesses computed styles to detect visibility
- Handles malformed HTML properly
- More reliable than regex parsing

### Extraction Sources

The DOM-based extractor checks multiple sources for links:

| Source | Selector/Pattern | Description |
|--------|------------------|-------------|
| Standard links | `a[href]` | All anchor elements with href |
| Data attributes | `[data-href]`, `[data-url]`, `[data-link]` | SPA navigation patterns |
| onclick handlers | `location.href='...'` patterns | JavaScript navigation |
| Button navigation | `button[data-navigate]`, `[role="link"]` | UI framework patterns |
| Next.js/React Router | `[data-next-link]`, `[data-router-link]` | Framework-specific attributes |
| Image maps | `area[href]` | Clickable image regions |
| JSON-LD | `url`, `@id`, `mainEntityOfPage` in structured data | SEO structured data |
| Sitemap embeds | `<loc>` elements | Inline sitemap data |
| **SPA routes** | `history.pushState()` monitoring | Routes discovered via click simulation |
| **Clickable elements** | `cursor:pointer` elements | Potential navigation triggers |

**Example Implementation**:
```javascript
function extractLinks() {
  const links = new Set();
  const baseUrl = window.location.href;

  // 1. Standard <a href> links
  document.querySelectorAll('a[href]').forEach(anchor => {
    addUrl(anchor.getAttribute('href'));
  });

  // 2. Data attributes (common in SPAs)
  document.querySelectorAll('[data-href], [data-url]').forEach(el => {
    addUrl(el.getAttribute('data-href'));
    addUrl(el.getAttribute('data-url'));
  });

  // 3. onclick handlers
  document.querySelectorAll('[onclick]').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    // Extract URLs from location.href patterns
  });

  // ... additional sources

  return Array.from(links);
}
```

### SPA Route Discovery

Modern Single Page Applications (SPAs) built with Angular, React, or Vue often use client-side routing where navigation URLs are not present in the HTML. The crawler detects these routes through two mechanisms:

#### 1. history.pushState/replaceState Monitoring

Intercepts SPA router navigation calls:

```javascript
// Override history methods to capture route changes
const capturedSpaRoutes = [];
const originalPushState = history.pushState;

history.pushState = function(state, title, url) {
  if (url) capturedSpaRoutes.push(url.toString());
  return originalPushState.call(this, state, title, url);
};

// Similar for replaceState...
```

**Captures routes from:**
- Angular Router
- React Router (when using browser history)
- Vue Router
- Any framework using History API

#### 2. Clickable Element Discovery

Finds elements with `cursor:pointer` and simulates clicks to trigger navigation:

```javascript
// Find clickable elements
const clickableElements = Array.from(document.querySelectorAll('*')).filter(el => {
  const style = window.getComputedStyle(el);
  return style.cursor === 'pointer' && isVisible(el);
});

// Click up to 50 elements
for (const el of clickableElements.slice(0, 50)) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  // Any navigation is captured via pushState monitoring
}
```

**Safety Filters:**
- Only clicks visible elements with `cursor:pointer`
- Skips standard `<a href>` links (already captured)
- Skips submit buttons and form inputs
- Skips action buttons (delete, buy, purchase, checkout, etc.)
- Limited to 50 elements maximum

**Example - Angular SPA:**
```
Page HTML:
  <div class="service-item-container">
    <span>Dhyana For Two</span>
    <!-- No href, no data-id! -->
  </div>

On Click:
  → Angular component calls: router.navigate(['/service-item/26754310'])
  → This calls: history.pushState(state, '', '/service-item/26754310')
  → Intercepted by our monitor
  → URL captured and added to links
```

**Limitations:**
- Only captures routes that are triggered by clicks
- Limited to 50 elements to prevent excessive clicking
- May miss routes that require specific user interactions (forms, authentication, etc.)
- Action buttons are filtered to avoid side effects, but filtering may not be perfect

### Benefits Over Regex

| Aspect | DOM-Based | Regex-Based |
|--------|-----------|-------------|
| JavaScript-generated links | ✅ Captured | ❌ Missed |
| Malformed HTML | ✅ Handled | ⚠️ May fail |
| Data attributes | ✅ Supported | ❌ Not checked |
| onclick patterns | ✅ Extracted | ❌ Not checked |
| JSON-LD structured data | ✅ Parsed | ❌ Not checked |
| SPA client-side routes | ✅ Discovered via clicks | ❌ Not possible |
| Service worker compatible | ❌ No | ✅ Yes |

**Usage Priority**:
1. **Primary**: DOM-based extraction (when page is rendered in tab)
2. **Fallback**: Regex extraction (for cached HTML without tab)

---

## Sitemap Discovery

### Sitemap Detection

Convention-based detection at `/sitemap.xml`:

```javascript
const domain = new URL(baseUrl).origin;
const sitemapUrl = `${domain}/sitemap.xml`;
```

**Detection strategy**:
- Derive domain from base URL
- Append `/sitemap.xml`
- No robots.txt parsing (simplified approach)

**Example**:
- Input: `https://docs.stripe.com/api/charges`
- Sitemap URL: `https://docs.stripe.com/sitemap.xml`

### Sitemap Index Support

Many CMS platforms (WordPress, Yoast SEO, etc.) use **sitemap index files** that reference multiple child sitemaps:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/page-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/category-sitemap.xml</loc>
  </sitemap>
</sitemapindex>
```

**Detection**:
```javascript
function isSitemapIndex(xmlText) {
  return /<sitemapindex/i.test(xmlText) || /<sitemap>/i.test(xmlText);
}
```

**Recursive Parsing**:
- If a sitemap index is detected, extract nested sitemap URLs
- Fetch each nested sitemap with timeout protection
- Recursively parse up to `MAX_SITEMAP_DEPTH` levels (default: 2)
- Combine all page URLs from nested sitemaps
- Filter out `.xml` URLs from final results (safety net)

**Example Flow**:
```
sitemap.xml (index)
├── Fetch post-sitemap.xml → 50 page URLs
├── Fetch page-sitemap.xml → 10 page URLs
├── Fetch category-sitemap.xml → 20 page URLs
└── Total: 80 page URLs discovered
```

### Timeout Configuration

Sitemap discovery uses configurable timeouts to prevent crawl delays:

```javascript
const SITEMAP_FETCH_TIMEOUT = 10000;      // 10s per root sitemap
const NESTED_SITEMAP_TIMEOUT = 5000;      // 5s per nested sitemap
const TOTAL_DISCOVERY_TIMEOUT = 30000;    // 30s max for entire discovery
const MAX_SITEMAP_DEPTH = 2;              // Maximum nesting depth
```

**Timeout Behavior**:
- Each sitemap fetch has its own timeout (10s root, 5s nested)
- Total discovery phase capped at 30 seconds
- If a sitemap times out, it's skipped and others continue
- If total timeout reached, returns URLs discovered so far

**Why Timeouts?**:
- Sitemaps are an optimization, not critical path
- Slow/broken sitemaps shouldn't block the crawl
- Continuous link discovery will find pages anyway
- Fast sites benefit from sitemap discovery
- Slow sites gracefully fall back to link extraction

### Sitemap Fetching

Uses `AbortController` for timeout protection:

```javascript
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Headers**:
- `Accept`: Explicitly request XML content types
- Helps servers return proper content

**Response handling**:
- 200: Parse XML (check for sitemap index)
- 404: No sitemap (return empty array)
- Timeout: Log warning, return empty array
- Other errors: Log and return empty array

### Error Handling

Graceful fallback on errors with per-sitemap isolation:

```javascript
try {
  const nestedUrls = await fetchAndParseSitemap(nestedUrl, depth + 1, startTime);
  allUrls.push(...nestedUrls);
} catch (error) {
  // Log and continue - don't let one failed sitemap stop the others
  console.warn(`[Discovery] Failed to fetch nested sitemap ${nestedUrl}:`, error.message);
}
```

**Errors handled**:
- Network errors (continue with other sitemaps)
- Timeout errors (`AbortError` - logged as timeout)
- Invalid XML (return empty array)
- Parsing errors (return empty array)

**Timeout-specific handling**:
```javascript
if (error.name === 'AbortError') {
  console.warn(`[Discovery] Sitemap fetch timeout (${timeout}ms): ${sitemapUrl}`);
} else {
  console.warn(`[Discovery] Error fetching sitemap:`, error.message);
}
```

**Fallback**: Return whatever URLs were discovered, crawler continues with base URL

### Base Path Filtering

After parsing, filter URLs to base path:

```javascript
const canonicalBase = canonicalizeUrl(baseUrl);
const filteredUrls = urls
  .map(url => canonicalizeUrl(url))
  .filter(url => url && isUnderBasePath(url, canonicalBase));
```

**Filtering ensures**:
- Only URLs under base path are crawled
- Cross-site links excluded
- Sitemap may contain URLs for entire domain

**Example**:
- Base: `https://docs.stripe.com/api`
- Included: `https://docs.stripe.com/api/charges`
- Excluded: `https://docs.stripe.com/guides`

---

## Sitemap Parsing

### Regex-Based Parsing

No DOMParser in service workers, use regex instead. Two separate functions handle different sitemap types:

**Extract Page URLs** (from regular sitemaps):
```javascript
function extractPageUrls(xmlText) {
  const urls = [];
  const locRegex = /<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xmlText)) !== null) {
    const url = match[1].trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // Skip URLs that look like sitemaps (end with .xml)
      if (!url.toLowerCase().endsWith('.xml')) {
        urls.push(url);
      }
    }
  }
  return urls;
}
```

**Extract Nested Sitemap URLs** (from sitemap indexes):
```javascript
function extractNestedSitemapUrls(xmlText) {
  const sitemapUrls = [];
  const sitemapRegex = /<sitemap[^>]*>[\s\S]*?<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>[\s\S]*?<\/sitemap>/gi;
  let match;

  while ((match = sitemapRegex.exec(xmlText)) !== null) {
    const url = match[1].trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      sitemapUrls.push(url);
    }
  }
  return sitemapUrls;
}
```

**Key Difference**:
- `extractPageUrls`: Extracts all `<loc>` tags, filters out `.xml` URLs
- `extractNestedSitemapUrls`: Extracts only `<loc>` tags within `<sitemap>` elements

### Pattern Matching

**Regex pattern**:
```regex
/<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gi
```

**Pattern breakdown**:
- `<loc>`: Opening tag
- `(?:<!\[CDATA\[)?`: Optional CDATA opening (non-capturing)
- `(.*?)`: URL content (capturing group 1)
- `(?:\]\]>)?`: Optional CDATA closing (non-capturing)
- `<\/loc>`: Closing tag
- `/gi`: Global, case-insensitive

### CDATA Handling

Supports both formats:

**Simple format**:
```xml
<loc>https://docs.example.com/page</loc>
```

**CDATA format**:
```xml
<loc><![CDATA[https://docs.example.com/page?foo=bar&baz=qux]]></loc>
```

**Why CDATA?**
- Allows special characters in URLs
- Handles query parameters with `&`
- Common in sitemap generators

### URL Validation

Before adding URLs, validate:

```javascript
const url = match[1].trim();
if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
  urls.push(url);
}
```

**Validation checks**:
1. Not empty after trim
2. Starts with `http://` or `https://`
3. Excludes relative URLs
4. Excludes malformed entries

---

## Link Extraction from HTML (Regex Fallback)

When DOM-based extraction isn't available (e.g., cached HTML), the system falls back to regex-based extraction. This uses multiple patterns to handle various HTML formats.

### Multiple Regex Patterns

The function uses several regex patterns to maximize link capture:

```javascript
// Pattern 1: Standard quoted hrefs
const quotedHrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

// Pattern 2: Unquoted hrefs (valid HTML5)
const unquotedHrefRegex = /<a[^>]+href=([^\s>"']+)[^>]*>/gi;

// Pattern 3: Area elements in image maps
const areaHrefRegex = /<area[^>]+href=["']([^"']+)["'][^>]*>/gi;
```

**Pattern 1 - Standard quoted hrefs**:
```regex
/<a[^>]+href=["']([^"']+)["'][^>]*>/gi
```
- Matches: `<a href="URL">` and `<a href='URL'>`
- Most common format

**Pattern 2 - Unquoted hrefs**:
```regex
/<a[^>]+href=([^\s>"']+)[^>]*>/gi
```
- Matches: `<a href=/page>` (valid HTML5)
- Filters out malformed matches containing `<`, `>`, or `=`

**Pattern 3 - Area elements**:
```regex
/<area[^>]+href=["']([^"']+)["'][^>]*>/gi
```
- Matches: `<area href="URL">` in image maps
- Often overlooked by simple extractors

### Protocol Filtering

Skip non-HTTP(S) protocols:

```javascript
if (href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:') ||
    href.startsWith('#')) {
  continue;
}
```

**Excluded protocols**:
- `mailto:` - Email links
- `tel:` - Telephone links
- `javascript:` - JavaScript handlers
- `#` - Fragment-only anchors

### File Extension Filtering

Skip downloadable files that cannot be rendered as HTML pages:

```javascript
const downloadExtensions = [
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xlsm', '.ppt', '.pptx',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z',
  // Media
  '.mp4', '.mp3', '.avi', '.mov',
  // Executables
  '.exe', '.dmg', '.apk',
  // Data files
  '.csv', '.xml', '.json', '.sql'
];
```

**Why filter these?**:
- Browsers download these files instead of rendering them
- Causes tab load timeouts (30 second timeout exceeded)
- Not useful for content extraction
- Prevents crawl errors and wasted resources

**Excluded file types**:
- Documents: PDF, Office files (Word, Excel, PowerPoint)
- Archives: ZIP, TAR, RAR, etc.
- Media: Videos, audio files
- Executables: Platform-specific installers
- Data: CSV, JSON, XML, SQL files

### Relative URL Resolution

Resolve relative URLs to absolute:

```javascript
const absoluteUrl = resolveUrl(href, pageUrl);
if (!absoluteUrl || !isValidUrl(absoluteUrl)) {
  continue;
}
```

**Resolution examples**:
- `./page` → `https://example.com/docs/page`
- `../other` → `https://example.com/other`
- `/absolute` → `https://example.com/absolute`
- `https://...` → (unchanged)

**Uses URL constructor**:
```javascript
function resolveUrl(relativeUrl, baseUrl) {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    return relativeUrl;
  }
}
```

---

## External Link Depth Tracking

### Depth Calculation

When external link crawling is enabled, `extractLinksFromHtml` returns links with depth information:

```javascript
export function extractLinksFromHtml(html, pageUrl, baseUrls, options = {}) {
  const {
    strictPathMatching = true,
    followExternalLinks = false,
    currentDepth = 0,
    maxExternalHops = 1
  } = options;

  // ... extract hrefs ...

  // Check if internal or external
  const isInternal = isInternalUrl(canonicalUrl, canonicalBases, strictPathMatching);

  if (isInternal) {
    links.push({ url: canonicalUrl, depth: 0 });
  } else if (followExternalLinks && currentDepth + 1 <= maxExternalHops) {
    links.push({ url: canonicalUrl, depth: currentDepth + 1 });
  }
}
```

**Depth Rules**:
- Internal links (matching base paths): Always depth 0
- External links: Parent page's depth + 1
- Links exceeding `maxExternalHops` are excluded

### Return Format

The function returns an array of `{url, depth}` objects:

```javascript
[
  { url: 'https://docs.example.com/api/users', depth: 0 },      // Internal
  { url: 'https://sdk.example.com/install', depth: 1 },         // External (hop 1)
  { url: 'https://github.com/example/repo', depth: 2 }          // External (hop 2)
]
```

**Backward Compatibility**:
- If `options` is a boolean, it's treated as `strictPathMatching` for legacy code
- Default behavior (no external links) remains unchanged

---

## URL Canonicalization

### Canonicalization Process

Every discovered URL is canonicalized:

```javascript
const canonicalUrl = canonicalizeUrl(absoluteUrl);
if (canonicalUrl && isUnderBasePath(canonicalUrl, canonicalBase)) {
  links.push(canonicalUrl);
}
```

### Normalization Rules

Handled by `utils.js`:

1. **Lowercase protocol and domain**
2. **Remove trailing slashes**
3. **Remove fragments** (`#section`)
4. **Normalize paths** (`/./` → `/`, `/../` handled)

**Example transformations**:
- `HTTPS://Docs.Example.COM/Page/` → `https://docs.example.com/page`
- `https://example.com/page#section` → `https://example.com/page`
- `https://example.com/./page` → `https://example.com/page`

### Integration with Utils

```javascript
import { canonicalizeUrl, isUnderBasePath, resolveUrl, isValidUrl } from './utils.js';
```

**Utils functions used**:
- `canonicalizeUrl(url)`: Normalize URL
- `isUnderBasePath(url, base)`: Check if URL is under base path
- `resolveUrl(relative, base)`: Resolve relative URL
- `isValidUrl(url)`: Validate URL format

---

## Base Path Filtering

### Filtering Logic

URLs are filtered to match one or more base paths:

```javascript
// Multiple base URLs supported
if (canonicalUrl && isUnderAnyBasePath(canonicalUrl, canonicalBases, strictPathMatching)) {
  links.push(canonicalUrl);
}
```

**isUnderAnyBasePath() checks**:
- Same origin (protocol + domain)
- Path matches ANY of the base paths
- Applies strict or loose matching mode

### Strict vs Loose Path Matching

**Strict Mode (default, enabled by checkbox)**:
- Base: `/financial-apis`
- ✅ Matches: `/financial-apis`, `/financial-apis/overview`, `/financial-apis/auth`
- ❌ Does NOT match: `/financial-apis-blog`, `/financial-apis-docs`
- Ensures next character after base path is `/` (or end of string)

**Loose Mode (checkbox unchecked)**:
- Base: `/financial-apis`
- ✅ Matches: `/financial-apis`, `/financial-apis/overview`, `/financial-apis-blog`, `/financial-apis-docs`
- Simple prefix matching (old behavior)

### Multiple Base URL Support

Supports crawling from multiple base paths in a single job:

**Example**:
- Base URLs:
  - `https://example.com/api`
  - `https://example.com/sdk`
  - `https://example.com/guides`
- Included: Any URL under ANY of these paths
- Excluded: URLs outside all base paths

**Use case**: Crawl multiple sections of a site in one job

### Subdirectory Crawls

Supports crawling specific subdirectories:

**Example**:
- Base URL: `https://docs.example.com/api`
- Included: `https://docs.example.com/api/users`
- Excluded: `https://docs.example.com/guides`

**Use case**: Crawl only specific sections, not entire site

### Cross-Origin Prevention

URLs from different origins are automatically excluded:

```javascript
// In isUnderBasePath()
const urlObj = new URL(url);
const baseObj = new URL(base);

if (urlObj.origin !== baseObj.origin) {
  return false;
}
```

**Prevents**:
- Following external links
- Crawling linked sites
- Scope creep beyond intended documentation

---

## Deduplication Strategy

### Set-Based Deduplication

Final deduplication using Set:

```javascript
const uniqueLinks = [...new Set(links)];
console.log(`Extracted ${uniqueLinks.length} unique links from ${pageUrl}`);
return uniqueLinks;
```

**Benefits**:
- O(1) insertion and lookup
- Automatic deduplication
- Maintains insertion order

### Canonical URL Uniqueness

Canonicalization ensures duplicates are caught:

**Example duplicates**:
- `https://example.com/page`
- `https://example.com/page/`
- `https://example.com/page#section`
- `https://EXAMPLE.com/page`

**All canonicalize to**: `https://example.com/page`

### Multiple Discovery Prevention

URLs discovered multiple times are deduplicated:

1. **Within a page**: Set in `extractLinksFromHtml()`
2. **Across pages**: `addToQueue()` in crawler checks:
   - Already in queue
   - Already in progress
   - Already completed

**Three-level deduplication** ensures efficiency

---

## Initial URL Discovery

### discoverInitialUrls Function

Main entry point for discovery:

```javascript
export async function discoverInitialUrls(baseUrl) {
  const canonicalBase = canonicalizeUrl(baseUrl);
  const urls = new Set();

  // Always include the base URL itself
  urls.add(canonicalBase);

  // Try sitemap first
  const sitemapUrls = await discoverFromSitemap(baseUrl);
  if (sitemapUrls && sitemapUrls.length > 0) {
    sitemapUrls.forEach(url => urls.add(url));
    console.log(`Initial discovery: ${urls.size} URLs from sitemap`);
  } else {
    console.log('Initial discovery: Starting with base URL only');
  }

  return Array.from(urls);
}
```

### Fallback Strategy

**Strategy**:
1. Always add base URL
2. Try sitemap discovery
3. If sitemap succeeds: Return base + sitemap URLs
4. If sitemap fails: Return base URL only

**Result**:
- **Best case**: 100s-1000s of URLs from sitemap + base
- **Worst case**: 1 URL (base URL) + continuous discovery

### Set Combination

Uses Set to combine base + sitemap URLs:

```javascript
const urls = new Set();
urls.add(canonicalBase);
sitemapUrls.forEach(url => urls.add(url));
```

**Benefits**:
- Automatic deduplication if base URL in sitemap
- Preserves all unique URLs
- Simple and efficient

---

## Service Worker Compatibility

### No DOMParser

**Problem**: DOMParser unavailable in service workers

**Solution**: Regex-based parsing

**Trade-off**:
- Less robust than real XML/HTML parser
- Works for well-formed sitemaps and HTML
- Edge cases may be missed

### Regex-Only Parsing

All parsing uses global regex with `exec()`:

```javascript
const regex = /<pattern>/gi;
let match;

while ((match = regex.exec(text)) !== null) {
  // Process match
}
```

**Benefits**:
- Works in all JavaScript environments
- No external dependencies
- Fast for typical use cases

**Limitations**:
- Cannot handle nested structures
- May fail on malformed markup
- Less semantic than DOM parsing

### Performance Trade-offs

**Regex parsing**:
- Fast for typical documentation sitemaps
- Handles 1000s of URLs efficiently
- May be slower than native XML parser for huge files

**Memory usage**:
- Regex matching is memory-efficient
- No DOM tree construction
- Linear memory with input size

---

## Edge Cases

### Missing Sitemap

**Scenario**: No sitemap.xml at domain root

**Handling**:
```javascript
if (!response.ok) {
  console.log('Sitemap not found:', response.status);
  return null;
}
```

**Fallback**: Start with base URL, discover via links

### Malformed XML

**Scenario**: Sitemap exists but XML is invalid

**Handling**:
```javascript
try {
  const xmlText = await response.text();
  const urls = parseSitemap(xmlText);
  return urls;
} catch (error) {
  console.error('Error fetching sitemap:', error);
  return null;
}
```

**Result**: Return null, fall back to base URL

### Invalid URLs

**Scenario**: Sitemap or HTML contains invalid URLs

**Handling**:
```javascript
const absoluteUrl = resolveUrl(href, pageUrl);
if (!absoluteUrl || !isValidUrl(absoluteUrl)) {
  continue; // Skip invalid URL
}
```

**Result**: Invalid URLs ignored, crawl continues

### Circular References

**Scenario**: Page A links to B, B links to A

**Handling**: Deduplication prevents infinite loops:
- First discovery: Added to queue
- Second discovery: Already in queue, skipped
- Processing: Marked as completed
- Third+ discovery: Already completed, skipped

---

## Performance Considerations

### Sitemap Size

**Typical sitemaps**: 100-10,000 URLs

**Large sitemaps**: 10,000-50,000 URLs

**Regex performance**:
- Linear with sitemap size
- ~1ms per 100 URLs
- Large sitemaps: 50-500ms parse time

**Acceptable** for documentation sites

### Regex Performance

**Global regex with exec()**:

```javascript
while ((match = locRegex.exec(xmlText)) !== null) {
  // ...
}
```

**Time complexity**: O(n) where n = input length

**Memory**: O(m) where m = matches found

**Optimizations**:
- Non-capturing groups: `(?:...)`
- Lazy quantifiers: `.*?`
- Early termination on validation

### Memory Usage

**During discovery**:
- Sitemap XML text: ~100KB-1MB
- Extracted URLs: ~10KB-100KB
- Temporary Sets: ~10KB-100KB

**Peak memory**: ~1-2MB for large sitemaps

**Cleanup**: URLs returned, XML text GC'd

---

## Integration Points

### Crawler Module

**Import**:
```javascript
import { discoverInitialUrls, extractLinksFromHtml } from './discovery.js';
```

**Used by**:
- `CrawlJob.start()`: Initial discovery
- `CrawlJob.processUrl()`: Link extraction

### Utils Module

**Import**:
```javascript
import { canonicalizeUrl, isUnderBasePath, resolveUrl, isValidUrl } from './utils.js';
```

**Functions used**:
- `canonicalizeUrl()`: Normalize URLs
- `isUnderBasePath()`: Filter to base path
- `resolveUrl()`: Resolve relative URLs
- `isValidUrl()`: Validate URL format

### Usage Patterns

**Initial discovery**:
```javascript
const initialUrls = await discoverInitialUrls(this.baseUrl);
initialUrls.forEach(url => this.addToQueue(url));
```

**Continuous discovery**:
```javascript
const html = await this.fetchUrl(url);
const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
links.forEach(link => this.addToQueue(link));
```
