# Service Worker Documentation

## Table of Contents

- [Service Worker Documentation](#service-worker-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Service Worker Lifecycle](#service-worker-lifecycle)
    - [Install Event](#install-event)
    - [Activate Event](#activate-event)
    - [Lifecycle Flow](#lifecycle-flow)
  - [Message Handling Architecture](#message-handling-architecture)
    - [Message Event Listener](#message-event-listener)
    - [Message Structure](#message-structure)
    - [Handler Dispatch](#handler-dispatch)
  - [Message Types](#message-types)
    - [Capture Operations](#capture-operations)
    - [Job Operations](#job-operations)
    - [Page Operations](#page-operations)
    - [Search Operations](#search-operations)
    - [Error Log Operations](#error-log-operations-v222)
  - [Request/Response Pattern](#requestresponse-pattern)
    - [MessageChannel Protocol](#messagechannel-protocol)
    - [Response Format](#response-format)
    - [Error Responses](#error-responses)
    - [Timeout Handling](#timeout-handling)
  - [Message Handlers](#message-handlers)
    - [START_CRAWL Handler](#start_crawl-handler)
    - [CANCEL_CRAWL Handler](#cancel_crawl-handler)
    - [GET_JOBS Handler](#get_jobs-handler)
    - [GET_JOB Handler](#get_job-handler)
    - [DELETE_JOB Handler](#delete_job-handler)
    - [GET_PAGES Handler](#get_pages-handler)
    - [SEARCH Handler](#search-handler)
    - [GET_CRAWL_STATUS Handler](#get_crawl_status-handler)
  - [Broadcast Pattern](#broadcast-pattern)
    - [Progress Broadcasting](#progress-broadcasting)
    - [Client Matching](#client-matching)
    - [Message Format](#message-format)
  - [Response Mechanism](#response-mechanism)
    - [sendResponse Function](#sendresponse-function)
    - [Port-Based Response](#port-based-response)
    - [Direct Response Fallback](#direct-response-fallback)
  - [Capture Integration](#capture-integration)
    - [Progress Callback](#progress-callback)
    - [Capture Lifecycle](#capture-lifecycle)
    - [Active Capture Management](#active-capture-management)
  - [Storage Integration](#storage-integration)
    - [Database Initialization](#database-initialization)
    - [Job Operations](#job-operations-1)
    - [Page Operations](#page-operations-1)
    - [Search Operations](#search-operations-1)
  - [Error Handling](#error-handling)
    - [Try-Catch Wrapper](#try-catch-wrapper)
    - [Error Response Format](#error-response-format)
    - [Error Logging](#error-logging)
  - [Concurrency Management](#concurrency-management)
    - [Single Active Capture](#single-active-capture)
    - [Concurrent Requests](#concurrent-requests)
    - [State Isolation](#state-isolation)
  - [Client Communication](#client-communication)
    - [Popup to Service Worker](#popup-to-service-worker)
    - [Service Worker to Popup](#service-worker-to-popup)
    - [Multiple Clients](#multiple-clients)
  - [Background Processing](#background-processing)
    - [Persistent Capture](#persistent-capture)
    - [Popup Independence](#popup-independence)
    - [State Persistence](#state-persistence)
  - [Security Considerations](#security-considerations)
    - [Message Validation](#message-validation)
    - [URL Validation](#url-validation)
    - [Data Sanitization](#data-sanitization)
  - [Performance Optimization](#performance-optimization)
    - [Async Operations](#async-operations)
    - [Database Access](#database-access)
    - [Memory Management](#memory-management)
  - [Debugging](#debugging)
    - [Console Logging](#console-logging)
    - [Message Tracing](#message-tracing)
    - [Error Visibility](#error-visibility)

---

## Overview

The service worker acts as the central orchestrator for the Webscribe extension, handling background capture operations and managing communication between the popup UI and core modules.

**File**: `service-worker.js`

**Key Responsibilities**:
- Initialize and manage IndexedDB
- Handle messages from popup
- Coordinate capture operations
- Broadcast progress updates
- Manage storage operations
- Run in background (survives popup close)
- Capture and log errors for diagnostics (v2.22+)

**Key Features**:
- MessageChannel-based request/response
- Broadcast pattern for progress updates
- Single active crawl enforcement
- Persistent background processing

---

## Service Worker Lifecycle

### Install Event

Triggered when service worker is first installed:

```javascript
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(initDB());
});
```

**Actions**:
1. Log installation
2. Initialize IndexedDB
3. Wait for database to be ready

**waitUntil()**:
- Prevents service worker from activating until DB initialized
- Ensures database is ready before handling messages

### Activate Event

Triggered when service worker becomes active:

```javascript
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(initDB());
});
```

**Actions**:
1. Log activation
2. Re-initialize IndexedDB (if needed)
3. Prepare for message handling

**Note**: Database initialized on both install and activate for reliability

### Lifecycle Flow

```
Install → Activate → Ready
   ↓         ↓         ↓
 initDB   initDB   Handle Messages
```

**States**:
- **Installing**: Setting up database
- **Activated**: Ready to handle messages
- **Idle**: Waiting for messages
- **Terminated**: May sleep when inactive
- **Reactivated**: Wakes up on message

---

## Message Handling Architecture

### Message Event Listener

Central message handler:

```javascript
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
      // ... other handlers
      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    console.error('Error handling message:', type, error);
    sendResponse(event, { error: error.message });
  }
});
```

### Message Structure

**Incoming message format**:
```javascript
{
  type: 'MESSAGE_TYPE',
  data: {
    // Message-specific data
  }
}
```

**Message types**: String constants (uppercase with underscores)

**Data**: Object with handler-specific parameters

### Handler Dispatch

**Switch-based routing**:
- `type` field determines handler
- Each handler is an async function
- Receives `event` and `data` parameters
- Unknown types logged as warning

---

## Message Types

### Crawl Operations

| Type | Purpose | Parameters |
|------|---------|------------|
| `START_CRAWL` | Start new crawl | `{ baseUrl }` |
| `CANCEL_CRAWL` | Cancel active crawl | None |
| `GET_CRAWL_STATUS` | Get crawl status | None |

### Job Operations

| Type | Purpose | Parameters |
|------|---------|------------|
| `GET_JOBS` | Get all jobs | None |
| `GET_JOB` | Get specific job | `{ jobId }` |
| `DELETE_JOB` | Delete job | `{ jobId }` |

### Page Operations

| Type | Purpose | Parameters |
|------|---------|------------|
| `GET_PAGES` | Get pages for job | `{ jobId }` |

### Search Operations

| Type | Purpose | Parameters |
|------|---------|------------|
| `SEARCH` | Search all pages | `{ query }` |

### Error Log Operations (v2.22+)

| Type | Purpose | Parameters |
|------|---------|------------|
| `GET_ERROR_LOGS` | Get all error logs | None |
| `GET_ERROR_COUNT` | Get error log count | None |
| `CLEAR_ERROR_LOGS` | Clear all error logs | None |
| `GENERATE_ERROR_REPORT` | Generate diagnostic report | `{ format: 'json' \| 'string' }` |
| `LOG_ERROR` | Log error from external source | `{ source, message, stack, context }` |

---

## Request/Response Pattern

### MessageChannel Protocol

Uses MessageChannel for request/response:

**Client side** (popup):
```javascript
export async function sendMessage(type, data) {
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'RESPONSE') {
        if (event.data.data.error) {
          reject(new Error(event.data.data.error));
        } else {
          resolve(event.data.data);
        }
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type, data },
      [messageChannel.port2]
    );
  });
}
```

**Service worker side**:
```javascript
function sendResponse(event, data) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      type: 'RESPONSE',
      data
    });
  }
}
```

### Response Format

**Success response**:
```javascript
{
  type: 'RESPONSE',
  data: {
    // Handler-specific response data
  }
}
```

**Error response**:
```javascript
{
  type: 'RESPONSE',
  data: {
    error: 'Error message'
  }
}
```

### Error Responses

Errors caught and returned in response:

```javascript
try {
  // Handler logic
} catch (error) {
  console.error('Error handling message:', type, error);
  sendResponse(event, { error: error.message });
}
```

**Client receives**:
- Error message in `data.error` field
- Can differentiate from success responses
- Rejects promise on client side

### Timeout Handling

Client implements timeout (30 seconds):

```javascript
setTimeout(() => {
  reject(new Error('Service worker request timeout'));
}, 30000);
```

**Service worker has no timeout**:
- Long-running operations OK
- Crawl operations can take minutes/hours
- Timeout is client responsibility

---

## Message Handlers

### START_CRAWL Handler

```javascript
async function handleStartCrawl(event, data) {
  const { baseUrl } = data;

  if (!baseUrl) {
    throw new Error('Base URL is required');
  }

  const activeCrawl = getActiveCrawl();
  if (activeCrawl) {
    throw new Error('A crawl is already in progress');
  }

  const jobId = await startCrawl(baseUrl, (progress) => {
    broadcastProgress(jobId, progress);
  });

  sendResponse(event, { jobId, status: 'started' });
}
```

**Validation**:
- Checks `baseUrl` is provided
- Checks no active crawl

**Actions**:
1. Start crawl with progress callback
2. Get job ID
3. Send response with job ID

**Progress callback**: Broadcasts to all clients

### CANCEL_CRAWL Handler

```javascript
async function handleCancelCrawl(event) {
  cancelActiveCrawl();
  sendResponse(event, { status: 'cancelled' });
}
```

**Simple handler**:
- Cancels active crawl
- Returns cancelled status

**No validation**: Safe to call even if no active crawl

### GET_JOBS Handler

```javascript
async function handleGetJobs(event) {
  const jobs = await getAllJobs();
  sendResponse(event, { jobs });
}
```

**Actions**:
1. Fetch all jobs from database
2. Return jobs array

**No parameters**: Returns all jobs

### GET_JOB Handler

```javascript
async function handleGetJob(event, data) {
  const { jobId } = data;
  const job = await getJob(jobId);
  sendResponse(event, { job });
}
```

**Parameters**: `jobId`

**Returns**: Single job object or null

### DELETE_JOB Handler

```javascript
async function handleDeleteJob(event, data) {
  const { jobId } = data;
  await deleteJob(jobId);
  sendResponse(event, { status: 'deleted' });
}
```

**Actions**:
1. Delete job from database
2. Cascade delete pages
3. Return deleted status

**Side effects**: Permanently removes data

### GET_PAGES Handler

```javascript
async function handleGetPages(event, data) {
  const { jobId } = data;
  const pages = await getPagesByJobId(jobId);
  sendResponse(event, { pages });
}
```

**Parameters**: `jobId`

**Returns**: Array of page objects for job

### SEARCH Handler

```javascript
async function handleSearch(event, data) {
  const { query } = data;
  const results = await searchPages(query);
  sendResponse(event, { results });
}
```

**Parameters**: `query` (search string)

**Returns**: Array of matching pages

**Implementation**: Full-text search in IndexedDB

### GET_CRAWL_STATUS Handler

```javascript
async function handleGetCrawlStatus(event) {
  const activeCrawl = getActiveCrawl();
  if (activeCrawl) {
    sendResponse(event, {
      active: true,
      jobId: activeCrawl.jobId,
      pagesProcessed: activeCrawl.completed.size,
      pagesFound: activeCrawl.queue.length + activeCrawl.inProgress.size + activeCrawl.completed.size,
      queueSize: activeCrawl.queue.length,
      inProgress: Array.from(activeCrawl.inProgress)
    });
  } else {
    sendResponse(event, { active: false });
  }
}
```

**Returns**:
- If active: Full crawl status
- If inactive: `{ active: false }`

**Used by**: Popup on mount to check for running crawl

---

## Broadcast Pattern

### Progress Broadcasting

Send progress to all connected clients:

```javascript
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

**Broadcast message**:
- Type: `CRAWL_PROGRESS`
- Data: Job ID + progress metrics

**All clients receive** the same message

### Client Matching

```javascript
const clients = await self.clients.matchAll();
```

**Matches**:
- All active popup instances
- Background pages (if any)
- Any connected client

**Multiple popups**: All receive progress updates

### Message Format

**Progress broadcast**:
```javascript
{
  type: 'CRAWL_PROGRESS',
  data: {
    jobId: 'abc123',
    pagesFound: 150,
    pagesProcessed: 75,
    pagesFailed: 2,
    queueSize: 73,
    inProgress: ['https://...']
  }
}
```

**Client listens**:
```javascript
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'CRAWL_PROGRESS') {
    // Update UI with progress
  }
});
```

---

## Response Mechanism

### sendResponse Function

Centralized response handler:

```javascript
function sendResponse(event, data) {
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      type: 'RESPONSE',
      data
    });
  } else if (event.source) {
    event.source.postMessage({
      type: 'RESPONSE',
      data
    });
  }
}
```

### Port-Based Response

**Primary method** (MessageChannel):

```javascript
if (event.ports && event.ports[0]) {
  event.ports[0].postMessage({
    type: 'RESPONSE',
    data
  });
}
```

**Benefits**:
- Direct channel to requesting client
- No message confusion
- Clean request/response pairing

### Direct Response Fallback

**Fallback** if no port:

```javascript
else if (event.source) {
  event.source.postMessage({
    type: 'RESPONSE',
    data
  });
}
```

**When used**:
- Old clients not using MessageChannel
- Compatibility fallback
- Rare in practice

---

## Crawl Integration

### Progress Callback

Crawl started with progress callback:

```javascript
const jobId = await startCrawl(baseUrl, (progress) => {
  broadcastProgress(jobId, progress);
});
```

**Callback receives**:
```javascript
{
  pagesFound: 150,
  pagesProcessed: 75,
  pagesFailed: 2,
  queueSize: 73,
  inProgress: ['https://...']
}
```

**Callback action**: Broadcast to all clients

### Crawl Lifecycle

**Start**:
1. Client sends `START_CRAWL` message
2. Service worker calls `startCrawl()`
3. Returns job ID to client
4. Crawl runs in background

**Progress**:
1. Crawler calls progress callback
2. Service worker broadcasts to clients
3. Clients update UI

**Completion**:
1. Crawler calls completion callback
2. Job status updated in database
3. Final progress broadcast
4. Active crawl cleared

### Active Crawl Management

**Global state**:
```javascript
let activeCrawl = null;
```

**Managed by crawler module**:
- Set on `startCrawl()`
- Cleared on completion/cancellation
- Checked before starting new crawl

**Service worker access**:
- `getActiveCrawl()`: Returns active crawl or null
- `cancelActiveCrawl()`: Cancels and clears

---

## Storage Integration

### Database Initialization

```javascript
import { initDB, /* ... */ } from './storage/db.js';
```

**Initialized**:
- On install event
- On activate event
- Ensures database ready

### Job Operations

**Imports**:
```javascript
import {
  getAllJobs,
  getJob,
  deleteJob,
  getPagesByJobId,
  searchPages
} from './storage/db.js';
```

**Used by**:
- `handleGetJobs()`
- `handleGetJob()`
- `handleDeleteJob()`
- `handleGetPages()`
- `handleSearch()`

### Page Operations

**Page queries**:
- `getPagesByJobId(jobId)`: Get all pages for job
- `searchPages(query)`: Full-text search

**Used by**:
- Jobs tab (view pages)
- Search tab (search content)

### Search Operations

**Full-text search**:
```javascript
const results = await searchPages(query);
```

**Implementation**: Case-insensitive content search in IndexedDB

---

## Error Handling

### Try-Catch Wrapper

All handlers wrapped in try-catch:

```javascript
try {
  switch (type) {
    case 'START_CRAWL':
      await handleStartCrawl(event, data);
      break;
    // ... other cases
  }
} catch (error) {
  console.error('Error handling message:', type, error);
  sendResponse(event, { error: error.message });
}
```

### Error Response Format

**Error sent to client**:
```javascript
{
  type: 'RESPONSE',
  data: {
    error: 'Error message string'
  }
}
```

**Client handling**:
```javascript
if (event.data.data.error) {
  reject(new Error(event.data.data.error));
}
```

### Error Logging

All errors logged:

```javascript
console.error('Error handling message:', type, error);
```

**Visible in**:
- Service worker console
- Chrome DevTools → Application → Service Workers

---

## Concurrency Management

### Single Active Crawl

Only one crawl at a time:

```javascript
const activeCrawl = getActiveCrawl();
if (activeCrawl) {
  throw new Error('A crawl is already in progress');
}
```

**Enforced by**:
- Service worker check before starting
- Global state in crawler module

**Benefits**:
- Predictable resource usage
- Simplified state management
- Clear user experience

### Concurrent Requests

**Multiple clients can send requests**:
- Each request handled independently
- Database operations are concurrent-safe
- Progress broadcasts go to all clients

**Examples**:
- Multiple popups can view jobs
- Search while crawl is running
- View pages while crawl is running

### State Isolation

**Database state**: Shared (IndexedDB)
**Crawl state**: Global (one active crawl)
**Client state**: Isolated (each popup independent)

---

## Client Communication

### Popup to Service Worker

**Popup sends**:
```javascript
navigator.serviceWorker.controller.postMessage(
  { type, data },
  [messageChannel.port2]
);
```

**Service worker receives**:
```javascript
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  // Handle message
});
```

### Service Worker to Popup

**Service worker sends**:
```javascript
client.postMessage({
  type: 'CRAWL_PROGRESS',
  data: { /* ... */ }
});
```

**Popup receives**:
```javascript
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'CRAWL_PROGRESS') {
    // Handle progress
  }
});
```

### Multiple Clients

**Broadcast to all**:
```javascript
const clients = await self.clients.matchAll();
clients.forEach(client => {
  client.postMessage(message);
});
```

**Use cases**:
- Progress updates during crawl
- Notifications
- State synchronization

---

## Background Processing

### Persistent Crawling

**Service worker survives popup close**:
- Crawl continues in background
- Database updates persist
- Popup can reopen and reconnect

**Reconnection**:
1. Popup opens
2. Calls `GET_CRAWL_STATUS`
3. If active, subscribes to progress
4. Displays current state

### Popup Independence

**Popup can**:
- Close during crawl
- Reopen at any time
- Multiple instances can open
- All receive same progress updates

**Service worker**:
- Runs independently
- Doesn't depend on popup
- Manages own lifecycle

### State Persistence

**Persistent state**:
- Jobs in IndexedDB
- Pages in IndexedDB
- Progress saved on each URL

**Runtime state**:
- Active crawl object
- Queue, completed, failed sets
- Lost on service worker restart

**Recovery**:
- Database has partial results
- User can restart crawl
- No data loss

---

## Security Considerations

### Message Validation

**Input validation**:
```javascript
if (!baseUrl) {
  throw new Error('Base URL is required');
}
```

**Checks**:
- Required parameters present
- Types are correct
- Values are reasonable

### URL Validation

**URLs validated by**:
- `canonicalizeUrl()` in utils
- `isValidUrl()` checks
- URL constructor try-catch

**Prevents**:
- Invalid URL schemes
- Malformed URLs
- Injection attacks

### Data Sanitization

**Content storage**:
- HTML stripped by extractor
- Markdown is safe format
- No script execution risk

**Database queries**:
- IndexedDB is safe by design
- No SQL injection possible
- Key-based access

---

## Performance Optimization

### Async Operations

**All handlers are async**:
```javascript
async function handleStartCrawl(event, data) {
  await startCrawl(/* ... */);
}
```

**Benefits**:
- Non-blocking
- Concurrent request handling
- Smooth UI experience

### Database Access

**Efficient queries**:
- Indexed lookups
- Cursor-based iteration
- Batch operations where possible

**Caching**:
- `getPageByCanonicalUrl()` checks cache
- Avoids redundant crawls

### Memory Management

**Service worker**:
- May be terminated when idle
- State in IndexedDB persists
- Minimal memory footprint when idle

**Active crawl**:
- Queue and sets grow with pages
- Cleared on completion
- Manageable for typical docs

---

## Debugging

### Console Logging

**Key events logged**:
```javascript
console.log('Service worker started');
console.log('Service worker installing...');
console.log('Service worker activated');
console.log('Received message:', type, data);
```

**Errors logged**:
```javascript
console.error('Error handling message:', type, error);
console.warn('Unknown message type:', type);
```

### Message Tracing

**Every message logged**:
```javascript
console.log('Received message:', type, data);
```

**Benefits**:
- Track message flow
- Debug handler issues
- Verify communication

### Error Visibility

**Errors visible in**:
- Chrome DevTools console
- Application → Service Workers
- Background page inspector

**Access**:
1. Open extension popup
2. Right-click → Inspect
3. Console tab shows service worker logs
