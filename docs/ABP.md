# Agentic Browser Protocol (ABP) Support

**Status:** Production Ready (v4.2.0+)

Webscribe implements the **Agentic Browser Protocol (ABP)**, enabling AI agents to programmatically access all extension capabilities — crawling, content extraction, storage, and export — through a structured `window.abp` interface.

## Table of Contents

- [What is ABP?](#what-is-abp)
- [Quick Start](#quick-start)
- [17 Capabilities Exposed](#17-capabilities-exposed)
  - [Crawl Operations](#crawl-operations)
  - [Storage Operations](#storage-operations)
  - [Content Conversion & Export](#content-conversion--export)
  - [Scraping](#scraping)
  - [Diagnostics](#diagnostics)
  - [Extension Info](#extension-info)
- [Architecture](#architecture)
- [Connecting with MCP Bridge](#connecting-with-mcp-bridge)
- [Testing](#testing)
- [Implementation Details](#implementation-details)

---

## What is ABP?

**ABP (Agentic Browser Protocol)** is a protocol that lets AI agents programmatically interact with web apps and Chrome extensions through structured capabilities. Instead of UI automation (clicking buttons, filling forms), agents call methods like `crawl.start()`, `export.asArchive()`, or `scrape.pickContent()` to access functionality directly.

**Key Principles:**
- **Headless-compatible** — Every capability works with no human present
- **Self-contained** — Each capability accepts parameters and returns complete results in one call
- **Fire-and-poll** — Long-running operations return immediately; agents poll status
- **No delivery mechanisms** — Capabilities return content; agents handle clipboard/downloads/notifications

---

## Quick Start

### 1. Load the Extension with ABP

```bash
# Via MCP Bridge (connects Puppeteer to Chrome extension)
abp_connect({ extensionPath: "/path/to/webscribe" })
```

The bridge:
- Launches Chrome with the extension loaded
- Discovers the extension ID automatically
- Navigates to `chrome-extension://ID/abp-app.html`
- Initializes the ABP session via `window.abp.initialize()`

### 2. Test in Chrome DevTools

```javascript
// 1. Load extension in Chrome (chrome://extensions/)
// 2. Navigate to chrome-extension://ID/abp-app.html
// 3. Open DevTools Console

// Initialize session
const session = await window.abp.initialize({
  agent: { name: 'test', version: '1.0' },
  protocolVersion: '0.1',
  features: {}
});
console.log('Session:', session);

// List capabilities
const caps = await window.abp.listCapabilities();
console.log('Capabilities:', caps);

// Start a crawl
const result = await window.abp.call('crawl.start', {
  urls: 'https://example.com/docs',
  options: { maxWorkers: 3, pageLimit: 10 }
});
console.log('Crawl started:', result);

// Poll status
const status = await window.abp.call('crawl.status', { jobId: result.data.jobId });
console.log('Status:', status);

// Shutdown
await window.abp.shutdown();
```

---

## 17 Capabilities Exposed

### Crawl Operations

#### `crawl.start`
Start a new web crawl. Returns immediately with jobId (fire-and-poll pattern).

**Input:**
```javascript
{
  urls: string | string[],  // URL(s) to crawl
  options?: {
    maxWorkers?: number,         // 1-10, default 5
    pageLimit?: number,          // Max pages per URL
    strictPathMatching?: boolean, // Default true
    skipCache?: boolean,         // Default false
    useIncognito?: boolean,      // Default false
    followExternalLinks?: boolean, // Default false
    maxExternalHops?: number,    // 1-5, default 1
    waitForSelectors?: string[]  // CSS selectors to wait for
  }
}
```

**Output:**
```javascript
{ success: true, data: { jobId: string, status: "started" } }
```

#### `crawl.status`
Get current status/progress of a crawl job.

**Input:** `{ jobId: string }`

**Output:**
```javascript
{
  success: true,
  data: {
    active: boolean,
    jobId: string,
    pagesProcessed: number,
    pagesFound: number,
    queueSize: number,
    inProgress: string[],
    job: { ...jobObject }
  }
}
```

#### `crawl.cancel`
Cancel the active crawl.

**Input:** `{}` (no params)

**Output:** `{ success: true, data: { status: "cancelled" } }`

#### `crawl.resume`
Resume an interrupted crawl job.

**Input:**
```javascript
{
  jobId: string,
  options?: { /* same as crawl.start */ }
}
```

**Output:** `{ success: true, data: { jobId: string, status: "resumed" } }`

---

### Storage Operations

#### `storage.jobs.list`
List all crawl jobs sorted by creation date (newest first).

**Input:** `{}`

**Output:** `{ success: true, data: { jobs: Array<Job> } }`

#### `storage.jobs.get`
Get a specific job by ID.

**Input:** `{ jobId: string }`

**Output:** `{ success: true, data: { job: Job | null } }`

#### `storage.jobs.delete`
Delete one or more jobs and all associated pages.

**Input:** `{ jobIds: string | string[] }`

**Output:** `{ success: true, data: { deleted: number } }`

#### `storage.jobs.update`
Update metadata on a crawl job.

**Input:** `{ jobId: string, updates: Record<string, any> }`

**Output:** `{ success: true, data: { job: Job } }`

#### `storage.pages.list`
Get all pages for a specific crawl job.

**Input:** `{ jobId: string }`

**Output:** `{ success: true, data: { pages: Array<Page> } }`

**Note:** Can return large payloads for jobs with thousands of pages.

#### `storage.pages.search`
Search pages by URL substring across all jobs.

**Input:** `{ query: string }`

**Output:** `{ success: true, data: { pages: Array<Page> } }`

---

### Content Conversion & Export

#### `convert.toFormat`
Convert page content to text, markdown, or HTML with metadata.

**Single Page:**
```javascript
{
  jobId: string,
  pageId: string,
  format: "text" | "markdown" | "html",
  confidenceThreshold?: number,  // 0-1, default 0.5
  includeMetadata?: boolean      // default true
}
```

**Output (single):**
```javascript
{
  success: true,
  data: {
    format: string,
    content: string,
    fallback: boolean,
    reason?: string,
    metadata?: object
  }
}
```

**All Pages:**
```javascript
{
  jobId: string,
  format: "text" | "markdown" | "html",
  confidenceThreshold?: number,
  includeMetadata?: boolean
}
```

**Output (all pages):**
```javascript
{
  success: true,
  data: {
    format: string,
    content: string,  // Concatenated with separators
    pageCount: number,
    fallbackCount: number
  }
}
```

#### `export.asArchive`
Package pages from one or more jobs into a ZIP archive (base64).

**Input:**
```javascript
{
  jobIds: string | string[],
  format: "text" | "markdown",
  confidenceThreshold?: number  // 0-1, default 0.5
}
```

**Output:**
```javascript
{
  success: true,
  data: {
    document: {
      content: string,       // base64 encoded ZIP
      mimeType: "application/zip",
      encoding: "base64",
      size: number,
      filename: string
    }
  }
}
```

---

### Scraping

#### `scrape.pickContent`
Extract content from a specific CSS selector on a URL (programmatic content picker).

**Input:**
```javascript
{
  url: string,
  selector?: string,      // default "body"
  useIncognito?: boolean  // default false
}
```

**Output:**
```javascript
{
  success: true,
  data: {
    url: string,
    title: string,
    html: string,
    markdown: string,
    text: string,
    metadata: {
      selector: string,
      extractedAt: string  // ISO 8601
    }
  }
}
```

**Note:** Creates a tab, extracts content, converts to markdown, closes tab automatically.

---

### Diagnostics

#### `diagnostics.getReport`
Generate comprehensive diagnostic report.

**Input:** `{ format?: "json" | "string" }`  (default "json")

**Output:**
```javascript
{
  success: true,
  data: {
    report: object | string,
    format: "json" | "string"
  }
}
```

#### `diagnostics.getErrors`
Get error logs or error count.

**Input:** `{ countOnly?: boolean }` (default false)

**Output (full):**
```javascript
{ success: true, data: { logs: Array<ErrorLog>, count: number } }
```

**Output (count only):**
```javascript
{ success: true, data: { count: number } }
```

#### `diagnostics.clearErrors`
Clear all error logs.

**Input:** `{}`

**Output:** `{ success: true, data: { cleared: true } }`

---

### Extension Info

#### `extension.getInfo`
Get extension metadata, version, and storage usage.

**Input:** `{}`

**Output:**
```javascript
{
  success: true,
  data: {
    name: string,
    version: string,
    manifestVersion: number,
    extensionId: string,
    storageUsage?: {
      usage: number,
      quota: number,
      usagePercentage: number
    }
  }
}
```

---

## Architecture

Webscribe uses a **hybrid architecture** for ABP:

```
ABP Runtime (abp-app.html + abp-runtime.js)
  |
  |-- [Message Protocol] --> Service Worker (for stateful operations)
  |     |-- crawl.start/status/cancel/resume
  |     |-- storage.jobs.list/get/delete/update
  |     |-- storage.pages.list/search
  |     |-- diagnostics.getReport/getErrors/clearErrors
  |
  |-- [Direct Utility Functions] --> Export utils (for formatting)
  |     |-- convert.toFormat → formatting functions
  |     |-- export.asArchive → JSZip + formatting
  |
  |-- [Direct chrome.* APIs] --> Chrome Extension APIs
        |-- scrape.pickContent → chrome.tabs, chrome.scripting
        |-- extension.getInfo → chrome.runtime.getManifest()
```

**Why Hybrid?**
- Service worker owns crawl orchestration (singleton state, tab pool, debugger)
- Export-utils are pure functions (no shared state, wasteful to proxy through service worker)
- Direct chrome.* APIs avoid unnecessary message passing

---

## Connecting with MCP Bridge

The ABP MCP Bridge provides an MCP server that connects to the extension:

```javascript
// MCP configuration
{
  "mcpServers": {
    "webscribe": {
      "command": "npx",
      "args": ["@anthropic/abp-mcp-bridge"],
      "env": {
        "EXTENSION_PATH": "/path/to/webscribe"
      }
    }
  }
}
```

**Bridge handles:**
- Launching Chrome with `--load-extension`
- Discovering extension ID from service worker URL
- Navigating to `chrome-extension://ID/abp-app.html`
- Calling `initialize()` and `listCapabilities()`
- Exposing MCP tools for each capability

**Agent workflow:**
```
1. Agent calls abp_connect() → Bridge launches Chrome
2. Agent calls abp_call({ capability: "crawl.start", params: {...} })
3. Bridge routes to window.abp.call("crawl.start", {...})
4. Result returned to agent
```

---

## Testing

### Manual Testing (DevTools)

```javascript
// 1. Load extension: chrome://extensions/ → Load unpacked
// 2. Navigate to chrome-extension://ID/abp-app.html
// 3. Open DevTools Console

// Test sequence
console.log(window.abp);  // Verify object exists

const session = await window.abp.initialize({
  agent: { name: 'test' },
  protocolVersion: '0.1',
  features: {}
});
console.log('Session:', session);

const caps = await window.abp.listCapabilities();
console.log('Capabilities:', caps.length);  // Should be 17

const info = await window.abp.call('extension.getInfo');
console.log('Info:', info);

const jobs = await window.abp.call('storage.jobs.list');
console.log('Jobs:', jobs);

// Test scraping
const scrape = await window.abp.call('scrape.pickContent', {
  url: 'https://example.com',
  selector: 'h1'
});
console.log('Scraped:', scrape);

await window.abp.shutdown();
```

### Automated Testing (Puppeteer)

```javascript
import puppeteer from 'puppeteer';

const extensionPath = '/path/to/webscribe';

const browser = await puppeteer.launch({
  headless: true,
  args: [
    `--load-extension=${extensionPath}`,
    `--disable-extensions-except=${extensionPath}`
  ]
});

// Find extension ID
const targets = await browser.targets();
const extTarget = targets.find(t => t.url().startsWith('chrome-extension://'));
const extId = new URL(extTarget.url()).hostname;

// Navigate to ABP page
const page = (await browser.pages())[0];
await page.goto(`chrome-extension://${extId}/abp-app.html`);

// Wait for window.abp
await page.waitForFunction('typeof window.abp !== "undefined"');

// Test
const result = await page.evaluate(async () => {
  await window.abp.initialize({ agent: { name: 'test' }, protocolVersion: '0.1', features: {} });
  return await window.abp.call('extension.getInfo');
});

console.log('Result:', result);
await browser.close();
```

---

## Implementation Details

### Files

| File | Purpose |
|------|---------|
| `abp-app.html` | ABP entry page (loads vendor libs + runtime) |
| `abp-runtime.js` | Complete ABP implementation (~1,400 lines) |
| `lib/vendor/turndown.js` | HTML→Markdown conversion |
| `lib/vendor/turndown-plugin-gfm.js` | GitHub Flavored Markdown support |
| `lib/vendor/jszip.min.js` | ZIP archive creation |

### Discovery Mechanism

**Chrome extensions use runtime-only discovery** (no static manifest):

1. MCP Bridge navigates to `chrome-extension://ID/abp-app.html`
2. Checks for `window.abp` object
3. Calls `initialize()` to get session info
4. Calls `listCapabilities()` to discover all 17 capabilities
5. Each capability includes `name`, `description`, `available`, `inputSchema`

**No `abp.json` manifest file needed** — capabilities discovered at runtime.

### Response Format

**Success:**
```javascript
{ success: true, data: { ...actualData } }
```

**Error:**
```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human-readable description',
    retryable: boolean
  }
}
```

**Standard Error Codes:**
- `NOT_INITIALIZED` - Call initialize() first
- `UNKNOWN_CAPABILITY` - Capability doesn't exist
- `INVALID_PARAMS` - Parameters don't match schema
- `OPERATION_FAILED` - Handler threw during execution
- `PERMISSION_DENIED` - Browser permission denied
- `TIMEOUT` - Operation exceeded timeout
- `CAPABILITY_UNAVAILABLE` - Capability exists but can't run right now
- `NOT_IMPLEMENTED` - Capability declared but not yet implemented

### Long-Running Operations (Fire-and-Poll)

Crawls can take minutes or hours for large sites. The pattern:

```javascript
// 1. Start crawl (returns immediately)
const start = await window.abp.call('crawl.start', {
  urls: 'https://docs.stripe.com/api'
});
const jobId = start.data.jobId;

// 2. Poll status every 2-5 seconds
const poll = setInterval(async () => {
  const status = await window.abp.call('crawl.status', { jobId });

  console.log(`Progress: ${status.data.pagesProcessed}/${status.data.pagesFound}`);

  if (!status.data.active) {
    clearInterval(poll);
    console.log('Crawl complete!');

    // 3. Get pages
    const pages = await window.abp.call('storage.pages.list', { jobId });
    console.log(`Got ${pages.data.pages.length} pages`);
  }
}, 3000);
```

**Benefits:**
- Agent controls polling cadence
- Crawl state persisted to IndexedDB (nothing lost between polls)
- Agent can detect crashed crawls and resume
- No blocking the agent for hours

### Binary Data Format

Files (ZIP archives) returned as base64:

```javascript
{
  success: true,
  data: {
    document: {
      content: "UEsDBBQAA...",  // base64 encoded
      mimeType: "application/zip",
      encoding: "base64",
      size: 15234,
      filename: "example.com-docs.zip"
    }
  }
}
```

Agent decodes and writes to disk:

```javascript
const result = await window.abp.call('export.asArchive', {
  jobIds: ['job-123'],
  format: 'markdown'
});

const base64 = result.data.document.content;
const buffer = Buffer.from(base64, 'base64');
fs.writeFileSync('export.zip', buffer);
```

---

## Permissions

ABP capabilities use the same permissions as the popup UI:

| Permission | Used By | Purpose |
|------------|---------|---------|
| `storage` | storage.*, crawl.* | IndexedDB access |
| `tabs` | crawl.*, scrape.pickContent | Tab management |
| `scripting` | scrape.pickContent | Script injection for content extraction |
| `debugger` | crawl.* (via tab-fetcher) | CDP for background tab rendering |
| `activeTab` | scrape.pickContent | Current tab context |
| `http://*/*`, `https://*/*` | All capabilities | Cross-origin access |

**Note:** Permissions like `notifications` and `clipboardWrite` are declared (for popup UI) but NOT used by ABP capabilities per the ABP spec (no delivery mechanisms).

---

## Error Handling

All capabilities return structured errors:

```javascript
const result = await window.abp.call('scrape.pickContent', {
  url: 'chrome://extensions'  // Invalid URL
});

// result:
{
  success: false,
  error: {
    code: 'INVALID_PARAMS',
    message: 'URL must start with http:// or https://',
    retryable: false
  }
}
```

**Common error patterns:**
- `INVALID_PARAMS` → Fix parameters and retry
- `OPERATION_FAILED` → Check `retryable` flag
- `NOT_INITIALIZED` → Call `initialize()` first
- `TIMEOUT` → Service worker request timed out (30s), retry or investigate
- `UNKNOWN_CAPABILITY` → Capability name misspelled or doesn't exist

---

## Limitations

1. **Single active crawl** — Only one crawl can run at a time (singleton in service worker)
2. **No pagination** — `storage.pages.list` returns all pages (can be large for 100K+ page crawls)
3. **30-second message timeout** — Service worker messages timeout after 30s (usually sufficient)
4. **HTTP/HTTPS only** — `scrape.pickContent` blocks chrome://, file://, etc.

---

## Development

ABP implementation files are in:
- `abp-app.html` — Entry page (extension root)
- `abp-runtime.js` — Runtime (extension root)
- `specs/260212-01-abp/` — Full implementation context, reviews, fixes

**Modifying capabilities:**
1. Read `specs/260212-01-abp/TODO.md` for architecture decisions
2. Edit `abp-runtime.js`
3. Test via DevTools console (see [Testing](#testing) above)
4. Run automated tests if available

**Adding new capabilities:**
1. Follow the 5-step mapping process (see `specs/260212-01-abp/TODO.md`)
2. Add handler function to `abp-runtime.js`
3. Add case to `call()` router
4. Add to `_getCapabilityList()` with inputSchema
5. Test via DevTools

---

## Reference Documentation

For complete implementation details:
- **`specs/260212-01-abp/TODO.md`** — Full context, feature inventory, capability mapping, architecture decisions
- **`specs/260212-01-abp/IMPLEMENTATION-STATUS.md`** — Implementation status and validation results
- **`specs/260212-01-abp/reviews/FINAL-REPORT.md`** — Comprehensive review from 4 independent auditors

For ABP protocol specifications:
- [ABP Implementation Guide](https://github.com/cloudless/agenticbrowserprotocol/docs/abp-implementation-guide.md)
- [Chrome Extension Guide](https://github.com/cloudless/agenticbrowserprotocol/docs/chrome-extension-guide.md)

---

**Status:** Production ready. All 17 capabilities fully implemented, tested, and reviewed.
