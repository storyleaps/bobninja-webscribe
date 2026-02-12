# ABP Implementation for Webscribe - Full Context & TODO

> **Purpose**: This file preserves ALL context from the planning session so a fresh Claude session can continue implementation without losing any decisions, mappings, or architectural choices.

## Table of Contents

1. [What is ABP?](#1-what-is-abp)
2. [ABP Core Principles](#2-abp-core-principles)
3. [Chrome Extension ABP Specifics](#3-chrome-extension-abp-specifics)
4. [Reference Documentation](#4-reference-documentation)
5. [Completed Work](#5-completed-work)
6. [Feature Inventory Summary](#6-feature-inventory-summary)
7. [Capability Mapping (17 Capabilities)](#7-capability-mapping-17-capabilities)
8. [Convergence Analysis](#8-convergence-analysis)
9. [Features NOT Exposed as Capabilities](#9-features-not-exposed-as-capabilities)
10. [Architecture Decision](#10-architecture-decision)
11. [Long-Running Operations Design](#11-long-running-operations-design)
12. [Key Source Files Reference](#12-key-source-files-reference)
13. [Delivery Mechanisms to Strip](#13-delivery-mechanisms-to-strip)
14. [TODO - Implementation Steps](#14-todo---implementation-steps)
15. [TODO - Review & Validation](#15-todo---review--validation)

---

## 1. What is ABP?

**ABP (Agentic Browser Protocol)** is a protocol that lets AI agents programmatically interact with web apps and Chrome extensions through structured capabilities. The consumer is a **program** (AI agent), not a person sitting in front of a browser.

The extension exposes a `window.abp` object on a dedicated HTML page (`abp-app.html`). An MCP Bridge (Puppeteer-based) connects to this page, calls `initialize()`, discovers capabilities via `listCapabilities()`, and then invokes them via `call(capabilityName, params)`.

## 2. ABP Core Principles

These are NON-NEGOTIABLE rules from the ABP spec:

1. **The Headless Test**: Every capability must produce a complete, usable result for a program with no human present. No dialogs, downloads, clipboard writes, notifications, or any delivery mechanisms.

2. **Delivery vs. Content Production**: Capabilities produce content; the agent handles delivery. Strip ALL `navigator.clipboard`, `<a download>`, `chrome.notifications`, `chrome.windows.create()`, `window.print()`, `navigator.share()`, file pickers, etc.

3. **Self-Containment**: Every capability is stateless. Receives input parameters, does work, returns output — all in a single call. No requiring the agent to call other capabilities first to "set up" state.

4. **No UI Driving**: Don't expose `ui.navigate`, `ui.switchView`. Data capabilities should work regardless of UI state.

5. **Response Format**:
   - Success: `{ success: true, data: { ... } }`
   - Error: `{ success: false, error: { code: 'ERROR_CODE', message: '...', retryable: bool } }`
   - Binary: `{ success: true, data: { document: { content, mimeType, encoding, size, filename } } }`

6. **`listCapabilities()` returns a PLAIN ARRAY** (NOT wrapped in `{ success, data }` envelope). The bridge iterates the result directly.

7. **Standard Error Codes**: `NOT_INITIALIZED`, `UNKNOWN_CAPABILITY`, `INVALID_PARAMS`, `OPERATION_FAILED`, `PERMISSION_DENIED`, `CAPABILITY_UNAVAILABLE`, `TIMEOUT`, `NOT_IMPLEMENTED`.

## 3. Chrome Extension ABP Specifics

- Create `abp-app.html` in the extension root — the MCP Bridge navigates to `chrome-extension://ID/abp-app.html`
- Create `abp-runtime.js` loaded via `<script>` in `abp-app.html`
- **No `<link rel="abp-manifest">` needed** — discovery is runtime-only
- **No `abp.json` manifest file needed** — capabilities discovered via `initialize()` + `listCapabilities()`
- The `abp-app.html` page runs in the extension context with full `chrome.*` API access
- `window.abp` must be defined when the page loads (synchronous script, not async)
- The `window.abp` object has: `protocolVersion`, `app`, `initialized`, `sessionId`, `initialize()`, `shutdown()`, `call()`, `listCapabilities()`

## 4. Reference Documentation

**ABP specs (READ THESE before implementing):**
- `/Users/nicolasdao/Documents/projects/cloudless/agenticbrowserprotocol/docs/abp-implementation-guide.md` — Core fundamentals (Sections 1, 7, 8 are critical)
- `/Users/nicolasdao/Documents/projects/cloudless/agenticbrowserprotocol/docs/chrome-extension-guide.md` — Chrome extension specifics

**Project docs (DO NOT read files under `specs/` or `docs/manual/`):**
- `docs/GOTCHAS.md` — MUST read (critical gotchas: width overflow, scroll issues, chunk size)
- `docs/ARCHITECTURE.md`, `docs/STORAGE.md`, `docs/CAPTURER.md`, etc. — available if needed

## 5. Completed Work

| Step | Status | What Was Done |
|---|---|---|
| **Step 1 — Feature Inventory** | DONE | Read ALL source files. Identified 94 features across 7 categories (Capture 25, Content Extraction 7, Storage 13, Export 14, UI 20, Diagnostics 8, Lifecycle 7). Documented every code path, delivery mechanism, and library used. |
| **Step 2 — Capability Mapping** | DONE | Mapped 94 features to 17 ABP capabilities. Performed convergence analysis (14 export features → 2 capabilities). Identified 12 feature categories NOT to expose. Made architecture decision (hybrid: message protocol + direct imports). Designed fire-and-poll pattern for long-running crawls. |
| **Step 3 — Implementation** | DONE | Created `abp-app.html` (loads vendor libs + runtime), `abp-runtime.js` (1323 lines, all 17 capabilities), copied JSZip to vendor. No manifest changes needed. |
| **Step 4 — Review Against Inventory** | DONE | 17/17 capabilities verified, all convergence cases confirmed, zero forbidden patterns. See `step4-review.md`. |
| **Step 5 — Validate Against Checklists** | DONE | 34/34 checks pass. Extension setup, runtime, headless test, self-containment, data quality, consistency. See `step5-validation.md`. |

## 6. Feature Inventory Summary

### Service Worker Message Protocol (16 message types)

**Crawl:** `START_CRAWL`, `CANCEL_CRAWL`, `RESUME_CRAWL`, `GET_CRAWL_STATUS`
**Jobs:** `GET_JOBS`, `GET_JOB`, `DELETE_JOB`, `UPDATE_JOB`, `GET_PAGES`, `SEARCH`
**Errors:** `GET_ERROR_LOGS`, `GET_ERROR_COUNT`, `CLEAR_ERROR_LOGS`, `GENERATE_ERROR_REPORT`, `LOG_ERROR`
**Content Picker:** `START_CONTENT_PICKER`, `SAVE_PICKED_CONTENT`
**Broadcast:** `CRAWL_PROGRESS`, `SERVICE_WORKER_UPDATED`

### Chrome APIs Used

| API | Permission | Used By |
|---|---|---|
| `chrome.tabs.query/update/create/remove` | `tabs`, `activeTab` | CrawlTab, tab-fetcher.js |
| `chrome.scripting.executeScript` | `scripting` | service-worker.js, content picker |
| `chrome.debugger.attach/sendCommand` | `debugger` | tab-fetcher.js |
| `chrome.runtime.sendMessage/getManifest` | Built-in | Popup, service-worker.js |
| `chrome.windows.create/get` | Built-in | tab-fetcher.js, PageContentViewer |
| `chrome.notifications.create` | `notifications` | service-worker.js (content picker) |
| `chrome.storage.local.get/set/remove` | `storage` | Multiple |
| `chrome.extension.isAllowedIncognitoAccess` | Built-in | tab-fetcher.js |

### Libraries

- **Turndown** (vendor, `lib/vendor/turndown.js`) — HTML→Markdown
- **Turndown GFM Plugin** (vendor, `lib/vendor/turndown-plugin-gfm.js`) — GFM tables/strikethrough
- **JSZip** (npm, popup) — ZIP archive creation
- **Marked** (npm, popup) — Markdown→HTML rendering
- **Web Crypto API** (browser) — SHA-256 for content dedup

## 7. Capability Mapping (17 Capabilities)

### 1. `crawl.start`
- **Description**: Start a new web crawl. Returns immediately with jobId (fire-and-poll).
- **Input**: `{ urls: string|string[], options?: { maxWorkers?: number(1-10, default 5), pageLimit?: number, strictPathMatching?: boolean(true), skipCache?: boolean(false), useIncognito?: boolean(false), followExternalLinks?: boolean(false), maxExternalHops?: number(1-5, default 1), waitForSelectors?: string[] } }`
- **Output**: `{ success: true, data: { jobId: string, status: "started" } }`
- **Code Path**: Service worker message `START_CRAWL` → `handleStartCrawl()` → `crawler.js:startCrawl()` → `CrawlJob.start()`
- **Communication**: Message protocol to service worker

### 2. `crawl.status`
- **Description**: Get current status/progress of a crawl job. Merges live + persisted state.
- **Input**: `{ jobId: string }`
- **Output**: `{ success: true, data: { active: boolean, jobId, pagesProcessed, pagesFound, queueSize, inProgress: string[], job: {...} } }`
- **Code Path**: `GET_CRAWL_STATUS` → `getActiveCrawl()` + `GET_JOB` → `getJob(jobId)`
- **Communication**: Message protocol to service worker

### 3. `crawl.cancel`
- **Description**: Cancel the active crawl.
- **Input**: `{}` (no params, cancels the singleton active crawl)
- **Output**: `{ success: true, data: { status: "cancelled" } }`
- **Code Path**: `CANCEL_CRAWL` → `cancelActiveCrawl()` → sets `isCancelled = true`
- **Communication**: Message protocol to service worker

### 4. `crawl.resume`
- **Description**: Resume an interrupted crawl job.
- **Input**: `{ jobId: string, options?: { maxWorkers?, pageLimit?, strictPathMatching?, skipCache?, useIncognito?, followExternalLinks?, maxExternalHops? } }`
- **Output**: `{ success: true, data: { jobId: string, status: "resumed" } }`
- **Code Path**: `RESUME_CRAWL` → `resumeCrawl()` → loads existing job + completed pages → `CrawlJob.resumeStart()`
- **Communication**: Message protocol to service worker

### 5. `storage.jobs.list`
- **Description**: List all crawl jobs, sorted by creation date (newest first).
- **Input**: `{}`
- **Output**: `{ success: true, data: { jobs: Array<{id, baseUrl, baseUrls, status, pagesFound, pagesProcessed, pagesFailed, createdAt, updatedAt, errors}> } }`
- **Code Path**: `GET_JOBS` → `getAllJobs()`
- **Communication**: Message protocol to service worker

### 6. `storage.jobs.get`
- **Description**: Get a specific job by ID.
- **Input**: `{ jobId: string }`
- **Output**: `{ success: true, data: { job: {...}|null } }`
- **Code Path**: `GET_JOB` → `getJob(jobId)`
- **Communication**: Message protocol to service worker

### 7. `storage.jobs.delete`
- **Description**: Delete one or more jobs and all associated pages.
- **Input**: `{ jobIds: string|string[] }`
- **Output**: `{ success: true, data: { deleted: number } }`
- **Code Path**: `DELETE_JOB` → `deleteJob(jobId)` (loop for arrays)
- **Note**: Existing protocol handles single ID; ABP handler iterates for arrays
- **Communication**: Message protocol to service worker

### 8. `storage.jobs.update`
- **Description**: Update metadata on a crawl job.
- **Input**: `{ jobId: string, updates: Record<string, any> }`
- **Output**: `{ success: true, data: { job: {...updatedJob} } }`
- **Code Path**: `UPDATE_JOB` → `updateJob(jobId, updates)`
- **Note**: Existing handler returns status message; ABP handler must return full updated job
- **Communication**: Message protocol to service worker

### 9. `storage.pages.list`
- **Description**: Get all pages for a specific crawl job.
- **Input**: `{ jobId: string }`
- **Output**: `{ success: true, data: { pages: Array<{id, url, canonicalUrl, jobId, content, html, markdown, markdownMeta, metadata, contentHash, alternateUrls, status, extractedAt}> } }`
- **Code Path**: `GET_PAGES` → `getPagesByJobId(jobId)`
- **Note**: Can return megabytes for large crawls
- **Communication**: Message protocol to service worker

### 10. `storage.pages.search`
- **Description**: Search pages by URL substring across all jobs.
- **Input**: `{ query: string }`
- **Output**: `{ success: true, data: { results: Array<{id, url, canonicalUrl, jobId, content, contentLength, metadata, ...}> } }`
- **Code Path**: `SEARCH` → `searchPages(query)` (full table scan)
- **Communication**: Message protocol to service worker

### 11. `convert.toFormat`
- **Description**: Format page content as text/markdown/html with metadata. Handles single page or all pages.
- **Input**: `{ jobId: string, pageId?: string, format: "text"|"markdown"|"html", confidenceThreshold?: number(0-1, default 0.5), includeMetadata?: boolean(true) }`
- **Output (single page)**: `{ success: true, data: { format, content, fallback: boolean, reason?, metadata? } }`
- **Output (all pages)**: `{ success: true, data: { format, content, pageCount, fallbackCount } }`
- **Code Path**: Get pages via message protocol, then locally call `getContentForFormat()`, `formatConcatenatedMarkdown()`, `formatConcatenatedContent()`, `formatMarkdownWithMetadata()`
- **Communication**: Message protocol for data retrieval + **direct import** of export-utils for formatting

### 12. `export.asArchive`
- **Description**: Package pages into a ZIP archive as base64 binary.
- **Input**: `{ jobIds: string|string[], format: "text"|"markdown", confidenceThreshold?: number(0.5) }`
- **Output**: `{ success: true, data: { document: { content: base64, mimeType: "application/zip", encoding: "base64", size: number, filename: string } } }`
- **Code Path**: Get data via message protocol, then locally use `sanitizeFileName()`, `getDomainFileName()`, `getContentForFormat()`, `formatMarkdownWithMetadata()`, JSZip for ZIP creation, convert to base64
- **Communication**: Message protocol for data + **direct import** of export-utils + JSZip

### 13. `scrape.pickContent`
- **Description**: Extract content from a CSS selector on a URL (programmatic content picker).
- **Input**: `{ url: string, selector?: string("body"), useIncognito?: boolean(false) }`
- **Output**: `{ success: true, data: { url, title, html, markdown, text, metadata } }`
- **Code Path**: New handler that directly uses `chrome.tabs.create()`, `chrome.scripting.executeScript()`, Turndown conversion pipeline. Reuses tab-fetcher rendering approach but targets specific selector.
- **Communication**: **Direct chrome.* API calls** (no service worker message needed)

### 14. `diagnostics.getReport`
- **Description**: Generate comprehensive diagnostic report.
- **Input**: `{ format?: "json"|"string" (default "json") }`
- **Output**: `{ success: true, data: { report: object|string } }`
- **Code Path**: `GENERATE_ERROR_REPORT` → `generateDiagnosticReport()` or `generateDiagnosticReportString()`
- **Communication**: Message protocol to service worker

### 15. `diagnostics.getErrors`
- **Description**: Get error logs or count.
- **Input**: `{ countOnly?: boolean(false) }`
- **Output (full)**: `{ success: true, data: { logs: Array<{...}>, count: number } }`
- **Output (count only)**: `{ success: true, data: { count: number } }`
- **Code Path**: `GET_ERROR_LOGS` → `getAllErrorLogs()` OR `GET_ERROR_COUNT` → `getErrorLogCount()`
- **Communication**: Message protocol to service worker

### 16. `diagnostics.clearErrors`
- **Description**: Clear all error logs.
- **Input**: `{}`
- **Output**: `{ success: true, data: { cleared: true } }`
- **Code Path**: `CLEAR_ERROR_LOGS` → `clearErrorLogs()`
- **Communication**: Message protocol to service worker

### 17. `extension.getInfo`
- **Description**: Extension metadata, version, storage usage.
- **Input**: `{}`
- **Output**: `{ success: true, data: { name, version, manifestVersion, extensionId, serviceWorkerVersion, storageUsage? } }`
- **Code Path**: `chrome.runtime.getManifest()`, `chrome.runtime.id`, storage estimate
- **Communication**: Direct chrome.* API calls + message protocol for storage estimate

## 8. Convergence Analysis

### 14 Export Features → 2 Capabilities

**Into `convert.toFormat`:**
- Copy single page to clipboard (text/markdown/html) — strip clipboard
- Download single page as .md/.txt/.html — strip `<a download>`
- Copy all pages as markdown/text — strip clipboard
- Download all as single .txt/.md file — strip `<a download>`
- Open page in fullscreen window — strip `chrome.windows.create()`

Distinguishing params: `format`, `pageId` (single vs all), `confidenceThreshold`, `includeMetadata`

**Into `export.asArchive`:**
- ZIP all .txt files, ZIP all .md files, ZIP selected jobs .txt/.md

Distinguishing params: `format`, `jobIds`, `confidenceThreshold`

### GET_ERROR_LOGS + GET_ERROR_COUNT → `diagnostics.getErrors`

Single capability with `countOnly` param.

### GET_CRAWL_STATUS + GET_JOB → `crawl.status`

Merged into single response combining live + persisted state.

### Content Picker UI → `scrape.pickContent`

Interactive UI replaced with CSS selector parameter. All UI overlay, clipboard, notifications stripped.

## 9. Features NOT Exposed as Capabilities

1. **Content Picker UI Injection** (`START_CONTENT_PICKER`) — UI-driven, requires human
2. **Save Picked Content** (`SAVE_PICKED_CONTENT`) — internal state transfer
3. **Open in Fullscreen Window** (`chrome.windows.create`) — delivery mechanism
4. **All Clipboard Operations** (`navigator.clipboard.writeText`) — delivery mechanism
5. **All File Downloads** (`Blob + <a download>`) — delivery mechanism
6. **Chrome Notifications** (`chrome.notifications.create`) — delivery mechanism
7. **Force Migration** (`FORCE_MIGRATION`) — destroys all data, too dangerous
8. **DB Init/Migration** (`initDB`, `checkAndMigrate`) — internal lifecycle
9. **Log Error** (`LOG_ERROR`) — internal plumbing
10. **UI Navigation/Tab Switching** — no UI driving
11. **Clipboard Size Checks** (`isClipboardSizeSafe`, `formatBytes`, `calculateContentSize`) — delivery-specific
12. **Toast Notifications** (`useToast()`) — human-facing feedback

## 10. Architecture Decision

### Hybrid: Message Protocol + Direct Imports

```
ABP Runtime (abp-app.html + abp-runtime.js)
    |
    |-- [Message Protocol] --> Service Worker (for stateful operations)
    |       |-- crawl.start/status/cancel/resume
    |       |-- storage.jobs.list/get/delete/update
    |       |-- storage.pages.list/search
    |       |-- diagnostics.getReport/getErrors/clearErrors
    |       |-- extension.getInfo (partial)
    |
    |-- [Direct Import] --> export-utils functions (for pure formatting)
    |       |-- convert.toFormat → getContentForFormat(), formatConcatenated*()
    |       |-- export.asArchive → sanitizeFileName(), getDomainFileName() + JSZip
    |
    |-- [Direct chrome.* APIs] --> scrape.pickContent
            |-- chrome.tabs.create/update/remove
            |-- chrome.scripting.executeScript
            |-- Turndown conversion (needs vendor libs accessible)
```

### Why Hybrid?

1. **Service worker owns crawl orchestration** — singleton `activeCrawl`, tab pool, debugger attachments. Can't import crawler.js directly without creating a disconnected second runtime.
2. **Message protocol is well-defined** — `service-worker-client.ts` has clean async `sendMessage(type, data)` with MessageChannel, timeouts, error propagation.
3. **Export-utils are pure functions** — stateless transformations, no shared state. Sending megabytes through service worker for formatting is wasteful.
4. **IndexedDB should NOT be accessed directly** from `abp-app.html` — risk of version conflicts with service worker migrations.

### Service Worker Messaging Pattern

The ABP runtime needs to implement the same `sendMessage()` pattern as `popup/src/lib/service-worker-client.ts`:
- Create `MessageChannel` for request/response
- Post message via `chrome.runtime.sendMessage()` or `navigator.serviceWorker.controller.postMessage()`
- Handle timeouts (30 seconds)
- Return promise resolving with response data

**IMPORTANT**: The `abp-app.html` page is an extension page, NOT a popup. It communicates with the service worker differently than the popup. Need to verify the correct messaging approach — likely `chrome.runtime.sendMessage()` since it's an extension page talking to the background service worker.

## 11. Long-Running Operations Design

### Fire-and-Poll Pattern for Crawls

```
Agent                          ABP Runtime              Service Worker
  |                                |                         |
  |-- crawl.start(urls, opts) ---->|                         |
  |                                |-- START_CRAWL --------->|
  |                                |<-- { jobId } ----------|
  |<-- { jobId, status: "started" }|                         |
  |                                |                         |
  | (poll every 2-5 seconds)       |                         |
  |                                |                         |
  |-- crawl.status({ jobId }) ---->|                         |
  |<-- { active: true/false,      |                         |
  |      pagesProcessed, ... }    |                         |
  |                                |                         |
  | (when active: false)           |                         |
  |-- storage.pages.list(jobId) -->|                         |
  |<-- { pages: [...] }           |                         |
```

- `crawl.start` returns immediately
- Agent polls `crawl.status` at its own cadence
- ABP runtime does NOT push progress
- Data persisted to IndexedDB on every page completion — nothing lost between polls
- Agent can detect crashed crawl (job status "in_progress" but no active crawl) and resume

## 12. Key Source Files Reference

| File | Relative Path | Role |
|---|---|---|
| Service Worker | `extension/service-worker.js` | Message router, all handlers |
| Crawler | `extension/lib/crawler.js` | CrawlJob class, queue, workers |
| Tab Fetcher | `extension/lib/tab-fetcher.js` | Tab rendering, CDP, content extraction |
| Discovery | `extension/lib/discovery.js` | Sitemap parsing, link extraction |
| Database | `extension/storage/db.js` | IndexedDB CRUD |
| Export Utils | `extension/popup/src/lib/export-utils.ts` | Content formatting (TypeScript) |
| SW Client | `extension/popup/src/lib/service-worker-client.ts` | MessageChannel messaging (TypeScript) |
| Error Logger | `extension/lib/error-logger.js` | Error logging, diagnostic reports |
| Content Picker | `extension/lib/content-picker.js` | Interactive element selector (UI) |
| Extractor | `extension/lib/extractor-simple.js` | Text cleanup |
| Utils | `extension/lib/utils.js` | URL canonicalization, path matching |
| Manifest | `extension/manifest.json` | Permissions, entry points |
| Turndown | `extension/lib/vendor/turndown.js` | HTML→Markdown converter |
| Turndown GFM | `extension/lib/vendor/turndown-plugin-gfm.js` | GFM support |

## 13. Delivery Mechanisms to Strip

Every one of these patterns in the popup code is a delivery mechanism. The ABP handlers must NEVER use them — instead, return the content/data directly.

| Pattern | Locations | ABP Alternative |
|---|---|---|
| `navigator.clipboard.writeText()` | PageContentViewer, JobsTab, SupportPage, content-picker.js | Return content in response |
| `Blob + URL.createObjectURL + <a download>` | PageContentViewer, JobsTab, SupportPage | Return content or base64 binary in response |
| `chrome.notifications.create()` | service-worker.js | Return data in response |
| `chrome.windows.create()` | PageContentViewer (preview window) | Return content in response |
| `window.open()` | PageContentModal, AboutDialog | Return URLs/data in response |

## 14. TODO - Implementation Steps

### Step 3A: Create `abp-app.html` [DONE]

Create the ABP entry page. Per Chrome Extension Guide convention:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Webscribe ABP</title>
</head>
<body>
  <h1>Webscribe ABP Interface</h1>
  <p>This page exposes Webscribe capabilities to AI agents via ABP.</p>
  <script src="abp-runtime.js"></script>
</body>
</html>
```

No `<link rel="abp-manifest">` needed.

### Step 3B: Create service worker messaging utility [DONE]

The ABP runtime needs a `sendMessage(type, data)` function to talk to the service worker. Study `popup/src/lib/service-worker-client.ts` for the pattern, then implement in vanilla JS for `abp-runtime.js`.

Key question to resolve: What's the correct messaging mechanism from an extension page to the service worker?
- Option 1: `chrome.runtime.sendMessage()` (extension internal messaging)
- Option 2: `navigator.serviceWorker.controller.postMessage()` with MessageChannel

Need to verify which one the existing service worker `onMessage` handler listens to. Read `service-worker.js` message listener setup.

### Step 3C: Create `abp-runtime.js` [DONE]

This is the main implementation file. It defines `window.abp` with:

1. **Identity properties**: `protocolVersion: '0.1'`, `app: { id: 'com.nicholasdao.webscribe', name: 'Webscribe', version: '<from manifest>' }`, `initialized: false`, `sessionId: null`

2. **`initialize(params)`**: Returns `{ sessionId, protocolVersion, app, capabilities: [{name, available}...], features: { notifications: false, progress: false, elicitation: false, dynamicCapabilities: false } }`

3. **`shutdown()`**: Resets `initialized` and `sessionId`

4. **`call(capability, params)`**: Switch/router to all 17 capability handlers. Returns `NOT_INITIALIZED` if not initialized, `UNKNOWN_CAPABILITY` for unknown names.

5. **`listCapabilities()`**: Returns **plain array** (not wrapped) with `name`, `description`, `available`, `inputSchema` for each capability.

6. **17 private handler methods**: `_crawlStart`, `_crawlStatus`, `_crawlCancel`, `_crawlResume`, `_storageJobsList`, `_storageJobsGet`, `_storageJobsDelete`, `_storageJobsUpdate`, `_storagePagesList`, `_storagePagesSearch`, `_convertToFormat`, `_exportAsArchive`, `_scrapePickContent`, `_diagnosticsGetReport`, `_diagnosticsGetErrors`, `_diagnosticsClearErrors`, `_extensionGetInfo`

### Step 3D: Implement service-worker-routed capabilities [DONE]

These capabilities send messages to the service worker and return the response:

- `crawl.start` → `START_CRAWL`
- `crawl.status` → `GET_CRAWL_STATUS` + `GET_JOB` (combine responses)
- `crawl.cancel` → `CANCEL_CRAWL`
- `crawl.resume` → `RESUME_CRAWL`
- `storage.jobs.list` → `GET_JOBS`
- `storage.jobs.get` → `GET_JOB`
- `storage.jobs.delete` → `DELETE_JOB` (loop for arrays)
- `storage.jobs.update` → `UPDATE_JOB` (ensure returns full job, not status message)
- `storage.pages.list` → `GET_PAGES`
- `storage.pages.search` → `SEARCH`
- `diagnostics.getReport` → `GENERATE_ERROR_REPORT`
- `diagnostics.getErrors` → `GET_ERROR_LOGS` or `GET_ERROR_COUNT`
- `diagnostics.clearErrors` → `CLEAR_ERROR_LOGS`

### Step 3E: Implement export-utils-based capabilities [DONE]

These need the export-utils functions available in the ABP page context.

**Challenge**: `export-utils.ts` is TypeScript, compiled by Vite into the popup bundle. The ABP page needs these functions in vanilla JS.

**Options**:
1. Rewrite the needed functions in vanilla JS in `abp-runtime.js` (simplest, no build step)
2. Create a separate build target that compiles export-utils for the ABP page
3. Extract shared utility functions into a vanilla JS module under `lib/`

**Functions needed from export-utils.ts**:
- `getContentForFormat(page, format, threshold)` — format selection with fallback
- `formatConcatenatedContent(pages)` — multi-page text concatenation with separators
- `formatConcatenatedMarkdown(pages, threshold)` — multi-page markdown
- `formatMarkdownWithMetadata(page)` — YAML frontmatter + markdown
- `formatMetadataAsYAML(page)` — YAML generation
- `sanitizeFileName(url)` — URL to filename conversion
- `getDomainFileName(baseUrl)` — domain-based filename prefix
- `isMarkdownAvailable(page, threshold)` — confidence check

**For `export.asArchive`**: Also need JSZip. The ABP page would need to load JSZip somehow. Options:
1. Include a vendor copy of JSZip under `lib/vendor/`
2. Load from the popup bundle (complex, not recommended)

### Step 3F: Implement `scrape.pickContent` [DONE]

This is a new handler that uses chrome.* APIs directly from the ABP page:

1. Create a tab: `chrome.tabs.create({ url, active: false })`
2. Wait for page load (listen for `chrome.tabs.onUpdated` with `status: 'complete'`)
3. Execute extraction script: `chrome.scripting.executeScript({ target: { tabId }, func: extractionFunction })`
4. The extraction function targets the CSS selector, clones element, removes noise, converts to markdown via Turndown
5. Clean up: `chrome.tabs.remove(tabId)`
6. Return `{ url, title, html, markdown, text, metadata }`

**Challenge**: Turndown library needs to be accessible in the injected script context. Two approaches:
1. Inject Turndown as a file first, then run extraction
2. Return raw HTML from the page, convert to markdown in the ABP page context (load Turndown in abp-app.html)

Approach 2 is cleaner — return HTML from the tab, then convert in ABP context where Turndown is already loaded.

### Step 3G: Implement `extension.getInfo` [DONE]

Mix of direct API calls and service worker message:
- `chrome.runtime.getManifest()` for name/version
- `chrome.runtime.id` for extension ID
- Service worker message for storage estimate (or use `navigator.storage.estimate()` directly)

### Step 3H: Update `manifest.json` if needed [DONE — No changes needed]

Review if any new permissions are needed. Current permissions: `storage`, `activeTab`, `tabs`, `scripting`, `debugger`, `notifications`, `clipboardWrite`.

The ABP implementation uses the same APIs, so likely no new permissions needed. But verify.

### Step 3I: Test the implementation [NOT STARTED]

1. Load extension in Chrome
2. Navigate to `chrome-extension://ID/abp-app.html`
3. Open DevTools Console
4. Test sequence:
   ```javascript
   console.log(window.abp);
   const session = await window.abp.initialize({ agent: { name: 'test' }, protocolVersion: '0.1', features: {} });
   console.log('Session:', session);
   const caps = await window.abp.listCapabilities();
   console.log('Capabilities:', caps);
   const info = await window.abp.call('extension.getInfo');
   console.log('Info:', info);
   const jobs = await window.abp.call('storage.jobs.list');
   console.log('Jobs:', jobs);
   await window.abp.shutdown();
   ```

## 15. TODO - Review & Validation

### Step 4: Review Against Inventory [NOT STARTED]

For each of the 17 capabilities, verify:
1. Which feature(s) from the inventory does it cover?
2. What parameters reproduce each feature?
3. Does the output match what the original feature produces?
4. Are convergence parameters correct (can reach all code paths)?

### Step 5: Validate Against Checklists [NOT STARTED]

**Extension Setup:**
- [ ] `manifest.json` is valid Manifest V3
- [ ] All required permissions declared
- [ ] `abp-app.html` exists in extension root
- [ ] `abp-runtime.js` loaded via `<script>` in `abp-app.html`

**Runtime:**
- [ ] `window.abp` defined when page loads
- [ ] `initialize()` returns sessionId, protocolVersion, app, capabilities, features
- [ ] `call()` routes to correct handler for each capability
- [ ] `call()` returns `NOT_INITIALIZED` before `initialize()`
- [ ] `call()` returns `UNKNOWN_CAPABILITY` for unknown names
- [ ] `listCapabilities()` returns plain array (NOT `{ success, data }` envelope)
- [ ] `listCapabilities()` includes `inputSchema` for each capability
- [ ] `shutdown()` resets session state

**Headless Test (per capability):**
- [ ] No `alert()`, `confirm()`, `prompt()`
- [ ] No `chrome.notifications.create()`
- [ ] No `navigator.clipboard.*`
- [ ] No `<a download>` / blob URL downloads
- [ ] No `chrome.windows.create()` as output
- [ ] No `window.open()` as output
- [ ] Side effects cleaned up (tabs closed after scrape.pickContent)

**Self-Containment:**
- [ ] Each capability operates on input parameters only
- [ ] No capability requires previous call to set up state
- [ ] `crawl.start` accepts URLs, `scrape.pickContent` accepts URL + selector

**Data Quality:**
- [ ] Return actual data, not status messages
- [ ] Binary content has correct mimeType, encoding
- [ ] Error responses use standard error codes

**Consistency:**
- [ ] All `storage.*` capabilities return data in same shape
- [ ] All `crawl.*` capabilities return data in same shape
- [ ] Error handling consistent across all capabilities

---

## Quick Reference: `listCapabilities()` Response Shape

```javascript
[
  { name: 'crawl.start', description: 'Start a new web crawl for one or more URLs', available: true, inputSchema: {...} },
  { name: 'crawl.status', description: 'Get current status and progress of a crawl job', available: true, inputSchema: {...} },
  { name: 'crawl.cancel', description: 'Cancel the active crawl', available: true, inputSchema: {...} },
  { name: 'crawl.resume', description: 'Resume an interrupted crawl job', available: true, inputSchema: {...} },
  { name: 'storage.jobs.list', description: 'List all crawl jobs sorted by creation date', available: true, inputSchema: {...} },
  { name: 'storage.jobs.get', description: 'Get a specific crawl job by ID', available: true, inputSchema: {...} },
  { name: 'storage.jobs.delete', description: 'Delete one or more jobs and their pages', available: true, inputSchema: {...} },
  { name: 'storage.jobs.update', description: 'Update metadata on a crawl job', available: true, inputSchema: {...} },
  { name: 'storage.pages.list', description: 'Get all pages for a crawl job', available: true, inputSchema: {...} },
  { name: 'storage.pages.search', description: 'Search pages by URL substring', available: true, inputSchema: {...} },
  { name: 'convert.toFormat', description: 'Convert page content to text, markdown, or HTML with metadata', available: true, inputSchema: {...} },
  { name: 'export.asArchive', description: 'Package pages from jobs into a ZIP archive', available: true, inputSchema: {...} },
  { name: 'scrape.pickContent', description: 'Extract content from a specific element on a URL', available: true, inputSchema: {...} },
  { name: 'diagnostics.getReport', description: 'Generate a comprehensive diagnostic report', available: true, inputSchema: {...} },
  { name: 'diagnostics.getErrors', description: 'Get error logs or error count', available: true, inputSchema: {...} },
  { name: 'diagnostics.clearErrors', description: 'Clear all stored error logs', available: true, inputSchema: {...} },
  { name: 'extension.getInfo', description: 'Get extension metadata, version, and storage usage', available: true, inputSchema: {...} }
]
```
