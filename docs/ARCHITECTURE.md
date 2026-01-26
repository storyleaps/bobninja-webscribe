# Architecture Documentation

## Table of Contents

- [Architecture Documentation](#architecture-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [System Architecture](#system-architecture)
    - [High-Level Architecture](#high-level-architecture)
    - [Component Responsibilities](#component-responsibilities)
  - [Data Flow](#data-flow)
    - [Capture Initialization Flow](#capture-initialization-flow)
    - [URL Discovery and Processing Flow](#url-discovery-and-processing-flow)
    - [Real-Time Progress Updates Flow](#real-time-progress-updates-flow)
    - [Content Viewing Flow](#content-viewing-flow)
  - [Module Interactions](#module-interactions)
    - [Service Worker ↔ Storage](#service-worker--storage)
    - [Service Worker ↔ Popup UI](#service-worker--popup-ui)
    - [Capturer ↔ Discovery ↔ Extractor](#capturer--discovery--extractor)
  - [Design Decisions](#design-decisions)
    - [Hybrid Architecture (Vanilla JS + React)](#hybrid-architecture-vanilla-js--react)
    - [Single Active Capture Constraint](#single-active-capture-constraint)
    - [Canonical URL Normalization](#canonical-url-normalization)
    - [Incremental Saving Strategy](#incremental-saving-strategy)
    - [Dynamic Queue System](#dynamic-queue-system)
  - [Threading Model](#threading-model)
    - [Service Worker Thread](#service-worker-thread)
    - [UI Thread (Popup)](#ui-thread-popup)
    - [Communication Between Threads](#communication-between-threads)
  - [State Management](#state-management)
    - [Persistent State (IndexedDB)](#persistent-state-indexeddb)
    - [Runtime State (Service Worker)](#runtime-state-service-worker)
    - [UI State (React)](#ui-state-react)
  - [Error Handling Strategy](#error-handling-strategy)
    - [Network Errors](#network-errors)
    - [Parsing Errors](#parsing-errors)
    - [Storage Errors](#storage-errors)
    - [UI Errors](#ui-errors)
  - [Performance Considerations](#performance-considerations)
    - [Rate Limiting](#rate-limiting)
    - [Memory Management](#memory-management)
    - [Storage Efficiency](#storage-efficiency)
  - [Security Considerations](#security-considerations)
    - [Content Security Policy](#content-security-policy)
    - [URL Validation](#url-validation)
    - [XSS Prevention](#xss-prevention)

---

## Overview

Webscribe is a Chrome Extension built using a **hybrid architecture** that combines:

- **Vanilla JavaScript modules** for core capture logic (service worker compatible)
- **React + TypeScript** for the popup user interface
- **IndexedDB** for persistent local storage
- **Message passing** for inter-component communication

This architecture ensures optimal performance, service worker compatibility, and modern developer experience.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Extension                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────────────────┐     │
│  │   Popup UI   │ ◄─────► │    Service Worker        │     │
│  │   (React)    │ Message │   (Vanilla JS)           │     │
│  │              │ Passing │                          │     │
│  │  - CrawlTab  │         │  - Message Handlers      │     │
│  │  - JobsTab   │         │  - Crawl Orchestration   │     │
│  │  - SearchTab │         │  - Storage Operations    │     │
│  └──────────────┘         └──────────┬───────────────┘     │
│                                       │                      │
│                                       ▼                      │
│                          ┌─────────────────────────┐        │
│                          │   Core Modules          │        │
│                          │   (Vanilla JS)          │        │
│                          │                         │        │
│                          │  - crawler.js           │        │
│                          │  - discovery.js         │        │
│                          │  - extractor-simple.js  │        │
│                          │  - utils.js             │        │
│                          └────────┬────────────────┘        │
│                                   │                         │
│                                   ▼                         │
│                          ┌─────────────────────────┐        │
│                          │    IndexedDB            │        │
│                          │    (storage/db.js)      │        │
│                          │                         │        │
│                          │  - jobs store           │        │
│                          │  - pages store          │        │
│                          └─────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### **Popup UI (React + TypeScript)**
- **Location**: `popup/src/`
- **Purpose**: User interface for controlling crawls and viewing results
- **Responsibilities**:
  - Render 3-tab navigation (Crawl, Jobs, Search)
  - Capture user input (URLs, search queries)
  - Send messages to service worker
  - Display real-time crawl progress
  - Render job lists and page content
  - Handle user interactions (copy, download, delete)

#### **Service Worker (Vanilla JS)**
- **Location**: `service-worker.js`
- **Purpose**: Background orchestration and message routing
- **Responsibilities**:
  - Receive and route messages from popup
  - Manage active crawl instance
  - Broadcast progress updates to UI
  - Coordinate storage operations
  - Persist across browser sessions

#### **Crawler Module**
- **Location**: `lib/crawler.js`
- **Purpose**: Orchestrate crawl jobs with queue management
- **Responsibilities**:
  - Manage crawl queue (dynamic, grows as links discovered)
  - Coordinate worker threads (max 2 concurrent)
  - Rate limiting (500ms between requests)
  - Track progress (found, processed, failed)
  - Handle completion and errors

#### **Discovery Module**
- **Location**: `lib/discovery.js`
- **Purpose**: Find URLs to crawl (sitemap + link extraction)
- **Responsibilities**:
  - Parse sitemap.xml for initial URLs
  - Extract links from HTML pages (regex-based)
  - Normalize URLs to canonical form
  - Filter URLs to base path only
  - Deduplicate URLs

#### **Extractor Module**
- **Location**: `lib/extractor-simple.js`
- **Purpose**: Convert HTML to clean Markdown
- **Responsibilities**:
  - Extract main content from HTML
  - Remove noise (nav, footer, ads)
  - Convert to Markdown (headers, code, tables, lists)
  - Clean and format output

#### **Storage Module**
- **Location**: `storage/db.js`
- **Purpose**: IndexedDB wrapper for persistent storage
- **Responsibilities**:
  - CRUD operations for jobs and pages
  - Index management for fast queries
  - Search functionality across content
  - Cache lookups for deduplication

#### **Utils Module**
- **Location**: `lib/utils.js`
- **Purpose**: Shared utility functions
- **Responsibilities**:
  - URL canonicalization
  - URL validation
  - Base path filtering
  - URL resolution (relative → absolute)

---

## Data Flow

### Crawl Initialization Flow

```
User Action: Enter URL → Click "Start Crawl"
    ↓
Popup UI (CrawlTab.tsx)
    ↓ calls useCrawl.startCrawl(url)
    ↓
Service Worker Client (service-worker-client.ts)
    ↓ sendMessage('START_CRAWL', { baseUrl })
    ↓ [MessageChannel for response]
    ↓
Service Worker (service-worker.js)
    ↓ handleStartCrawl()
    ↓
Crawler Module (crawler.js)
    ↓ startCrawl(baseUrl, onProgress)
    ↓ new CrawlJob(baseUrl)
    ↓ crawl.start()
    ↓
Storage (db.js)
    ↓ createJob(baseUrl, canonicalBaseUrl)
    ↓ → IndexedDB: jobs store
    ↓
Discovery (discovery.js)
    ↓ discoverInitialUrls(baseUrl)
    ↓ discoverFromSitemap() [fetches sitemap.xml]
    ↓
Crawler
    ↓ Add URLs to queue
    ↓ Start 2 workers
    ↓
[Workers begin processing queue...]
```

### URL Discovery and Processing Flow

```
Worker picks URL from queue
    ↓
1. Canonicalize URL
    ↓ utils.canonicalizeUrl(url)
    ↓
2. Check cache (avoid duplicates)
    ↓ db.getPageByCanonicalUrl(canonicalUrl)
    ↓ If found → skip, pick next URL
    ↓
3. Fetch HTML
    ↓ fetch(url) with timeout & headers
    ↓
4. Extract links from HTML
    ↓ discovery.extractLinksFromHtml(html, pageUrl, baseUrl)
    ↓ → Finds all <a href> using regex
    ↓ → Resolves relative URLs to absolute
    ↓ → Canonicalizes each URL
    ↓ → Filters to base path only
    ↓
5. Add new links to queue
    ↓ crawler.addToQueue(newUrls)
    ↓ → Check not already in queue/completed
    ↓ → Append to end of queue
    ↓
6. Extract content from HTML
    ↓ extractor.extractContent(html, url)
    ↓ → Remove noise elements
    ↓ → Convert to Markdown
    ↓ → Clean output
    ↓
7. Save to storage
    ↓ db.savePage(jobId, url, canonicalUrl, markdown)
    ↓ → IndexedDB: pages store
    ↓
8. Update job progress
    ↓ db.updateJob(jobId, { pagesProcessed, pagesFound })
    ↓
9. Notify UI of progress
    ↓ crawler.notifyProgress()
    ↓ service-worker.broadcastProgress()
    ↓ → All popup clients receive update
    ↓
10. Rate limiting delay (500ms)
    ↓
11. Pick next URL from queue
    ↓
[Repeat until queue empty]
```

### Real-Time Progress Updates Flow

```
Crawler (crawler.js)
    ↓ After each page processed
    ↓ this.notifyProgress()
    ↓
    ↓ Calls onProgress callback
    ↓
Service Worker (service-worker.js)
    ↓ broadcastProgress(jobId, progress)
    ↓
    ↓ self.clients.matchAll()
    ↓ client.postMessage({ type: 'CRAWL_PROGRESS', data })
    ↓
Popup UI (useCrawl hook)
    ↓ crawlerAPI.onProgress(callback)
    ↓ navigator.serviceWorker.addEventListener('message')
    ↓
    ↓ Receives: { pagesFound, pagesProcessed, queueSize, inProgress }
    ↓
React State Update
    ↓ setProgress({ ...progressData })
    ↓
UI Re-renders
    ↓ Progress bar updates
    ↓ Counters increment
    ↓ Current URLs displayed
```

### Content Viewing Flow

```
User clicks page URL in JobsTab
    ↓
JobsTab.tsx
    ↓ setSelectedPage(page)
    ↓ → page object already has .content (from IndexedDB)
    ↓
Dialog component opens
    ↓ <Dialog open={!!selectedPage}>
    ↓
Content rendered
    ↓ <pre>{selectedPage.content}</pre>
    ↓ → Markdown displayed in monospace font
    ↓
User clicks "Copy Page"
    ↓ navigator.clipboard.writeText(content)
    ↓ toast({ variant: "success", ... })
    ↓
Toast notification appears
    ↓ Green success message: "Content copied!"
```

---

## Module Interactions

### Service Worker ↔ Storage

**Write Operations:**
```javascript
// Service worker delegates to crawler
startCrawl(baseUrl)
  → crawler.start()
  → db.createJob(baseUrl)
  → db.savePage(jobId, url, content)
  → db.updateJob(jobId, progress)
```

**Read Operations:**
```javascript
// Popup requests data via service worker
Popup: sendMessage('GET_JOBS')
  → Service Worker: handleGetJobs()
  → db.getAllJobs()
  → Response sent back to popup
```

### Service Worker ↔ Popup UI

**Message Protocol:**

1. **Request/Response Pattern** (MessageChannel):
```javascript
// Popup sends request
sendMessage('START_CRAWL', { baseUrl })
  → Creates MessageChannel
  → Sends to service worker with port

// Service worker responds
event.ports[0].postMessage({ type: 'RESPONSE', data })
  → Popup receives response via promise
```

2. **Broadcast Pattern** (Progress Updates):
```javascript
// Service worker broadcasts to all clients
broadcastProgress(jobId, progress)
  → self.clients.matchAll()
  → client.postMessage({ type: 'CRAWL_PROGRESS', data })

// Popup listens
crawlerAPI.onProgress(callback)
  → navigator.serviceWorker.addEventListener('message')
  → Callback fired on each update
```

### Crawler ↔ Discovery ↔ Extractor

**Crawl Orchestration:**

```javascript
// Crawler coordinates discovery and extraction
CrawlJob.start()
  ↓
1. Discovery: discoverInitialUrls(baseUrl)
   → Returns array of URLs from sitemap
   ↓
2. Crawler: Add URLs to queue
   ↓
3. Worker: processUrl(url)
   ↓
   3a. Discovery: extractLinksFromHtml(html, url, baseUrl)
       → Returns new URLs found on page
       ↓
   3b. Crawler: addToQueue(newUrls)
       → Checks duplicates, adds unique URLs
       ↓
   3c. Extractor: extractContent(html, url)
       → Returns clean Markdown
       ↓
   3d. Storage: savePage(jobId, url, markdown)
       ↓
4. Worker: Pick next URL from queue
   ↓
[Repeat until queue empty]
```

---

## Design Decisions

### Hybrid Architecture (Vanilla JS + React)

**Decision**: Use Vanilla JavaScript for core logic, React for UI

**Rationale**:
- Service workers **cannot use DOM APIs** (no `DOMParser`, no `document`)
- Service workers need to be lightweight and fast
- React provides excellent UI development experience
- Separation of concerns: business logic vs presentation

**Implementation**:
- All crawling logic in pure JS (no dependencies on browser DOM)
- Popup built with modern React stack (TypeScript, Vite, Tailwind)
- Service worker imports ES modules (Manifest V3 supports this)

**Trade-offs**:
- ✅ Service worker compatible
- ✅ Fast background processing
- ✅ Modern UI development
- ❌ Cannot share React components between contexts
- ❌ Need regex-based parsing instead of DOM parsing

### Single Active Crawl Constraint

**Decision**: Only allow one crawl to run at a time

**Rationale**:
- Prevents overwhelming target servers
- Simplifies state management (one global `activeCrawl`)
- Better UX (user focuses on one task)
- Easier error handling and recovery

**Implementation**:
```javascript
let activeCrawl = null;

export async function startCrawl(baseUrl, onProgress) {
  if (activeCrawl) {
    throw new Error('A crawl is already in progress');
  }

  activeCrawl = new CrawlJob(baseUrl);
  crawl.onCompleteCallback = () => { activeCrawl = null; };
  // ...
}
```

**Edge Cases Handled**:
- Crawl completion → clear `activeCrawl`
- Crawl cancellation → clear `activeCrawl`
- Service worker restart → check IndexedDB for interrupted jobs

### Canonical URL Normalization

**Decision**: Normalize all URLs to a canonical form before any operation

**Rationale**:
- Prevents duplicate crawling of same page with different URLs
- Consistent cache lookups
- Reliable deduplication across jobs

**Normalization Rules**:
```javascript
canonicalizeUrl(url):
  1. Protocol → https://
  2. Hostname → lowercase
  3. Remove www. subdomain
  4. Remove trailing slash (except root)
  5. Remove :80/:443 ports
  6. Remove fragments (#section)
  7. Remove query parameters
```

**Examples**:
```
Input:  HTTP://WWW.Example.com/Docs/API/
Output: https://example.com/Docs/API

Input:  https://example.com/page#section?utm=123
Output: https://example.com/page
```

**Impact**:
- All storage uses canonical URLs as keys
- Queue deduplication uses canonical URLs
- Link discovery compares canonical URLs
- Prevents crawling same page multiple times

### Incremental Saving Strategy

**Decision**: Save each page immediately after extraction, not batched

**Rationale**:
- **Crash recovery**: If browser crashes, already-saved pages persist
- **Resume capability**: Can resume from last saved page
- **Memory efficiency**: Don't accumulate pages in memory
- **Real-time feedback**: UI can show pages as they're saved

**Implementation**:
```javascript
async processUrl(url) {
  const html = await fetchUrl(url);
  const links = extractLinksFromHtml(html);
  const markdown = extractContent(html);

  // Save immediately (not batched)
  await savePage(jobId, url, markdown);

  // Continue with next URL
}
```

**Benefits**:
- Survive browser crashes without data loss
- User can view partial results while crawling
- Lower memory footprint
- Simpler error recovery

### Dynamic Queue System

**Decision**: Queue grows dynamically as pages are crawled and new links discovered

**Rationale**:
- Documentation sites often have undocumented pages
- Sitemap.xml may be incomplete or outdated
- Ensures comprehensive coverage

**Flow**:
```
Initial queue: [url1, url2, url3] (from sitemap)
    ↓
Crawl url1 → Find 5 new links
Queue: [url2, url3, url4, url5, url6, url7, url8]
    ↓
Crawl url2 → Find 3 new links (2 duplicates)
Queue: [url3, url4, url5, url6, url7, url8, url9]
    ↓
Continue until queue empty
```

**Implementation**:
- Queue is a simple array: `this.queue = []`
- Workers `shift()` from front
- Discovery `push()` to back
- Deduplication via Set: `completed`, `inProgress`

---

## Threading Model

### Service Worker Thread

**Characteristics**:
- Runs in background, separate from browser tabs
- Survives page navigation and popup close
- No DOM access
- ES modules supported (Manifest V3)

**Lifecycle**:
```
install event → initDB()
activate event → initDB()
message event → handle popup requests
fetch event → (not used)
```

**Active State**:
- Service worker may be terminated by Chrome when idle
- Reactivates on next message
- Crawl state persists in IndexedDB
- Active crawl object is recreated on restart (TODO)

### UI Thread (Popup)

**Characteristics**:
- React app running in popup window
- Can be closed/reopened without affecting crawl
- Full DOM access
- Short-lived (popup closes → UI destroyed)

**Lifecycle**:
```
Popup opens → React mounts → Check active crawl
Popup closes → React unmounts → Crawl continues
Popup reopens → React mounts → Restore progress
```

**State Persistence**:
- No state persists in popup (destroyed on close)
- Re-fetches from service worker on open
- Subscribes to progress broadcasts

### Communication Between Threads

**Protocol**: MessageChannel for request/response, Broadcast for progress

**Request/Response**:
```javascript
// Popup
const response = await sendMessage('GET_JOBS');
// Creates MessageChannel
// Waits for response via port1
// Returns promise

// Service Worker
event.ports[0].postMessage({ type: 'RESPONSE', data });
// Responds via port2
```

**Broadcast (One-to-Many)**:
```javascript
// Service Worker
const clients = await self.clients.matchAll();
clients.forEach(client => {
  client.postMessage({ type: 'CRAWL_PROGRESS', data });
});

// Popup (all instances receive)
navigator.serviceWorker.addEventListener('message', handler);
```

---

## State Management

### Persistent State (IndexedDB)

**Stored in**: `DocumentationCrawlerDB`

**Stores**:
1. **jobs** - Crawl job metadata
   - Status, progress, errors
   - Created/updated timestamps
   - Base URL (canonical and original)

2. **pages** - Extracted page content
   - Markdown content
   - Metadata (size, extraction time)
   - Canonical URL (unique index)

**Persistence**:
- Survives browser restarts
- Survives extension updates
- Survives service worker termination
- User must manually delete

### Runtime State (Service Worker)

**Stored in**: Global variables in `service-worker.js` and `crawler.js`

**Variables**:
- `activeCrawl` - Current CrawlJob instance (or null)
- `CrawlJob.queue` - URLs waiting to be processed
- `CrawlJob.inProgress` - URLs currently being fetched
- `CrawlJob.completed` - URLs successfully processed
- `CrawlJob.failed` - URLs that failed

**Volatility**:
- Lost when service worker terminates (Chrome idle timeout ~30s)
- Recreated from IndexedDB on restart (TODO: not yet implemented)
- Lost on extension reload

### UI State (React)

**Stored in**: React component state (useState hooks)

**State**:
- `activeTab` - Current tab (crawl, jobs, search)
- `expandedJob` - Which job accordion is open
- `selectedPage` - Which page content is being viewed
- `progress` - Real-time crawl progress from service worker
- `jobs` - Cached list of jobs from IndexedDB

**Volatility**:
- Lost when popup closes
- Refetched when popup reopens
- Updated in real-time via message passing

---

## Error Handling Strategy

### Network Errors

**Handling**:
```javascript
try {
  const response = await fetch(url, { signal: abortSignal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    // Timeout after 30s
    this.failed.add(url);
  } else {
    // Network error - retry once
    // If still fails, skip and continue
  }
}
```

**Strategy**:
- Retry once for transient errors
- Log error with URL
- Continue processing other URLs
- Track failed URLs in job.errors array

### Parsing Errors

**HTML Extraction Errors**:
```javascript
try {
  const markdown = extractContent(html, url);
  return markdown;
} catch (error) {
  console.error('Error extracting content:', error);
  // Fallback to basic text extraction
  return '# Error\n\nCould not extract content from this page.';
}
```

**Strategy**:
- Never fail entire crawl for one page
- Return error placeholder
- Log for debugging
- Mark page with partial status

### Storage Errors

**IndexedDB Errors**:
```javascript
try {
  await savePage(jobId, url, content);
} catch (error) {
  console.error('Storage error:', error);
  // Continue crawl but log error
  // Page will be missing from results
}
```

**Strategy**:
- Log storage errors
- Don't crash crawl
- User can retry if needed

### UI Errors

**React Error Boundaries** (TODO):
- Wrap components in error boundary
- Show error UI instead of blank screen
- Allow user to reset state

**Toast for User-Facing Errors**:
```javascript
try {
  await deleteJob(jobId);
  toast({ variant: "success", title: "Job deleted!" });
} catch (err) {
  toast({ variant: "destructive", title: "Delete failed" });
}
```

---

## Performance Considerations

### Rate Limiting

**Implementation**:
- Max 2 concurrent requests (`MAX_CONCURRENT_REQUESTS`)
- 500ms delay between requests (`DELAY_BETWEEN_REQUESTS`)
- 30s timeout per request (`REQUEST_TIMEOUT`)

**Rationale**:
- Be polite to target servers
- Avoid rate limiting (429 responses)
- Prevent browser resource exhaustion

**Calculation**:
```
2 workers × 500ms delay = ~4 pages/second max
For 100 pages: ~25 seconds (ideal)
Real-world: ~30-40 seconds (network latency)
```

### Memory Management

**Strategies**:
1. **Incremental saving** - Don't accumulate in memory
2. **Queue size monitoring** - Track but don't limit
3. **Worker cleanup** - Release references on completion
4. **Popup independence** - UI can close without affecting crawl

**Memory Profile**:
- Active crawl: ~1-2 MB (queue + in-progress + metadata)
- IndexedDB: ~10-20 KB per page
- UI: ~5-10 MB (React + components)

### Storage Efficiency

**Optimization**:
- Store only Markdown (not raw HTML)
- Canonical URLs prevent duplicates
- No binary data (images as URLs only)
- Efficient indexing for fast lookups

**Typical Storage**:
- 100-page documentation site: ~1-2 MB
- 1000-page site: ~10-20 MB
- IndexedDB quota: Usually 50-100+ MB

---

## Security Considerations

### Content Security Policy

**manifest.json**:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

**Implications**:
- No inline scripts allowed
- All scripts must be from extension files
- No eval() or new Function()
- Vite builds compliant bundles

### URL Validation

**All URLs validated before processing**:
```javascript
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

**Prevents**:
- `javascript:` URLs
- `data:` URLs
- `file:` URLs
- Malformed URLs

### XSS Prevention

**Content Display**:
- Markdown displayed in `<pre>` tags (escaped)
- No innerHTML usage
- No dynamic script injection
- URLs opened in new tabs use `window.open()` (safe)

**User Input**:
- URL input validated before crawl
- Search queries escaped in regex
- No user input rendered as HTML

---

## Conclusion

This architecture prioritizes:
1. **Reliability** - Incremental saves, error recovery
2. **Performance** - Rate limiting, efficient storage
3. **Compatibility** - Service worker constraints respected
4. **Maintainability** - Clear separation of concerns
5. **User Experience** - Real-time updates, background operation

For detailed technical specifications of each module, see the specialized documentation in `/docs/`.
