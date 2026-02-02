# Changelog

All notable changes to the Webscribe extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.3] - 2026-02-02

### Fixed
- **Infinite loop on duplicate content** - URLs with duplicate content are now correctly marked as completed, preventing them from being re-added to the queue indefinitely
  - Duplicate detection updates alternate URLs but was not marking the URL as processed
  - Page limit checks now also mark URLs as completed when skipping saves
- **Tab timeout on slow-loading pages** - Pages that never reach 'complete' status (due to websockets, analytics scripts, or streaming responses) no longer cause timeouts
  - Tab loading now waits maximum 10 seconds for 'complete' status
  - Gracefully proceeds to content detection instead of timing out
  - Content detection (DOM stability, network idle, content plateau) correctly identifies when content is ready

## [4.1.2] - 2025-01-30

### Fixed
- **Sitemap index parsing** - Crawl jobs no longer get stuck when websites use sitemap index files (WordPress/Yoast SEO style)
  - Root sitemap.xml files that reference nested sitemaps (e.g., `post-sitemap.xml`, `page-sitemap.xml`) are now recursively parsed
  - Actual page URLs extracted from nested sitemaps instead of treating `.xml` files as crawlable pages
  - Previously, workers would attempt to render sitemap XML files as pages, causing hangs

### Added
- **Sitemap discovery timeouts** - Robust timeout protection prevents sitemap issues from blocking crawls
  - 10 second timeout per root sitemap fetch
  - 5 second timeout per nested sitemap fetch
  - 30 second maximum for entire sitemap discovery phase
  - Maximum nesting depth of 2 levels
- **Graceful sitemap fallback** - If any sitemap times out or fails, discovery continues with remaining sitemaps
  - Individual sitemap failures don't stop other sitemaps from being parsed
  - Crawl proceeds with whatever URLs were discovered plus continuous link extraction

### Changed
- **Settings page padding** - Added more top padding to the About/Settings dialog for better visual spacing

### Documentation
- Updated DISCOVERY.md with Sitemap Index Support and Timeout Configuration sections
- Added code examples for sitemap index detection and recursive parsing
- Documented timeout constants and graceful fallback behavior

## [3.1.0] - 2025-12-26

### Added
- **External link following** - Follow links outside base URL scope with configurable depth limits
  - New "Follow External Links" checkbox in Advanced Options (disabled by default)
  - Configurable "Max hops" setting (1-5) controls how deep to follow external links
  - Depth tracking system: internal URLs = depth 0, external URLs = depth 1+
  - Links exceeding max hop limit are automatically filtered out
  - Enables capturing documentation that spans multiple domains or path hierarchies
- **DOM-based link extraction** - Primary link extraction method using DOM APIs in tab context
  - Extracts links after JavaScript execution (captures dynamically generated links)
  - Checks 10+ sources: standard `<a>` tags, data attributes, onclick handlers, button navigation, JSON-LD, image maps, etc.
  - Regex extraction now used only as fallback for cached pages
  - More reliable than regex for modern SPAs and JavaScript-heavy sites
- **SPA route discovery** - Detects client-side routes in Angular/React/Vue applications
  - Monitors `history.pushState()` and `replaceState()` to capture route changes
  - Simulates clicks on `cursor:pointer` elements to trigger navigation
  - Discovers routes that don't exist in HTML (Angular Router, React Router, Vue Router)
  - Safety filters: skips submit buttons, action buttons (delete/buy/checkout), form inputs
  - Limited to 50 elements per page to prevent excessive clicking
- **"Use current page URL" button** - Globe icon button next to each URL input
  - Fills input with the currently active browser tab's URL
  - Validates URL is http/https before filling
  - Shows error toast if no valid page is open
- **Improved regex fallback patterns** - Multiple regex patterns for edge cases
  - Pattern 1: Standard quoted hrefs (`href="URL"` and `href='URL'`)
  - Pattern 2: Unquoted hrefs (`href=/page`, valid HTML5)
  - Pattern 3: Area elements in image maps (`<area href="URL">`)

### Changed
- **Link extraction return format** - `extractLinksFromHtml()` now returns `{url, depth}` objects instead of plain URL strings
  - Enables depth tracking for external link crawling
  - Backward compatible: accepts boolean as options parameter for legacy code
- **Tab fetcher return value** - `fetchRenderedContent()` now returns `links` array alongside html, text, metadata, markdown
  - DOM-extracted links more reliable than regex on HTML string
  - Crawler prefers DOM links, falls back to regex for cached pages

### Technical
- Added `isInternalUrl()` utility function as alias for `isUnderAnyBasePath()`
- Added `followExternalLinks` and `maxExternalHops` options to CrawlJob constructor
- Added `urlDepths` Map to track depth for each URL in queue
- Modified `addToQueue()` to accept depth parameter and enforce hop limits
- Added `getLinkExtractionOptions()` helper method in CrawlJob
- Added `processRawLinks()` method to apply filtering/depth logic to DOM-extracted URLs
- Enhanced `extractLinks()` function in tab-fetcher.js with history monitoring and click simulation
- Updated all `extractLinksFromHtml()` call sites to handle `{url, depth}` return format
- Added constants: `DEFAULT_MAX_EXTERNAL_HOPS`, `MIN_MAX_EXTERNAL_HOPS`, `MAX_MAX_EXTERNAL_HOPS`

### Documentation
- Updated CRAWLER.md with "External Link Following" section (depth tracking, configuration, examples)
- Updated DISCOVERY.md with "DOM-Based Link Extraction" and "SPA Route Discovery" sections
- Updated DISCOVERY.md "Link Extraction from HTML" renamed to "Link Extraction from HTML (Regex Fallback)"
- Added "External Link Depth Tracking" section to DISCOVERY.md
- Updated README.md key features list with SPA Route Discovery and External Link Following
- Updated state properties table in CRAWLER.md

## [3.0.1] - 2025-12-06

### Changed
- **Bundle optimization** - Added manual chunk splitting to Vite build configuration to eliminate 500 kB chunk size warning
  - Splits vendors into 4 logical chunks: react-vendor, radix-vendor, markdown-vendor, utils-vendor
  - All chunks now under 500 kB (largest: react-vendor at 141 kB)
  - Improves browser caching of vendor libraries

### Documentation
- Added "Build and Bundle Size" section to GOTCHAS.md with instructions for maintaining chunk optimization when adding new dependencies
- Added bundle optimization note to README.md Development Commands section with link to GOTCHAS.md

## [3.0.0] - 2025-12-06

