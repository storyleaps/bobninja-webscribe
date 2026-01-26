# Storage Documentation

## Table of Contents

- [Storage Documentation](#storage-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [IndexedDB Schema](#indexeddb-schema)
    - [Database Configuration](#database-configuration)
    - [Jobs Store Schema](#jobs-store-schema)
    - [Pages Store Schema](#pages-store-schema)
    - [Error Logs Store Schema](#error-logs-store-schema)
    - [Indexes](#indexes)
  - [API Reference](#api-reference)
    - [Database Initialization](#database-initialization)
      - [`initDB()`](#initdb)
      - [`forceMigration()`](#forcemigration)
      - [`getDBVersion()`](#getdbversion)
      - [`checkAndMigrate()`](#checkandmigrate)
    - [Job Operations](#job-operations)
      - [`createJob(baseUrl, canonicalBaseUrl)`](#createjobbaseurl-canonicalbaseurl)
      - [`getJob(jobId)`](#getjobjobid)
      - [`getAllJobs()`](#getalljobs)
      - [`getJobByBaseUrl(canonicalBaseUrl)`](#getjobbybaseurlcanonicalbaseurl)
      - [`updateJob(jobId, updates)`](#updatejobjobid-updates)
      - [`deleteJob(jobId)`](#deletejob jobid)
    - [Page Operations](#page-operations)
      - [`savePage(jobId, url, canonicalUrl, content, status, html, contentHash)`](#savepagejobid-url-canonicalurl-content-status-html-contenthash)
      - [`getPageByCanonicalUrl(canonicalUrl)`](#getpagebycanonicalurlcanonicalurl)
      - [`getPageByContentHash(jobId, contentHash)`](#getpagebycontenthash jobid-contenthash)
      - [`updatePageAlternateUrls(pageId, newUrl)`](#updatepagealternateurlspageid-newurl)
      - [`getPagesByJobId(jobId)`](#getpagesbyjobidjobid)
      - [`deletePagesByJobId(jobId)`](#deletepagesbyjobidjobid)
      - [`searchPages(query)`](#searchpagesquery)
    - [Utility Operations](#utility-operations)
      - [`getStorageSize()`](#getstoragesize)
    - [Error Log Operations](#error-log-operations)
      - [`saveErrorLog(errorEntry)`](#saveerrorlogerrorentry)
      - [`getAllErrorLogs()`](#getallerrorlogs)
      - [`getErrorLogCount()`](#geterrorlogcount)
      - [`clearErrorLogs()`](#clearerrorlogs)
      - [`cleanupOldErrorLogs()`](#cleanupOlderrorlogs)
  - [Usage Patterns](#usage-patterns)
    - [Creating and Managing a Capture Job](#creating-and-managing-a-capture-job)
    - [Saving Pages During Capture](#saving-pages-during-capture)
    - [Checking for Cached Pages](#checking-for-cached-pages)
    - [Loading Job Data for UI](#loading-job-data-for-ui)
    - [Searching Across All Content](#searching-across-all-content)
  - [Data Integrity](#data-integrity)
    - [Canonical URL Uniqueness](#canonical-url-uniqueness)
    - [Job-Page Relationship](#job-page-relationship)
    - [Orphaned Page Prevention](#orphaned-page-prevention)
  - [Performance Optimizations](#performance-optimizations)
    - [Index Usage](#index-usage)
    - [Query Patterns](#query-patterns)
    - [Batch Operations](#batch-operations)
  - [Storage Limits](#storage-limits)
    - [Browser Quotas](#browser-quotas)
    - [Monitoring Usage](#monitoring-usage)
    - [Cleanup Strategies](#cleanup-strategies)
  - [Migration and Versioning](#migration-and-versioning)
    - [Schema Versioning](#schema-versioning)
    - [Troubleshooting Migrations](#troubleshooting-migrations)
    - [Future Migrations](#future-migrations)

---

## Overview

The storage layer uses **IndexedDB** for persistent, local-first storage of crawl jobs and extracted documentation pages. All data remains on the user's machine with no cloud dependencies.

**File**: `storage/db.js`

**Key Features**:
- Canonical URL deduplication
- **Content-based deduplication using SHA-256 hashing** (v3+)
- **Alternate URLs tracking** for duplicate content (v3+)
- Fast indexed queries
- Full-text search across pages
- Transaction-based operations
- Automatic job-page cascade deletion

---

## IndexedDB Schema

### Database Configuration

```javascript
const DB_NAME = 'DocumentationCrawlerDB';
const DB_VERSION = 6;
const JOBS_STORE = 'jobs';
const PAGES_STORE = 'pages';
const ERROR_LOGS_STORE = 'errorLogs';
```

**Version History**:
- **v1**: Initial schema with unique canonicalUrl constraint
- **v2**: Removed unique constraint on canonicalUrl to allow same URL across multiple jobs
- **v2.4**: Added singleton pattern for database connections, HTML caching, force migration utilities
- **v3**: Added content hash deduplication and alternate URLs tracking
- **v4**: Added metadata support for page head information
- **v5**: Added markdown conversion support with confidence scoring
- **v6**: Added error logs store for diagnostic reporting

### Jobs Store Schema

**Object Store**: `jobs`
**Key Path**: `id`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique job identifier (generated) |
| `baseUrl` | string | First base URL (backward compatibility) |
| `canonicalBaseUrl` | string | First canonical URL (backward compatibility) |
| `baseUrls` | string[] | Array of all base URLs (v2.10+) |
| `canonicalBaseUrls` | string[] | Array of all canonical base URLs (v2.10+) |
| `createdAt` | number | Unix timestamp (milliseconds) |
| `updatedAt` | number | Last update timestamp |
| `status` | string | Job status (see below) |
| `pagesFound` | number | Total unique URLs discovered |
| `pagesProcessed` | number | Pages successfully crawled |
| `pagesFailed` | number | Pages that failed to crawl |
| `errors` | array | Error objects (see below) |

**Status Values**:
- `'pending'` - Job created, not started
- `'in_progress'` - Currently crawling
- `'completed'` - Successfully completed
- `'completed_with_errors'` - Completed but some pages failed
- `'interrupted'` - Crawl was cancelled or crashed
- `'failed'` - Job failed completely

**Error Object Structure**:
```javascript
{
  url: "https://example.com/broken-page",
  canonicalUrl: "https://example.com/broken-page",
  error: "404 Not Found",
  timestamp: 1700000000000
}
```

**Example Job Record (Single URL)**:
```javascript
{
  id: "1700000000000-abc123def",
  baseUrl: "https://docs.stripe.com/api",
  canonicalBaseUrl: "https://docs.stripe.com/api",
  baseUrls: ["https://docs.stripe.com/api"],
  canonicalBaseUrls: ["https://docs.stripe.com/api"],
  createdAt: 1700000000000,
  updatedAt: 1700000100000,
  status: "completed",
  pagesFound: 47,
  pagesProcessed: 45,
  pagesFailed: 2,
  errors: [
    {
      url: "https://docs.stripe.com/api/deprecated",
      canonicalUrl: "https://docs.stripe.com/api/deprecated",
      error: "404 Not Found",
      timestamp: 1700000050000
    }
  ]
}
```

**Example Job Record (Multiple URLs, v2.10+)**:
```javascript
{
  id: "1700000000000-xyz456abc",
  baseUrl: "https://example.com/api",  // First URL
  canonicalBaseUrl: "https://example.com/api",
  baseUrls: [
    "https://example.com/api",
    "https://example.com/sdk",
    "https://example.com/guides"
  ],
  canonicalBaseUrls: [
    "https://example.com/api",
    "https://example.com/sdk",
    "https://example.com/guides"
  ],
  createdAt: 1700000000000,
  updatedAt: 1700000200000,
  status: "completed",
  pagesFound: 125,
  pagesProcessed: 120,
  pagesFailed: 5,
  errors: []
}
```

### Pages Store Schema

**Object Store**: `pages`
**Key Path**: `id`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique page identifier |
| `url` | string | Original discovered URL (primary) |
| `canonicalUrl` | string | Normalized canonical URL (indexed) |
| `jobId` | string | Parent job ID (foreign key) |
| `content` | string | Extracted text content |
| `html` | string\|null | Raw HTML (cached for link extraction, v2.4+) |
| **`contentHash`** | string\|null | **SHA-256 hash of content for deduplication** (v3+) |
| **`alternateUrls`** | array | **Array of URLs serving same content** (v3+) |
| **`metadata`** | object\|null | **Descriptive metadata from page `<head>`** (v4+) |
| `format` | string | Content format (always "markdown") |
| `extractedAt` | number | Unix timestamp of extraction |
| `contentLength` | number | Character count of content |
| `status` | string | Page status ('success', 'failed', 'partial') |
| `conversionWarnings` | array | Warnings from HTML conversion |

**Metadata Object Structure** (v4+):
```javascript
{
  description: "Page description text",
  keywords: "keyword1, keyword2, keyword3",
  author: "Author Name",
  generator: "Mintlify",
  ogTitle: "Social sharing title",
  ogDescription: "Social description",
  ogType: "website",
  ogSiteName: "Site Name",
  articleSection: "Category",
  articleTags: ["tag1", "tag2"],
  canonical: "https://example.com/canonical-url",
  jsonLd: {
    type: "Article",
    headline: "Article headline",
    description: "Description",
    name: "Name",
    author: "Author"
  }
}
```

**Important Notes on Metadata**:
- Only non-null fields are included in the metadata object
- Metadata is **NOT** included in `contentHash` calculation (content-only hashing for deduplication)
- Existing pages crawled before v4 will have `metadata: null`
- Metadata is displayed in all page views and included in all export formats

**Example Page Record** (v4):
```javascript
{
  id: "1700000001000-xyz789ghi",
  url: "https://docs.stripe.com/api/authentication",
  canonicalUrl: "https://docs.stripe.com/api/authentication",
  jobId: "1700000000000-abc123def",
  content: "# Authentication\n\nThe Stripe API uses API keys...",
  html: "<html><body>...</body></html>",
  contentHash: "a3f2c8d1e5b4a7f9c2d6e8b1a4c7f3e9d2a5b8c1f4e7a9c2",  // v3+
  alternateUrls: [  // v3+
    "https://docs.stripe.com/api/authentication",
    "https://docs.stripe.com/api/auth",  // Duplicate content
    "https://stripe.com/docs/api/authentication"  // Another duplicate
  ],
  metadata: {  // v4+
    description: "Learn how to authenticate API requests with Stripe",
    keywords: "API, authentication, keys, security",
    ogTitle: "API Authentication - Stripe Documentation",
    ogSiteName: "Stripe Documentation",
    canonical: "https://docs.stripe.com/api/authentication"
  },
  format: "markdown",
  extractedAt: 1700000001000,
  contentLength: 5432,
  status: "success",
  conversionWarnings: []
}
```

### Error Logs Store Schema

**Object Store**: `errorLogs`
**Key Path**: `id`

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique error log identifier |
| `timestamp` | number | Unix timestamp (milliseconds) |
| `level` | string | Log level (currently always 'error') |
| `source` | string | Error source (see below) |
| `message` | string | Error message |
| `stack` | string\|null | Stack trace (if available) |
| `context` | object | Additional context (URL, jobId, action, etc.) |
| `extensionVersion` | string\|null | Extension version at time of error |
| `userAgent` | string\|null | Browser user agent string |

**Source Values**:
- `'service-worker'` - Errors from background service worker
- `'crawler'` - Errors during crawl operations
- `'tab-fetcher'` - Errors during tab-based content fetching
- `'popup'` - Errors from the popup UI (React errors, uncaught exceptions)
- `'unknown'` - Errors from unidentified sources

**Example Error Log Record**:
```javascript
{
  id: "1700000000000-err123abc",
  timestamp: 1700000000000,
  level: "error",
  source: "crawler",
  message: "Failed to fetch rendered content from https://example.com/page",
  stack: "Error: Failed to fetch...\n    at processUrl (crawler.js:150)\n    ...",
  context: {
    url: "https://example.com/page",
    jobId: "1700000000000-abc123def",
    workerId: 1,
    action: "processUrl",
    timestamp: "2024-01-15T10:30:00.000Z"
  },
  extensionVersion: "2.22.0",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
}
```

**Retention**:
- Error logs are automatically cleaned up after 30 days
- Cleanup runs on error logger initialization
- Manual cleanup available via `clearErrorLogs()`

**Added in**: v6 (v2.22.0)

### Indexes

**Jobs Store Indexes**:

| Index Name | Key Path | Unique | Purpose |
|------------|----------|--------|---------|
| `canonicalBaseUrl` | `canonicalBaseUrl` | No | Find jobs by base URL |
| `status` | `status` | No | Filter by status |
| `createdAt` | `createdAt` | No | Sort by date |

**Pages Store Indexes**:

| Index Name | Key Path | Unique | Purpose |
|------------|----------|--------|---------|
| `canonicalUrl` | `canonicalUrl` | No | Find pages by URL (v2: non-unique) |
| `jobId` | `jobId` | No | Get all pages for a job |
| `status` | `status` | No | Filter by status |
| **`jobId_contentHash`** | **`['jobId', 'contentHash']`** | **No** | **Fast duplicate detection within job** (v3+) |

**Error Logs Store Indexes** (v6+):

| Index Name | Key Path | Unique | Purpose |
|------------|----------|--------|---------|
| `timestamp` | `timestamp` | No | Sort by date, cleanup old logs |
| `source` | `source` | No | Filter by error source |
| `level` | `level` | No | Filter by log level |

**Notes**:
- In v2+, `canonicalUrl` is non-unique, allowing the same URL to exist in multiple jobs
- In v3+, compound index `jobId_contentHash` enables O(1) duplicate content detection within a job
- In v6+, error logs indexes enable efficient filtering and 30-day retention cleanup

---

## API Reference

### Database Initialization

#### `initDB()`

Initialize or open the IndexedDB database using singleton pattern.

**Returns**: `Promise<IDBDatabase>`

**Usage**:
```javascript
const db = await initDB();
```

**Behavior**:
- Uses singleton pattern - returns same connection across calls
- Creates database if doesn't exist
- Creates stores and indexes on first run
- Upgrades schema if version changes
- Automatically handles connection lifecycle

**Singleton Pattern** (v2.4+):
- Only one database connection is maintained
- All operations share the same connection
- Ensures schema consistency across concurrent operations
- Prevents race conditions during migrations

**Called By**:
- Service worker on install/activate
- All storage operations (internally)

---

#### `forceMigration()`

Force database migration by deleting and recreating with latest schema.

**Returns**: `Promise<{success: boolean, message: string}>`

**Usage**:
```javascript
const result = await forceMigration();
// { success: true, message: 'Database recreated successfully' }
```

**Behavior**:
- Closes all existing database connections
- Deletes the old database completely
- Creates new database with current schema (v2)
- **WARNING**: Deletes all stored data!

**Use Cases**:
- Fixing stuck v1 → v2 migrations
- Resolving database corruption
- Manual schema reset

**Added in**: v2.4

---

#### `getDBVersion()`

Get current database version without opening it.

**Returns**: `Promise<number>` - Database version (0 if doesn't exist)

**Usage**:
```javascript
const version = await getDBVersion();
console.log(`Database is v${version}`);
```

**Added in**: v2.4

---

#### `checkAndMigrate()`

Check if database needs migration and trigger it automatically.

**Returns**: `Promise<boolean>` - True if migration was performed

**Usage**:
```javascript
const migrated = await checkAndMigrate();
if (migrated) {
  console.log('Database upgraded successfully');
}
```

**Behavior**:
- Checks current database version
- Closes existing connections if migration needed
- Triggers migration by opening database
- Returns whether migration occurred

**Added in**: v2.4

---

### Job Operations

#### `createJob(baseUrl, canonicalBaseUrl)`

Create a new crawl job.

**Parameters**:
- `baseUrl` (string) - Original user-entered URL
- `canonicalBaseUrl` (string) - Normalized canonical URL

**Returns**: `Promise<Job>` - Created job object

**Usage**:
```javascript
const job = await createJob(
  "https://docs.stripe.com/api",
  "https://docs.stripe.com/api"
);
// → { id: "...", status: "pending", pagesFound: 0, ... }
```

**Implementation Details**:
- Generates unique ID: `Date.now() + random string`
- Sets initial status: `'pending'`
- Sets timestamps: `createdAt` and `updatedAt`
- Initializes counters to 0
- Empty errors array

---

#### `getJob(jobId)`

Get a job by its ID.

**Parameters**:
- `jobId` (string) - Job identifier

**Returns**: `Promise<Job | undefined>` - Job object or undefined if not found

**Usage**:
```javascript
const job = await getJob("1700000000000-abc123def");
if (job) {
  console.log(`Status: ${job.status}, Pages: ${job.pagesProcessed}`);
}
```

---

#### `getAllJobs()`

Get all jobs, sorted by creation date (newest first).

**Returns**: `Promise<Job[]>` - Array of job objects

**Usage**:
```javascript
const jobs = await getAllJobs();
// → [{ id: "...", createdAt: 1700001000 }, { id: "...", createdAt: 1700000000 }]
```

**Sorting**:
- Jobs sorted by `createdAt` descending
- Newest jobs appear first
- Sorting done in-memory after retrieval

---

#### `getJobByBaseUrl(canonicalBaseUrl)`

Find a job by its canonical base URL.

**Parameters**:
- `canonicalBaseUrl` (string) - Canonical base URL to search

**Returns**: `Promise<Job | undefined>` - First matching job or undefined

**Usage**:
```javascript
const existingJob = await getJobByBaseUrl("https://docs.stripe.com/api");
if (existingJob) {
  console.log("Already crawled this URL!");
}
```

**Use Case**:
- Detect duplicate crawls
- Incremental crawl detection
- Cache validation

---

#### `updateJob(jobId, updates)`

Update a job with partial data.

**Parameters**:
- `jobId` (string) - Job identifier
- `updates` (object) - Fields to update

**Returns**: `Promise<Job>` - Updated job object

**Usage**:
```javascript
await updateJob(jobId, {
  status: 'in_progress',
  pagesProcessed: 10,
  pagesFound: 50
});
```

**Behavior**:
- Merges updates with existing job
- Automatically updates `updatedAt` timestamp
- Throws error if job not found

**Common Updates**:
- Progress counters during crawl
- Status changes
- Error additions

---

#### `deleteJob(jobId)`

Delete a job and all its associated pages.

**Parameters**:
- `jobId` (string) - Job identifier

**Returns**: `Promise<boolean>` - True if deleted

**Usage**:
```javascript
await deleteJob("1700000000000-abc123def");
// Job and all its pages are now deleted
```

**Behavior**:
- First deletes all pages for this job
- Then deletes the job record
- Transaction ensures atomicity
- Frees storage space

---

### Page Operations

#### `savePage(jobId, url, canonicalUrl, content, status, html, contentHash, metadata)`

Save or update a page with optional HTML caching, content hash, and metadata.

**Parameters**:
- `jobId` (string) - Parent job identifier
- `url` (string) - Original discovered URL
- `canonicalUrl` (string) - Canonical URL
- `content` (string) - Extracted text content
- `status` (string, optional) - Page status (default: 'success')
- `html` (string|null, optional) - Raw HTML for caching (v2.4+, default: null)
- **`contentHash`** (string|null, optional) - **SHA-256 hash for deduplication** (v3+, default: null)
- **`metadata`** (object|null, optional) - **Descriptive metadata from page head** (v4+, default: null)

**Returns**: `Promise<Page>` - Saved page object

**Usage**:
```javascript
// v4+ with metadata (recommended)
await savePage(
  jobId,
  "https://docs.stripe.com/api/charges",
  "https://docs.stripe.com/api/charges",
  "# Charges\n\nCreate and manage charges...",
  "success",
  "<html><body>...</body></html>",
  "a3f2c8d1e5b4a7f9...",  // Content hash
  {  // Metadata
    description: "Learn about Stripe charges",
    ogTitle: "Charges - Stripe API",
    ogSiteName: "Stripe Documentation"
  }
);

// v3+ with content hash only
await savePage(
  jobId,
  "https://docs.stripe.com/api/charges",
  "https://docs.stripe.com/api/charges",
  "# Charges\n\nCreate and manage charges...",
  "success",
  "<html><body>...</body></html>",
  "a3f2c8d1e5b4a7f9..."
);
```

**Behavior** (v3+):
- Always creates a new page entry for each job
- Same URL can exist in multiple jobs (non-unique `canonicalUrl`)
- Each job gets its own copy of the page
- Initializes `alternateUrls` array with primary URL

**Content Hash** (v3+):
- Enables content-based deduplication
- Used by `getPageByContentHash()` to find duplicates
- Computed using SHA-256 via `computeContentHash()` from utils.js

**HTML Caching** (v2.4+):
- Storing HTML enables skipping tab rendering on recrawls
- Significant performance improvement (~80% faster)
- Optional but recommended for all new pages

---

#### `getPageByContentHash(jobId, contentHash)`

**New in v3**: Get a page by content hash within a specific job.

**Parameters**:
- `jobId` (string) - Job identifier to search within
- `contentHash` (string) - SHA-256 hash of content

**Returns**: `Promise<Page | undefined>` - Page object or undefined

**Usage**:
```javascript
const contentHash = await computeContentHash(cleanedText);
const existingPage = await getPageByContentHash(jobId, contentHash);

if (existingPage) {
  console.log("Duplicate content found!");
  console.log("Same as:", existingPage.url);
  // Update alternateUrls instead of creating new page
  await updatePageAlternateUrls(existingPage.id, newUrl);
}
```

**Purpose**:
- Detect duplicate content within a job
- Enables content-based deduplication
- Uses compound index `jobId_contentHash` for O(1) lookup

**See**: [CAPTURER.md - Content-Based Deduplication](./CAPTURER.md#content-based-deduplication) for usage details.

---

#### `updatePageAlternateUrls(pageId, newUrl)`

**New in v3**: Add an alternate URL to a page's alternateUrls array.

**Parameters**:
- `pageId` (string) - Page identifier
- `newUrl` (string) - Additional URL serving the same content

**Returns**: `Promise<Page>` - Updated page object

**Usage**:
```javascript
// When duplicate content is detected
await updatePageAlternateUrls(existingPage.id, newDuplicateUrl);

// Page alternateUrls array is updated:
// [primaryUrl, newDuplicateUrl]
```

**Behavior**:
- Adds URL to `alternateUrls` array if not already present
- Does not create duplicates in the array
- Initializes array with primary URL if missing (for backward compatibility)

**Purpose**:
- Track all URLs serving identical content
- Provide user visibility into duplicate URLs
- Enable accurate page counting (unique content, not total URLs)

---

#### `getPageByCanonicalUrl(canonicalUrl)`

Get a page by its canonical URL.

**Parameters**:
- `canonicalUrl` (string) - Canonical URL to lookup

**Returns**: `Promise<Page | undefined>` - Page object or undefined

**Usage**:
```javascript
const cached = await getPageByCanonicalUrl("https://example.com/page");
if (cached) {
  console.log("Page already crawled, skipping");
  return;
}
```

**Use Case**:
- Check if page already cached before crawling
- Deduplication across jobs
- Fast cache lookups (indexed)

---

#### `getPagesByJobId(jobId)`

Get all pages for a specific job.

**Parameters**:
- `jobId` (string) - Job identifier

**Returns**: `Promise<Page[]>` - Array of page objects

**Usage**:
```javascript
const pages = await getPagesByJobId(jobId);
console.log(`Job has ${pages.length} pages`);

pages.forEach(page => {
  console.log(`${page.url}: ${page.contentLength} chars`);
});
```

**Performance**:
- Uses `jobId` index for fast lookup
- Returns all matching pages
- No pagination (assumes reasonable page count)

---

#### `deletePagesByJobId(jobId)`

Delete all pages for a job.

**Parameters**:
- `jobId` (string) - Job identifier

**Returns**: `Promise<number>` - Number of pages deleted

**Usage**:
```javascript
const deletedCount = await deletePagesByJobId(jobId);
console.log(`Deleted ${deletedCount} pages`);
```

**Behavior**:
- Called automatically by `deleteJob()`
- Iterates through all pages for job
- Deletes each page individually
- Returns total count

---

#### `searchPages(query)`

Search all pages for a text query.

**Parameters**:
- `query` (string) - Search term (case-insensitive)

**Returns**: `Promise<Page[]>` - Matching pages

**Usage**:
```javascript
const results = await searchPages("authentication");
// → Returns pages where content or URL contains "authentication"
```

**Search Strategy**:
- Loads all pages from database (no pagination)
- Filters in-memory (case-insensitive)
- Searches both `content` and `url` fields
- Returns full page objects (not snippets)

**Performance**:
- Not optimized for huge datasets (1000s of pages)
- Works well for typical documentation sites (< 500 pages)
- Future: Add full-text search index

---

### Utility Operations

#### `getStorageSize()`

Get estimated storage usage.

**Returns**: `Promise<StorageEstimate | null>` - Storage info or null if unavailable

**Usage**:
```javascript
const size = await getStorageSize();
if (size) {
  console.log(`Using ${size.usageMB} MB of ${size.quotaMB} MB`);
}
```

**Return Object**:
```javascript
{
  usage: 2345678,      // bytes
  quota: 52428800,     // bytes
  usageMB: "2.24",     // megabytes (string)
  quotaMB: "50.00"     // megabytes (string)
}
```

**Browser Support**:
- Uses `navigator.storage.estimate()` API
- Returns null if API not available
- Works in Chrome, Firefox, Edge

---

### Error Log Operations

#### `saveErrorLog(errorEntry)`

Save an error log entry.

**Parameters**:
- `errorEntry` (object) - Error entry object with the following fields:
  - `source` (string) - Source of the error
  - `message` (string) - Error message
  - `stack` (string|null) - Stack trace
  - `context` (object) - Additional context
  - `extensionVersion` (string|null) - Extension version
  - `userAgent` (string|null) - Browser user agent

**Returns**: `Promise<ErrorLog>` - Saved error log object

**Usage**:
```javascript
await saveErrorLog({
  source: 'crawler',
  message: 'Failed to fetch page',
  stack: error.stack,
  context: { url: 'https://example.com', jobId: 'abc123' },
  extensionVersion: '2.22.0',
  userAgent: navigator.userAgent
});
```

**Added in**: v6 (v2.22.0)

---

#### `getAllErrorLogs()`

Get all error logs, sorted by timestamp (newest first).

**Returns**: `Promise<ErrorLog[]>` - Array of error log objects

**Usage**:
```javascript
const logs = await getAllErrorLogs();
logs.forEach(log => {
  console.log(`[${log.source}] ${log.message}`);
});
```

**Added in**: v6 (v2.22.0)

---

#### `getErrorLogCount()`

Get the count of error logs.

**Returns**: `Promise<number>` - Number of error logs

**Usage**:
```javascript
const count = await getErrorLogCount();
console.log(`${count} errors logged`);
```

**Added in**: v6 (v2.22.0)

---

#### `clearErrorLogs()`

Clear all error logs.

**Returns**: `Promise<boolean>` - True if cleared

**Usage**:
```javascript
await clearErrorLogs();
console.log('All error logs cleared');
```

**Added in**: v6 (v2.22.0)

---

#### `cleanupOldErrorLogs()`

Delete error logs older than 30 days.

**Returns**: `Promise<number>` - Number of logs deleted

**Usage**:
```javascript
const deleted = await cleanupOldErrorLogs();
console.log(`Cleaned up ${deleted} old error logs`);
```

**Behavior**:
- Uses `timestamp` index for efficient range query
- Deletes entries older than 30 days (configurable via `ERROR_LOG_RETENTION_MS`)
- Called automatically on error logger initialization

**Added in**: v6 (v2.22.0)

---

## Usage Patterns

### Creating and Managing a Crawl Job

```javascript
// 1. Create job
const job = await createJob(
  "https://docs.stripe.com/api",
  "https://docs.stripe.com/api"
);

// 2. Update as crawl progresses
await updateJob(job.id, {
  status: 'in_progress',
  pagesFound: 10
});

await updateJob(job.id, {
  pagesProcessed: 5,
  pagesFound: 15
});

// 3. Mark as complete
await updateJob(job.id, {
  status: 'completed',
  pagesProcessed: 15,
  pagesFailed: 0
});
```

### Saving Pages During Crawl

```javascript
// Check cache first (avoid re-crawling)
const canonicalUrl = canonicalizeUrl(url);
const cached = await getPageByCanonicalUrl(canonicalUrl);

if (cached) {
  console.log("Already have this page");
  return;
}

// Fetch and extract
const html = await fetch(url).then(r => r.text());
const markdown = extractContent(html, url);

// Save immediately (incremental)
await savePage(jobId, url, canonicalUrl, markdown, 'success');

// Update job counter
await updateJob(jobId, {
  pagesProcessed: currentCount + 1
});
```

### Checking for Cached Pages

```javascript
// Before crawling, check if page exists
async function shouldCrawlUrl(url) {
  const canonical = canonicalizeUrl(url);
  const existing = await getPageByCanonicalUrl(canonical);

  if (existing) {
    console.log(`Skipping ${url} - already cached`);
    return false;
  }

  return true;
}
```

### Loading Job Data for UI

```javascript
// Get all jobs for Jobs tab
const jobs = await getAllJobs();
// → Array sorted by newest first

// Get pages for expanded job
const pages = await getPagesByJobId(selectedJobId);
// → All pages for this job

// Display in UI
jobs.forEach(job => {
  console.log(`${job.baseUrl}: ${job.pagesProcessed} pages`);
});
```

### Searching Across All Content

```javascript
// User searches for "authentication"
const results = await searchPages("authentication");

// Display results
results.forEach(page => {
  console.log(`Found in: ${page.url}`);
  const snippet = page.content.substring(0, 200);
  console.log(`Preview: ${snippet}...`);
});
```

---

## Data Integrity

### Canonical URL Uniqueness

**Behavior (v2)**: The `canonicalUrl` field has a **non-unique index** in the pages store.

**Change from v1**: In v1, canonicalUrl was unique (one URL per database). In v2, the unique constraint was removed to allow the same URL to exist in multiple jobs.

**Implications**:
```javascript
// Job 1: Save page
await savePage(job1Id, "https://example.com/page", "https://example.com/page", "...");
// ✅ Created for Job 1

// Job 2: Save same URL
await savePage(job2Id, "https://example.com/page", "https://example.com/page", "...");
// ✅ Created for Job 2 (separate copy)
```

**Benefits**:
- Each job has its own complete copy of pages
- Jobs are independent and self-contained
- Deleting one job doesn't affect pages in other jobs
- Better data isolation

### Job-Page Relationship

**Foreign Key**: `page.jobId` → `job.id`

**Cascade Deletion**:
```javascript
// Deleting a job automatically deletes its pages
await deleteJob(jobId);
// 1. deletePagesByJobId(jobId) called first
// 2. deleteJob(jobId) called second
```

**Orphan Prevention**:
- Pages always have valid `jobId`
- Cannot create page without parent job
- Deleting job cleans up all pages

### Orphaned Page Prevention

**Current Implementation**:
- Manual cascade deletion in `deleteJob()`
- Not database-enforced (IndexedDB limitation)

**Future Improvement**:
- Add cleanup job on startup
- Scan for pages without valid jobId
- Delete orphaned pages

---

## Performance Optimizations

### Index Usage

**Fast Queries**:

```javascript
// ✅ Fast - uses canonicalUrl index
await getPageByCanonicalUrl("https://example.com/page");

// ✅ Fast - uses jobId index
await getPagesByJobId(jobId);

// ✅ Fast - uses canonicalBaseUrl index
await getJobByBaseUrl("https://docs.stripe.com/api");

// ❌ Slow - full table scan
await searchPages("query");
```

**Query Planning**:
- All lookups use indexes when possible
- Search is the only full-scan operation
- Future: Add content index for search

### Query Patterns

**Efficient Patterns**:

```javascript
// ✅ Single indexed lookup
const page = await getPageByCanonicalUrl(url);

// ✅ Batch read with index
const pages = await getPagesByJobId(jobId);

// ❌ Multiple individual lookups in loop
for (const url of urls) {
  const page = await getPageByCanonicalUrl(url); // N queries
}

// ✅ Better: Load all, filter in memory
const allPages = await getPagesByJobId(jobId);
const filtered = allPages.filter(p => urls.includes(p.canonicalUrl));
```

### Batch Operations

**Deleting Multiple Pages**:

```javascript
// Current: Individual deletes in transaction
const transaction = db.transaction(['pages'], 'readwrite');
pages.forEach(page => {
  transaction.objectStore('pages').delete(page.id);
});
```

**Efficient for**:
- < 1000 pages
- Transaction ensures atomicity
- Browser handles batching internally

---

## Storage Limits

### Browser Quotas

**Typical Quotas**:
- Chrome: ~60% of available disk space
- Minimum: Usually 50-100 MB
- Dynamic: Grows with available space

**Checking Quota**:
```javascript
const size = await getStorageSize();
console.log(`${size.usageMB} MB / ${size.quotaMB} MB`);
console.log(`${((size.usage / size.quota) * 100).toFixed(1)}% used`);
```

### Monitoring Usage

**Per-Page Estimate**:
- Average page: 5-20 KB of Markdown
- Metadata: ~500 bytes
- Total: ~6-20 KB per page

**Per-Job Estimate**:
- 100-page docs: ~0.6-2 MB
- 500-page docs: ~3-10 MB
- 1000-page docs: ~6-20 MB

**Display to User**:
```javascript
// In Jobs tab footer
const size = await getStorageSize();
<div>Storage: {size.usageMB} MB used</div>
```

### Cleanup Strategies

**Manual Cleanup**:
```javascript
// Delete old jobs
const jobs = await getAllJobs();
const oldJobs = jobs.filter(j =>
  Date.now() - j.createdAt > 30 * 24 * 60 * 60 * 1000 // 30 days
);

for (const job of oldJobs) {
  await deleteJob(job.id);
}
```

**Future: Automatic Cleanup**:
- LRU eviction when quota exceeded
- User-configurable retention period
- Compress old jobs

---

## Migration and Versioning

### Schema Versioning

**Current Version**: 2

**Version History**:
- **v1** (Initial): Unique canonicalUrl constraint
- **v2** (Current): Non-unique canonicalUrl, allows duplicate URLs across jobs

**Version Handling**:
```javascript
const DB_VERSION = 2;

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  // Version 1: Initial setup
  if (oldVersion < 1) {
    // Create jobs store
    const jobsStore = db.createObjectStore(JOBS_STORE, { keyPath: 'id' });
    jobsStore.createIndex('canonicalBaseUrl', 'canonicalBaseUrl', { unique: false });
    jobsStore.createIndex('status', 'status', { unique: false });
    jobsStore.createIndex('createdAt', 'createdAt', { unique: false });

    // Create pages store (v1 had unique canonicalUrl)
    const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
    pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: true });
    pagesStore.createIndex('jobId', 'jobId', { unique: false });
    pagesStore.createIndex('status', 'status', { unique: false });
  }

  // Version 2: Allow duplicate URLs across jobs
  if (oldVersion < 2 && oldVersion >= 1) {
    // Delete and recreate pages store to change index
    if (db.objectStoreNames.contains(PAGES_STORE)) {
      db.deleteObjectStore(PAGES_STORE);
    }

    // Recreate with non-unique canonicalUrl index
    const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
    pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
    pagesStore.createIndex('jobId', 'jobId', { unique: false });
    pagesStore.createIndex('status', 'status', { unique: false });
  }

  // Version 3: Add content hash deduplication and alternate URLs
  if (oldVersion < 3) {
    // Delete and recreate pages store to add new indexes
    if (db.objectStoreNames.contains(PAGES_STORE)) {
      db.deleteObjectStore(PAGES_STORE);
    }

    // Recreate with content hash index
    const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
    pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
    pagesStore.createIndex('jobId', 'jobId', { unique: false });
    pagesStore.createIndex('status', 'status', { unique: false });
    // Compound index for fast duplicate detection within a job
    pagesStore.createIndex('jobId_contentHash', ['jobId', 'contentHash'], { unique: false });
  }
};
```

**Migration Impact**:
- **v1 → v2**: All existing pages are deleted when upgrading (pages store is recreated)
- **v2 → v3**: All existing pages are deleted when upgrading (pages store is recreated to add new indexes)
- Users will need to re-crawl sites after upgrade
- Jobs metadata is preserved

**Migration Fixes** (v2.4+):
- Singleton pattern prevents schema inconsistencies
- `forceMigration()` closes connections before migration
- Automatic migration check on service worker activation
- Better error messages with migration instructions

### Troubleshooting Migrations

**Symptom**: `ConstraintError: Unable to add key to index 'canonicalUrl'`

**Cause**: Database still using v1 schema with unique constraint

**Solution**:
1. Use `forceMigration()` via service worker message
2. Or manually delete database in Chrome DevTools (Application > IndexedDB)
3. Reload extension to trigger fresh database creation

**Prevention** (v2.4+):
- Singleton pattern ensures consistent schema
- Auto-migration on service worker startup
- Proactive version checks before crawls

### Future Migrations

**Best Practices**:
- Increment `DB_VERSION` for schema changes
- Add migration logic in `onupgradeneeded`
- Test migrations with existing data
- Document version changes
- For index changes, recreate the object store (pages may be lost)

---

## Summary

The storage layer provides:

✅ **Reliable persistence** via IndexedDB
✅ **Fast queries** via strategic indexes
✅ **URL deduplication** via canonical URLs
✅ **Content deduplication** via SHA-256 hashing (v3+)
✅ **Alternate URLs tracking** for duplicate content (v3+)
✅ **Data integrity** via cascade deletion
✅ **Search capability** across all content
✅ **Storage monitoring** for quota management
✅ **Error logging** with 30-day retention for diagnostics (v6+)

For implementation details on how storage is used by the crawler, see [CAPTURER.md](./CAPTURER.md).

For service worker integration, see [SERVICE_WORKER.md](./SERVICE_WORKER.md).
