# Capturer Documentation

## Table of Contents

- [Capturer Documentation](#capturer-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [CrawlJob Class Architecture](#crawljob-class-architecture)
    - [Class Structure](#class-structure)
    - [Constructor](#constructor)
    - [State Properties](#state-properties)
    - [Callback Properties](#callback-properties)
  - [External Link Following](#external-link-following)
    - [Overview](#external-link-overview)
    - [Depth Tracking](#depth-tracking)
    - [Configuration Options](#external-link-configuration)
    - [How It Works](#external-link-how-it-works)
  - [Queue Management](#queue-management)
    - [Queue Lifecycle](#queue-lifecycle)
    - [Adding URLs to Queue](#adding-urls-to-queue)
    - [Deduplication Strategy](#deduplication-strategy)
    - [Dynamic Queue Growth](#dynamic-queue-growth)
  - [Content-Based Deduplication](#content-based-deduplication)
    - [Overview](#content-deduplication-overview)
    - [Hash Computation](#hash-computation)
    - [Duplicate Detection](#duplicate-detection)
    - [Alternate URLs](#alternate-urls)
  - [Worker Coordination](#worker-coordination)
    - [Concurrent Worker System](#concurrent-worker-system)
    - [Worker Lifecycle](#worker-lifecycle)
    - [Worker Synchronization](#worker-synchronization)
    - [Worker Completion Detection](#worker-completion-detection)
  - [Rate Limiting](#rate-limiting)
    - [Configuration](#configuration)
    - [Implementation](#implementation)
    - [Request Timeout](#request-timeout)
  - [Progress Tracking](#progress-tracking)
    - [Progress Metrics](#progress-metrics)
    - [Progress Notification](#progress-notification)
    - [Database Updates](#database-updates)
  - [Error Handling](#error-handling)
    - [Error Capture](#error-capture)
    - [Failed URL Tracking](#failed-url-tracking)
    - [Error Recovery](#error-recovery)
  - [Capture Lifecycle](#capture-lifecycle)
    - [Initialization](#initialization)
    - [Discovery Phase](#discovery-phase)
    - [Processing Phase](#processing-phase)
    - [Completion Phase](#completion-phase)
  - [Global Capture Management](#global-capture-management)
    - [Single Active Capture](#single-active-capture)
    - [Public API Functions](#public-api-functions)
    - [Completion Callbacks](#completion-callbacks)
  - [URL Processing Pipeline](#url-processing-pipeline)
    - [Cache Check](#cache-check)
    - [HTML Fetching](#html-fetching)
    - [Link Extraction](#link-extraction)
    - [Content Extraction](#content-extraction)
    - [Content Hash Deduplication](#content-hash-deduplication)
    - [Storage](#storage)
  - [Page Limit Logic](#page-limit-logic)
    - [Per-URL Tracking](#per-url-tracking)
    - [Capacity Check](#capacity-check)
    - [Global Checks](#global-checks)
    - [Race Condition Prevention](#race-condition-prevention)
    - [Duplicate Handling](#duplicate-handling)
    - [Completion Log](#completion-log)
  - [Pause and Resume](#pause-and-resume)
    - [Pause Implementation](#pause-implementation)
    - [Resume Implementation](#resume-implementation)
    - [Cancel Implementation](#cancel-implementation)
  - [Memory Management](#memory-management)
    - [Set-Based Tracking](#set-based-tracking)
    - [Queue Cleanup](#queue-cleanup)
    - [Completion Cleanup](#completion-cleanup)
  - [Integration Points](#integration-points)
    - [Discovery Module](#discovery-module)
    - [Extractor Module](#extractor-module)
    - [Storage Module](#storage-module)
    - [Utils Module](#utils-module)
    - [Service Worker](#service-worker)

---

## Overview

The capturer module orchestrates the entire page capture process, managing a queue of URLs, coordinating concurrent workers, enforcing rate limits, and tracking progress.

**File**: `lib/crawler.js`

**Key Responsibilities**:
- Manage capture queue with dynamic growth
- Coordinate 2 concurrent workers
- Enforce rate limiting (500ms between requests)
- **Deduplicate content using SHA-256 hashing** (v3+)
- Track progress and notify callbacks
- Handle errors and retries
- Integrate with discovery and extraction modules
- Persist state to IndexedDB

**Constants**:
```javascript
const DEFAULT_MAX_WORKERS = 5;
const MIN_MAX_WORKERS = 1;
const MAX_MAX_WORKERS = 10;
const DELAY_BETWEEN_REQUESTS = 500; // ms
const REQUEST_TIMEOUT = 30000; // 30 seconds

// External link following configuration
const DEFAULT_MAX_EXTERNAL_HOPS = 1;
const MIN_MAX_EXTERNAL_HOPS = 1;
const MAX_MAX_EXTERNAL_HOPS = 5;
```

---

## CrawlJob Class Architecture

### Class Structure

The `CrawlJob` class encapsulates all state and logic for a single capture operation.

```javascript
export class CrawlJob {
  constructor(baseUrl) {
    // Initialize state
  }

  async start() { }
  addToQueue(url) { }
  startWorkers() { }
  async runWorker() { }
  async processUrl(url) { }
  async fetchUrl(url) { }
  async onComplete() { }
  notifyProgress() { }
  pause() { }
  resume() { }
  cancel() { }
  sleep(ms) { }
}
```

### Constructor

**Parameters**:
- `baseUrl` (string | string[]): Single starting URL or array of URLs for the capture
- `options` (object): Configuration options

**Initialization**:
```javascript
constructor(baseUrl, options = {}) {
  // Handle both single URL and array of URLs
  this.baseUrls = Array.isArray(baseUrl) ? baseUrl : [baseUrl];
  this.baseUrl = this.baseUrls[0]; // For backward compatibility
  this.canonicalBaseUrls = this.baseUrls.map(url => canonicalizeUrl(url)).filter(Boolean);
  this.canonicalBaseUrl = this.canonicalBaseUrls[0]; // For backward compatibility

  this.queue = [];
  this.inProgress = new Set();
  this.completed = new Set();
  this.failed = new Set();
  this.activeWorkers = 0;
  this.isPaused = false;
  this.isCancelled = false;
  this.jobId = null;
  this.onProgress = null;

  // Concurrent workers configuration (1-10, default 5)
  const requestedWorkers = options.maxWorkers || DEFAULT_MAX_WORKERS;
  this.maxWorkers = Math.max(MIN_MAX_WORKERS, Math.min(MAX_MAX_WORKERS, requestedWorkers));

  // Page limit configuration (optional, default unlimited)
  this.pageLimit = options.pageLimit && options.pageLimit > 0 ? options.pageLimit : null;

  // Rendering options
  this.renderMode = options.renderMode || FetchMode.BALANCED;
  this.waitForSelectors = options.waitForSelectors || [];
  this.skipCache = options.skipCache || false;

  // Strict path matching (default: true)
  // When true: /financial-apis matches /financial-apis/overview but NOT /financial-apis-blog
  // When false: /financial-apis matches both /financial-apis/overview AND /financial-apis-blog
  this.strictPathMatching = options.strictPathMatching !== undefined ? options.strictPathMatching : true;
}
```

### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `baseUrls` | string[] | Array of base URLs to capture |
| `baseUrl` | string | First base URL (backward compatibility) |
| `canonicalBaseUrls` | string[] | Array of normalized base URLs for filtering |
| `canonicalBaseUrl` | string | First canonical URL (backward compatibility) |
| `queue` | Array | URLs waiting to be processed |
| `inProgress` | Set | URLs currently being captured |
| `completed` | Set | Canonical URLs successfully processed |
| `failed` | Set | URLs that failed to process |
| `activeWorkers` | number | Count of running workers |
| `maxWorkers` | number | Maximum concurrent workers (1-10, default: 5) |
| `pageLimit` | number\|null | Maximum pages to capture (null = unlimited) |
| `isPaused` | boolean | Pause flag |
| `isCancelled` | boolean | Cancellation flag |
| `jobId` | string | Database job ID (set on start) |
| `renderMode` | string | Tab rendering mode (fast/balanced/thorough) |
| `skipCache` | boolean | Force refresh cached pages |
| `strictPathMatching` | boolean | Use strict path hierarchy matching (default: true) |
| `followExternalLinks` | boolean | Follow links outside base URL scope (default: false) |
| `maxExternalHops` | number | Maximum depth for external links, 1-5 (default: 1) |
| `urlDepths` | Map | Tracks depth for each URL (internal=0, external=1+) |

### Callback Properties

| Property | Type | Description |
|----------|------|-------------|
| `onProgress` | function | Called with progress updates |
| `onCompleteCallback` | function | Called when capture finishes |

---

## External Link Following

### Overview {#external-link-overview}

By default, the capturer only follows links that match the base URL path(s). The external link following feature allows following links that point outside the base URL scope, with configurable depth limits to prevent unbounded capturing.

**Use Cases**:
- Documentation that spans multiple domains (e.g., `docs.example.com` links to `sdk.example.com`)
- Related content on different paths (e.g., `/api` links to `/guides`)
- Comprehensive content capture across related resources

### Depth Tracking

Each URL is assigned a **depth** value stored in the `urlDepths` Map:

| Depth | Description |
|-------|-------------|
| 0 | Internal URLs (matching base path) - always depth 0 |
| 1 | External links found on base pages |
| 2 | Links found on depth-1 pages |
| N | Links found on depth-(N-1) pages |

```javascript
// Depth tracking in constructor
this.urlDepths = new Map(); // url → depth

// When adding to queue
this.urlDepths.set(canonicalUrl, depth);
```

### Configuration Options {#external-link-configuration}

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `followExternalLinks` | boolean | `false` | Enable/disable following external links |
| `maxExternalHops` | number | `1` | Maximum depth for external links (1-5) |

**maxExternalHops Examples**:
- `1`: Only follow external links found on base pages (don't follow links from external pages)
- `2`: Also follow links from those external pages (one level deeper)
- `5`: Maximum allowed depth

### How It Works {#external-link-how-it-works}

```
User enters: https://docs.example.com/api
             followExternalLinks: true
             maxExternalHops: 2

1. Base page (depth 0): https://docs.example.com/api
   ├─ Internal link → https://docs.example.com/api/users (depth 0) ✓
   └─ External link → https://sdk.example.com/install (depth 1) ✓

2. External page (depth 1): https://sdk.example.com/install
   ├─ Link → https://sdk.example.com/config (depth 2) ✓
   └─ Link → https://github.com/example/sdk (depth 2) ✓

3. External page (depth 2): https://sdk.example.com/config
   └─ Link → https://other-site.com/foo (depth 3) ✗ BLOCKED (exceeds max)
```

**Implementation in addToQueue()**:
```javascript
addToQueue(url, depth = 0) {
  const canonical = canonicalizeUrl(url);
  const isInternal = isInternalUrl(canonical, this.canonicalBaseUrls, this.strictPathMatching);

  // For external URLs, check depth limit
  if (!isInternal) {
    if (!this.followExternalLinks) return; // External links not allowed
    if (depth > this.maxExternalHops) return; // Exceeds hop limit
  }

  // Store depth and add to queue
  this.urlDepths.set(canonical, isInternal ? 0 : depth);
  this.queue.push(canonical);
}
```

---

## Queue Management

### Queue Lifecycle

The queue is a simple array that grows dynamically as new links are discovered:

1. **Initialization**: Populated with URLs from sitemap and/or base URL
2. **Growth**: Links extracted from each page are added
3. **Depletion**: Workers shift URLs from the front
4. **Completion**: Queue empties when all URLs are processed OR page limit reached

**Page Limit Handling** (v2.4+):
- Optional limit on total pages to capture (configurable in UI)
- Limit includes both completed AND in-progress pages (prevents race conditions)
- Workers check limit before grabbing URLs to avoid exceeding limit
- When limit reached, queue is cleared
- Job marked as `completed` (not `interrupted`)
- Ensures exact page count matches limit with concurrent workers

### Adding URLs to Queue

The `addToQueue(url)` method handles intelligent queuing:

```javascript
addToQueue(url) {
  const canonical = canonicalizeUrl(url);
  if (!canonical) return;

  // Check if already processed or in queue
  if (this.completed.has(canonical) ||
      this.inProgress.has(canonical) ||
      this.queue.includes(canonical)) {
    return;
  }

  this.queue.push(canonical);
}
```

**Deduplication Checks**:
1. URL must canonicalize successfully
2. Not in `completed` set
3. Not in `inProgress` set
4. Not already in `queue` array

### Deduplication Strategy

**URL-Level Deduplication** (prevents processing same URL twice):

1. **Canonical URL normalization**:
   - Removes trailing slashes
   - Strips fragments
   - Normalizes query parameters

2. **Set-based tracking**:
   - `completed` Set for O(1) lookup (unique content pages only)
   - `inProgress` Set for O(1) lookup

3. **Queue array check**:
   - Linear search (acceptable since queue is typically small)

**Note**: URL deduplication prevents capturing the same URL twice, but different URLs may serve identical content. See [Content-Based Deduplication](#content-based-deduplication) for handling duplicate content.

### Dynamic Queue Growth

The queue grows dynamically as workers discover new links:

```javascript
// In processUrl()
const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
links.forEach(link => this.addToQueue(link));
```

**Growth Pattern**:
- Sitemap may add 100s-1000s of URLs initially
- Each processed page may add 0-50 new URLs
- Queue stabilizes as more pages share common links
- Eventually depletes as all discoverable URLs are processed

---

## Content-Based Deduplication

### Overview

**Version**: Added in v3 (Database schema version 3)

Content-based deduplication detects when different URLs serve identical content. This commonly occurs when:
- Multiple URLs redirect to the same page
- Mirror URLs exist (e.g., `/docs/page` and `/documentation/page`)
- Query parameters don't affect content (e.g., `?ref=twitter` vs `?ref=email`)

**Key Benefits**:
- Reduces storage usage
- More accurate page counts
- Page limit counts unique content, not total URLs
- Groups duplicate URLs together for better organization

### Hash Computation

Content is hashed using **SHA-256** after text extraction:

```javascript
import { computeContentHash } from './utils.js';

// After extracting clean text
const cleanedText = extractContent(text, url);
const contentHash = await computeContentHash(cleanedText);
```

**Implementation** (`lib/utils.js`):
```javascript
export async function computeContentHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex; // Returns: "a3f2c8d1e5..."
}
```

**Properties**:
- Uses Web Crypto API (available in service workers)
- Deterministic (same content always produces same hash)
- Fast computation (~1ms for typical page)
- Collision probability is negligible with SHA-256

### Duplicate Detection

During `processUrl()`, after content extraction:

```javascript
// Compute content hash
const contentHash = await computeContentHash(cleanedText);

// Check for duplicate content within this job
if (contentHash) {
  const existingPage = await getPageByContentHash(this.jobId, contentHash);

  if (existingPage) {
    // Duplicate found! Update existing page
    await updatePageAlternateUrls(existingPage.id, url);

    // Extract links (still needed for discovery)
    const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
    links.forEach(link => this.addToQueue(link));

    return; // Don't create new page, don't add to completed
  }
}

// Not a duplicate - save as new unique page
await savePage(this.jobId, url, url, cleanedText, 'success', html, contentHash);
this.completed.add(url); // Mark as unique content
```

**Duplicate Handling**:
- **When duplicate found**:
  - Add URL to existing page's `alternateUrls` array
  - Still extract and queue links for discovery
  - Do NOT add to `completed` Set (not unique content)
  - Do NOT save as separate page

- **When unique content**:
  - Save as new page with content hash
  - Add to `completed` Set
  - Initialize `alternateUrls` with primary URL

### Alternate URLs

Each page tracks all URLs serving the same content:

```javascript
{
  id: "1700000001000-xyz",
  url: "https://example.com/api/users",  // Primary URL (first discovered)
  canonicalUrl: "https://example.com/api/users",
  contentHash: "a3f2c8d1e5...",
  alternateUrls: [
    "https://example.com/api/users",      // Primary
    "https://example.com/api/customers",  // Alternate 1
    "https://example.com/users"           // Alternate 2
  ],
  content: "...",
  // ... other fields
}
```

**Properties**:
- `alternateUrls` is always an array (never null)
- First element is the primary URL (first discovered)
- Additional elements are alternates
- UI shows count when `alternateUrls.length > 1`

**Storage**: See [STORAGE.md](./STORAGE.md) for database schema details.

---

## Worker Coordination

### Concurrent Worker System

Configurable concurrent workers (1-10, default: 5) process URLs from the queue:

```javascript
startWorkers() {
  console.log(`[Crawler] Starting ${this.maxWorkers} workers`);
  for (let i = 0; i < this.maxWorkers; i++) {
    this.runWorker();
  }
}
```

**Configurable Workers**:
- Default: 5 workers (balanced speed and resource usage)
- Minimum: 1 worker (conservative)
- Maximum: 10 workers (aggressive)
- User can configure in Advanced Options UI

**Benefits**:
- Faster capturing with more workers
- User controls speed vs resource usage trade-off
- Scales based on system capabilities
- 5 workers = ~10-20 pages/minute

### Worker Lifecycle

Each worker runs asynchronously with smart queue management:

```javascript
async runWorker() {
  this.activeWorkers++;
  const workerId = this.activeWorkers;

  while (!this.isCancelled && !this.isPageLimitReached()) {
    if (this.isPaused) {
      await this.sleep(1000);
      continue;
    }

    // Check page limit BEFORE grabbing URL (v2.4+: prevents race conditions)
    if (this.isPageLimitReached()) {
      break;
    }

    const url = this.queue.shift();

    // Smart waiting: if queue empty but other workers active, wait
    if (!url) {
      const otherWorkersActive = this.inProgress.size > 0;
      if (otherWorkersActive) {
        // Wait for other workers to discover new links
        await this.sleep(500);
        continue;
      } else {
        break; // Queue empty, no active workers - done
      }
    }

    this.inProgress.add(url);

    try {
      await this.processUrl(url);
      this.completed.add(url);
      await updateJob(this.jobId, { /* progress */ });
      this.notifyProgress();
    } catch (error) {
      this.failed.add(url);
      await updateJob(this.jobId, { /* errors */ });
    } finally {
      this.inProgress.delete(url);
    }

    // Check page limit after processing (final safety check)
    if (this.isPageLimitReached()) break;

    await this.sleep(DELAY_BETWEEN_REQUESTS);
  }

  this.activeWorkers--;

  if (this.activeWorkers === 0 && (this.queue.length === 0 || this.isPageLimitReached())) {
    await this.onComplete();
  }
}
```

**Key improvements**:
- Workers wait for queue to fill instead of exiting early
- Allows other workers to discover new links
- Prevents race condition where workers exit before links discovered
- **Page limit checked twice** (v2.4+):
  - Before grabbing URL (prevents over-commitment)
  - After processing (final safety check)
- Ensures exact page count with concurrent workers

### Worker Synchronization

**No explicit locking required** because:
- JavaScript is single-threaded
- Async operations yield control cooperatively
- `Set.add()` and `Array.shift()` are atomic

**Synchronization points**:
1. Queue shift (atomic)
2. Set operations (atomic)
3. Database updates (async but independent)

### Worker Completion Detection

Workers complete when:
```javascript
if (this.activeWorkers === 0 && (this.queue.length === 0 || this.hasMetUniquePageRequirement() || this.isCancelled)) {
  await this.onComplete();
}
```

**Completion Conditions**:
- `activeWorkers === 0`: All workers finished, AND
- One of the following:
  - `queue.length === 0`: No more URLs to process, OR
  - `hasMetUniquePageRequirement()`: Page limit reached, OR
  - `isCancelled`: Crawl was cancelled
- Only last worker to finish triggers `onComplete()`
- **Bug fix**: Previously, cancelled crawls didn't call `onComplete()` if queue wasn't empty, leaving status as 'in_progress'

**Page Limit Check** (v2.4+):
```javascript
isPageLimitReached() {
  if (!this.pageLimit) return false;

  // Count both completed and in-progress to prevent race conditions
  const totalPages = this.completed.size + this.inProgress.size;
  return totalPages >= this.pageLimit;
}
```

**Race Condition Prevention**:
- Includes in-progress pages in count
- Prevents workers from exceeding limit with concurrent execution
- Ensures exact page count matches configured limit

---

## Rate Limiting

### Configuration

```javascript
const DELAY_BETWEEN_REQUESTS = 500; // ms
const REQUEST_TIMEOUT = 30000; // 30 seconds
```

### Implementation

**Per-worker delay** after each URL is processed:

```javascript
await this.sleep(DELAY_BETWEEN_REQUESTS);
```

**Effective rate**:
- 2 workers × 2 requests/second = ~4 requests/second maximum
- Actual rate is lower due to processing time
- Typical sustained rate: 2-3 requests/second

**Benefits**:
- Polite to documentation servers
- Reduces likelihood of being blocked
- Allows time for processing between requests

### Request Timeout

Each fetch has a 30-second timeout:

```javascript
async fetchUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DocumentationCrawler/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return html;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Timeout handling**:
- AbortController cancels fetch after 30 seconds
- Prevents workers from hanging on slow/unresponsive servers
- Failed URLs are tracked in `failed` Set

---

## Progress Tracking

### Progress Metrics

Progress is calculated from several sources:

```javascript
{
  pagesFound: this.queue.length + this.inProgress.size + this.completed.size,
  pagesProcessed: this.completed.size,
  pagesFailed: this.failed.size,
  queueSize: this.queue.length,
  inProgress: Array.from(this.inProgress)
}
```

**Metrics**:
- `pagesFound`: Total unique URLs discovered so far
- `pagesProcessed`: Successfully completed pages
- `pagesFailed`: Failed pages
- `queueSize`: URLs waiting to be processed
- `inProgress`: Currently processing URLs (array of URLs)

### Progress Notification

Progress is broadcast via callback:

```javascript
notifyProgress() {
  if (this.onProgress) {
    this.onProgress({
      pagesFound: /* ... */,
      pagesProcessed: /* ... */,
      pagesFailed: /* ... */,
      queueSize: /* ... */,
      inProgress: Array.from(this.inProgress)
    });
  }
}
```

**When notified**:
- After each URL is successfully processed
- After each URL fails
- Never during pause (would spam callback)

### Database Updates

Job status is persisted after each URL:

```javascript
await updateJob(this.jobId, {
  pagesProcessed: this.completed.size,
  pagesFound: this.queue.length + this.inProgress.size + this.completed.size
});
```

**Updated fields**:
- `pagesProcessed`: Incremented on success
- `pagesFound`: Updated with new total
- `pagesFailed`: Incremented on error
- `errors`: Array of error objects (on failure)

---

## Error Handling

### Error Capture

Errors are caught at the worker level:

```javascript
try {
  await this.processUrl(url);
  this.completed.add(url);
} catch (error) {
  console.error('Error processing URL:', url, error);
  this.failed.add(url);
  await updateJob(this.jobId, {
    pagesFailed: this.failed.size,
    errors: await this.getErrors()
  });
}
```

### Failed URL Tracking

Failed URLs are stored in a Set:

```javascript
this.failed = new Set();
```

**Error object structure**:
```javascript
{
  url: 'https://...',
  canonicalUrl: 'https://...',
  error: 'Failed to process',
  timestamp: Date.now()
}
```

### Error Recovery

**No automatic retries** - failed URLs are recorded but not retried:

- Prevents infinite loops on permanently broken URLs
- User can manually restart crawl if needed
- Failed pages don't block other pages

**Partial failure handling**:
- Other workers continue processing
- Job completes with status `completed_with_errors`
- Error details available in job record

---

## Capture Lifecycle

### Initialization

```javascript
async start() {
  console.log('Starting capture for:', this.baseUrl);

  // Create job in database
  const job = await createJob(this.baseUrl, this.canonicalBaseUrl);
  this.jobId = job.id;

  // Update job status
  await updateJob(this.jobId, { status: 'in_progress' });

  // Discover initial URLs
  const initialUrls = await discoverInitialUrls(this.baseUrl);

  // Add to queue
  initialUrls.forEach(url => this.addToQueue(url));

  // Update job with found pages
  await updateJob(this.jobId, {
    pagesFound: this.queue.length
  });

  // Start workers
  this.startWorkers();

  return this.jobId;
}
```

### Discovery Phase

Initial URL discovery via `discoverInitialUrls()`:

1. Try to fetch sitemap.xml
2. Parse sitemap for URLs
3. Filter URLs to base path
4. Add base URL itself
5. Return combined set

**Result**: Queue populated with initial URLs (1-1000s)

### Processing Phase

Workers continuously process URLs:

1. Check cache (skip if already captured)
2. Fetch HTML
3. Extract links → add to queue
4. Extract content → convert to Markdown
5. Save to database
6. Update progress

**Duration**: Continues until queue is empty

### Completion Phase

```javascript
async onComplete() {
  console.log('Capture complete!');
  console.log('Processed:', this.completed.size);
  console.log('Failed:', this.failed.size);

  const status = this.isCancelled ? 'interrupted' :
                 this.failed.size > 0 ? 'completed_with_errors' : 'completed';

  await updateJob(this.jobId, {
    status,
    pagesProcessed: this.completed.size,
    pagesFailed: this.failed.size
  });

  this.notifyProgress();

  if (this.onCompleteCallback) {
    this.onCompleteCallback();
  }
}
```

**Completion statuses**:
- `completed`: All pages successful
- `completed_with_errors`: Some pages failed
- `interrupted`: User cancelled

---

## Global Capture Management

### Single Active Capture

Only one capture can run at a time:

```javascript
let activeCrawl = null;

export async function startCrawl(baseUrl, onProgress) {
  if (activeCrawl) {
    throw new Error('A capture is already in progress');
  }

  const crawl = new CrawlJob(baseUrl);
  crawl.onProgress = onProgress;

  crawl.onCompleteCallback = () => {
    console.log('Clearing active capture');
    activeCrawl = null;
  };

  activeCrawl = crawl;

  try {
    const jobId = await crawl.start();
    return jobId;
  } catch (error) {
    activeCrawl = null;
    throw error;
  }
}
```

**Why single capture?**
- Prevents resource exhaustion
- Simplifies state management
- Ensures predictable behavior
- User can cancel and start new capture

### Public API Functions

**`startCrawl(baseUrl, onProgress)`**:
- Creates new CrawlJob
- Sets progress callback
- Sets completion callback (clears active capture)
- Starts the capture
- Returns job ID

**`getActiveCrawl()`**:
- Returns current CrawlJob or null
- Used for status checks

**`cancelActiveCrawl()`**:
- Cancels active capture
- Clears active capture reference

### Completion Callbacks

Two-level callback system:

1. **Progress callback** (`onProgress`):
   - Called after each URL is processed
   - Provides real-time metrics

2. **Completion callback** (`onCompleteCallback`):
   - Called when crawl finishes
   - Clears global `activeCrawl` reference (code variable)

---

## URL Processing Pipeline

### Cache Check

**Behavior (v3+)**: Cache check with content deduplication:

```javascript
if (!this.skipCache) {
  const cached = await getPageByCanonicalUrl(url);
  if (cached) {
    // Compute or reuse content hash
    const contentHash = cached.contentHash || await computeContentHash(cached.content);

    // Check for duplicate content within this job
    const existingPage = await getPageByContentHash(this.jobId, contentHash);
    if (existingPage) {
      // Duplicate - update alternateUrls
      await updatePageAlternateUrls(existingPage.id, url);
      // Extract links and return (don't save as new page)
      return;
    }

    // Not duplicate - save cached content to this job
    await savePage(this.jobId, url, url, cached.content, 'success', cached.html, contentHash);
    this.completed.add(url); // Mark as unique content

    // Check if HTML is also cached
    if (cached.html) {
      // Fully cached - extract links from cached HTML
      const links = extractLinksFromHtml(cached.html, url, this.canonicalBaseUrl);
      links.forEach(link => this.addToQueue(link));
      // No tab rendering needed! ~80% faster
      return;
    } else {
      // Partial cache - fetch HTML only for link extraction
      const { html } = await this.fetchUrl(url);
      const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
      links.forEach(link => this.addToQueue(link));
      return;
    }
  }
}
```

**Benefits**:
- **Content caching**: Avoids re-extracting text from pages
- **HTML caching** (v2.4+): Avoids opening tabs for link extraction
- Each job has its own complete copy of pages
- ~80% performance improvement on fully cached pages

**Cache Levels**:
- **Full cache hit** (content + HTML): No tab opened, instant processing
- **Partial cache hit** (content only): Tab opened for HTML, text reused
- **Cache miss**: Full capture with tab rendering

**Force Refresh**: When `skipCache: true`, cache check is skipped entirely and page is re-captured

**Performance Impact** (v2.4+):
- First crawl: 100% tab rendering
- Second crawl with old cache: 100% tab rendering (HTML not cached)
- Third+ crawl with new cache: 0% tab rendering (fully cached)

### HTML Fetching

```javascript
const html = await this.fetchUrl(url);
```

**Includes**:
- 30-second timeout
- Custom User-Agent header
- HTTP status validation
- Text response parsing

### Link Extraction

```javascript
const links = extractLinksFromHtml(html, url, this.canonicalBaseUrl);
links.forEach(link => this.addToQueue(link));
```

**Discovery module extracts**:
- All `<a href>` links
- Resolves relative URLs
- Filters to base path
- Canonicalizes and deduplicates

### Content Extraction

```javascript
const cleanedText = extractContent(text, url);
```

**Extractor module**:
- Removes scripts and styles
- Finds main content area
- Converts HTML to plain text
- Cleans up formatting

### Content Hash Deduplication

**New in v3**: After content extraction, compute hash and check for duplicates:

```javascript
// Compute SHA-256 hash of content
const contentHash = await computeContentHash(cleanedText);

// Check if this content already exists in current job
if (contentHash) {
  const existingPage = await getPageByContentHash(this.jobId, contentHash);

  if (existingPage) {
    // Duplicate found - update alternateUrls and return
    await updatePageAlternateUrls(existingPage.id, url);
    return; // Don't save as new page
  }
}
```

**See**: [Content-Based Deduplication](#content-based-deduplication) for full details.

### Storage

```javascript
await savePage(this.jobId, url, url, cleanedText, 'success', html, contentHash);
this.completed.add(url); // Only called for unique content
```

**Persists to IndexedDB** (v3):
- Job ID for relationship
- Original and canonical URL
- Extracted text content
- **Content hash** for deduplication
- **Alternate URLs** array (initialized with primary URL)
- HTML (for cache hits)
- Timestamp and metadata

**Only unique content** is added to `completed` Set. Duplicates update existing pages without creating new records.

---

## Page Limit Logic

**Version**: Updated in v2.19+ to support per-URL limits

When an optional page limit is set, the limit applies **per input URL**, not globally. This means with 3 input URLs and a limit of 5, you can capture up to 15 pages total (5 from each base URL).

### Per-URL Tracking

The crawler maintains separate tracking for each base URL:

```javascript
// Maps to track completed and in-progress pages per base URL
this.completedPerBaseUrl = new Map();  // baseUrl → Set of completed URLs
this.inProgressPerBaseUrl = new Map(); // baseUrl → Set of in-progress URLs
```

### Capacity Check

**Purpose**: Determine if a base URL can accept more pages

**Method**: `hasCapacityForBaseUrl(baseUrl)`

```javascript
hasCapacityForBaseUrl(baseUrl) {
  if (!this.pageLimit) return true;

  // Only count completed pages (not in-progress)
  const completed = this.completedPerBaseUrl.get(baseUrl) || new Set();
  return completed.size < this.pageLimit;
}
```

**Used**: Before grabbing URLs and before saving pages

### Global Checks

**`canGrabMoreUrls()`**: Returns true if ANY base URL still has capacity

```javascript
canGrabMoreUrls() {
  if (!this.pageLimit) return true;

  for (const baseUrl of this.canonicalBaseUrls) {
    if (this.hasCapacityForBaseUrl(baseUrl)) {
      return true;
    }
  }
  return false;
}
```

**`hasMetUniquePageRequirement()`**: Returns true if ALL base URLs have met their limits

```javascript
hasMetUniquePageRequirement() {
  if (!this.pageLimit) return false;

  for (const baseUrl of this.canonicalBaseUrls) {
    if (!this.hasBaseUrlMetLimit(baseUrl)) {
      return false;
    }
  }
  return true;
}
```

### Race Condition Prevention

To prevent over-capturing with concurrent workers, the capturer performs a **final check before saving**:

```javascript
// Inside processUrl, before saving:
const currentCount = this.completedPerBaseUrl.get(baseUrl)?.size || 0;
if (currentCount >= this.pageLimit) {
  console.log(`Limit reached for ${baseUrl}, skipping save`);
  return; // Don't save, limit already reached
}
```

This synchronous check ensures that even if multiple workers process URLs simultaneously, only up to the limit will actually be saved.

### Duplicate Handling

Duplicates (URLs with identical content) do NOT count towards the limit:
- Only unique content pages are added to `completedPerBaseUrl`
- Duplicates update existing pages with alternate URLs
- The capture continues until the limit of unique pages is reached

**Example** (2 input URLs, limit = 3):

```
Base URLs: example.com/docs, example.com/api
Limit: 3 per URL

Result:
  example.com/docs: 3/3 pages (includes handling of any duplicates)
  example.com/api: 3/3 pages
  Total: 6 unique pages
```

### Completion Log

When capture completes with page limits, the log shows per-URL stats:

```
Capture complete!
Processed: 6
Page limit per input URL: 3
Max total pages: 6
  https://example.com/docs: 3/3 pages
  https://example.com/api: 3/3 pages
```

---

## Pause and Resume

### Pause Implementation

```javascript
pause() {
  this.isPaused = true;
}
```

**Behavior**:
- Workers check `isPaused` flag in loop
- When paused, workers sleep for 1 second
- In-flight requests complete
- Queue and state preserved

```javascript
while (this.queue.length > 0 && !this.isCancelled) {
  if (this.isPaused) {
    await this.sleep(1000);
    continue;
  }
  // ... process URL
}
```

### Resume Implementation

```javascript
resume() {
  this.isPaused = false;
}
```

**Behavior**:
- Clears pause flag
- Workers resume processing on next iteration
- No state lost

### Cancel Implementation

```javascript
cancel() {
  this.isCancelled = true;
}
```

**Behavior**:
- Workers exit loop on next iteration
- In-flight requests complete
- `onComplete()` is called when all workers finish (even with non-empty queue)
- Queue and in-progress sets are cleared
- Job status updated to `interrupted` in database
- Progress notification sent to UI (triggers job list refresh)

**Important**: The completion check includes `|| this.isCancelled` to ensure `onComplete()` is called even when queue has remaining URLs.

---

---

## Memory Management

### Set-Based Tracking

Using Sets instead of arrays for O(1) lookup:

```javascript
this.inProgress = new Set();
this.completed = new Set();
this.failed = new Set();
```

**Memory characteristics**:
- Sets grow linearly with pages processed
- Typical crawl: 100-1000 URLs = 10-100 KB
- Large crawl: 10,000 URLs = ~1 MB

### Queue Cleanup

Queue is drained as URLs are processed:

```javascript
const url = this.queue.shift();
```

**Memory behavior**:
- Queue peaks early (after sitemap discovery)
- Depletes as workers process faster than discovery
- Eventually reaches 0

### Completion Cleanup

On completion, the global reference is cleared:

```javascript
activeCrawl = null;
```

**Garbage collection**:
- Allows entire CrawlJob instance to be GC'd
- Sets, queue, and all state released
- Only persistent data remains in IndexedDB

---

## Integration Points

### Discovery Module

**Import**:
```javascript
import { discoverInitialUrls, extractLinksFromHtml } from './discovery.js';
```

**Usage**:
- `discoverInitialUrls(baseUrl)`: Get starting URLs
- `extractLinksFromHtml(html, pageUrl, baseUrl)`: Extract links from page

### Extractor Module

**Import**:
```javascript
import { extractContent } from './extractor-simple.js';
```

**Usage**:
- `extractContent(html, url)`: Convert HTML to Markdown

### Storage Module

**Import**:
```javascript
import {
  createJob,
  updateJob,
  savePage,
  getPageByCanonicalUrl,
  getPageByContentHash,
  updatePageAlternateUrls
} from '../storage/db.js';
```

**Usage**:
- `createJob()`: Initialize job in DB
- `updateJob()`: Update progress
- `savePage()`: Persist extracted content with hash
- `getPageByCanonicalUrl()`: Check cache
- **`getPageByContentHash(jobId, contentHash)`**: Find duplicate content (v3+)
- **`updatePageAlternateUrls(pageId, newUrl)`**: Add alternate URL (v3+)

### Utils Module

**Import** (v3+):
```javascript
import { canonicalizeUrl, computeContentHash } from './utils.js';
```

**Usage**:
- `canonicalizeUrl(url)`: Normalize URL to canonical form
- **`computeContentHash(content)`**: Generate SHA-256 hash for deduplication (v3+)

### Service Worker

**Import**:
```javascript
import { startCrawl, getActiveCrawl, cancelActiveCrawl } from './lib/crawler.js';
```

**Usage**:
- `startCrawl(baseUrl, onProgress)`: Start new capture
- `getActiveCrawl()`: Check active status
- `cancelActiveCrawl()`: Cancel running capture