### Added
- **Content Picker Mode** - New interactive element selection mode for extracting content from any web page element
  - Radio button toggle to switch between "Capture URL" and "Pick Content" modes
  - Click "Start Selecting Content" to activate the picker on the current page
  - Visual hover highlighting shows which element will be selected
  - Click any element to extract its content
  - Press Escape to cancel selection
  - Content extracted in three formats: HTML, Markdown, and plain text
  - Markdown automatically copied to clipboard on selection
  - Chrome notification confirms successful content extraction
  - Uses same Turndown conversion as page capture for consistent markdown output
- **Content Picker script** (`lib/content-picker.js`) - Injected content script for interactive selection
  - Crosshair cursor while picker is active
  - Blue highlight overlay follows mouse hover
  - Prevents default click behavior (won't trigger links/buttons)
  - Reuses extraction logic from tab-fetcher for consistent output
- **RadioGroup UI component** - New shadcn/ui radio group component for mode selection
- **contentPickerAPI** - New API in service-worker-client for content picker operations
  - `startPicker()` - Inject picker into active tab
  - `savePickedContent()` - Save picked content as job
  - `getPendingContent()` - Check for pending picked content
  - `clearPendingContent()` - Clear stored picked content

### Changed
- **CaptureTab UI** - Redesigned with mode toggle and context-aware floating buttons
  - Radio buttons at top to switch between Capture URL and Pick Content modes
  - Floating button adapts based on mode and state:
    - Capture URL mode: "Start Capture" button
    - Pick Content mode (no content): "Start Selecting Content" button
    - Pick Content mode (with content): Two buttons - "Reselect" (outline) and "Save Selection" (primary)
  - Card content changes based on selected mode
  - Instructions shown only when no content is selected
  - Status indicator shows "Content ready to save" with URL when content exists
- **Capture mode persistence** - Selected mode (Capture URL / Pick Content) is saved to storage and restored on popup open
- **Manifest permissions** - Added `notifications` and `clipboardWrite` permissions

### Documentation
- Updated README.md with Content Picker Mode in Key Features and Features in Detail sections
- Updated UI_COMPONENTS.md with Capture Modes section and contentPickerAPI documentation

## [2.23.0] - 2025-12-05

### Added
- **Error logging and diagnostic reporting** - Centralized error capture system for troubleshooting
  - Captures errors from service worker, capturer, tab-fetcher, and popup UI
  - Persists error logs in IndexedDB with 30-day automatic retention
  - Stores full stack traces, error context (URL, jobId, action), and browser info
- **SupportPage component** - Sliding panel for viewing and managing error logs
  - Access via three-dot menu → Support
  - Error table with expandable rows showing full details
  - Source filter (capturer, tab-fetcher, popup, service-worker)
  - Date filter (Today, This week, This month, All time)
  - Filtered export - Copy/Download respects current filters
  - "X of Y errors" count when filters applied
  - Source badges with distinct colors for quick identification
- **ErrorBoundary component** - React error boundary for catching UI rendering errors
  - Displays user-friendly error screen with "Try Again" and "Reload" options
  - Logs errors to service worker for inclusion in diagnostic reports
- **Global error handlers** - Capture uncaught errors and unhandled promise rejections
  - Service worker: `error` and `unhandledrejection` event listeners
  - Popup: Window-level error handlers in main.tsx
- **Error log API** - New service worker message types for error management
  - `GET_ERROR_LOGS`, `GET_ERROR_COUNT`, `CLEAR_ERROR_LOGS`
  - `GENERATE_ERROR_REPORT` (JSON or formatted string)
  - `LOG_ERROR` for external error submission

### Changed
- **Database schema v6** - Added `errorLogs` object store with timestamp, source, and level indexes
- **Service worker version** - Updated to 2.14.0
- **Cancellation error handling** - Capturer now distinguishes between real errors and cancellation-induced failures
  - Cancelled operations logged as info instead of errors
  - Failed URLs not added to error count when capture is cancelled

### Documentation
- Updated README.md with "Error Logging & Diagnostics" feature and "Diagnostic Reports" section
- Updated STORAGE.md with errorLogs store schema, indexes, and API reference
- Updated SERVICE_WORKER.md with error log message types
- Updated UI_COMPONENTS.md with SupportPage and ErrorBoundary component documentation

## [2.22.0] - 2025-12-05

### Added
- **Gmail-style action bar** - Always-visible toolbar in Jobs page replacing the dynamic header
  - Select all/none checkbox (aligned with job card checkboxes)
  - Delete button (red, only visible when items selected)
  - Three-dot menu with bulk operations (only visible when items selected)
  - Selection count display
  - Pagination controls with prev/next navigation
- **Pagination** - Jobs list now paginates at 50 jobs per page
  - Shows "X-Y of Z" format (e.g., "1-50 of 125")
  - Navigation arrows to move between pages
  - Selection persists across pages
- **Bulk export operations** - Three-dot menu in action bar provides bulk operations across all selected jobs:
  - Copy to Clipboard: Copy as raw text, Copy as markdown
  - Download as ZIP: Zip using raw text files, Zip using markdown files
  - Download as Single File: Single raw text file, Single markdown file
  - Delete: Delete selected jobs

### Changed
- **Job list header** - Removed "My Crawl Jobs (X)" title, replaced with Gmail-style action bar
- **Select all behavior** - Now selects/deselects jobs on current page only (not all jobs)
- **Range selection** - Shift+click now works within current page only
- **Ctrl/Cmd+A shortcut** - Now selects all jobs on current page only

### Documentation
- Updated UI_COMPONENTS.md with Gmail-style action bar documentation
- Added pagination state and calculations documentation
- Added Bulk Export Operations section
- Updated Table of Contents with new sections

## [2.21.0] - 2025-12-05

### Added
- **Warning toast variant** - Orange background (`bg-orange-500`) for cancellation and warning states
- **Images with rounded corners** - Markdown-rendered images now have small rounded corners (6px border radius) in both popup and preview window

### Changed
- **Toast position** - Toasts now appear at the bottom of the popup and slide in from below (was top)
- **Toast auto-dismiss duration** - All toasts now auto-dismiss after 2 seconds (was 3-5 seconds with custom overrides)
- **Cancel Capture button styling** - Now uses red/destructive variant for clearer visual indication
- **Cancelled capture notification** - Shows warning toast ("Capture Cancelled" with orange background) instead of success toast
- **Bulk delete modal** - Now uses centered modal style matching single job delete (was full-height panel with scrollable list)
- **Bulk delete content** - Simplified to show only total pages count and warning (removed individual job list)
- **Back button from search** - When opening a page from search results, back button returns to search results instead of job details

### Fixed
- **Job list scrolling** - Last item in job list can now scroll fully into view (was half-hidden at bottom)
- **Search results scrolling** - Last search result can now scroll fully into view
- **UI freeze on mark as completed** - Fixed freeze when clicking back button after marking a job as completed (Dialog component no longer unmounts during background refresh)
- **Empty job details from search** - Job pages now load correctly when navigating to job details via breadcrumb from search results

### Technical
- Changed job list and search results from `max-h-[380px]` to flex layout with `flex-1 overflow-auto`
- Added `pb-2` bottom padding to scrollable content for proper last-item visibility
- Added `modalView` check to loading/empty state conditions to prevent Dialog unmounting
- Added `cameFromSearch` state flag to track navigation origin
- Added `warning` variant to toast component styles
- Removed all custom `duration` overrides from toast calls
- Changed `TOAST_REMOVE_DELAY` from 3000ms to 2000ms
- Updated toast animations from `slide-out-to-right-full` to `slide-out-to-bottom-full`
- Updated `/changelog` slash command to accept optional version argument

### Documentation
- Updated GOTCHAS.md with "Scrollable Lists Not Reaching Bottom" section
- Updated UI_COMPONENTS.md toast documentation with position, duration, and warning variant
- Updated UI_COMPONENTS.md bulk delete section to reflect centered modal style
- Updated UI_COMPONENTS.md CrawlTab features with cancel button and toast variants

## [2.20.0] - 2025-12-02

### Added
- **Per-URL page limits** - The "Limit Number of Pages" option now applies to each input URL separately
  - With 3 input URLs and limit of 5, you can capture up to 15 pages (5 per URL)
  - Each base URL tracked independently via `completedPerBaseUrl` map
  - Duplicates don't count towards the limit (only unique content pages)
  - Completion log shows per-URL stats (e.g., `https://example.com/docs: 3/3 pages`)
- **Copy URL button** - Added copy-to-clipboard icon in job modal header for easy URL copying
- **Global search in Jobs tab** - Search bar at top of Jobs tab searches across all captured pages
  - Shows results with URL, file size, and content snippets
  - Click result to view page content directly

### Changed
- **UI simplified to 2 tabs** - Removed separate Search tab, integrated search into Jobs tab
  - Empty search shows job list (previous behavior)
  - Active search shows global search results across all jobs
- **Download filenames** - ZIP export now always uses full canonical URL (without protocol) as filename
  - Example: `example.com-docs-api.md` instead of just `api.md`
  - Consistent naming regardless of single or multiple input URLs
- **Page display names in UI** - When multiple input URLs used, shows full URL path instead of relative path

### Fixed
- **Root path URL discovery** - Fixed `isUnderBasePath()` to correctly match child paths when base URL is root (e.g., `https://example.com/`)
  - Previously, URLs like `/about` were incorrectly rejected when capturing from root domain
  - Now correctly identifies all paths under root as valid children
- **Page limit accuracy** - Fixed race conditions causing under-capturing or over-capturing with concurrent workers
  - Added final synchronous check before saving to prevent exceeding limits
  - Duplicates no longer cause premature capture stops

### Documentation
- Updated README.md with 2-tab interface description and per-URL page limit feature
- Rewrote CRAWLER.md "Page Limit Logic" section with new per-URL tracking architecture

## [2.19.0] - 2025-12-02

### Added
- **Incognito mode support** - Capture in a new incognito window for clean sessions without cookies, cache, or logged-in states
  - Checkbox option in Advanced Options (unchecked by default)
  - Creates minimized incognito window with tabs for all workers
  - Automatically closes incognito window when capture completes
  - Warning dialog if extension not enabled in incognito mode with setup instructions
  - "Open Settings" button to directly open Chrome extension settings
  - Detects incognito access via `chrome.extension.isAllowedIncognitoAccess()` API

### Changed
- **Simplified to fast-only extraction** - Removed thorough mode to reduce complexity
  - Fast mode: Network idle + DOM stability + content plateau → extract immediately (~2-4s per page)
  - Removed progressive scrolling and incremental capture (planned for future if needed)

### Removed
- **Thorough content extraction mode** - Removed two-mode architecture and related UI
  - Content Extraction Mode dropdown removed from Advanced Options
  - `scrollToBottom()`, `scrollToTop()`, and `scrollWithCapture()` functions removed
  - Incremental markdown capture logic removed
  - `contentMode` parameter removed from all functions
  - `SCROLL_STEP_DELAY` constant removed

### Technical
- Tab-fetcher version updated from 2.33.0 to 2.34.0
- Added `isIncognitoAllowed()` exported function for incognito access detection
- Added `getOrCreateIncognitoWindow()` for incognito window management
- Updated `acquireCrawlTab()` to accept `useIncognito` parameter and create tabs in incognito window
- Updated `closeCrawlWindow()` to close incognito window if created
- Added `useIncognito` option to CrawlJob constructor and passed through to `fetchRenderedContent()`
- Added incognito warning modal in CrawlTab.tsx with Dialog component
- Created `popup/src/chrome.d.ts` for Chrome Extension API type declarations
- Simplified `waitForContentReady()` to remove mode-specific branching

### Documentation
- Updated TAB_FETCHER.md with incognito mode section and removed two-mode architecture
- Updated API reference to show `useIncognito` parameter and new `isIncognitoAllowed()` function
- Removed progressive scrolling section and virtualized content limitation details
- Simplified performance comparison table (removed thorough mode)
- Updated README.md key features list with incognito mode

## [2.18.0] - 2025-12-02

### Added
- **Two-mode content extraction architecture** - Fast mode (default) and Thorough mode for different page types
  - **Fast mode**: Network idle + DOM stability + content plateau → extract immediately (~2-4s per page)
  - **Thorough mode**: Same checks + progressive scroll for lazy-loaded/virtualized content (~8-12s per page)
- **`contentMode` option** in `fetchRenderedContent()` - Accepts `'fast'` (default) or `'thorough'`
- **Implementation plan for incremental markdown capture** - Detailed spec at `specs/251202_01_virtual_content/execute.md` for future Phase 2 (UI) and Phase 3 (incremental capture) implementation

### Changed
- **Default extraction behavior** - Fast mode is now default, skipping scrolling for 90%+ of pages that don't need it
- **~3x faster captures** - 50-page capture now ~2-3 minutes (was ~7-10 minutes with always-scroll behavior)
- **Tab-fetcher version** - Updated from 2.30.0 to 2.31.0

### Technical
- Added `contentMode` parameter to `fetchRenderedContent()` options
- Added `contentMode` parameter to `waitForContentReady()` function
- Fast mode skips `scrollToBottom()` and `scrollToTop()` calls entirely
- Thorough mode preserves existing scroll behavior (placeholder for future incremental capture)

### Documentation
- Updated TAB_FETCHER.md with Two-Mode Architecture section
- Added fast/thorough mode flow diagrams
- Updated API reference with `contentMode` parameter
- Updated performance comparison table with both modes

## [2.17.0] - 2025-12-02

### Added
- **Chrome DevTools Protocol (CDP) debugger integration** - Bypasses Chrome's background tab throttling for reliable content rendering (v2.27-2.30)
  - Attaches debugger to capture tabs using `chrome.debugger` API
  - Enables focus emulation via `Emulation.setFocusEmulationEnabled` CDP command
  - Sets page lifecycle to active via `Page.setWebLifecycleState` CDP command
  - Solves requestAnimationFrame pausing, timer throttling, and Intersection Observer delays in background tabs
- **Tab pool architecture** - Efficient tab reuse for parallel capture
  - Pool of tabs with debugger attached (one per concurrent worker)
  - Tabs are navigated to new URLs instead of created/destroyed
  - Eliminates tab creation overhead and debugger reattachment
  - Supports 1-10 concurrent workers (default: 5)
- **Non-pre code block normalization** - Handle syntax highlighters that don't use `<pre>` tags (v2.17)
  - Detects react-syntax-highlighter patterns with `<span>` wrappers
  - Conservative multi-signal detection (line numbers + actual code + syntax tokens)
  - Converts to standard `<pre><code>` structure before Turndown conversion
  - Prevents inline code formatting for code blocks: `` `1 2 3` `code` `` → ````code````
- **Progressive scrolling** - Incremental viewport-based scrolling for lazy-load triggering (v2.30)
  - Scrolls 80% of viewport height at a time with 150ms delays
  - Recalculates page height after each step (adapts to lazy-loaded content growth)
  - Triggers Intersection Observer for each element as it enters viewport
  - More reliable than instant scroll-to-bottom
- **Multi-signal content detection** - Robust content readiness detection
  - Phase 1: Network idle + DOM stability (parallel, max 10s)
  - Phase 2: Initial content plateau detection
  - Phase 3: Progressive scroll to bottom
  - Phase 4: Wait 2s at bottom (final lazy content loads)
  - Phase 5: Scroll to top + wait 2s (stabilization)
  - Phase 6: Final content plateau check
- **Content plateau detection** - Monitors `document.body.innerText.length` until it stops growing
  - Checks every 200ms for content growth
  - Resolves when length unchanged for 1 second
  - Adapts to actual page behavior instead of arbitrary timeouts
- **Page visibility spoofing** - Backup mechanism to trigger deferred rendering
  - Overrides `document.visibilityState` to return 'visible'
  - Dispatches visibilitychange and focus events
- **Virtual content challenge documentation** - Comprehensive spec document at `specs/251202_01_virtual_content/`
  - Documents virtualized content limitation (react-window, react-virtualized, Angular CDK)
  - Explains why only visible content is captured on virtualized pages
  - Proposes incremental capture solution for future implementation
- **Unit test suite for non-pre code blocks** - 10 tests covering all detection patterns
  - Tests for react-syntax-highlighter, highlight.js patterns
  - Tests for digit-only line number detection
  - Tests for language detection and preservation
  - Tests with actual sample HTML file (02_html.html)

### Changed
- **Simplified content detection** - Removed Tab Rendering Speed UI setting (fast/balanced/thorough modes)
  - Was: User chooses detection mode (1-10s per page)
  - Now: Automatic multi-signal detection (adapts to page, ~5-8s per page)
  - Better UX: No configuration needed, always gets best results
- **Tab creation strategy** - Background tabs with debugger instead of popup windows
  - Was: Separate popup windows (user disruption)
  - Now: Background tabs in user's window with CDP (no disruption except warning banner)
- **Preprocessing pipeline order** - `normalizeNonPreCodeBlocks()` runs before `normalizeCodeBlocks()`
  - Step 1: Convert non-standard code blocks to `<pre><code>`
  - Step 2: Clean up `<pre>` elements (line numbers, etc.)
  - Step 3: Flatten block elements in anchors
  - Step 4: Resolve relative URLs
  - Step 5: Remove noise elements
- **Tab-fetcher version** - Progressive updates from 2.16.0 → 2.30.0
  - v2.17: Non-pre code block detection
  - v2.27: CDP debugger integration
  - v2.28: Simplified detection (removed modes)
  - v2.29: Scroll triggers for lazy content
  - v2.30: Progressive scrolling

### Removed
- **Tab Rendering Speed setting** - Fast/Balanced/Thorough mode selection removed from UI
- **FetchMode enum** - No longer needed without mode selection
- **renderMode parameter** - Removed from `fetchRenderedContent()`, `CrawlJob`, and UI state
- **getRecommendedMode() function** - No longer needed

### Fixed
- **Background tab rendering** - Content now fully renders even when tabs are not focused
  - Solved: requestAnimationFrame pausing in background tabs
  - Solved: Timer throttling (1 call/second limit)
  - Solved: Intersection Observer delays
  - Result: Lazy-loaded content now renders reliably
- **Code block formatting** - Syntax highlighters using `<span>` wrappers now convert properly
  - FinancialModelingPrep API documentation code blocks now render as fenced blocks
  - Line numbers correctly stripped from actual code
  - JSON/JavaScript code preserves structure and formatting

### Security
- **New permission required**: `debugger` - Enables Chrome DevTools Protocol access
  - User sees yellow "Extension is debugging this browser" banner during capture
  - Banner disappears when capture completes (debuggers detached)
  - Required for bypassing background tab throttling

### Technical
- Added `chrome.debugger` permission to manifest.json
- Tab pool implemented with `captureTabPool` array and `debuggerAttached` Set
- Added `acquireCrawlTab()`, `releaseCrawlTab()`, `attachDebugger()`, `detachDebugger()` functions
- Added `waitForContentReady()` orchestration function with 6 phases
- Added `waitForContentPlateau()` and `waitForContentPlateauInPage()` for text length monitoring
- Added `scrollToBottom()` with progressive viewport-based scrolling
- Added `scrollToTop()` for returning to initial scroll position
- Added `spoofPageVisibility()` for visibility state override
- Added `normalizeNonPreCodeBlocks()` preprocessing function
- Modified `closeCrawlWindow()` to detach debuggers and close all pool tabs
- Removed `FetchMode` constant and mode-based conditional logic
- Removed mode parameter from capturer integration

### Documentation
- Complete rewrite of TAB_FETCHER.md
  - Removed Detection Modes section (fast/balanced/thorough)
  - Added Chrome DevTools Protocol Integration section
  - Added Tab Pool Architecture section
  - Added Progressive Scrolling section with virtualized content limitation
  - Updated API reference (removed mode parameter)
  - Updated console log examples
- Updated EXTRACTOR.md
  - Added Non-Pre Code Block Normalization section
  - Updated preprocessing pipeline (9 steps now)
  - Updated table of contents
- Updated README.md
  - Added CDP-Based Background Rendering to key features
  - Updated TAB_FETCHER.md summary
- Created specs/251202_01_virtual_content/README.md
  - 300+ lines documenting virtualized content challenge
  - Technical explanation of react-window, react-virtualized, Angular CDK
  - Proposed incremental capture solution
  - Test cases and implementation plan

### Known Limitations
- **Virtualized content pages** - Pages using react-window, react-virtualized, or Angular CDK Virtual Scroll may have incomplete content capture
  - Only content visible in viewport at final extraction is captured
  - Content that scrolls out of view is removed from DOM and lost
  - Detection: Browser search (Ctrl+F) only finds text when scrolled to specific positions
  - Mitigation: See `specs/251202_01_virtual_content/` for proposed solution

## [2.16.0] - 2025-12-01

### Added
- **CSS Modules noise detection** - Detects navigation elements with hashed class names (e.g., `documentations_documentationSidebar__xkDcF`)
  - Pattern matching for keywords followed by `__` hash separator: `[class*="Sidebar__"]`, `[class*="Navigation__"]`, etc.
  - Material UI specific patterns: `[class^="MuiDrawer"]`, `[class^="MuiAppBar"]`
  - Data attribute patterns: `[data-sidebar]`, `[data-drawer]`, `[data-navigation]`
- **Link text flattening** - New `flattenBlockElementsInAnchors()` preprocessor fixes malformed markdown links
  - Prevents `[\n\ntext\n\n](url)` output caused by block elements (`<div>`, `<p>`) inside anchor tags
  - Normalizes whitespace and preserves `href`/`title` attributes
- **Absolute URL resolution** - New `resolveRelativeUrls()` preprocessor converts relative paths to absolute URLs
  - Converts `/docs/api` to `https://example.com/docs/api` for standalone markdown files
  - Handles both anchor `href` and image `src` attributes
  - Skips already absolute URLs, data URIs, mailto:, tel:, and javascript: links

### Changed
- **Enhanced preprocessing pipeline** - Document now goes through 4 preprocessing steps before Turndown conversion:
  1. `normalizeCodeBlocks()` - Handle syntax highlighters
  2. `flattenBlockElementsInAnchors()` - Fix link formatting
  3. `resolveRelativeUrls()` - Make URLs absolute
  4. `removeNoiseElements()` - Remove navigation/noise

### Technical
- Added 28 new CSS Modules noise selectors covering Sidebar, Navigation, NavBar, Drawer, and Panel variations
- Tab-fetcher version bumped to 2.16.0

### Documentation
- Updated EXTRACTOR.md with preprocessing pipeline documentation
- Added CSS Modules pattern matching explanation with examples

## [2.15.0] - 2025-12-01

### Changed
- **Replaced Readability.js with direct body conversion** - Markdown conversion now always uses direct body conversion with noise removal instead of Readability.js, ensuring 100% content preservation for all page types and sizes
- **Simplified markdown conversion pipeline** - Removed three-layer fallback mechanism (no longer needed since direct conversion is now the default)
- **Updated confidence scoring** - Base confidence now starts at 0.85 (was 1.0 with Readability), adjusted for direct conversion quality metrics
- **Reduced script injection** - Only Turndown and GFM plugin are now injected into tabs (Readability.js removed)

### Removed
- **Readability.js dependency** - No longer used for content extraction; direct body conversion provides more reliable results
- **Extraction ratio checks** - Removed 40% threshold check (not applicable to direct conversion)
- **Structural loss detection** - Removed 60% table/h2 retention check (direct conversion preserves all content)
- **`usedFallback` metadata flag** - Replaced with `usedDirectConversion: true` (always true now)

### Fixed
- **Content loss in large documentation pages** - Pages with 100+ sections no longer lose critical content like SDK tables and API field definitions
- **Scale-dependent extraction failures** - Ratio-based detection that failed on large files (116 sections losing 7 critical sections undetected) is eliminated

### Technical
- Updated `processMarkdown()` in tab-fetcher.js to always use direct conversion
- Expanded noise removal selectors with additional patterns (related posts, author bios, newsletters, promotions)
- Updated markdownMeta structure: removed `extractionRatio`, `urlHints`; added `h2Count`, `hasTables`
- Updated test suite to verify direct conversion behavior instead of fallback mechanism
- Tab-fetcher version bumped to 2.15.0

### Documentation
- Updated EXTRACTOR.md with direct conversion approach and noise removal table
- Updated README.md to reflect new markdown conversion strategy
- Removed Readability.js from directory structure documentation

## [2.14.0] - 2025-12-01

### Added
- **Three-layer fallback mechanism for markdown conversion** - Prevents content loss when Readability.js aggressively filters multi-section documentation pages
  - Layer 1: Readability success check - falls back if parsing fails
  - Layer 2: Extraction ratio check (40% threshold) - detects when too much content is dropped
  - Layer 3: Structural loss detection (60% threshold) - detects when tables or h2 sections are dropped
- **Enhanced noise removal** - Added 15+ sidebar and navigation patterns to improve direct body conversion
  - Sidebar patterns: `#side-bar`, `#sidebar`, `.sidebar`, `.side-bar`
  - Navigation: `#nav-btn-container`, `.nav-button`, `.nav-footer`
  - Table of contents: `.toc`, `#toc`, `.table-of-contents`
- **Links open in new tabs** - All links in markdown preview (popup and preview window) now open in new tabs with `target="_blank" rel="noopener noreferrer"`
- **Comprehensive unit test suite** - 52 total tests across 3 test files
  - `test-readability-content-loss.js` - 25 tests for fallback mechanism and content preservation
  - `test-code-block-parsing.js` - 16 tests for code block normalization
  - `test-inline-code-links.js` - 11 tests for inline code link formatting
- **Diagnostic tools** - Test utilities for analyzing content loss issues
  - `test-structural-loss-check.js` - Analyzes structural content retention
  - `diagnose-sample-file.js` - Detailed diagnostic comparing Readability vs direct conversion
  - Support for `--use-sample` flag to test with custom HTML files

### Fixed
- **Content loss in multi-section documentation pages** - SDK library tables and API response attribute definitions no longer dropped
- **Missing tables in markdown output** - Fallback ensures all tables are preserved even when Readability filters them
- **Missing nested field definitions** - API response attributes (type, s, p, t, v fields) now correctly preserved

### Changed
- **Markdown conversion strategy** - Readability.js now used opportunistically with robust fallback to direct body conversion
- **Direct body conversion confidence** - Set to 0.7 (70%) when fallback is triggered, with `usedFallback: true` flag in metadata

### Technical
- Added `checkStructuralLoss()` function to compare table/h2 counts before and after Readability extraction
- Added `removeNoiseElements()` function with comprehensive noise selector list
- Added `createTurndownService()` helper to avoid code duplication between Readability and fallback paths
- Added `postProcessMarkdown()` helper for consistent markdown cleanup
- Added `convertBodyDirectly()` function for fallback conversion path
- Modified `processMarkdown()` in tab-fetcher.js to implement three-layer check
- Enhanced `marked` configuration in PageContentViewer.tsx and preview.js with custom link renderer
- Updated test infrastructure with `npm run test:content-loss:sample` command
- Test files support loading custom HTML via `--use-sample` flag

### Documentation
- Updated EXTRACTOR.md with fallback mechanism documentation and diagrams
- Updated TESTING.md with unit testing section covering all test suites
- Added examples of extraction ratio and structural loss scenarios

## [2.12.0] - 2025-11-28

### Fixed
- **Code block parsing with line numbers** - Syntax highlighters (react-syntax-highlighter, highlight.js, Prism.js) that render line numbers in separate `<code>` elements now correctly capture the actual code instead of just line numbers
- **Inline code link formatting** - Links wrapped in `<code>` tags now render as `` [`text`](url) `` instead of `` `[text](url)` ``, preserving proper markdown semantics
- **Toast auto-close** - Toast notifications now properly respect the `duration` prop and auto-dismiss after the specified time (was staying open indefinitely)

### Technical
- Added `normalizeCodeBlocks()` function in tab-fetcher.js to pre-process `<pre>` elements before Turndown conversion
- Added `codeWithLink` custom Turndown rule to handle `<code><a>...</a></code>` patterns
- Added `duration` to ToasterToast type definition for proper TypeScript support
- Added test infrastructure in `tests/` directory with 27 unit tests for markdown conversion
- Test runner supports `npm test` to run all tests, individual test suites via `npm run test:code-blocks` and `npm run test:inline-links`

## [2.11.0] - 2025-11-28

### Added
- **HTML format support** - View and export original HTML source alongside raw text and markdown formats
- **Multi-URL paste support** - Paste text containing multiple URLs and they're automatically extracted and added as separate entries
- **Code block copy buttons** - One-click copy buttons appear on hover over code blocks in markdown preview (popup and preview window)
- **Mark job as completed** - Manually mark interrupted or in-progress jobs as completed via three-dots menu
- **Horizontal scrolling** - Content preview now supports horizontal scrolling when content overflows

### Changed
- **Search filters by URL only** - Search now filters pages by URL instead of content+URL for faster, more predictable results
- **Consolidated actions menu** - Export options, job actions, and delete moved to unified three-dots menu in job details
- **Copy All uses markdown** - Default "Copy All" button now copies content in markdown format (raw text available in menu)
- **Reorganized job details UI** - Search bar moved above status section, dedicated copy button with full menu access
- **Simplified status row** - Removed failed count from job status display

### Technical
- Added `updateJob()` API to service worker for job status updates
- Added `isHtmlAvailable()` and `formatConcatenatedMarkdown()` to export utilities
- Enhanced ScrollArea component with optional horizontal scrollbar support
- Added `extractUrls()` function with robust URL regex supporting query params, fragments, ports, and IP addresses

### Documentation
- Updated README.md with HTML format, multi-URL paste, code block copy, and updated search behavior

## [2.10.0] - 2025-11-25

### Added
- **Multiple URL support** - Start captures with multiple base URLs in a single job, capturing pages under any of the specified paths
- **Strict path matching option** - New checkbox (enabled by default) ensures `/financial-apis` matches `/financial-apis/overview` but NOT `/financial-apis-blog`
- **File extension filtering** - Automatically skip non-HTML files (PDF, Excel, Word, media, archives) to prevent tab load timeouts
- **Loading state feedback** - Button shows spinner and "Starting..." text immediately when clicked
- **Toast notification on start** - "Starting capture..." message appears instantly (2 second duration) for user confidence
- **Initialization screen** - Loading card displays while discovering initial URLs with clear status message
- **Dynamic URL list UI** - Add/remove multiple URLs with "+ Add Another URL" button and remove (×) buttons
- **Smart URL validation** - Button disabled until at least one valid URL is entered

### Changed
- **Project rebranding** - Renamed from "Documentation Crawler" to "Webscribe"
- **General-purpose web capture focus** - Updated all documentation, UI text, and descriptions to reflect general-purpose web capture instead of documentation-specific
- **Use cases updated** - Replaced documentation-focused examples with general content research, knowledge base creation, and content archiving scenarios
- **UI labels** - "Documentation URL" → "Target URL", more general terminology throughout
- **Progress display** - Shows "Extracting content from X base paths" when multiple URLs configured
- Toast duration reduced from 3 seconds to 2 seconds for capture start notification

### Fixed
- **Excel/Office file timeouts** - Files like `.xlsx`, `.xlsm` no longer cause 30-second tab load timeout errors
- **False path matches** - Base path `/api` no longer incorrectly matches `/api-docs` or `/api-blog` (with strict mode enabled)

### Technical
- Added `isUnderAnyBasePath()` utility function to check URL against multiple base paths
- Updated `isUnderBasePath()` with strict mode parameter (default: true)
- Modified `CrawlJob` constructor to accept single URL or array of URLs
- Updated `discoverInitialUrls()` and `extractLinksFromHtml()` to support multiple base URLs
- Enhanced job schema with `baseUrls` and `canonicalBaseUrls` arrays (backward compatible)
- Updated all discovery function calls to pass `strictPathMatching` parameter
- Added comprehensive file extension list (30+ extensions) in link extraction filter

### Documentation
- Updated CRAWLER.md with multiple URL support and strict path matching parameters
- Updated DISCOVERY.md with strict/loose matching modes, multiple URL support, and file filtering
- Updated STORAGE.md with new job schema fields and multiple URL examples
- Updated ARCHITECTURE.md project name to Content Crawler
- Updated README.md with Webscribe vision, new features, and rebranded use cases

## [2.9.0] - 2025-11-24

### Added
- **Table support** - HTML tables now convert to GFM pipe-delimited markdown tables with column alignment via `turndown-plugin-gfm`
- **Preview window** - "Open in Window" button to view content in separate Chrome Window (1000×800px popup) for comfortable reading of long pages
- **PageContentViewer component** - Reusable component for page viewing, eliminating code duplication between JobsTab and PageContentModal
- **Copy/download actions in preview window** - Split button with copy and download functionality in the separate preview window
- **Metadata callout styling in preview** - Styled metadata card renders correctly in preview window with matching CSS

### Changed
- **Renamed "Text" to "Raw Text"** - All UI labels now consistently use "Raw Text" instead of "Text" for clarity
- **Updated metadata field order** - Canonical URL moved before Alternate URLs, Title and Description prioritized
- **Renamed metadata labels** - "OG Title" → "Title", "OG Type" → "Type" for cleaner display
- **Reorganized export menu** - Category labels changed to "Download as ZIP" and "Download as Single File"
- **Updated export option names** - "ZIP all text files" → "Zip using raw text files", "ZIP all markdown files" → "Zip using markdown files"
- **Simplified export menu** - Removed file count and size details from menu items for cleaner UI

### Removed
- **ZIP mixed (auto) export option** - Removed auto-format selection export to simplify export workflow

### Technical
- Added `lib/vendor/turndown-plugin-gfm.js` library for GFM table support
- Injected turndown-plugin-gfm into tabs alongside Readability and Turndown
- Applied `turndownPluginGfm.tables` plugin to TurndownService in tab-fetcher.js
- Created `preview.html` and `preview.js` for standalone preview window
- Refactored PageContentModal.tsx from 386 lines to 82 lines (78% reduction)
- Extracted PageContentViewer.tsx (324 lines) with format selection, rendering, and actions
- Updated JobsTab.tsx to use PageContentViewer instead of inline implementation
- Removed duplicate `transformYAMLToCallout()` function from JobsTab.tsx
- Updated `formatMetadata()` and `formatMetadataAsYAML()` in export-utils.ts for new field order

### Documentation
- Updated EXTRACTOR.md with turndown-plugin-gfm documentation and table conversion examples
- Updated UI_COMPONENTS.md with PageContentViewer component documentation and refactored architecture
- Updated README.md with table support feature, preview window feature, and updated export examples

## [2.8.0] - 2025-11-24

### Added
- **YAML Front Matter format** - Markdown exports now use standard YAML Front Matter for metadata (compatible with Jekyll, Hugo, static site generators)
- **Metadata callout card** - Visual preview transforms YAML Front Matter into styled callout with bulleted list (rendering only, preserves YAML in copy/download)
- **Resume button for interrupted jobs** - Restart cancelled captures directly from job details with active capture validation
- **Alternate URLs in metadata** - Display all URLs serving the same content in both text and markdown exports
- **Auto-refresh job list** - Jobs list automatically updates when captures complete or are cancelled
- **Inline code pill styling** - Code wrapped in backticks now renders as gray rounded pills (GitHub/Stack Overflow style)

### Changed
- **Markdown defaults when available** - Page viewer now opens in Markdown format by default (was Text)
- **Consolidated Description field** - Uses standard description, falls back to ogDescription if empty (removed redundant "OG Description" field)
- **Toast duration reduced** - Auto-dismiss after 3 seconds (was essentially infinite at 1000 seconds)
- **Cleaner job list UI** - Removed markdown count and failed count from job cards to save horizontal space
- Typography plugin configured to remove backticks from inline code (::before and ::after)

### Fixed
- **Cancelled jobs status update** - Jobs now properly update to "interrupted" status when cancelled (was stuck at "in_progress")
- **Completion handler on cancellation** - `onComplete()` now called even when queue has remaining URLs
- **YAML array parsing** - Alternate URLs and tags now display correctly in metadata callout (was showing empty values)

### Technical
- Added `transformYAMLToCallout()` function in PageContentModal and JobsTab for visual transformation
- Updated `formatMetadataAsYAML()` to accept full Page object and include alternate URLs
- Modified capturer completion check to include `|| this.isCancelled` condition
- Queue and in-progress sets now cleared on cancellation for proper UI completion state
- Toast configuration updated in both `use-toast.ts` (TOAST_REMOVE_DELAY) and `toaster.tsx` (duration prop)

### Documentation
- Updated README.md with YAML Front Matter examples and alternate URLs
- Updated UI_COMPONENTS.md with Resume button, callout rendering, and toast duration
- Updated CRAWLER.md with cancellation behavior and completion detection fix

## [2.7.0] - 2025-11-24

### Added
- **Intelligent Markdown Conversion** - Readability.js extracts main content, Turndown converts to markdown
- **Confidence Scoring System** - AI-powered quality assessment (0-100%) for each page's markdown conversion
- **Dual Format Support** - Store both plain text and markdown for each page
- **Format Preview Toggle** - Switch between text and rendered markdown in page viewer UI
- **Markdown Rendering** - Beautiful styled markdown preview using marked.js and Tailwind typography
- **Smart Format Selection** - Automatic fallback to text when markdown confidence < 50%
- **Enhanced Export Options**:
  - ZIP all markdown files (with availability count)
  - Single markdown file (concatenated)
  - Mixed ZIP (auto-select best format per page)
- **Markdown Metadata Formatting** - Blockquote-styled metadata for beautiful rendering
- **Availability Indicators** - Show "X/Y pages" markdown-ready counts in UI
- **Confidence Badge** - Visual indicator showing quality score in page viewer
- Third-party libraries: Readability.js (84KB), Turndown (27KB), marked (35KB)
- Tailwind typography plugin for prose styling

### Changed
- **Database schema v5**: Added `markdown` (string|null) and `markdownMeta` (object|null) fields to pages store
- Tab fetcher now injects Readability.js and Turndown into tabs for in-context processing
- Tab fetcher returns `{html, text, metadata, markdown, markdownMeta}` (added 2 new fields)
- `savePage()` function signature now includes `markdown` and `markdownMeta` parameters
- Export utilities support both text and markdown formats with smart fallback
- Page content modal redesigned with format selector and confidence display
- JobsTab export dropdown expanded with markdown options
- Job details header shows markdown availability count

### Technical
- Database version incremented from 4 to 5
- Markdown processing happens in tab context (where DOM APIs are available)
- Quality heuristics include: link density, extraction ratio, structure detection, URL patterns
- Content hash calculation unchanged (still text-only for deduplication)
- Markdown conversion always attempted, stored with confidence metadata
- Display logic uses confidence threshold (default 50%) to determine availability
- Existing pages from v4 databases will have `markdown: null` until re-captured
- Libraries injected as global scripts (not ES modules) for tab compatibility

### Documentation
- Updated README.md with markdown conversion features and export examples
- Updated directory structure to include vendor libraries
- Added example markdown export format with blockquote metadata

## [2.6.0] - 2025-11-23

### Added
- Metadata extraction from page `<head>` tags (12 fields including SEO tags, Open Graph, JSON-LD)
- Standard HTML meta tags: description, keywords, author, generator
- Open Graph protocol tags: og:title, og:description, og:type, og:site_name
- Article metadata: article:section, article:tag (array)
- Canonical URL extraction from `<link rel="canonical">`
- JSON-LD structured data extraction (headline, description, name, author, type)
- Metadata display in all page views (formatted header section)
- Metadata included in all export formats (copy, download, ZIP)

### Changed
- **Database schema v4**: Added `metadata` field to pages store (object|null)
- Export format now includes formatted metadata header before page content
- Tab fetcher now returns `{html, text, metadata}` instead of `{html, text}`
- Single page view in JobsTab now shows formatted content with metadata
- PageContentModal component updated to display metadata (though currently unused)
- `savePage()` function signature now includes `metadata` parameter

### Technical
- Database version incremented from 3 to 4
- Content hash calculation unchanged (excludes metadata, content-only for deduplication)
- Metadata extracted in browser tab context with full DOM access
- Added input validation to `canonicalizeUrl()` to handle edge cases
- Link extraction now skips data URIs and hrefs longer than 2000 characters
- Existing pages from v3 databases will have `metadata: null` until re-captured

### Documentation
- Updated EXTRACTOR.md with comprehensive metadata extraction documentation
- Updated STORAGE.md with metadata field schema and examples
- Updated README.md with metadata feature in key features and export format example

## [2.4.0] - 2025-11-23

### Added
- About dialog accessible via three-dot menu button (⋮) in top right corner
- Full-screen modal (400px × 600px) for displaying application information
- Card-based menu items with icons for Documentation and GitHub links
- Discrete version display at bottom of About dialog showing full custom version
- Version format: `Webscribe — Version <semver>.<timestamp>.<git-sha>`
- Three-dot menu button with ghost styling in App header
- AboutDialog component with centered content layout
- AboutMenuItem component for reusable card-based menu items

### Changed
- App header now includes three-dot menu button alongside title
- Popup UI height standardized to 600px
- Dialog directly opens on three-dot button click (no dropdown intermediary)

### Documentation
- Updated UI_COMPONENTS.md with AboutDialog component documentation
- Added AboutDialog to component tree and hierarchy diagrams
- Updated project structure to include version.ts and AboutDialog.tsx
- Documented version display format and implementation details

## [2.1.0] - 2025-11-21

### Added
- Real-time search with 300ms debouncing (no search button needed)
- Clickable search results that open full page content modal
- PageContentModal reusable component for viewing page content
- Breadcrumb navigation in page content modal showing job context
- Cross-tab navigation from Search tab to Jobs tab
- Centered confirmation modal for single job deletion
- Job navigation link in page content modal (from search results)
- GOTCHAS.md documentation for common development pitfalls
- Database migration system (v1 → v2)

### Changed
- **Database schema v2**: `canonicalUrl` index changed from unique to non-unique
- Cached pages are now saved to new jobs (each job gets its own copy)
- Search input now has search icon on left and loading spinner on right
- Delete confirmation now uses custom modal instead of browser alert
- Bulk delete modal now has sticky footer with scrollable content
- Dialog component supports both slide-in and centered positioning
- Font sizes normalized across modal breadcrumb links

### Fixed
- Cached pages now appear in new capture jobs (previously missing)
- Width overflow in search results cards
- Vertical alignment of "Force Refresh" checkbox label
- Footer positioning in page content modal (no white gap)
- Spacing in job details modal header
- Root pages now display as "index" instead of full URL
- Modal coverage issue in delete confirmation (now fills full width)

### Technical
- Database version incremented from 1 to 2
- Pages store recreated during migration (existing pages deleted)
- Added `showClose` and `centered` props to Dialog component
- Removed duplicate code by extracting PageContentModal

## [2.0.0] - 2025-11-21

### Added
- Configurable concurrent workers (1-10 tabs, default: 5) in Advanced Options
- Optional page limit feature to control capture scope (1 to unlimited)
- Smart worker queue management - workers wait for queue instead of exiting early
- Green success toast notification when capture completes
- Sticky "Start Capture" button at bottom of popup UI
- Fixed height layout (600px) for proper scrolling behavior

### Changed
- **BREAKING**: Switched from Markdown to plain text output format
- **BREAKING**: Changed default concurrent workers from 2 to 5
- **BREAKING**: Tab-based rendering now always enabled (removed fetch API fallback)
- Extraction now uses `document.body.innerText` instead of regex-based HTML parsing
- Simplified extractor from 156 lines to 38 lines
- Export options now .txt only (removed all .md export options)
- UI description updated from "Markdown" to "Text"

### Fixed
- Worker race condition where workers would exit before discovering new links
- Page limit completion - job now properly marked as "completed" when limit reached
- UI now shows "Capture Complete!" toast instead of staying in "in progress" state
- Accessibility warning - DialogTitle now always present for screen readers
- Cleanup code now executes even when page limit reached (using finally block)

### Removed
- Regex-based HTML to Markdown conversion
- All .md (Markdown) export options
- "Render JavaScript" toggle (tab rendering always enabled)
- Large "Capture Complete" card (replaced with toast)

## [1.0.0] - Previous Release

Initial release with:
- Tab-based rendering support
- Flexible export options
- Job details modal redesign
- Bulk job management
- Force refresh capability
