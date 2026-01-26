# Tab Fetcher Documentation

## Table of Contents

- [Tab Fetcher Documentation](#tab-fetcher-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Why Tab-Based Rendering?](#why-tab-based-rendering)
    - [The Problem with Fetch API](#the-problem-with-fetch-api)
    - [The Tab-Based Solution](#the-tab-based-solution)
  - [Chrome DevTools Protocol Integration](#chrome-devtools-protocol-integration)
    - [Why CDP?](#why-cdp)
    - [How It Works](#how-it-works)
    - [The Warning Banner](#the-warning-banner)
  - [Incognito Mode](#incognito-mode)
    - [Why Incognito?](#why-incognito)
    - [How It Works](#how-it-works-1)
    - [Enabling Incognito Access](#enabling-incognito-access)
  - [Content Detection Strategy](#content-detection-strategy)
    - [Multi-Signal Detection](#multi-signal-detection)
    - [DOM Stability Detection](#dom-stability-detection)
    - [Network Idle Detection](#network-idle-detection)
    - [Content Plateau Detection](#content-plateau-detection)
  - [Tab Pool Architecture](#tab-pool-architecture)
    - [Pool Management](#pool-management)
    - [Parallel Capture](#parallel-capture)
    - [Lifecycle](#lifecycle)
  - [API Reference](#api-reference)
    - [fetchRenderedContent](#fetchrenderedcontent)
    - [closeCrawlWindow](#closecrawlwindow)
    - [isIncognitoAllowed](#isincognitoallowed)
  - [Integration with Capturer](#integration-with-capturer)
  - [Performance Considerations](#performance-considerations)
  - [Error Handling](#error-handling)
  - [Debugging](#debugging)
  - [Best Practices](#best-practices)

---

## Overview

The tab fetcher module provides tab-based content extraction for JavaScript-rendered pages. It opens URLs in real browser tabs to execute JavaScript and extract both HTML (for link discovery) and clean text (for storage).

**File**: `lib/tab-fetcher.js`

**Key Responsibilities**:
- Open URLs in background browser tabs with debugger attached
- Bypass Chrome's background tab throttling using CDP
- Execute JavaScript and wait for content to load
- Detect when content is fully rendered (multi-signal approach)
- Extract HTML (`outerHTML` for link discovery)
- Extract text (`document.body.innerText` for content storage)
- Convert HTML to Markdown with preprocessing
- Close tabs automatically (with error protection)
- Manage tab pool for parallel capture

**Chrome APIs Used**:
- `chrome.tabs` - Create and manage tabs
- `chrome.debugger` - Attach CDP to bypass background throttling
- `chrome.scripting` - Inject scripts to extract content and monitor page state

**Required Permissions**:
- `tabs` - Tab management
- `debugger` - Chrome DevTools Protocol access
- `scripting` - Content script injection

---

## Why Tab-Based Rendering?

### The Problem with Fetch API

The traditional `fetch()` approach only retrieves the initial HTML sent by the server:

```javascript
const response = await fetch(url);
const html = await response.text();
// ❌ Only gets initial HTML
// ❌ No JavaScript execution
// ❌ Missing dynamically loaded content
```

**Limitations**:
- ❌ Cannot execute JavaScript
- ❌ Misses React/Vue/Angular rendered content
- ❌ No access to dynamically loaded data
- ❌ Fails on SPAs with client-side routing
- ❌ Cannot wait for lazy-loaded content

### The Tab-Based Solution

Opening pages in real browser tabs allows full JavaScript execution:

```javascript
const tab = await chrome.tabs.create({ url, active: false });
// ✅ Full JavaScript execution
// ✅ React/Vue/Angular components render
// ✅ Data fetching happens
// ✅ Lazy loading triggers
await waitForContentReady(tab.id);
const html = await extractHTML(tab.id);
// ✅ Gets fully-rendered HTML
```

**Benefits**:
- ✅ Full JavaScript execution environment
- ✅ Works with SPAs and dynamic sites
- ✅ Captures lazy-loaded content
- ✅ Handles client-side routing
- ✅ Waits for data fetching to complete

---

## Chrome DevTools Protocol Integration

### Why CDP?

Chrome aggressively throttles background tabs to save resources:

| State | Behavior |
|-------|----------|
| Active tab | Full rendering, all APIs work |
| Background tab | `requestAnimationFrame` paused, timers throttled, Intersection Observer delayed |
| Minimized window | Even more aggressive throttling |

This causes **incomplete content** when crawling in background tabs, as lazy-loaded content may never render.

### How It Works

The tab fetcher uses the Chrome DevTools Protocol (CDP) to bypass these limitations:

```javascript
// 1. Create background tab
const tab = await chrome.tabs.create({ url, active: false });

// 2. Attach debugger to tab
await chrome.debugger.attach({ tabId: tab.id }, '1.3');

// 3. Enable focus emulation - makes page think it's focused
await chrome.debugger.sendCommand(
  { tabId: tab.id },
  'Emulation.setFocusEmulationEnabled',
  { enabled: true }
);

// 4. Set page lifecycle to active (prevents freezing)
await chrome.debugger.sendCommand(
  { tabId: tab.id },
  'Page.setWebLifecycleState',
  { state: 'active' }
);

// Now the background tab renders fully!
```

**CDP Commands Used**:
- `Emulation.setFocusEmulationEnabled` - Makes page think it has focus
- `Page.setWebLifecycleState` - Prevents page from being frozen

### The Warning Banner

When the debugger is attached, Chrome displays a yellow warning banner:

> "Extension is debugging this browser"

This banner:
- Appears at the top of the browser during crawling
- Disappears when crawl completes (debuggers detached)
- Is a Chrome security feature and cannot be suppressed
- Does not affect functionality

---

## Incognito Mode

### Why Incognito?

Crawling in incognito mode provides a clean session for each crawl:

**Benefits**:
- ✅ No cookies from previous browsing sessions
- ✅ No cached data affecting page rendering
- ✅ No logged-in states interfering with content
- ✅ Pages render as a fresh visitor would see them
- ✅ Consistent results across crawls

### How It Works

When incognito mode is enabled:

```javascript
// 1. Create an incognito window (minimized)
const window = await chrome.windows.create({
  incognito: true,
  state: 'minimized',
  focused: false
});

// 2. Create tabs inside the incognito window
const tab = await chrome.tabs.create({
  url: 'about:blank',
  active: false,
  windowId: window.id
});

// 3. Attach debugger and crawl as normal
await attachDebugger(tab.id);
```

The incognito window is automatically closed when the crawl completes.

### Enabling Incognito Access

Chrome requires explicit user permission for extensions to run in incognito mode:

1. Go to `chrome://extensions`
2. Find "Content Crawler" and click "Details"
3. Enable "Allow in Incognito"

If incognito mode is selected but not enabled, a warning dialog will appear with instructions.

---

## Content Detection Strategy

### Multi-Signal Detection

Content readiness is detected using multiple signals for reliability:

```
Tab Created (with debugger attached)
    ↓
Navigate to URL
    ↓
Wait for tab complete (load event)
    ↓
Spoof page visibility (backup)
    ↓
Wait for content ready:
    ├── Network idle (no new resources)
    ├── DOM stability (no mutations)
    └── Content plateau (text stops growing)
    ↓
Extract content
```

This fast approach works for 90%+ of pages including static HTML, server-rendered content, and most documentation sites. Content extraction typically takes ~2-4 seconds per page.

### DOM Stability Detection

Uses `MutationObserver` to detect when the DOM stops changing.

**Implementation**:
```javascript
function waitForDOMStabilityInPage(stabilityWait, maxTimeout) {
  return new Promise((resolve) => {
    let mutationCount = 0;
    let stabilityTimer = null;

    const observer = new MutationObserver((mutations) => {
      mutationCount += mutations.length;

      // Reset timer on each mutation
      if (stabilityTimer) clearTimeout(stabilityTimer);

      // Wait for 1 second of no mutations
      stabilityTimer = setTimeout(() => {
        observer.disconnect();
        resolve({ mutations: mutationCount, reason: 'stable' });
      }, stabilityWait);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  });
}
```

**What it detects**:
- Element additions/removals
- Attribute changes
- Text content changes
- Subtree modifications

### Network Idle Detection

Uses Performance API to detect when no new resources are loading.

**Implementation**:
```javascript
function waitForNetworkIdleInPage(idleWait, maxTimeout) {
  return new Promise((resolve) => {
    let lastResourceCount = 0;

    function checkNetworkIdle() {
      const entries = performance.getEntriesByType('resource');
      const currentCount = entries.length;

      if (currentCount === lastResourceCount) {
        // No new resources for 500ms = idle
        resolve({ resources: currentCount, reason: 'idle' });
      } else {
        lastResourceCount = currentCount;
        setTimeout(checkNetworkIdle, 100);
      }
    }

    checkNetworkIdle();
  });
}
```

**What it detects**:
- Image loading
- Script loading
- CSS loading
- Data fetching (XHR/Fetch)
- Font loading

### Content Plateau Detection

Monitors `document.body.innerText.length` and waits until it stops growing.

**Implementation**:
```javascript
function waitForContentPlateauInPage(plateauWait, minContentLength, checkInterval, maxTimeout) {
  return new Promise((resolve) => {
    let lastLength = 0;
    let plateauTimer = null;

    function checkContent() {
      const currentLength = document.body.innerText.length;

      if (currentLength !== lastLength) {
        // Content is still growing - reset timer
        lastLength = currentLength;
        if (plateauTimer) clearTimeout(plateauTimer);

        plateauTimer = setTimeout(() => {
          resolve({ finalLength: currentLength, reason: 'plateau' });
        }, plateauWait);
      }
    }

    const interval = setInterval(checkContent, checkInterval);
    checkContent(); // Initial check

    // Max timeout fallback
    setTimeout(() => resolve({ finalLength: lastLength, reason: 'timeout' }), maxTimeout);
  });
}
```

**Why this matters**:
- Adapts to actual page behavior (not arbitrary timeouts)
- Catches lazy-loaded content that arrives in chunks
- Finishes early if content stabilizes quickly

---

## Tab Pool Architecture

### Pool Management

Tabs are managed in a pool for efficient reuse:

```javascript
// Pool structure
let crawlTabPool = []; // Array of { tabId, inUse: boolean }
let debuggerAttached = new Set(); // Track which tabs have debugger

// Acquire a tab
async function acquireCrawlTab() {
  // 1. Try to find an available tab in pool
  for (const entry of crawlTabPool) {
    if (!entry.inUse) {
      entry.inUse = true;
      return entry;
    }
  }

  // 2. No available tab - create new one with debugger
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
  await attachDebugger(tab.id);

  const entry = { tabId: tab.id, inUse: true };
  crawlTabPool.push(entry);
  return entry;
}

// Release a tab back to pool
function releaseCrawlTab(entry) {
  entry.inUse = false;
}
```

### Parallel Crawling

Multiple workers can crawl simultaneously:

```
Worker 1: acquires tab → navigates → extracts → releases
Worker 2: acquires tab → navigates → extracts → releases
Worker 3: acquires tab → navigates → extracts → releases
Worker 4: acquires tab → navigates → extracts → releases
Worker 5: acquires tab → navigates → extracts → releases
          ↓
Pool grows dynamically up to worker count
          ↓
Tabs reused - navigate to new URL instead of create/close
```

**Benefits**:
- No tab creation/destruction overhead per URL
- Debugger stays attached (no reattach overhead)
- Pool size matches actual concurrency needs

### Lifecycle

```
Job Start:
├── Workers request tabs as needed
├── Pool grows dynamically (up to worker count)
└── Each tab has debugger attached

During Crawling:
├── Worker acquires tab from pool
├── Navigates tab to URL (reuses existing tab)
├── Waits for content ready
├── Extracts content
└── Releases tab back to pool

Job End:
├── Detach all debuggers
├── Close all tabs in pool
└── Clear pool
```

---

## API Reference

### fetchRenderedContent

Main function to fetch rendered content (both HTML and text).

**Signature**:
```javascript
async function fetchRenderedContent(url, options = {})
```

**Parameters**:
- `url` (string): URL to fetch
- `options` (object):
  - `timeout` (number): Max wait time in ms (default: 30000)
  - `waitForSelectors` (string[]): CSS selectors to wait for (default: [])
  - `useIncognito` (boolean): Crawl in incognito window for clean session (default: false)

**Returns**: Promise<{html: string, text: string, metadata: object, markdown: string, markdownMeta: object}>
- `html`: Rendered HTML (for link extraction)
- `text`: Plain text from `document.body.innerText` (for content storage)
- `metadata`: Page metadata (title, description, Open Graph tags, etc.)
- `markdown`: Converted markdown content
- `markdownMeta`: Markdown quality metadata (confidence score, etc.)

**Throws**: Error if tab creation fails, debugger attachment fails, timeout occurs, extraction fails, or incognito mode requested but not allowed

**Example**:
```javascript
// Basic usage
const { html, text, markdown } = await fetchRenderedContent('https://example.com');

// With custom timeout and selectors
const { html, text } = await fetchRenderedContent('https://react.dev', {
  timeout: 45000,
  waitForSelectors: ['.main-content', '.sidebar']
});

// Incognito mode for clean session
const { html, text } = await fetchRenderedContent('https://example.com', {
  useIncognito: true
});

// Use html for link discovery
const links = extractLinksFromHtml(html, url, baseUrl);

// Use text or markdown for content storage
const cleaned = extractContent(text, url);
```

### closeCrawlWindow

Closes all crawl tabs, detaches debuggers, and closes the incognito window (if used). Called when crawl job completes.

**Signature**:
```javascript
async function closeCrawlWindow()
```

**Behavior**:
- Detaches debuggers from all tabs in pool
- Closes all tabs in pool
- Closes incognito window if it was created
- Clears pool and resets state

**Example**:
```javascript
// Called automatically by crawler on job completion
await closeCrawlWindow();
```

### isIncognitoAllowed

Checks if the extension is allowed to run in incognito mode.

**Signature**:
```javascript
async function isIncognitoAllowed(): Promise<boolean>
```

**Returns**: Promise<boolean> - true if extension is allowed in incognito, false otherwise

**Example**:
```javascript
const allowed = await isIncognitoAllowed();
if (!allowed) {
  console.warn('Extension not enabled in incognito mode');
}
```

---

## Integration with Crawler

The crawler integrates tab fetcher through the `fetchUrl()` method:

```javascript
async fetchUrl(url) {
  return await fetchRenderedContent(url, {
    timeout: REQUEST_TIMEOUT,
    waitForSelectors: this.waitForSelectors,
    useIncognito: this.useIncognito
  });
}
```

**Crawler Options**:
```javascript
const crawl = new CrawlJob(baseUrl, {
  skipCache: false,          // Cache control
  waitForSelectors: [],      // Custom selectors
  maxWorkers: 5,             // Concurrent tabs (1-10)
  useIncognito: false        // Crawl in incognito window
});
```

**Job Completion**:
```javascript
// In crawler.js onComplete()
await closeCrawlWindow(); // Clean up all tabs, debuggers, and incognito window
```

---

## Performance Considerations

### Comparison of Methods

| Method | Time per Page | 100 Pages | Notes |
|--------|---------------|-----------|-------|
| Fetch API | 0.5s | ~30s | No JS execution |
| Tab + CDP | 2-4s | ~3-7 min | Full rendering with multi-signal detection |

Tab-based rendering with CDP provides reliable JavaScript execution and content detection without unnecessary scrolling delays.

### Tab Pool Benefits

| Aspect | Without Pool | With Pool |
|--------|--------------|-----------|
| Tab creation | Per URL | Once per worker |
| Debugger attach | Per URL | Once per worker |
| Memory churn | High | Low |
| Overhead | ~500ms/URL | ~0ms/URL |

### Resource Usage

**Memory**:
- Each tab with debugger: ~80-120 MB
- 5 concurrent tabs: ~400-600 MB
- Peak during crawl: ~500-700 MB total

**CPU**:
- JavaScript execution in tabs
- DOM mutation tracking
- Network monitoring
- Moderate CPU usage

---

## Error Handling

### Debugger Attachment Errors

```javascript
try {
  await chrome.debugger.attach({ tabId }, '1.3');
} catch (error) {
  // May fail if:
  // - Tab was closed
  // - Debugger already attached
  // - Extension lacks permission
  throw new Error(`Failed to attach debugger: ${error.message}`);
}
```

### Timeout Protection

All operations have timeout protection:

```javascript
const DEFAULT_TIMEOUT = 30000; // 30 seconds max wait

// Network idle: max 10s
// DOM stability: max 10s
// Content plateau: max 10s
// Total: max 30s
```

### Tab Cleanup

```javascript
try {
  // ... fetch and extract content
  return content;
} finally {
  // Release tab back to pool (don't close - reuse)
  if (poolEntry) {
    releaseCrawlTab(poolEntry);
  }
}
```

### Graceful Degradation

Detection failures don't stop the crawl:

```javascript
try {
  await waitForDOMStability(tabId, timeout);
} catch (error) {
  console.warn('DOM stability check failed:', error);
  // Continue anyway - better to get content than fail
}
```

---

## Debugging

### Console Logs

Tab fetcher provides detailed logging:

```javascript
[TabFetcher] Starting fetch for: https://example.com
[TabFetcher] Created new crawl tab: 123 with debugger (pool size: 1)
[TabFetcher] Debugger attached to tab 123
[TabFetcher] Focus emulation enabled for tab 123
[TabFetcher] Navigating tab 123 to: https://example.com
[TabFetcher] Initial load complete for: https://example.com
[TabFetcher] Waiting for content ready (multi-signal detection)...
[TabFetcher] Content plateau: 15420 chars, 25 checks, reason: plateau
[TabFetcher] Content ready: 15420 chars after 4523ms
[TabFetcher] Released tab back to pool: 123
```

### Service Worker Console

Debug in service worker context:
```
1. chrome://extensions/
2. Find "Content Crawler"
3. Click "Service worker" link
4. View console logs
```

### Common Issues

**Issue**: Debugger attachment fails
- **Cause**: Missing "debugger" permission
- **Fix**: Add "debugger" to permissions in manifest.json, reload extension

**Issue**: Content incomplete
- **Cause**: Content detection timeout too short
- **Fix**: Increase timeout in options

**Issue**: Tabs stay open after crawl
- **Cause**: Error in extraction code, closeCrawlWindow not called
- **Fix**: Check service worker console for errors

**Issue**: Yellow warning banner
- **Cause**: Chrome's security notification for debugger attachment
- **Fix**: This is expected behavior, cannot be suppressed

---

## Best Practices

### When to Use Tab Rendering

✅ **Use tab rendering for**:
- React, Vue, Angular documentation
- Single Page Applications (SPAs)
- Sites with client-side routing
- Dynamically loaded content
- Lazy-loaded images/code

❌ **Don't use tab rendering for**:
- Static HTML sites (use fetch instead)
- Server-side rendered sites
- When speed is critical
- Simple documentation generators

### Cache Management

**Normal operation**:
```javascript
skipCache: false // Use cache to avoid re-crawling
```

**Testing/development**:
```javascript
skipCache: true // Force refresh to test rendering
```

**Site updates**:
```javascript
skipCache: true // Re-crawl to get latest content
```

### Worker Configuration

| Workers | Speed | Resources | Use Case |
|---------|-------|-----------|----------|
| 1-2 | Slow | Low | Testing, low-spec machines |
| 5 (default) | Balanced | Medium | Most crawling |
| 8-10 | Fast | High | Large sites, powerful machines |
