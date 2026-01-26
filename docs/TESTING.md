# Testing Guide

## Table of Contents

- [Testing Guide](#testing-guide)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Unit Testing](#unit-testing)
    - [Markdown Conversion Tests](#markdown-conversion-tests)
    - [Running Unit Tests](#running-unit-tests)
    - [Test Files](#test-files)
  - [Quick Start Testing](#quick-start-testing)
    - [Initial Setup](#initial-setup)
    - [Load Extension in Chrome](#load-extension-in-chrome)
    - [First Capture Test](#first-capture-test)
  - [Test Scenarios](#test-scenarios)
    - [Scenario 1: Basic Capture (Small Site)](#scenario-1-basic-capture-small-site)
    - [Scenario 2: Sitemap Discovery](#scenario-2-sitemap-discovery)
    - [Scenario 3: Continuous Link Discovery](#scenario-3-continuous-link-discovery)
    - [Scenario 4: Error Handling](#scenario-4-error-handling)
    - [Scenario 5: Background Capture](#scenario-5-background-capture)
    - [Scenario 6: Multiple Jobs](#scenario-6-multiple-jobs)
    - [Scenario 7: Search Functionality](#scenario-7-search-functionality)
    - [Scenario 8: Content Viewing and Export](#scenario-8-content-viewing-and-export)
  - [Debugging Procedures](#debugging-procedures)
    - [Debugging Popup Issues](#debugging-popup-issues)
      - [Popup Doesn't Open](#popup-doesnt-open)
      - [Popup is Blank](#popup-is-blank)
      - [UI Elements Not Responding](#ui-elements-not-responding)
    - [Debugging Service Worker Issues](#debugging-service-worker-issues)
      - [Service Worker Not Running](#service-worker-not-running)
      - [Messages Not Reaching Service Worker](#messages-not-reaching-service-worker)
      - [Capture Stuck or Not Starting](#capture-stuck-or-not-starting)
    - [Debugging Storage Issues](#debugging-storage-issues)
      - [Pages Not Saving](#pages-not-saving)
      - [Duplicate Pages](#duplicate-pages)
      - [Job Data Incorrect](#job-data-incorrect)
    - [Debugging Network Issues](#debugging-network-issues)
      - [CORS Errors](#cors-errors)
      - [Timeout Errors](#timeout-errors)
      - [404 or 500 Errors](#404-or-500-errors)
  - [Test Data](#test-data)
    - [Recommended Test URLs](#recommended-test-urls)
      - [Small Sites (Quick Tests)](#small-sites-quick-tests)
      - [Medium Sites (Realistic Tests)](#medium-sites-realistic-tests)
      - [Large Sites (Stress Tests)](#large-sites-stress-tests)
    - [Expected Performance Metrics](#expected-performance-metrics)
  - [Validation Checklist](#validation-checklist)
    - [Core Features](#core-features)
    - [UI Features](#ui-features)
    - [Edge Cases](#edge-cases)
  - [Common Issues and Solutions](#common-issues-and-solutions)
    - [Extension Installation Issues](#extension-installation-issues)
    - [Crawl Operation Issues](#crawl-operation-issues)
    - [UI Display Issues](#ui-display-issues)
    - [Performance Issues](#performance-issues)
  - [Advanced Testing](#advanced-testing)
    - [Testing with Custom Sites](#testing-with-custom-sites)
    - [Simulating Failures](#simulating-failures)
    - [Load Testing](#load-testing)

---

## Overview

This guide provides comprehensive testing procedures, debugging strategies, and validation checklists for the Documentation Crawler extension.

**Goal**: Verify all functionality works correctly and identify issues quickly.

---

## Unit Testing

### Markdown Conversion Tests

The project includes comprehensive unit tests for the HTML-to-markdown conversion system, including the fallback mechanism that prevents content loss.

**Test Infrastructure**: `tests/` directory

### Running Unit Tests

```bash
# Run all unit tests
cd tests
npm test

# Run specific test suites
npm run test:code-blocks        # Code block parsing tests
npm run test:inline-links       # Inline code link tests
npm run test:content-loss       # Content loss prevention tests
npm run test:content-loss:sample # Test with sample HTML file

# Run individual tests
node test-code-block-parsing.js
node test-inline-code-links.js
node test-readability-content-loss.js
node test-readability-content-loss.js --use-sample
```

### Test Files

**Core Test Suites** (52 total tests):

1. **`test-code-block-parsing.js`** (16 tests)
   - Tests `normalizeCodeBlocks()` function
   - Handles syntax highlighters (react-syntax-highlighter, highlight.js, Prism.js)
   - Verifies line numbers are filtered out, actual code is preserved

2. **`test-inline-code-links.js`** (11 tests)
   - Tests custom Turndown rule for `<code><a>` patterns
   - Verifies `<code><a>text</a></code>` → `` [`text`](url) ``
   - Prevents backticks wrapping entire link syntax

3. **`test-readability-content-loss.js`** (25 tests)
   - Tests three-layer fallback mechanism
   - Verifies SDK tables, Response Attributes preserved
   - Tests with `specs/251128_01_parsing_issues/01_html.html` (default)
   - Tests with `tests/samples/01_html.html` (when `--use-sample` provided)
   - Confirms structural loss detection (tables, h2 headings)

**Diagnostic Tools**:

4. **`test-structural-loss-check.js`**
   - Analyzes structural content loss for sample file
   - Shows extraction ratio, structure retention metrics
   - Verifies fallback triggers correctly

5. **`diagnose-sample-file.js`**
   - Detailed diagnostic for sample HTML file
   - Compares Readability vs direct conversion
   - Identifies noise elements and structural issues

**Expected Results**:
```
✅ Total passed: 52
❌ Total failed: 0
📊 Test files: 3
```

**What Gets Tested**:
- ✅ Code blocks with line numbers from syntax highlighters
- ✅ Inline code containing links
- ✅ HTML tables conversion to markdown
- ✅ Nested div structures (API response attributes)
- ✅ Multi-section documentation pages
- ✅ Extraction ratio fallback (< 40% triggers direct conversion)
- ✅ Structural loss fallback (< 60% table/h2 retention triggers direct conversion)
- ✅ Enhanced noise removal (sidebars, nav, TOC)

---

## Quick Start Testing

### Initial Setup

```bash
# 1. Navigate to popup directory
cd /path/to/extension/popup

# 2. Install dependencies (first time only)
npm install

# 3. Build the popup
npm run build

# 4. Verify build output
ls -la ../popup-dist/
# Should see: index.html, assets/popup.js, assets/popup.css
```

### Load Extension in Chrome

**Steps**:
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle switch in top-right corner)
4. Click **"Load unpacked"** button (top-left)
5. Browse to and select: `/path/to/extension` directory
6. Confirm selection

**Verification**:
- Extension appears in list with name "Documentation Crawler"
- Icon shows "DC" badge in toolbar (may need to pin it)
- Status shows "Service worker (Inactive)" or "Service worker"
- No errors displayed

### First Crawl Test

**Test URL**: `https://docs.anthropic.com/claude/reference`

**Steps**:
1. Click extension icon in Chrome toolbar
2. Popup opens showing 3 tabs (Crawl, Jobs, Search)
3. Verify on "Crawl" tab by default
4. Enter test URL in input field
5. Click "Start Crawl" button

**Expected Results**:
- Button changes to loading state
- Progress display appears
- "Found" counter starts incrementing
- "Processed" counter increments as pages are crawled
- Currently processing URLs shown at bottom
- After ~30-60 seconds, crawl completes
- Success message displayed

**Success Criteria**:
- ✅ Crawl starts without errors
- ✅ Progress updates in real-time
- ✅ Completes successfully
- ✅ Can switch to Jobs tab to see results

---

## Test Scenarios

### Scenario 1: Basic Crawl (Small Site)

**Objective**: Verify basic crawl functionality on small documentation site

**Test URL**: `https://docs.anthropic.com/claude/reference` (5-10 pages)

**Steps**:
1. Load extension
2. Click extension icon → Crawl tab
3. Enter URL and start crawl
4. Monitor progress in popup
5. Wait for completion
6. Switch to Jobs tab

**Assertions**:
- Progress updates smoothly (no freezing)
- Pages found: 5-10
- Pages processed matches pages found
- No failed pages
- Job shows green "Completed" badge
- Can expand job to see page list
- All pages have non-zero content length

**Logs to Check** (Service Worker Console):
```
Service worker started
Received message: START_CRAWL
Checking for sitemap at: https://docs.anthropic.com/sitemap.xml
Initial URLs discovered: X
Processing: https://docs.anthropic.com/...
Extracted N unique links from ...
Saved: ... - Found N new links
Crawl complete!
Processed: X
Failed: 0
```

### Scenario 2: Sitemap Discovery

**Objective**: Verify sitemap.xml parsing works correctly

**Test URL**: `https://docs.stripe.com/api` (has sitemap)

**Steps**:
1. Start crawl
2. Open service worker console immediately
3. Watch for "Checking for sitemap" log
4. Verify "Initial URLs discovered" count is > 1

**Assertions**:
- Service worker logs show sitemap check
- If sitemap found: Initial URLs > 20
- If no sitemap: Initial URLs = 1 (just base URL)
- Crawl proceeds normally

**Expected Logs**:
```
Checking for sitemap at: https://docs.stripe.com/sitemap.xml
Parsed 47 URLs from sitemap
Found 47 URLs in sitemap under base path
Initial discovery: 47 URLs from sitemap
```

### Scenario 3: Continuous Link Discovery

**Objective**: Verify new links are discovered while crawling

**Test URL**: Any documentation site

**Steps**:
1. Start crawl
2. Watch "Found" counter in popup
3. Note initial value
4. Watch as it increases during crawl

**Assertions**:
- "Found" counter starts at initial count (from sitemap or 1)
- "Found" increases as pages are processed
- Final "Found" ≥ initial value (equal if no new links)
- All discovered URLs are under base path

**Example**:
```
Start:  Found: 10 (from sitemap)
After:  Found: 15 (discovered 5 new links)
After:  Found: 18 (discovered 3 more)
Final:  Found: 20, Processed: 20
```

### Scenario 4: Error Handling

**Objective**: Verify graceful error handling

**Test Strategy**: Crawl a site with broken links

**Steps**:
1. Start crawl on any documentation site
2. Monitor service worker console for errors
3. Wait for completion
4. Check job status

**Expected Behavior**:
- Errors logged but don't stop crawl
- Failed URLs tracked in job.errors array
- Status shows "Completed with Errors" if any failures
- Failed count displayed in UI
- Successfully crawled pages still accessible

**Service Worker Logs**:
```
Error processing URL: https://example.com/broken-page ReferenceError: ...
Crawl complete!
Processed: 45
Failed: 2
```

### Scenario 5: Background Crawling

**Objective**: Verify crawl continues when popup closed

**Steps**:
1. Start a crawl (use larger site, 50+ pages)
2. Watch progress for 10-20 seconds
3. **Close the popup** (click outside or close window)
4. Wait 30 seconds
5. Reopen popup
6. Switch to Jobs tab

**Assertions**:
- Crawl continues after popup closes
- Service worker keeps running
- Reopening popup shows updated progress
- Can view completed pages while crawl ongoing

**Service Worker Logs** (remain active):
```
Processing: ... (continues after popup closed)
Saved: ...
Processed: 25
Processed: 30
...
```

### Scenario 6: Multiple Jobs

**Objective**: Verify managing multiple completed jobs

**Steps**:
1. Crawl first site (e.g., `https://docs.stripe.com/api`)
2. Wait for completion
3. Crawl second site (e.g., `https://docs.anthropic.com/claude/reference`)
4. Go to Jobs tab
5. Verify both jobs listed

**Assertions**:
- Both jobs visible in Jobs tab
- Jobs sorted by newest first
- Each job shows correct page count
- Can expand both independently
- Each job's pages are separate
- Deleting one job doesn't affect the other

### Scenario 7: Search Functionality

**Objective**: Verify search across all crawled content

**Prerequisites**: At least one completed crawl

**Steps**:
1. Switch to Search tab
2. Enter search term (e.g., "authentication")
3. Click search or press Enter

**Assertions**:
- Results appear within 1-2 seconds
- Results show pages from all jobs
- Snippet contains search term (highlighted context)
- Copy button works for each result
- Search is case-insensitive

**Test Queries**:
- Single word: "authentication"
- Multiple words: "API endpoint"
- Technical term: "webhook"
- Common word: "the" (should find many results)

### Scenario 8: Content Viewing and Export

**Objective**: Verify content viewer and export functionality

**Steps**:
1. Go to Jobs tab
2. Expand a job
3. Click on a page URL

**Content Viewer Assertions**:
- ✅ Modal slides in from right
- ✅ URL displayed in header (clickable)
- ✅ Copy URL icon works
- ✅ Split button "Copy Page" works
- ✅ Dropdown shows download options
- ✅ "Download as .md" downloads file
- ✅ "Download as .txt" downloads file
- ✅ Toast notifications appear (green)
- ✅ ESC key closes modal
- ✅ Click outside closes modal
- ✅ Close button (X) works

**Export Assertions**:
- Downloaded files have correct content
- Markdown file preserves formatting
- Text file is plain text
- Filename derived from URL path

---

## Debugging Procedures

### Debugging Popup Issues

#### Popup Doesn't Open

**Symptoms**: Clicking icon does nothing

**Debug Steps**:
1. Check if extension is enabled: `chrome://extensions/`
2. Look for "Errors" button (red) - click to view
3. Check popup path in manifest.json:
   ```json
   "action": {
     "default_popup": "popup-dist/index.html"
   }
   ```
4. Verify file exists: `ls extension/popup-dist/index.html`

**Solution**:
- Rebuild popup: `cd popup && npm run build`
- Reload extension
- If still fails, check manifest.json paths

#### Popup is Blank

**Symptoms**: Tiny empty square or white popup

**Debug Steps**:
1. Right-click extension icon → "Inspect popup"
2. Check Console tab for errors
3. Verify in index.html:
   ```html
   <script src="./assets/popup.js">  <!-- Relative path! -->
   ```
4. Check if assets exist: `ls popup-dist/assets/`

**Common Errors**:
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
```

**Solution**:
- Ensure `base: './'` in `vite.config.ts`
- Rebuild: `npm run build`
- Reload extension
- Verify paths are relative (start with `./`)

#### UI Elements Not Responding

**Symptoms**: Buttons don't work, no crawl starts

**Debug Steps**:
1. Open popup DevTools (right-click → Inspect)
2. Check Console for React errors
3. Check if service worker is running:
   - `chrome://extensions/` → "service worker" link
   - Should say "active" not "inactive"
4. Check Network tab for failed messages

**Common Issues**:
```
Service worker not available
Cannot read property 'postMessage' of null
```

**Solution**:
- Service worker might be inactive - reload extension
- Check service-worker.js for syntax errors
- Verify message handler is registered

### Debugging Service Worker Issues

#### Service Worker Not Running

**Symptoms**: "Service worker (inactive)" shown

**Debug Steps**:
1. Go to `chrome://extensions/`
2. Click "service worker" link
3. If it says "inactive", click again to activate
4. Check console for startup errors

**Common Errors**:
```
Uncaught SyntaxError: Cannot use import statement outside a module
```

**Solution**:
```json
// Verify in manifest.json:
"background": {
  "service_worker": "service-worker.js",
  "type": "module"  // ← Required for ES modules
}
```

#### Messages Not Reaching Service Worker

**Symptoms**: Actions in popup do nothing

**Debug Steps**:
1. Open popup DevTools
2. Add breakpoint in service-worker-client.ts `sendMessage()`
3. Click action in UI
4. Check if message is sent
5. Open service worker console
6. Check if message received

**Verification**:
```javascript
// In service worker console, should see:
Received message: START_CRAWL { baseUrl: "..." }
```

**Solution**:
- Ensure service worker is active (not inactive)
- Check MessageChannel is created correctly
- Verify event.ports[0] exists in service worker

#### Crawl Stuck or Not Starting

**Symptoms**: Progress shows 0/0, nothing happens

**Debug Steps**:
1. Open service worker console
2. Look for error logs
3. Check if crawler.start() was called
4. Check if discovery returned URLs

**Common Issues**:
```
// No URLs discovered
Initial discovery: 1 URLs from sitemap
// ^ Only base URL, no sitemap

// DOMParser error (should not happen anymore)
ReferenceError: DOMParser is not defined
```

**Solution**:
- If no sitemap, verify link extraction works
- Check regex patterns in discovery.js
- Add console.log to debug discovery flow

### Debugging Storage Issues

#### Pages Not Saving

**Symptoms**: Job shows "X pages found" but "0 pages processed"

**Debug Steps**:
1. Open popup DevTools
2. Application → IndexedDB → DocumentationCrawlerDB
3. Check "pages" store - is it empty?
4. Service worker console - any storage errors?

**Common Errors**:
```
QuotaExceededError: The quota has been exceeded
ConstraintError: Key already exists
```

**Solution**:
- QuotaExceededError: Delete old jobs to free space
- ConstraintError: Check canonical URL uniqueness logic

#### Duplicate Pages

**Symptoms**: Same page saved multiple times

**Debug Steps**:
1. Check IndexedDB → pages store
2. Filter by canonicalUrl
3. Look for duplicates

**Root Cause**:
- Canonical normalization not working
- getPageByCanonicalUrl() not called before save

**Solution**:
- Verify canonicalizeUrl() implementation
- Check crawler calls getPageByCanonicalUrl() before processUrl()

#### Job Data Incorrect

**Symptoms**: Page count doesn't match reality

**Debug Steps**:
1. Check job record in IndexedDB
2. Count pages with matching jobId
3. Compare counts

**Verification Query**:
```javascript
// In popup console
const job = await getJob(jobId);
const pages = await getPagesByJobId(jobId);
console.log(`Job says: ${job.pagesProcessed} pages`);
console.log(`Actually have: ${pages.length} pages`);
```

**Solution**:
- Ensure updateJob() called after each save
- Check for race conditions in worker threads

### Debugging Network Issues

#### CORS Errors

**Symptoms**:
```
Access to fetch at 'https://...' has been blocked by CORS policy
```

**Explanation**: This **should not happen** - extensions have CORS bypass

**Debug Steps**:
1. Verify manifest.json permissions:
   ```json
   "host_permissions": ["http://*/*", "https://*/*"]
   ```
2. Check if fetch is called from service worker (has permissions)
3. Check if fetch is called from content script (doesn't exist)

**Solution**:
- Ensure all fetches happen in service worker context
- Reload extension after manifest changes

#### Timeout Errors

**Symptoms**: Pages fail with timeout

**Debug Steps**:
1. Service worker console shows timeout errors
2. Check REQUEST_TIMEOUT constant (30s default)
3. Test URL manually in browser - is it slow?

**Solution**:
```javascript
// Increase timeout in crawler.js
const REQUEST_TIMEOUT = 60000; // 60 seconds
```

#### 404 or 500 Errors

**Symptoms**: Many pages fail with HTTP errors

**Expected Behavior**:
- Individual page failures don't stop crawl
- Errors logged in job.errors array
- Status shows "Completed with Errors"

**Verify**:
1. Check job record in IndexedDB
2. Look at errors array
3. Confirm other pages succeeded

---

## Test Data

### Recommended Test URLs

#### Small Sites (Quick Tests)

**1-10 pages, ~10-30 seconds**

```
https://docs.anthropic.com/claude/reference
https://jsonplaceholder.typicode.com/guide/
```

**Use for**:
- Quick functionality verification
- Testing UI updates
- Debugging extraction issues
- Fast iteration during development

#### Medium Sites (Realistic Tests)

**50-100 pages, ~1-3 minutes**

```
https://docs.stripe.com/api
https://code.claude.com/docs/en
```

**Use for**:
- Realistic performance testing
- Sitemap discovery testing
- Progress tracking validation
- Storage capacity testing

#### Large Sites (Stress Tests)

**100-500 pages, ~3-10 minutes**

```
https://developer.github.com/v3
```

**Warning**: Only use sub-paths for very large sites:
```
https://docs.aws.amazon.com/ec2/  ← Specific service
```

**Use for**:
- Performance stress testing
- Memory management verification
- Queue growth testing
- Storage limit testing

### Expected Performance Metrics

**Rate**:
- ~2 pages per second (with rate limiting)
- Varies based on network and target server

**Time Estimates**:
- 10 pages: ~5-10 seconds
- 50 pages: ~25-40 seconds
- 100 pages: ~50-80 seconds
- 500 pages: ~4-8 minutes

**Storage**:
- Small page (simple): ~3-5 KB
- Medium page (API ref): ~10-20 KB
- Large page (tutorial): ~30-50 KB
- Average: ~15 KB per page

**Memory** (Service Worker):
- Active crawl: 1-2 MB
- Idle: < 100 KB
- Should not grow indefinitely

---

## Validation Checklist

### Core Features

**Crawl Initiation**:
- [ ] Can enter URL in Crawl tab
- [ ] Start button enables when URL valid
- [ ] Invalid URLs show error
- [ ] Crawl starts and shows progress
- [ ] Only one crawl allowed at a time

**URL Discovery**:
- [ ] Sitemap.xml detected and parsed
- [ ] Links extracted from HTML pages
- [ ] URLs normalized to canonical form
- [ ] Only URLs under base path included
- [ ] No duplicate URLs in queue

**Content Extraction**:
- [ ] Main content identified correctly
- [ ] Headers converted to Markdown (#, ##, etc.)
- [ ] Code blocks preserved with formatting
- [ ] Links converted to [text](url)
- [ ] Lists converted correctly
- [ ] Tables converted to Markdown tables

**Storage**:
- [ ] Jobs created in IndexedDB
- [ ] Pages saved incrementally
- [ ] Progress updates persist
- [ ] Can retrieve jobs after completion
- [ ] Can delete jobs and pages

### UI Features

**Crawl Tab**:
- [ ] URL input accepts valid URLs
- [ ] Start button triggers crawl
- [ ] Progress bar animates
- [ ] Counters update in real-time
- [ ] Currently processing URLs displayed
- [ ] Cancel button stops crawl
- [ ] Completion message shown

**Jobs Tab**:
- [ ] All jobs listed (newest first)
- [ ] Status icons show correct colors
- [ ] Can expand/collapse jobs
- [ ] Pages load when job expanded
- [ ] Can click page to view content
- [ ] Delete button removes job
- [ ] Toast confirms deletion

**Search Tab**:
- [ ] Search input accepts text
- [ ] Results show matching pages
- [ ] Snippets contain search term
- [ ] Copy button works
- [ ] Empty state shows when no results

**Content Viewer Modal**:
- [ ] Slides in from right
- [ ] URL clickable (opens in new tab)
- [ ] Copy URL icon works
- [ ] Split button "Copy Page" works
- [ ] Dropdown shows all options
- [ ] Download as .md works
- [ ] Download as .txt works
- [ ] Toast notifications appear
- [ ] Close button works
- [ ] ESC key closes
- [ ] Click outside closes

### Edge Cases

**Empty Results**:
- [ ] Crawl with no links found (single page)
- [ ] Search with no matches
- [ ] Job with all pages failed

**Long Content**:
- [ ] Pages with 100KB+ content display correctly
- [ ] Very long URLs truncate with ellipsis
- [ ] Many jobs (10+) scroll correctly

**Rapid Actions**:
- [ ] Click Start Crawl twice rapidly → shows error
- [ ] Open/close modal rapidly → no UI glitches
- [ ] Expand multiple jobs quickly → loads correctly

**Browser Edge Cases**:
- [ ] Close browser during crawl → resume works (TODO)
- [ ] Disable extension during crawl → data persists
- [ ] Update extension → data migrates correctly

---

## Common Issues and Solutions

### Extension Installation Issues

**Issue**: "Invalid manifest"

**Solution**:
```bash
# Validate manifest.json
cat manifest.json | jq .
# Should parse without errors

# Common issues:
# - Trailing commas in JSON
# - Invalid paths (popup-dist/index.html must exist)
```

**Issue**: Icons not showing

**Solution**:
```bash
# Verify icons exist
ls icons/
# Should have: icon16.png, icon48.png, icon128.png

# If missing, regenerate
cd icons
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Crawl Operation Issues

**Issue**: "Service worker request timeout"

**Root Cause**: Service worker not responding to messages

**Solution**:
1. Check service worker is active: `chrome://extensions/`
2. Click "service worker" link to activate it
3. Check sendResponse() uses event.ports[0]
4. Verify MessageChannel created in popup

**Issue**: "A crawl is already in progress"

**Root Cause**: Previous crawl didn't clear activeCrawl

**Debug**:
```javascript
// In service worker console
getActiveCrawl()
// If returns object when shouldn't, reset manually:
cancelActiveCrawl()
```

**Solution**:
- Ensure crawl.onCompleteCallback clears activeCrawl
- Reload extension to reset state

### UI Display Issues

**Issue**: Job cards overflow popup width

**Solution**:
```bash
# Check App.tsx container
# Should have: overflow-hidden on parent containers
# AccordionItem should have: overflow-hidden class
```

**Issue**: Modal doesn't fill screen

**Solution**:
```typescript
// In dialog.tsx, DialogContent should have:
className="fixed right-0 top-0 z-50 h-full w-full max-w-full"
```

**Issue**: Toast doesn't appear

**Solution**:
```typescript
// Verify App.tsx has:
import { Toaster } from "./components/ui/toaster";
// And renders: <Toaster />
```

### Performance Issues

**Issue**: Crawl is very slow

**Check**:
1. Network conditions (throttled?)
2. Target server response time
3. Rate limiting delay in crawler.js

**Adjust**:
```javascript
// Increase concurrency (use cautiously)
const MAX_CONCURRENT_REQUESTS = 3; // was 2

// Decrease delay (be polite!)
const DELAY_BETWEEN_REQUESTS = 300; // was 500
```

**Issue**: High memory usage

**Debug**:
1. Service worker console → Memory tab
2. Take heap snapshot
3. Look for large arrays or objects

**Solutions**:
- Ensure pages not accumulated in memory
- Check queue size stays reasonable
- Verify completed Set doesn't grow indefinitely

---

## Advanced Testing

### Testing with Custom Sites

**Local Test Server**:
```bash
# Create simple test site
mkdir test-docs
cd test-docs

cat > index.html << 'EOF'
<html>
<body>
  <main>
    <h1>Test Page 1</h1>
    <a href="page2.html">Page 2</a>
    <code>Sample code</code>
  </main>
</body>
</html>
EOF

# Serve with Python
python3 -m http.server 8000
```

**Test URL**: `http://localhost:8000`

**Benefits**:
- Controlled environment
- Can create edge cases
- Fast iteration
- No external dependencies

### Simulating Failures

**Test 404 Handling**:
```html
<!-- Add broken link in test page -->
<a href="/broken-page">Broken Link</a>
```

**Test Slow Response**:
```javascript
// Mock slow server
setTimeout(() => res.send(html), 5000); // 5 second delay
```

**Test Large Content**:
```html
<!-- Create page with huge content -->
<main>
  <p>Lorem ipsum...</p>
  <!-- Repeat 10000 times -->
</main>
```

### Load Testing

**High Page Count**:
```
Test URL with sitemap containing 500+ URLs
Monitor:
- Memory growth
- Queue size
- Storage usage
- Completion time
```

**Concurrent Access**:
```
Open multiple popup instances
All should receive progress updates
```

**Long Running Crawls**:
```
Start large crawl (500+ pages)
Close browser
Reopen after 1 minute
Verify state (TODO: not implemented yet)
```

---

## Summary

**Testing Workflow**:
1. Build extension: `cd popup && npm run build`
2. Load in Chrome: chrome://extensions/
3. Run test scenarios (start with small sites)
4. Monitor service worker console
5. Verify results in Jobs tab
6. Check IndexedDB data

**Key Debug Tools**:
- Popup DevTools (UI errors)
- Service Worker console (crawl logs)
- IndexedDB Inspector (data verification)
- Network tab (request monitoring)

**When Things Break**:
1. Check both consoles (popup + service worker)
2. Verify IndexedDB state
3. Reload extension (clean slate)
4. Test with simple URL first
5. Check relevant docs for module details

For detailed testing procedures per module, see:
- [CAPTURER.md](./CAPTURER.md) - Crawl testing
- [DISCOVERY.md](./DISCOVERY.md) - URL discovery testing
- [STORAGE.md](./STORAGE.md) - Storage testing
- [UI_COMPONENTS.md](./UI_COMPONENTS.md) - UI testing
