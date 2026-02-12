# Webscribe Extension - ABP Runtime Reference Document

**Version:** 2.14.0 (Service Worker)
**Last Updated:** February 12, 2026
**Purpose:** Complete reference for implementing `abp-runtime.js` — the ABP runtime for the Webscribe extension

---

## Table of Contents

1. [Service Worker Messaging](#service-worker-messaging)
2. [Message Types and Handlers](#message-types-and-handlers)
3. [Export Utils Functions](#export-utils-functions)
4. [Content Extraction](#content-extraction)

---

## Service Worker Messaging

### Messaging Pattern Overview

The Webscribe extension uses a **MessageChannel-based architecture** for popup-to-service-worker communication. This pattern ensures reliable request-response semantics with timeouts and error handling.

### Message Channel Pattern (from service-worker-client.ts)

**File Location:** `/Users/nicolasdao/Documents/projects/storyleaps/bobninja/libs/webscribe/popup/src/lib/service-worker-client.ts`

#### Core sendMessage Function

```typescript
export async function sendMessage(type: MessageType, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('Service worker not available'));
      return;
    }

    // Create message channel for response
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event: MessageEvent<ServiceWorkerResponse>) => {
      if (event.data.type === 'RESPONSE') {
        if (event.data.data.error) {
          reject(new Error(event.data.data.error));
        } else {
          resolve(event.data.data);
        }
      }
    };

    // Send message to service worker
    navigator.serviceWorker.controller.postMessage(
      { type, data } as ServiceWorkerMessage,
      [messageChannel.port2]
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Service worker request timeout'));
    }, 30000);
  });
}
```

**Key Features:**
- Uses `MessageChannel` for bidirectional communication (port1 for listener, port2 sent to service worker)
- Automatic 30-second timeout to prevent hanging requests
- Error handling through response data with `.error` field
- Returns a Promise that resolves with response data or rejects with Error

#### Message Type Definition

```typescript
type MessageType =
  | 'START_CRAWL'
  | 'RESUME_CRAWL'
  | 'CANCEL_CRAWL'
  | 'GET_JOBS'
  | 'GET_JOB'
  | 'DELETE_JOB'
  | 'UPDATE_JOB'
  | 'GET_PAGES'
  | 'SEARCH'
  | 'GET_CRAWL_STATUS'
  | 'GET_ERROR_LOGS'
  | 'GET_ERROR_COUNT'
  | 'CLEAR_ERROR_LOGS'
  | 'GENERATE_ERROR_REPORT'
  | 'START_CONTENT_PICKER'
  | 'SAVE_PICKED_CONTENT';

interface ServiceWorkerMessage {
  type: MessageType;
  data?: any;
}

interface ServiceWorkerResponse {
  type: 'RESPONSE' | 'CRAWL_PROGRESS';
  data: any;
}
```

### Service Worker Message Listener (from service-worker.js)

**File Location:** `/Users/nicolasdao/Documents/projects/storyleaps/bobninja/libs/webscribe/service-worker.js`

#### Message Reception Handler

```javascript
// Lines 106-193 in service-worker.js
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  console.log('Received message:', type, data);

  try {
    switch (type) {
      case 'START_CRAWL':
        await handleStartCrawl(event, data);
        break;

      case 'CANCEL_CRAWL':
        await handleCancelCrawl(event);
        break;

      case 'RESUME_CRAWL':
        await handleResumeCrawl(event, data);
        break;

      case 'GET_JOBS':
        await handleGetJobs(event);
        break;

      case 'GET_JOB':
        await handleGetJob(event, data);
        break;

      case 'DELETE_JOB':
        await handleDeleteJob(event, data);
        break;

      case 'UPDATE_JOB':
        await handleUpdateJob(event, data);
        break;

      case 'GET_PAGES':
        await handleGetPages(event, data);
        break;

      case 'SEARCH':
        await handleSearch(event, data);
        break;

      case 'GET_CRAWL_STATUS':
        await handleGetCrawlStatus(event);
        break;

      case 'FORCE_MIGRATION':
        await handleForceMigration(event);
        break;

      case 'GET_ERROR_LOGS':
        await handleGetErrorLogs(event);
        break;

      case 'GET_ERROR_COUNT':
        await handleGetErrorCount(event);
        break;

      case 'CLEAR_ERROR_LOGS':
        await handleClearErrorLogs(event);
        break;

      case 'GENERATE_ERROR_REPORT':
        await handleGenerateErrorReport(event, data);
        break;

      case 'LOG_ERROR':
        await handleLogError(event, data);
        break;

      case 'START_CONTENT_PICKER':
        await handleStartContentPicker(event);
        break;

      case 'SAVE_PICKED_CONTENT':
        await handleSavePickedContent(event, data);
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    console.error('Error handling message:', type, error);
    sendResponse(event, { error: error.message });
  }
});
```

#### Response Sending Function

```javascript
// Lines 356-370 in service-worker.js
function sendResponse(event, data) {
  // When using MessageChannel, respond via the port
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      type: 'RESPONSE',
      data
    });
  } else if (event.source) {
    // Fallback for direct messaging
    event.source.postMessage({
      type: 'RESPONSE',
      data
    });
  }
}
```

#### Progress Broadcasting (for real-time updates)

```javascript
// Lines 375-386 in service-worker.js
async function broadcastProgress(jobId, progress) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'CRAWL_PROGRESS',
      data: {
        jobId,
        ...progress
      }
    });
  });
}
```

**Usage from popup:**
```typescript
export function onCrawlProgress(callback: (progress: any) => void): () => void {
  const handler = (event: MessageEvent<ServiceWorkerResponse>) => {
    if (event.data.type === 'CRAWL_PROGRESS') {
      callback(event.data.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
```

---

## Message Types and Handlers

### Crawl Operations

#### START_CRAWL

**Handler:** `handleStartCrawl(event, data)` (lines 198-218)

**Input:**
```typescript
{
  baseUrl: string | string[],    // URL(s) to crawl
  options?: {
    // Additional crawl options (optional)
  }
}
```

**Returns:**
```typescript
{
  jobId: string,      // Unique job identifier
  status: 'started'
}
```

**Logic:**
1. Validates `baseUrl` is provided
2. Checks if a crawl is already in progress (throws error if so)
3. Calls `startCrawl(baseUrl, progressCallback, options)` from crawler.js
4. Returns job ID and status
5. Progress updates are broadcast to all connected clients

**Error Handling:** Throws if baseUrl missing or crawl already in progress

---

#### CANCEL_CRAWL

**Handler:** `handleCancelCrawl(event)` (lines 257-260)

**Input:** None (no data required)

**Returns:**
```typescript
{
  status: 'cancelled'
}
```

**Logic:**
1. Calls `cancelActiveCrawl()` from crawler.js
2. Returns cancellation status

---

#### RESUME_CRAWL

**Handler:** `handleResumeCrawl(event, data)` (lines 223-252)

**Input:**
```typescript
{
  jobId: string,     // ID of job to resume
  options?: {
    // Additional options
  }
}
```

**Returns:**
```typescript
{
  jobId: string,
  status: 'resumed'
}
```

**Logic:**
1. Validates `jobId` is provided
2. Checks if a crawl is already in progress (throws if so)
3. Calls `resumeCrawl(jobId, progressCallback, options)` from crawler.js
4. Returns job ID and status
5. Logs errors to error logger

---

### Job Management

#### GET_JOBS

**Handler:** `handleGetJobs(event)` (lines 265-268)

**Input:** None

**Returns:**
```typescript
{
  jobs: Job[]
}
```

**Logic:** Calls `getAllJobs()` from db.js and returns array

---

#### GET_JOB

**Handler:** `handleGetJob(event, data)` (lines 273-277)

**Input:**
```typescript
{
  jobId: string
}
```

**Returns:**
```typescript
{
  job: Job | null
}
```

**Logic:** Calls `getJob(jobId)` from db.js

---

#### DELETE_JOB

**Handler:** `handleDeleteJob(event, data)` (lines 282-286)

**Input:**
```typescript
{
  jobId: string
}
```

**Returns:**
```typescript
{
  status: 'deleted'
}
```

**Logic:** Calls `deleteJob(jobId)` from db.js

---

#### UPDATE_JOB

**Handler:** `handleUpdateJob(event, data)` (lines 291-295)

**Input:**
```typescript
{
  jobId: string,
  updates: Record<string, any>
}
```

**Returns:**
```typescript
{
  status: 'updated'
}
```

**Logic:** Calls `updateJob(jobId, updates)` from db.js

---

### Page Management

#### GET_PAGES

**Handler:** `handleGetPages(event, data)` (lines 300-304)

**Input:**
```typescript
{
  jobId: string
}
```

**Returns:**
```typescript
{
  pages: Page[]
}
```

**Logic:** Calls `getPagesByJobId(jobId)` from db.js

---

#### SEARCH

**Handler:** `handleSearch(event, data)` (lines 309-313)

**Input:**
```typescript
{
  query: string
}
```

**Returns:**
```typescript
{
  results: Page[]
}
```

**Logic:** Calls `searchPages(query)` from db.js with full-text search

---

### Crawl Status & Control

#### GET_CRAWL_STATUS

**Handler:** `handleGetCrawlStatus(event)` (lines 318-332)

**Input:** None

**Returns:**
```typescript
// If crawl is active:
{
  active: true,
  jobId: string,
  pagesProcessed: number,
  pagesFound: number,
  queueSize: number,
  inProgress: string[]  // Array of URLs currently being processed
}

// If no crawl is active:
{
  active: false
}
```

**Logic:**
1. Gets active crawl state from `getActiveCrawl()`
2. Returns detailed crawl statistics or false if inactive

---

### Error Management

#### GET_ERROR_LOGS

**Handler:** `handleGetErrorLogs(event)` (lines 393-396)

**Input:** None

**Returns:**
```typescript
{
  logs: ErrorLog[]
}
```

**Logic:** Calls `getAllErrorLogs()` from db.js

---

#### GET_ERROR_COUNT

**Handler:** `handleGetErrorCount(event)` (lines 401-404)

**Input:** None

**Returns:**
```typescript
{
  count: number
}
```

**Logic:** Calls `getErrorLogCount()` from db.js

---

#### CLEAR_ERROR_LOGS

**Handler:** `handleClearErrorLogs(event)` (lines 409-412)

**Input:** None

**Returns:**
```typescript
{
  status: 'cleared'
}
```

**Logic:** Calls `clearErrorLogs()` from db.js

---

#### GENERATE_ERROR_REPORT

**Handler:** `handleGenerateErrorReport(event, data)` (lines 419-429)

**Input:**
```typescript
{
  format?: 'json' | 'string'  // Default: 'json'
}
```

**Returns:**
```typescript
// For JSON format:
{
  report: DiagnosticReport,
  format: 'json'
}

// For string format:
{
  report: string,
  format: 'string'
}
```

**Logic:**
1. Extracts format from data (defaults to 'json')
2. Calls `generateDiagnosticReportString()` or `generateDiagnosticReport()` from error-logger.js
3. Returns report in requested format

---

### Content Picker

#### START_CONTENT_PICKER

**Handler:** `handleStartContentPicker(event)` (lines 450-497)

**Input:** None

**Returns:**
```typescript
{
  status: 'started',
  tabId?: number,
  error?: string
}
```

**Logic:**
1. Queries for active tab in last focused window
2. Validates tab URL (rejects chrome://, chrome-extension://, about:, file://, etc.)
3. Injects Turndown libraries: `lib/vendor/turndown.js`, `lib/vendor/turndown-plugin-gfm.js`
4. Injects content picker script: `lib/content-picker.js`
5. Returns status and tab ID

**Error Cases:** Rejects on no active tab, restricted tab (system URLs), or injection failure

---

#### SAVE_PICKED_CONTENT

**Handler:** `handleSavePickedContent(event, data)` (lines 502-556)

**Input:**
```typescript
{
  url: string,           // Source URL
  title?: string,        // Page title
  html?: string,         // Full HTML
  markdown?: string,     // Converted markdown
  text: string           // Plain text content (required)
}
```

**Returns:**
```typescript
{
  status: 'saved',
  jobId?: string,
  error?: string
}
```

**Logic:**
1. Validates URL and text are provided
2. Canonicalizes URL using `canonicalizeUrl()`
3. Creates new job with `createJob(url, canonicalUrl)`
4. Saves page with metadata and extracted formats
5. Updates job status to 'completed' with page counts
6. Clears `pickedContent` from chrome.storage.local
7. Returns job ID

---

## Export Utils Functions

**File Location:** `/Users/nicolasdao/Documents/projects/storyleaps/bobninja/libs/webscribe/popup/src/lib/export-utils.ts`

### Data Types

#### PageMetadata Interface
```typescript
interface PageMetadata {
  description?: string;
  keywords?: string;
  author?: string;
  generator?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogSiteName?: string;
  articleSection?: string;
  articleTags?: string[];
  canonical?: string;
  jsonLd?: {
    type?: string;
    headline?: string;
    description?: string;
    name?: string;
    author?: string;
  };
}
```

#### MarkdownMeta Interface
```typescript
interface MarkdownMeta {
  confidence: number;           // 0-1 score for markdown quality
  isArticle: boolean;           // Whether content is article-like
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  textLength?: number;
  linkDensity?: number;
  extractionRatio?: number;
  hasStructure?: boolean;
  reason?: string;
  urlHints?: any;
  qualityChecks?: any;
}
```

#### Page Interface
```typescript
interface Page {
  id: string;
  url: string;
  content: string;              // Plain text content
  contentLength: number;
  metadata?: PageMetadata | null;
  markdown?: string | null;     // Markdown version
  markdownMeta?: MarkdownMeta | null;
  alternateUrls?: string[];
  html?: string | null;
}
```

### File Name Functions

#### sanitizeFileName(url: string): string

**Signature:**
```typescript
export function sanitizeFileName(url: string): string
```

**Purpose:** Converts full URL to valid, readable filename

**Logic:**
1. Strip protocol: removes `https://` and `http://`
2. Replace invalid filesystem characters: `<>:"/\|?*` → `_`
3. Replace slashes with hyphens: `/` → `-` (flattens path)
4. Collapse consecutive hyphens/underscores: `[-_]{2,}` → `-`
5. Truncate to 200 characters
6. Remove trailing special characters
7. Return 'page' if empty

**Example:**
- Input: `https://example.com/docs/api-reference`
- Output: `example.com-docs-api-reference`

---

#### getDomainFileName(baseUrl: string): string

**Signature:**
```typescript
export function getDomainFileName(baseUrl: string): string
```

**Purpose:** Creates safe filename from domain + path

**Logic:**
1. Parse URL using URL constructor
2. Extract hostname and remove `www.` prefix
3. Extract pathname, convert `/` to `-`
4. Combine: `{domain}-{path}` or just `{domain}`
5. Sanitize invalid filesystem characters
6. Return 'export' if parsing fails

**Example:**
- Input: `https://www.example.com/docs`
- Output: `example.com-docs`

---

### Format Functions

#### formatMetadata(page: Page): string (Private)

**Purpose:** Formats page metadata as human-readable text

**Logic:**
1. Constructs lines from metadata fields in order:
   - Canonical URL
   - Alternate URLs (slice(1) to skip primary)
   - Title (ogTitle)
   - Description (description or ogDescription)
   - Generator
   - Type (ogType)
   - Keywords, Author, Site Name
   - Article section and tags
   - JSON-LD headline and type
2. Returns formatted string with newlines, empty string if no metadata

---

#### formatConcatenatedContent(pages: Page[]): string

**Signature:**
```typescript
export function formatConcatenatedContent(pages: Page[]): string
```

**Purpose:** Formats multiple pages as concatenated raw text with URL headers

**Output Format:**
```
================================================================================
URL: https://example.com/page1
================================================================================

[page content]

================================================================================
URL: https://example.com/page2
================================================================================

[page content]
```

**Logic:**
1. Maps over each page
2. Creates 80-char separator line
3. Includes URL header and metadata
4. Includes page content
5. Joins multiple pages with newlines

---

#### formatConcatenatedMarkdown(pages: Page[], confidenceThreshold: number = 0.5): string

**Signature:**
```typescript
export function formatConcatenatedMarkdown(
  pages: Page[],
  confidenceThreshold: number = 0.5
): string
```

**Purpose:** Formats multiple pages as markdown with YAML frontmatter, falls back to text

**Logic:**
1. For each page:
   - If markdown available and confidence >= threshold: use `formatMarkdownWithMetadata()`
   - Else: use raw text format with separator
2. Join pages with `\n---\n\n` separator for markdown page breaks

---

#### formatMetadataAsYAML(page: Page): string (Private)

**Purpose:** Converts page metadata to YAML Front Matter format

**Output Format:**
```yaml
---
url: https://example.com
canonical: https://canonical.example.com
title: "Page Title"
description: "Page description"
author: "John Doe"
tags:
  - tag1
  - tag2
---

```

**Logic:**
1. Creates array starting with `---` and url
2. Adds YAML-formatted metadata fields
3. Escapes quotes in string values
4. Handles arrays (tags, alternate_urls) with YAML list syntax
5. Closes with `---`
6. Returns as string with trailing newlines

---

#### formatMarkdownWithMetadata(page: Page): string

**Signature:**
```typescript
export function formatMarkdownWithMetadata(page: Page): string
```

**Purpose:** Combines YAML frontmatter with markdown content

**Output:**
```
[YAML frontmatter from formatMetadataAsYAML]
[markdown content]
```

**Logic:**
1. Calls `formatMetadataAsYAML(page)`
2. Appends `page.markdown` or empty string
3. Returns combined result

---

### Size and Validation Functions

#### calculateContentSize(pages: Page[]): number

**Signature:**
```typescript
export function calculateContentSize(pages: Page[]): number
```

**Purpose:** Calculates total byte size of concatenated content

**Logic:**
1. Calls `formatConcatenatedContent(pages)` to generate full text
2. Creates Blob from string
3. Returns blob.size in bytes

---

#### formatBytes(bytes: number): string

**Signature:**
```typescript
export function formatBytes(bytes: number): string
```

**Purpose:** Converts byte count to human-readable format (B, KB, MB, GB)

**Logic:**
1. Handle zero case: returns '0 Bytes'
2. Uses base-1024 (k=1024) conversion
3. Calculates appropriate unit: `Math.floor(Math.log(bytes) / Math.log(k))`
4. Returns rounded value (2 decimals) with unit

**Examples:**
- 1024 → "1 KB"
- 1048576 → "1 MB"
- 5242880 → "5 MB"

---

#### isClipboardSizeSafe(pages: Page[]): boolean

**Signature:**
```typescript
export function isClipboardSizeSafe(pages: Page[]): boolean
```

**Purpose:** Validates content can be safely copied to clipboard

**Logic:**
1. Calls `calculateContentSize(pages)`
2. Converts to MB: `bytes / (1024 * 1024)`
3. Returns true if size <= 10 MB, false otherwise

**Rationale:** 10MB conservative limit for clipboard stability across browsers

---

### Format Selection Functions

#### getContentForFormat(page: Page, requestedFormat: ContentFormat, confidenceThreshold: number = 0.5): ContentFormatResult

**Signature:**
```typescript
export function getContentForFormat(
  page: Page,
  requestedFormat: ContentFormat,
  confidenceThreshold: number = 0.5
): ContentFormatResult
```

**Where:** `ContentFormat = 'text' | 'markdown' | 'html'`

**Purpose:** Gets content in requested format with fallback logic

**Returns:**
```typescript
interface ContentFormatResult {
  format: ContentFormat;           // Format actually returned
  content: string;                 // The content
  fallback: boolean;               // Whether fallback was used
  reason?: string;                 // 'unavailable', 'low-confidence', 'metadata-missing'
}
```

**Logic:**
1. **For 'html':**
   - If HTML available: return as-is, `fallback: false`
   - Else: return text content, `fallback: true, reason: 'unavailable'`

2. **For 'markdown':**
   - If markdown AND markdownMeta exist:
     - If confidence >= threshold: return markdown, `fallback: false`
     - Else: return text, `fallback: true, reason: 'low-confidence'`
   - Else: return text, `fallback: true, reason: 'unavailable'` or `'metadata-missing'`

3. **For 'text':**
   - Always returns content, `fallback: false`

---

#### isMarkdownAvailable(page: Page, confidenceThreshold: number = 0.5): boolean

**Signature:**
```typescript
export function isMarkdownAvailable(
  page: Page,
  confidenceThreshold: number = 0.5
): boolean
```

**Purpose:** Checks if page has quality markdown

**Logic:**
```javascript
return !!(page.markdown && page.markdownMeta && page.markdownMeta.confidence >= confidenceThreshold)
```

---

#### isHtmlAvailable(page: Page): boolean

**Signature:**
```typescript
export function isHtmlAvailable(page: Page): boolean
```

**Purpose:** Checks if page has HTML content

**Logic:**
```javascript
return !!(page.html && page.html.length > 0)
```

---

#### getConfidenceDescription(confidence: number): string

**Signature:**
```typescript
export function getConfidenceDescription(confidence: number): string
```

**Purpose:** Converts numeric confidence score to human description

**Returns:**
- >= 0.8: 'Very High'
- >= 0.6: 'High'
- >= 0.4: 'Medium'
- >= 0.2: 'Low'
- < 0.2: 'Very Low'

---

## Content Extraction

### Tab Fetcher (tab-fetcher.js)

**File Location:** `/Users/nicolasdao/Documents/projects/storyleaps/bobninja/libs/webscribe/lib/tab-fetcher.js`

**Version:** 2.34.0 (Fast mode with incognito support)

**Purpose:** Opens URLs in real browser tabs to execute JavaScript and extract clean text using `document.body.innerText`, with robust multi-signal page load detection.

#### Key Concepts

1. **Tab Pool Management:** Maintains pool of browser tabs for parallel extraction
2. **Load Detection:** Uses multiple signals to detect when content is fully loaded
3. **Incognito Support:** Works with private browsing mode
4. **Tab Logging:** Logs tab creation to `chrome.storage.local` for post-crash debugging

#### Tab Logging Functions

**resetTabSafety():**
```javascript
export function resetTabSafety() {
  totalTabsCreated = 0;
  tabCreationLog = [];
}
```
- Called when starting a new crawl
- Resets global tab counters

**logTabCreation(tabId, url, poolSize):**
- Internal function (lines 23-42)
- Creates timestamp entry with tabId, url, poolSize
- Persists to chrome.storage.local
- Keeps last 100 entries

#### Design Pattern

The tab-fetcher extracts content by:
1. Creating a browser tab with the target URL
2. Waiting for JavaScript to fully execute (multi-signal detection)
3. Extracting text using `document.body.innerText`
4. Cleaning via `extractor-simple.js`
5. Closing the tab

This approach handles JavaScript-heavy sites that would fail with simple HTTP fetches.

---

### Extractor Simple (extractor-simple.js)

**File Location:** `/Users/nicolasdao/Documents/projects/storyleaps/bobninja/libs/webscribe/lib/extractor-simple.js`

**Purpose:** Simple text cleanup for content extracted from `document.body.innerText`

#### extractContent Function

**Signature:**
```javascript
export function extractContent(text, url): string
```

**Parameters:**
- `text` (string): Raw text from `document.body.innerText`
- `url` (string): Source URL (for reference/context)

**Returns:** Cleaned text string

**Logic (Lines 12-38):**

```javascript
export function extractContent(text, url) {
  try {
    let cleaned = text;

    // Remove excessive blank lines (more than 2 consecutive)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace from each line
    cleaned = cleaned.split('\n')
      .map(line => line.trimEnd())
      .join('\n');

    // Trim start and end of entire content
    cleaned = cleaned.trim();

    return cleaned || 'No content extracted from this page.';
  } catch (error) {
    console.error('Error cleaning text content:', error);
    return 'Error: Could not process content from this page.';
  }
}
```

**Cleaning Steps:**
1. **Remove excess blank lines:** Collapses 3+ newlines to 2 newlines (preserves paragraph structure)
2. **Trim line ends:** Removes trailing whitespace from each line
3. **Trim document:** Removes leading/trailing whitespace from entire content
4. **Fallback messages:** Returns error message if extraction fails

**Why Simple?**
- `document.body.innerText` already:
  - Removes `<script>` and `<style>` tags
  - Skips hidden elements
  - Decodes HTML entities
  - Normalizes whitespace in rendered layout
- extractor-simple just provides minimal normalization

**Example:**
```
Input:
"  Hello World   \n\n\n\nThis is text   \n  "

Output:
"Hello World\n\nThis is text"
```

---

## Integration Flow Diagram

```
Popup (sendMessage)
    ↓
MessageChannel.port2 + postMessage
    ↓
Service Worker (self.addEventListener('message'))
    ↓
Handler function (handleStartCrawl, etc.)
    ↓
Call crawler.js, db.js, extractor functions
    ↓
sendResponse via port1.postMessage
    ↓
MessageChannel.port1 handler
    ↓
Promise resolves with response data
```

---

## Key Design Patterns for abp-runtime.js Implementation

### 1. Message Handling Pattern
When implementing ABP runtime message handlers:
- Always extract `{ type, data }` from `event.data`
- Use `sendResponse(event, data)` for replies
- Wrap handlers in try-catch and log errors
- Return promises to allow async operations

### 2. Error Handling
- Always pass `{ error: string }` for failures
- Use `logError()` for persistent error tracking
- Include context object with action, jobId, etc.

### 3. Content Formatting
- Use `formatConcatenatedContent()` for plain text export
- Use `formatConcatenatedMarkdown()` with confidence threshold for markdown
- Check `isClipboardSizeSafe()` before clipboard operations
- Use `getContentForFormat()` for flexible format selection

### 4. Confidence Thresholds
- Default confidence threshold: 0.5 (50%)
- High confidence: >= 0.8 (80%)
- Use `getConfidenceDescription()` for UI labels

### 5. File Naming
- Use `sanitizeFileName()` for individual page exports
- Use `getDomainFileName()` for batch exports (preserve domain context)
- Maximum filename length: 200 chars (after sanitization)

---

## Notes for Implementation

1. **MessageChannel vs direct messaging:** The extension uses MessageChannel because it provides:
   - Separate ports for reliable bidirectional communication
   - Automatic response routing without polling
   - Works better with service worker lifecycle

2. **30-second timeout:** Allows enough time for:
   - Multi-page crawls to queue pages
   - Database operations on large result sets
   - Content extraction from complex pages

3. **Confidence scoring:** Markdown metadata confidence helps determine:
   - Whether to use markdown or fallback to text
   - Export quality indicators
   - Whether to prompt user for manual review

4. **Tab fetcher design:** Uses real tabs (not fetch) because:
   - Executes JavaScript properly
   - Handles SPA frameworks (React, Vue, Angular)
   - More reliable than headless approaches
   - Logs tab creation for debugging

5. **Content extraction:** Two-stage process:
   - `document.body.innerText` for initial text (handles rendering)
   - `extractor-simple.js` for normalization (preserves structure)
   - Keeps it simple to reduce overhead and errors

---

**End of Reference Document**
