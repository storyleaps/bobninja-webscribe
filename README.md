# Webscribe - Chrome Extension

> Part of the [BobNinja](https://bobninja.com/) project

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](./LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/storyleaps/bobninja-webscribe?label=Download&color=green)](https://github.com/storyleaps/bobninja-webscribe/releases/latest)

A Chrome extension that captures web pages and extracts clean text content as markdown. Designed for AI tools, offline reading, and research workflows.

> **🚀 Early Access:** Webscribe is pending approval on the Chrome Web Store. You can install it now using [Early Access Installation](#early-access-installation) below.

## Chrome Web Store Publishing Info

| Field | Value |
|-------|-------|
| Extension ID | `ldephafjgplbfbaimdboekjcoceihkmj` |
| Store URL | https://chromewebstore.google.com/detail/ldephafjgplbfbaimdboekjcoceihkmj |
| Developer Dashboard | https://chrome.google.com/webstore/devconsole |
| Publishing Account | `nic@neap.co` |

Use the Developer Dashboard to check published or pending approval extensions.

---

## Early Access Installation

> **Note:** Webscribe is currently pending approval on the Chrome Web Store. In the meantime, you can install it directly using Chrome's Developer Mode. This is the same extension—just not distributed through the store yet.

### Quick Install (2 minutes)

1. **Download** the latest release:
   👉 [**Download webscribe-extension.zip**](https://github.com/storyleaps/bobninja-webscribe/releases/latest/download/webscribe-extension.zip)

2. **Extract** the ZIP to a folder you'll keep (e.g., `Documents/webscribe/`)
   > **Important:** Don't extract to Downloads or a temp folder—Chrome needs this folder to remain in place.

3. **Open Chrome** and go to `chrome://extensions/`

4. **Enable Developer Mode** (toggle in top-right corner)

5. **Click "Load unpacked"** and select the extracted folder

6. **Done!** The Webscribe icon appears in your toolbar. Click the puzzle piece icon and pin it for easy access.

### About the Browser Warning

Chrome will show a "Disable developer mode extensions" dialog each time you open the browser. This is normal for any extension installed outside the Web Store—just click **"Cancel"** to dismiss it.

Once Webscribe is approved on the Chrome Web Store, you can switch to the store version for automatic updates and no more warnings.

### Updating the Extension

Updates are not automatic with Developer Mode. To update:

1. Download the new release from [GitHub Releases](https://github.com/storyleaps/bobninja-webscribe/releases)
2. Extract and replace your existing folder
3. Go to `chrome://extensions/` and click **"Reload"** on the Webscribe card

### Why Trust This Extension?

| Reason | Details |
|--------|---------|
| **Open source** | [View all the code](https://github.com/storyleaps/bobninja-webscribe)—nothing hidden |
| **No data collection** | Everything stays in your browser's local storage |
| **No external servers** | The extension has no backend—your data never leaves your device |
| **Same extension** | Identical to what's submitted to Chrome Web Store |

---

## Table of Contents

- [Webscribe - Chrome Extension](#webscribe---chrome-extension)
  - [Table of Contents](#table-of-contents)
  - [Early Access Installation](#early-access-installation)
  - [What is Webscribe?](#what-is-webscribe)
    - [The Problem](#the-problem)
    - [The Solution](#the-solution)
    - [Key Features](#key-features)
  - [Quick Start](#quick-start)
    - [Installation](#installation)
    - [First Capture](#first-capture)
    - [View and Export Results](#view-and-export-results)
  - [How It Works](#how-it-works)
    - [High-Level Flow](#high-level-flow)
    - [Under the Hood](#under-the-hood)
  - [Project Architecture](#project-architecture)
    - [Technology Stack](#technology-stack)
    - [Directory Structure](#directory-structure)
    - [Component Overview](#component-overview)
  - [Documentation Guide](#documentation-guide)
    - [For First-Time Users](#for-first-time-users)
    - [For Developers](#for-developers)
    - [For Contributors](#for-contributors)
    - [For AI Agents](#for-ai-agents)
    - [Specialized Documentation](#specialized-documentation)
      - [ABP.md](#abpmd)
      - [ARCHITECTURE.md](#architecturemd)
      - [STORAGE.md](#storagemd)
      - [CAPTURER.md](#crawlermd)
      - [TAB_FETCHER.md](#tab_fetchermd)
      - [DISCOVERY.md](#discoverymd)
      - [EXTRACTOR.md](#extractormd)
      - [SERVICE_WORKER.md](#service_workermd)
      - [UI_COMPONENTS.md](#ui_componentsmd)
      - [DEVELOPMENT.md](#developmentmd)
      - [TESTING.md](#testingmd)
      - [GOTCHAS.md](#gotchasmd)
      - [RELEASE.md](#releasemd)
      - [CHROME_WEB_STORE_DEPLOYMENT.md](#chrome_web_store_deploymentmd)
      - [CHROME_WEB_STORE_FORM_ANSWERS.md](#chrome_web_store_form_answersmd)
      - [Community & Governance](#community--governance)
  - [Packaging for Chrome Web Store](#packaging-for-chrome-web-store)
  - [Features in Detail](#features-in-detail)
    - [Smart URL Discovery](#smart-url-discovery)
    - [Intelligent Content Extraction](#intelligent-content-extraction)
    - [Real-Time Progress Tracking](#real-time-progress-tracking)
    - [Local-First Storage](#local-first-storage)
    - [Background Capture](#background-capture)
    - [Search and Export](#search-and-export)
    - [Content Picker Mode (v2.24+)](#content-picker-mode-v224)
  - [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Installation Steps](#installation-steps)
    - [Development Commands](#development-commands)
  - [Common Use Cases](#common-use-cases)
    - [Use Case 1: Building an API Integration](#use-case-1-building-an-api-integration)
    - [Use Case 2: Learning a New Framework](#use-case-2-learning-a-new-framework)
    - [Use Case 3: Documentation Research](#use-case-3-documentation-research)
  - [Technical Highlights](#technical-highlights)
    - [Why Vanilla JS for Core Logic?](#why-vanilla-js-for-core-logic)
    - [Why Regex-Based Parsing?](#why-regex-based-parsing)
    - [Why Canonical URL Normalization?](#why-canonical-url-normalization)
    - [Why Single Active Capture?](#why-single-active-capture)
  - [Limitations and Future Work](#limitations-and-future-work)
    - [Current Limitations](#current-limitations)
    - [Planned Features](#planned-features)
  - [Contributing](#contributing)
  - [License](#license)

---

## What is Webscribe?

### The Problem

Working with web content at scale presents several challenges:

- Websites often span **hundreds or thousands of pages**
- Manually extracting content is **tedious and error-prone**
- Web pages contain **navigation, ads, scripts, and visual clutter**
- Finding and processing all relevant pages requires **following many links**
- Understanding API interactions requires **capturing request/response data**

### The Solution

Webscribe is a powerful browser extension that:

1. **Automatically discovers** all pages under specified URL paths
2. **Extracts clean content** using intelligent parsing and analysis
3. **Stores locally** for instant access, search, and export
4. **Runs in background** with configurable concurrent workers
5. **Flexible controls** to scope and limit capture operations
6. **Future: API recording** to capture and analyze web API calls (coming soon)

### Key Features

✅ **[ABP](https://agenticbrowserprotocol.io) Support for AI Agents** - Programmatic API exposing 17 capabilities for AI agent integration (v4.2+)
✅ **Content Picker Mode** - Interactively select and extract content from any web page element (v2.24+)
✅ **Multiple URL Support** - Capture multiple base paths in a single job, paste multiple URLs at once (v2.10+)
✅ **Strict Path Matching** - Prevent false matches like `/api` matching `/api-docs` (v2.10+)
✅ **Smart File Filtering** - Skip non-HTML files (PDF, Excel, media) to prevent timeouts (v2.10+)
✅ **Smart Discovery** - Finds pages via sitemap.xml + continuous link following + DOM-based extraction
✅ **Tab-Based Rendering** - Execute JavaScript and capture SPAs (React, Vue, Angular)
✅ **SPA Route Discovery** - Detects client-side routes via history.pushState monitoring and click simulation (v3.1+)
✅ **External Link Following** - Follow links outside base URL with configurable hop limits (v3.1+)
✅ **CDP-Based Background Rendering** - Uses Chrome DevTools Protocol to bypass background tab throttling
✅ **Intelligent Content Detection** - Multi-signal detection (DOM stability, network idle, content plateau)
✅ **Triple Format Support** - Plain text, markdown, and HTML viewing/export options (v2.11+)
✅ **Code Block Copy** - One-click copy buttons on code blocks in markdown preview (v2.11+)
✅ **Smart Markdown Conversion** - Direct body conversion with noise removal, Turndown converts to markdown (v2.15+)
✅ **Table Support** - HTML tables converted to GFM pipe-delimited markdown tables (v2.8+)
✅ **Confidence Scoring** - AI-powered quality assessment for each page (0-100% confidence) (v2.7+)
✅ **Format Preview Toggle** - Switch between raw text, markdown, and HTML in UI (v2.11+)
✅ **Preview Window** - Open content in separate Chrome Window for comfortable reading (v2.8+)
✅ **Metadata Extraction** - Captures SEO tags, Open Graph, and JSON-LD metadata (v2.6+)
✅ **Intelligent Caching** - Content + HTML caching for ~80% faster re-captures (v2.4+)
✅ **Content Deduplication** - SHA-256 hashing detects duplicate content across URLs (v2.4+)
✅ **Configurable Workers** - 1-10 concurrent tabs (default: 5) for faster capturing
✅ **Per-URL Page Limits** - Limit applies to each input URL separately (v2.19+)
✅ **Real-Time Progress** - Watch pages being discovered and processed
✅ **Background Operation** - Close popup, capture continues
✅ **Local Storage** - All data in browser IndexedDB, no cloud dependencies
✅ **Search** - Filter pages by URL across all captured content
✅ **Flexible Export** - Copy/download as raw text or markdown, single files or ZIP archives (v2.7+)
✅ **Resume Capability** - Survive crashes without data loss (incremental saving)
✅ **Bulk Actions** - Select multiple jobs with checkboxes and delete in bulk
✅ **Modal Navigation** - Browse job details and pages in full-screen modals with breadcrumbs
✅ **Keyboard Shortcuts** - Ctrl+A to select all, Shift+click for range selection, Delete key to remove
✅ **Force Refresh** - Re-capture cached pages for testing or updates
✅ **Incognito Mode** - Capture in incognito window for clean sessions without cookies or cache (v2.18+)
✅ **Error Logging & Diagnostics** - Persistent error logs with diagnostic report generation for troubleshooting (v2.22+)

---

## Quick Start

### Installation

```bash
# 1. Build the popup UI
cd extension/popup
npm install
npm run build

# 2. Load extension in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the /extension directory

# 3. Extension icon appears in Chrome toolbar
```

### First Capture

1. **Click extension icon** in Chrome toolbar
2. **Enter a documentation URL** (or paste multiple URLs at once):
   ```
   https://docs.stripe.com/api
   ```
   > **Tip**: You can paste text containing multiple URLs and they'll be automatically extracted and added as separate entries.
3. **Click "Start Capture"**
4. **Watch progress**:
   - Found: Pages discovered
   - Processed: Pages extracted
   - Queue: Pages waiting

5. **Wait for completion** (~1-2 minutes for 50 pages)

### View and Export Results

1. **Switch to "Jobs" tab**
2. **Click on completed job** to open modal
3. **View job status** - See completion status, page count, total size, and date
4. **Export all pages** using the split button:
   - "Copy All" → copies all pages to clipboard (with 10MB safety check)
   - Dropdown menu:
     - ZIP all .md files
     - ZIP all .txt files
     - Single .md file (concatenated)
     - Single .txt file (concatenated)
5. **Search and browse pages** with real-time filtering
6. **Click any page** to view its content
7. **Single page actions**:
   - "Copy Page" → copies Markdown to clipboard
   - Dropdown → download as .md or .txt
8. **Delete job** using the red trash icon
9. **Bulk delete jobs** from the main list:
   - Select multiple jobs with checkboxes
   - Or use Ctrl/Cmd+A to select all
   - Click Delete to remove selected jobs

---

## How It Works

### High-Level Flow

```
User enters URL → Extension discovers pages → Captures in background →
Extracts text + markdown → Saves to IndexedDB → User views/exports
```

### Under the Hood

1. **Discovery Phase**:
   - Check for sitemap.xml (fast initial discovery)
   - Extract links from each captured page (continuous discovery)
   - Normalize URLs to canonical form (prevent duplicates)
   - Filter to only pages under base path

2. **Capture Phase**:
   - Queue-based processing (dynamic, grows as links found)
   - Configurable concurrent workers (1-10 tabs, default: 5)
   - 500ms delay between requests
   - Tab-based rendering (always enabled for JavaScript execution)
   - Smart content detection (DOM stability + network idle)
   - Incremental saving (pages saved immediately)
   - Optional page limit to control capture scope

3. **Extraction Phase** (v2.15+ dual format):
   - Execute JavaScript in browser tab
   - Extract metadata from page `<head>` (description, keywords, Open Graph tags, etc.)
   - Extract plain text using `document.body.innerText`
   - **Process markdown conversion** (direct body conversion + Turndown)
     - Remove noise elements (nav, footer, sidebars, ads, scripts)
     - Convert full body to clean markdown (headers, code blocks, lists, tables, links)
     - Calculate confidence score (0-100%) based on quality heuristics
   - Automatic cleanup (scripts, styles, hidden elements removed)
   - Basic whitespace normalization

4. **Storage Phase**:
   - Save to IndexedDB (local browser storage)
   - Store both text and markdown formats
   - Include confidence metadata for smart format selection
   - Canonical URL as unique key (deduplication)
   - Track progress and errors
   - Enable search and retrieval

---

## Project Architecture

### Technology Stack

**Extension Core (Vanilla JavaScript)**:
- Manifest V3 (Chrome Extension API)
- Service Worker (background processing, ES modules)
- IndexedDB (persistent storage)
- Vanilla JS modules (no dependencies)

**Popup UI (Modern React Stack)**:
- React 18 + TypeScript
- Vite 5 (build tool, HMR)
- Tailwind CSS v3 (styling)
- @tailwindcss/typography (markdown prose styling, v2.7+)
- shadcn/ui (component library, 18 components)
- Radix UI (accessible primitives)
- Lucide React (icons)
- marked (markdown to HTML rendering, v2.7+)
- JSZip (ZIP file generation for bulk exports)

**Why This Stack?**
- Service workers require vanilla JS (no DOM APIs)
- React provides excellent UI development experience
- TypeScript adds safety and documentation
- shadcn/ui provides professional, accessible components
- Vite enables fast development with HMR

### Directory Structure

```
extension/
├── manifest.json           # Extension config (permissions, entry points)
├── service-worker.js       # Background orchestration (message router)
│
├── lib/                    # Core capture logic (Vanilla JS)
│   ├── crawler.js         # Capture orchestration, queue management
│   ├── tab-fetcher.js     # Tab rendering + markdown conversion
│   ├── discovery.js       # URL discovery (sitemap + links)
│   ├── extractor-simple.js # Text cleanup utilities
│   ├── markdown-processor.js # (Deprecated - processing moved to tab context)
│   ├── utils.js           # URL normalization utilities
│   └── vendor/            # Third-party libraries
│       ├── turndown.js    # HTML to Markdown converter
│       └── turndown-plugin-gfm.js # GFM tables and strikethrough support
│
├── storage/
│   └── db.js              # IndexedDB wrapper (CRUD operations)
│
├── popup/                 # React TypeScript UI
│   ├── src/
│   │   ├── components/    # UI components (tabs, cards, modals)
│   │   ├── hooks/         # React hooks (capture, jobs, search)
│   │   └── lib/           # Service worker client, export utilities
│   └── popup-dist/        # Built output (generated)
│
└── docs/                  # Comprehensive documentation
    ├── ARCHITECTURE.md
    ├── STORAGE.md
    ├── CAPTURER.md
    ├── DISCOVERY.md
    ├── EXTRACTOR.md
    ├── SERVICE_WORKER.md
    ├── UI_COMPONENTS.md
    ├── DEVELOPMENT.md
    └── TESTING.md
```

### Component Overview

**Service Worker** (`service-worker.js`):
- Receives messages from popup
- Manages active capture instance
- Broadcasts progress updates
- Coordinates storage operations

**Capturer** (`lib/crawler.js`):
- CrawlJob class manages queue and workers
- Dynamically grows queue as links discovered
- Tracks progress (found, processed, failed)
- Handles errors gracefully

**Discovery** (`lib/discovery.js`):
- Parses sitemap.xml for initial URLs
- Extracts links from HTML (regex-based)
- Normalizes URLs to canonical form
- Filters to base path only

**Extractor** (`lib/extractor-simple.js`):
- Cleans text content from `innerText`
- Normalizes whitespace
- Removes excessive blank lines
- Minimal processing (browser does heavy lifting)

**Storage** (`storage/db.js`):
- IndexedDB wrapper with Promise API
- Jobs and pages stores
- Indexed queries for performance
- Full-text search capability

**Popup UI** (`popup/src/`):
- 2-tab interface (Capture, Jobs with integrated search)
- Real-time progress updates
- Job management and page browsing
- Content viewer with export options

---

## Documentation Guide

### For First-Time Users

**Start here**: This README (you are here!)

**Then read**:
1. [Quick Start](#quick-start) - Get extension running
2. [How It Works](#how-it-works) - Understand the basics
3. [TESTING.md](./docs/TESTING.md) - Test your first capture

**Optional**:
- [Common Use Cases](#common-use-cases) - See practical examples
- [Features in Detail](#features-in-detail) - Learn all capabilities

### For Developers

**New to the codebase?** Read in this order:

1. **This README** - High-level overview
2. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design and data flow
3. **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - Setup and build process
4. **[TESTING.md](./docs/TESTING.md)** - How to test and debug

**Working on specific modules?** See specialized docs below.

### For Contributors

**Before contributing**:
1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
2. Read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) - Community standards
3. Read [DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Setup dev environment
4. Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Understand design decisions
5. Read [GOTCHAS.md](./docs/GOTCHAS.md) - Learn from common mistakes
6. Read module-specific docs for the code you're modifying
7. Follow code style guidelines in [DEVELOPMENT.md](./docs/DEVELOPMENT.md)

**Creating releases**:
- Read [RELEASE.md](./docs/RELEASE.md) - Release management and versioning
- Use `/release` (Claude Code command) for automated releases (recommended)
- Use `node rls.js <version>` for manual version bumping
- Use `node v.js` to check the current version

### For AI Agents

**Programmatic access to Webscribe via ABP**:

Read [ABP.md](./docs/ABP.md) to learn how AI agents can programmatically interact with Webscribe using the [Agentic Browser Protocol](https://agenticbrowserprotocol.io). ABP exposes 17 capabilities for crawling, content extraction, storage, and export — no UI automation required.

**Quick start for agents**:
```javascript
// Initialize session
await window.abp.initialize({ agent: { name: 'claude' }, protocolVersion: '0.1', features: {} });

// Start a crawl
const crawl = await window.abp.call('crawl.start', { urls: 'https://docs.example.com' });

// Poll status
const status = await window.abp.call('crawl.status', { jobId: crawl.data.jobId });

// Export as ZIP
const archive = await window.abp.call('export.asArchive', { jobIds: [jobId], format: 'markdown' });
```

See [ABP.md](./docs/ABP.md) for complete API reference, all 17 capabilities, and MCP Bridge integration.

### Specialized Documentation

#### [ABP.md](./docs/ABP.md)

**What it covers**:
- Agentic Browser Protocol (ABP) implementation for AI agent access
- All 17 programmatic capabilities (crawl, storage, export, scraping, diagnostics)
- Fire-and-poll pattern for long-running crawls
- Response formats and error handling
- MCP Bridge integration for AI agents
- Testing via DevTools console and Puppeteer
- Complete API reference with input/output schemas

**Read this when**:
- Integrating Webscribe with AI agents or automation tools
- Building MCP servers or ABP clients
- Need programmatic access to crawling and content extraction
- Implementing agent workflows with Webscribe
- Testing ABP capabilities

**Length**: ~250 lines, ~15 minutes

**Who needs this**: AI agent developers, MCP server implementers, automation engineers. Regular users of the Webscribe UI don't need this — it's for programmatic access only.

---

#### [ARCHITECTURE.md](./docs/ARCHITECTURE.md)

**What it covers**:
- Complete system architecture diagram
- Component responsibilities and interactions
- Data flow for all operations (capture, view, search)
- Design decisions and rationale
- Threading model (service worker vs UI)
- State management strategies
- Error handling patterns
- Performance and security considerations

**Read this when**:
- Starting to work on the project
- Need to understand how components interact
- Planning new features
- Debugging cross-module issues

**Length**: ~250 lines, ~15 minutes

---

#### [STORAGE.md](./docs/STORAGE.md)

**What it covers**:
- Complete IndexedDB schema (jobs, pages)
- All field definitions and types
- Index configuration and purpose
- Full API reference for `storage/db.js`
- Usage patterns and code examples
- Data integrity constraints
- Performance optimization strategies
- Storage limits and cleanup

**Read this when**:
- Modifying storage schema
- Adding new queries
- Debugging data issues
- Implementing new storage features
- Understanding job-page relationships

**Length**: ~350 lines, ~20 minutes

---

#### [CAPTURER.md](./docs/CAPTURER.md)

**What it covers**:
- CrawlJob class architecture
- Queue management (dynamic growth)
- Worker coordination (2 concurrent workers)
- Rate limiting implementation
- Progress tracking and callbacks
- Error handling for failed pages
- Completion logic and cleanup
- Integration with discovery, tab-fetcher, and storage
- Memory management
- Cache control and force refresh option

**Read this when**:
- Modifying capture logic
- Debugging capture issues (stuck, slow, incomplete)
- Implementing resume/pause features
- Adjusting performance (concurrency, delays)
- Understanding worker coordination
- Switching between fetch and tab-based rendering

**Length**: ~400 lines, ~25 minutes

---

#### [TAB_FETCHER.md](./docs/TAB_FETCHER.md)

**What it covers**:
- Tab-based rendering for JavaScript-heavy sites
- Chrome DevTools Protocol (CDP) for background tab rendering
- Multi-signal content detection (DOM stability, network idle, content plateau)
- Tab pool architecture for parallel capture
- Tab lifecycle management with debugger attachment
- Error handling and timeout protection
- Chrome tabs, debugger, and scripting API integration

**Read this when**:
- Capturing SPAs (React, Vue, Angular documentation)
- Content not loading with regular fetch
- Understanding CDP-based rendering approach
- Debugging tab rendering issues
- Understanding content readiness detection
- Configuring parallel workers

**Length**: ~650 lines, ~35 minutes

---

#### [DISCOVERY.md](./docs/DISCOVERY.md)

**What it covers**:
- Two-phase discovery strategy
- Sitemap.xml parsing (regex-based)
- Link extraction from HTML
- Canonical URL normalization process
- Base path filtering algorithm
- Deduplication strategy (3 levels)
- Service worker compatibility constraints
- Edge case handling

**Read this when**:
- URLs not being discovered
- Too many/too few pages found
- Duplicate URLs in queue
- Modifying URL filtering logic
- Supporting new URL patterns

**Length**: ~350 lines, ~20 minutes

---

#### [EXTRACTOR.md](./docs/EXTRACTOR.md)

**What it covers**:
- HTML to Markdown conversion strategy
- Regex-based parsing (no DOMParser)
- Main content detection
- Noise removal (nav, footer, scripts)
- HTML element conversions (headers, code, tables, lists, links)
- HTML entity decoding
- Markdown cleanup and formatting
- Quality considerations and limitations

**Read this when**:
- Markdown output is incorrect
- Content not being extracted
- Improving extraction quality
- Adding support for new HTML elements
- Debugging formatting issues

**Length**: ~400 lines, ~25 minutes

---

#### [SERVICE_WORKER.md](./docs/SERVICE_WORKER.md)

**What it covers**:
- Service worker lifecycle (install, activate, message)
- Complete message protocol (8 message types)
- MessageChannel request/response pattern
- Broadcast pattern for progress updates
- All message handlers with code examples
- Integration with capturer and storage
- Error handling and edge cases
- Background processing capabilities

**Read this when**:
- Adding new message types
- Debugging message passing
- Understanding popup ↔ service worker communication
- Service worker not responding
- Implementing new background features

**Length**: ~450 lines, ~25 minutes

---

#### [UI_COMPONENTS.md](./docs/UI_COMPONENTS.md)

**What it covers**:
- Complete React component architecture
- Component tree and hierarchy
- Custom hooks (useCapture, useJobs, useSearch)
- Service worker client communication layer
- All tab components (Capture, Jobs, Search)
- shadcn/ui integration and usage
- Dialog modal for content viewing
- Toast notification system
- State management patterns
- Real-time update handling
- Styling with Tailwind CSS
- Accessibility features

**Read this when**:
- Modifying UI components
- Adding new tabs or features
- Debugging UI state issues
- Understanding React-service worker integration
- Implementing new user interactions
- Improving accessibility

**Length**: ~550 lines, ~30 minutes

---

#### [DEVELOPMENT.md](./docs/DEVELOPMENT.md)

**What it covers**:
- Prerequisites and installation
- Complete project structure explanation
- Development workflow (build, test, reload)
- Build configuration (Vite, TypeScript, Tailwind)
- Development tools (DevTools, service worker console)
- Common development tasks with examples
- Code style and linting guidelines
- Debugging tips and solutions
- Performance profiling

**Read this when**:
- Setting up development environment
- First time contributing
- Build issues or configuration problems
- Adding new features (with step-by-step guides)
- Performance optimization needed

**Length**: ~400 lines, ~25 minutes

---

#### [TESTING.md](./docs/TESTING.md)

**What it covers**:
- Complete testing procedures
- 8 detailed test scenarios
- Debugging procedures (popup, service worker, storage, network)
- Test data (recommended URLs)
- Validation checklist (50+ items)
- Common issues and solutions
- Advanced testing techniques
- Performance metrics and expectations

**Read this when**:
- Testing after changes
- Verifying functionality
- Debugging issues
- Quality assurance
- Before releasing updates

**Length**: ~450 lines, ~25 minutes

---

#### [GOTCHAS.md](./docs/GOTCHAS.md)

**What it covers**:
- Common mistakes and recurring issues
- Non-obvious bugs with subtle root causes
- UI layout problems (width overflow, padding conflicts)
- Lessons learned from development
- Prevention checklists
- Quick reference for known issues

**Read this when**:
- Encountering a familiar-looking bug
- UI elements are overflowing or cut off
- Width/padding issues in popup UI
- Before implementing scrollable containers
- Contributing and want to avoid common pitfalls

**Length**: ~200 lines, ~10 minutes

**Topics covered**:
- Width overflow in popup UI
- Padding conflicts in scroll containers
- Proper width constraint patterns

---

#### [RELEASE.md](./docs/RELEASE.md)

**What it covers**:
- Automated release workflow with `/release` command
- Manual release process for step-by-step control
- Version numbering with semantic versioning (x.x.x)
- Custom version format with timestamp and git commit hash
- Two-commit strategy to solve the commit hash chicken-and-egg problem
- Version file generation (`popup/src/version.ts`)
- Git tagging and pushing releases
- Using version information in the popup UI

**Read this when**:
- Creating a new release or version bump
- Need to understand the release process
- Want to include version information in the UI
- Debugging version-related issues
- Contributing and need to release changes

**Length**: ~180 lines, ~10 minutes

**Key commands**:
- `/release` - Automated release (Claude Code command, recommended)
- `/release patch|minor|major` - Force specific version type
- `node rls.js <version>` - Manual version bump
- `node v.js` - Check current version
- `node pkg.js` - Package extension as ZIP
- `node push-release.js [notes]` - Push to GitHub Releases

---

#### [CHROME_WEB_STORE_DEPLOYMENT.md](./docs/CHROME_WEB_STORE_DEPLOYMENT.md)

**What it covers**:
- Complete Chrome Web Store deployment workflow
- Version bumping, building, and packaging steps
- Store assets (screenshots, promotional tiles)
- Store listing description and fields
- Privacy tab and permission justifications
- URLs and contact information
- Post-submission process

**Read this when**:
- Deploying a new version to Chrome Web Store
- Updating store listing content or assets
- Need permission justification text
- Setting up Chrome Developer account

**Length**: ~300 lines, ~15 minutes

**Key commands**:
- `node rls.js <version>` - Bump version before release
- `node pkg.js` - Create ZIP package for upload
- `node push-release.js [notes]` - Push build artifact to GitHub Releases

---

#### [CHROME_WEB_STORE_FORM_ANSWERS.md](./docs/CHROME_WEB_STORE_FORM_ANSWERS.md)

**What it covers**:
- Complete answers for Chrome Web Store submission form
- Store listing description (copy/paste ready)
- All permission justifications (storage, tabs, debugger, etc.)
- Single purpose description
- Privacy declarations and policy URL
- Remote code declaration

**Read this when**:
- Filling out the Chrome Web Store submission form
- Need permission justification text for sensitive permissions
- Updating store listing description
- Answering Chrome Web Store privacy questions

**Length**: ~400 lines, ~20 minutes

**Note**: This is a reference document with copy/paste ready answers for the Chrome Developer Dashboard form.

---

#### Community & Governance

The following documents are for contributors and community members:

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - How to contribute to the project, code style guidelines, and pull request process
- **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)** - Community standards and expected behavior
- **[SECURITY.md](./SECURITY.md)** - How to report security vulnerabilities
- **[LICENSE](./LICENSE)** - BSD 3-Clause License

---

## Packaging for Chrome Web Store

**Recommended:** Use the `/release` Claude Code command for automated releases:

```bash
/release              # Auto-detect version type
/release patch        # Force patch release
/release minor        # Force minor release
```

This handles version bumping, changelog, build, packaging, and GitHub release automatically.

**Manual process:** If you prefer step-by-step control:

```bash
# 1. Bump version (if releasing a new version)
node rls.js <version>

# 2. Build the popup UI
cd popup && npm run build && cd ..

# 3. Create ZIP package
node pkg.js

# 4. (Optional) Push to GitHub Releases
node push-release.js "Release notes here"
```

The ZIP file is created at `out/webscribe-extension.zip` and contains only the files needed for the extension (excluding source files, tests, docs, etc.).

**GitHub Releases:** The `push-release.js` script creates a GitHub Release with the build artifact attached. This allows you to download and redeploy any previous version without rebuilding from source.

**For complete deployment instructions, see [CHROME_WEB_STORE_DEPLOYMENT.md](./docs/CHROME_WEB_STORE_DEPLOYMENT.md).**

---

## Features in Detail

### Smart URL Discovery

**Dual Strategy**:
1. **Sitemap First**: Checks for sitemap.xml at domain root for fast initial discovery
2. **Continuous Discovery**: Extracts links from each page as it's processed

**Example**:
```
Start: sitemap.xml → 47 URLs
Capture page 1 → +5 new URLs (52 total)
Capture page 2 → +3 new URLs (55 total)
Final: 55 unique pages discovered
```

**Smart Filtering**:
- Only pages under base path included
- URLs normalized to prevent duplicates
- Invalid URLs skipped

### Intelligent Content Extraction

**How It Works**:
- Opens pages in browser tabs to execute JavaScript
- Uses `document.body.innerText` for clean text extraction
- Browser automatically handles:
  - Script and style removal
  - Hidden element filtering
  - HTML entity decoding
  - Whitespace normalization

**What Gets Removed** (automatically by browser):
- Navigation menus
- Headers and footers
- Ads and tracking scripts
- Cookie banners
- Social sharing widgets
- All hidden elements

**Result**: Clean, readable plain text

### Real-Time Progress Tracking

**Live Updates**:
- Pages discovered (total unique URLs found)
- Pages processed (successfully captured)
- Queue size (waiting to be processed)
- Currently processing URLs

**No Black Box**: You always know exactly what's happening.

### Local-First Storage

**All data in browser**:
- IndexedDB stores jobs and pages
- ~15 KB per page average
- 100-page site = ~1-2 MB
- Searchable, persistent, private

**No Cloud**:
- No external APIs
- No data uploaded
- Works offline (for cached content)
- Your data stays on your machine

### Background Capture

**Non-Blocking Operation**:
- Service worker handles capturing
- Close popup → capture continues
- Reopen popup → see progress
- Switch tabs → still capturing

**Resilient**:
- Incremental saves (every page)
- Survive popup closure
- Persist across browser navigation

### Search and Export

**Search** (integrated in Jobs tab):
- Global search bar at the top of Jobs tab
- Search across all captured content by URL
- Real-time filtering within job details modal
- Case-insensitive URL matching
- Results show content snippets with file size
- Click result to view page content

**Format Selection** (v2.11+ enhanced):
- **Raw Text Format** - Plain text with metadata header
- **Markdown Format** - Rendered markdown with YAML Front Matter metadata
- **HTML Format** - Original HTML source for inspection (v2.11+)
- Defaults to Markdown view when available
- Toggle between formats in page viewer
- Smart fallback to raw text when markdown confidence < 50%
- Visual preview with styled callout card for metadata
- **Code Block Copy** - Hover over code blocks to reveal copy button (v2.11+)
- **Preview Window** - Open content in separate Chrome Window (1000×800px) for comfortable reading (v2.8+)

**Export Options** (v2.7+ enhanced):

*Bulk Export (All Pages)*:
- **Copy All** - Clipboard with 10MB safety limit (raw text format)
- **ZIP using raw text files** - Individual .txt files in archive
- **ZIP using markdown files** - Individual .md files (only high-confidence pages)
- **Single raw text file** - Concatenated with URL headers
- **Single markdown file** - Concatenated markdown with metadata

*Single Page Export*:
- Download as .txt, .md, or .html (based on selected format)
- Copy page content to clipboard
- Format selector with confidence indicator

**Export Format** (v2.7+):
- Each page includes fully qualified URL header
- **Metadata section** with description, keywords, author, Open Graph tags, alternate URLs (if duplicates exist)
- **Markdown exports use YAML Front Matter** for metadata (compatible with Jekyll, Hugo, static site generators)
- **Text exports use human-readable** key-value format
- Content delimited with 80-character separator
- File names sanitized from URL paths
- Automatic size display for single files

**Example Text Export**:
```
================================================================================
URL: https://docs.example.com/api/authentication
Canonical URL: https://docs.example.com/api/authentication
Alternate URLs: https://docs.example.com/authentication
Title: API Authentication Guide
Description: Learn how to authenticate with our API
Generator: Hugo 0.110.0
Type: website
Keywords: API, authentication, OAuth, tokens
Author: Example Team
Site Name: Example Documentation
================================================================================

[Page content here...]
```

**Example Markdown Export** (v2.7+, enhanced v2.8+):
```markdown
---
url: https://docs.example.com/api/authentication
canonical: https://docs.example.com/api/authentication
alternate_urls:
  - https://docs.example.com/api/authentication
  - https://docs.example.com/authentication
title: "API Authentication Guide"
description: "Learn how to authenticate with our API"
generator: Hugo 0.110.0
type: website
keywords: API, authentication, OAuth, tokens
author: Example Team
og_site_name: Example Documentation
---

# API Authentication

To authenticate with our API, you'll need to...

## OAuth 2.0 Flow

1. Register your application
2. Obtain access token
3. Include in requests

```javascript
const response = await fetch('https://api.example.com/data', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## API Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/auth/login` | POST | User login |
| `/auth/token` | POST | Get access token |
```

### Content Picker Mode (v2.24+)

**Interactive Element Selection**:
- Switch to "Pick Content" mode using the radio button toggle
- Click "Start Selecting Content" to activate the picker
- Hover over elements to see visual highlighting
- Click any element to extract its content
- Press Escape to cancel selection

**Automatic Extraction**:
- Content extracted in three formats: HTML, Markdown, and plain text
- Markdown is automatically copied to clipboard
- Chrome notification confirms successful extraction
- Uses same Turndown conversion as page capture for consistent markdown

**Save as Job**:
- After picking content, click "Save Selection" to create a job
- Saved as a single-page job for easy organization
- Content appears in Jobs tab alongside captured content
- "Reselect" option to pick different content before saving

**Use Cases**:
- Extract specific sections from complex pages
- Quick capture without full page capture
- Selective content extraction from SPAs
- Copy formatted content (tables, code blocks, lists)

### Bulk Job Management

**Gmail-Style Selection**:
- Always-visible checkboxes on every job card
- Select individual jobs or use Ctrl/Cmd+A for all
- Shift+click for range selection
- Dynamic action bar shows selection count

**Smart Deletion**:
- Bulk delete confirmation shows exactly what will be removed
- Lists all jobs being deleted with page counts
- Shows total pages that will be deleted
- Clear warning that action is permanent

**Keyboard Shortcuts**:
- **Ctrl/Cmd+A**: Select all jobs
- **Shift+Click**: Select range of jobs
- **Delete/Backspace**: Delete selected jobs
- **Escape**: Clear selection

### Modal-Based Navigation

**Job Details Modal**:
- Opens when clicking a job card
- Shows job metadata (status, pages, date)
- Searchable pages list with filtering
- Breadcrumb navigation for context
- Back button to return to job list

**Page Content Modal**:
- Transitions from job details when clicking a page
- Shows full markdown content
- Breadcrumb shows path: Job > Page
- Back button returns to job details
- Copy and download actions

**Benefits**:
- More screen space for content
- No nested modals (single modal with view states)
- Clear navigation with breadcrumbs
- Keyboard-friendly (Escape to go back)

---

## Install from Source (Developer Mode)

This section is for developers who want to install the extension directly from source code without using the Chrome Web Store.

### Steps

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd webscribe-toolkit
   ```

2. **Build the popup UI**
   ```bash
   cd extension/popup
   npm install
   npm run build
   ```

3. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/` in your Chrome browser

4. **Enable Developer mode**
   - Toggle the "Developer mode" switch in the top-right corner

5. **Load the extension**
   - Click "Load unpacked"
   - Select the `/extension` directory from the repository

6. **Verify installation**
   - The Webscribe extension icon should appear in your Chrome toolbar

### Notes

- **Developer mode warning**: Chrome will show a "Disable developer mode extensions" dialog each time you launch the browser. This is normal behavior for unpacked extensions and can be dismissed.

- **Manual updates required**: Unlike Chrome Web Store installations, developer mode extensions do not update automatically. To get the latest version, pull the latest changes from the repository and rebuild the popup UI.

---

## Development Setup

### Prerequisites

- **Node.js 18+**
- **npm** (comes with Node.js)
- **Google Chrome** (for testing)
- **Git** (optional, for version control)

### Installation Steps

```bash
# 1. Clone or download repository
cd /path/to/project

# 2. Install popup dependencies
cd extension/popup
npm install

# 3. Build popup
npm run build

# 4. Load in Chrome
# chrome://extensions/ → Load unpacked → select extension/
```

### Development Commands

```bash
# Build for production
cd popup
npm run build

# Development mode with HMR (for UI work only)
npm run dev

# Future: Linting
npm run lint
```

**Bundle Optimization**: The popup build uses manual chunk splitting to keep bundle sizes under 500 kB. When adding new npm dependencies, update the `manualChunks` config in `vite.config.ts`. See [GOTCHAS.md - Chunk Size Warning](./docs/GOTCHAS.md#chunk-size-warning-after-adding-dependencies) for details.

**See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for complete development guide.**

---

## Common Use Cases

### Use Case 1: Content Research & Analysis

**Scenario**: Researching competitor products, market analysis, or content aggregation

**Workflow**:
1. Open Webscribe
2. Enter target website URLs
3. Configure capture scope and limits
4. Extract and export content
5. Search across all captured pages
6. Analyze patterns and insights

**Benefit**: Comprehensive content extraction and analysis in minutes

### Use Case 2: Knowledge Base Creation

**Scenario**: Building a searchable knowledge base from web content

**Workflow**:
1. Capture multiple related websites
2. Use search to find specific topics
3. Export content in markdown or text format
4. Create offline reference library
5. Feed content to AI tools for processing

**Benefit**: Complete, searchable content library with offline access

### Use Case 3: Content Collection & Archiving

**Scenario**: Collecting structured content from e-commerce, listings, or directory sites

**Workflow**:
1. Configure multiple base URLs
2. Set strict path matching for target sections
3. Limit pages to control scope
4. Extract clean content automatically
5. Export as ZIP or single files
6. Process with custom tools or scripts

**Benefit**: Automated content collection at scale

---

## Technical Highlights

### Why Tab-Based Text Extraction?

**Decision**: Extract text using `document.body.innerText` in browser tabs

**Rationale**:
- ✅ Browser's native API handles all cleanup automatically
- ✅ Scripts, styles, and hidden elements removed by browser
- ✅ HTML entities decoded automatically
- ✅ Whitespace normalized according to CSS rules
- ✅ Gets what users actually see
- ✅ No complex regex needed
- ✅ Works with SPAs and dynamic content

**Trade-offs**:
- ✅ More reliable than regex-based HTML parsing
- ✅ Simpler codebase (38 lines vs 156 lines)
- ✅ Handles complex HTML structures automatically
- ⚖️ Slower (requires opening tabs)
- ⚖️ Plain text output (no Markdown formatting)

### Why Configurable Concurrent Workers?

**Decision**: Allow 1-10 concurrent tabs (default: 5)

**Rationale**:
- Faster capturing with more workers
- User controls speed vs resource usage trade-off
- Default of 5 balances speed and browser performance

**Impact**:
- 1 worker: ~2-4 pages/minute (conservative)
- 5 workers: ~10-20 pages/minute (balanced)
- 10 workers: ~20-40 pages/minute (aggressive)

### Why Canonical URL Normalization?

**Problem Without Normalization**:
```
https://example.com/page
http://example.com/page
https://www.example.com/page
https://example.com/page/
https://example.com/page#section
```
All represent the **same page** but look different!

**Solution**: Normalize all to canonical form:
```
https://example.com/page
```

**Benefits**:
- Prevents capturing same page multiple times
- Enables cache lookups
- Deduplicates across jobs
- Reduces storage usage

### Why Single Active Capture?

**Decision**: Only one capture can run at a time

**Rationale**:
- **Polite to servers** - Don't overwhelm with requests
- **Simpler state** - One global `activeCrawl` variable
- **Better UX** - User focuses on one task
- **Easier debugging** - Single source of logs

**Implementation**:
```javascript
if (activeCrawl) {
  throw new Error('A capture is already in progress');
}
```

**User Experience**:
- Clear message when trying to start second capture
- Can cancel current capture to start new one
- Unlimited completed jobs (only active capture limited)

---

## Limitations and Future Work

### Current Limitations

**1. No Resume for Interrupted Captures**
- If service worker restarts during capture, state is lost
- Workaround: Pages already saved are preserved
- Future: Persist queue state to IndexedDB

**2. Plain Text Only**
- No Markdown formatting (headers, code blocks, etc.)
- Output is readable plain text from `innerText`
- Simpler but less structured than Markdown
- Trade-off: Reliability over formatting

**3. Re-capturing Same URL Creates New Job**
- Each capture creates a separate job with its own page copies
- **v2.4+**: Cached pages reused (~80% faster on second capture)
- **v2.4+**: HTML caching eliminates tab rendering on third+ capture
- Future: Detect existing job and offer update option

**4. Search is Full Table Scan**
- Not optimized for 1000+ pages
- Works well for typical sites (< 500 pages)
- Future: Add full-text search index

### Planned Features

**High Priority**:
- [ ] Resume interrupted captures from IndexedDB state
- [ ] Incremental capture (update existing job)
- [ ] Pause/resume active capture

**Medium Priority**:
- [ ] Retry failed pages individually
- [ ] Custom extraction rules per domain
- [ ] Full-text search index
- [ ] Markdown output option (alongside text)

**Low Priority**:
- [ ] Light/dark theme toggle
- [ ] Statistics dashboard
- [ ] Import/export jobs between browsers

---

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

**Quick Start**:

1. **Fork and setup**:
   ```bash
   git clone <your-fork>
   cd extension/popup
   npm install
   ```

2. **Read documentation**:
   - Start with [CONTRIBUTING.md](./CONTRIBUTING.md)
   - Read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
   - Review [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
   - Follow [DEVELOPMENT.md](./docs/DEVELOPMENT.md) guidelines

3. **Make changes**:
   - Write clean, documented code
   - Follow existing patterns
   - Test thoroughly

4. **Submit**:
   - Create pull request with clear description
   - Reference issue if applicable
   - Include test results

**Code Guidelines**:
- TypeScript strict mode for popup
- JSDoc comments for vanilla JS
- Descriptive variable names
- Error handling in async functions

**Security**: If you discover a security vulnerability, please see [SECURITY.md](./SECURITY.md) for reporting guidelines.

---

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](./LICENSE) file for details.

---

## Getting Help

**Documentation**:
- Start with this README
- Check [TESTING.md](./docs/TESTING.md) for debugging
- Review [GOTCHAS.md](./docs/GOTCHAS.md) for common pitfalls
- Read specialized docs for deep dives

**Diagnostic Reports** (v2.22+):
- Click the three-dot menu → Support
- View error logs with filtering by source and date
- Copy or download diagnostic reports for troubleshooting
- Reports include error details, stack traces, and browser info

**Common Issues**:
- Check [GOTCHAS.md](./docs/GOTCHAS.md) for recurring issues and lessons learned
- See "Common Issues and Solutions" in [TESTING.md](./docs/TESTING.md)
- Check service worker console for errors
- Inspect IndexedDB for data verification

**Not finding what you need?**
- Check the [Table of Contents](#table-of-contents) above
- Search across all docs for keywords
- Review code comments in source files
- Open an issue on [GitHub](https://github.com/storyleaps/bobninja-webscribe)
- Join the discussion on [GitHub Discussions](https://github.com/storyleaps/bobninja-webscribe/discussions)

---

## Summary

**Webscribe** is a comprehensive web page capture and content extraction tool designed for:
- 🌐 **Web Capture**: Intelligent discovery and capture of website content
- 📄 **Content Extraction**: Clean text and markdown with metadata
- 🔍 **Content Analysis**: Quality scoring and intelligent parsing (with more features coming)
- 🔌 **Future: API Recording**: Capture and analyze HTTP requests/responses (coming soon)

**Quick Links**:
- 🤖 [ABP Guide](./docs/ABP.md) - **NEW:** Programmatic API for AI agents
- 📖 [Architecture Overview](./docs/ARCHITECTURE.md) - System design
- 🗄️ [Storage Guide](./docs/STORAGE.md) - Database schema and API
- 📥 [Capturer Guide](./docs/CAPTURER.md) - Capture orchestration
- 🌐 [Tab Fetcher Guide](./docs/TAB_FETCHER.md) - JavaScript rendering and content detection
- 🔍 [Discovery Guide](./docs/DISCOVERY.md) - URL finding strategies
- 📝 [Extractor Guide](./docs/EXTRACTOR.md) - HTML to Markdown
- ⚙️ [Service Worker Guide](./docs/SERVICE_WORKER.md) - Background processing
- 🎨 [UI Components Guide](./docs/UI_COMPONENTS.md) - React architecture
- 💻 [Development Guide](./docs/DEVELOPMENT.md) - Setup and workflows
- 🧪 [Testing Guide](./docs/TESTING.md) - Testing and debugging
- 🚀 [Release Guide](./docs/RELEASE.md) - Version management and releases
- 📦 [Chrome Web Store Deployment](./docs/CHROME_WEB_STORE_DEPLOYMENT.md) - Publishing to Chrome Web Store
- 📋 [Chrome Web Store Form Answers](./docs/CHROME_WEB_STORE_FORM_ANSWERS.md) - Submission form Q&A reference

**Get Started**: [Quick Start](#quick-start) → [First Capture](#first-capture) → [View Results](#view-and-export-results)

**Need Help?**: Check [TESTING.md](./docs/TESTING.md) for debugging procedures.
