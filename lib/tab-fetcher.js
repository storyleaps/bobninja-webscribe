/**
 * Tab-based text extraction for JavaScript-rendered content
 *
 * Opens URLs in real browser tabs to execute JavaScript and extract
 * clean text content using document.body.innerText. Uses a robust
 * multi-signal approach to detect when content is fully loaded.
 * VERSION: 2.34.0 - Fast mode with incognito support
 */

import { logError } from './error-logger.js';

const TAB_FETCHER_VERSION = '2.34.0';
console.log(`🚀 [TabFetcher] Loading tab-fetcher.js v${TAB_FETCHER_VERSION} (fast mode, incognito support)`);

const DEFAULT_TIMEOUT = 30000; // 30 seconds max wait
const DOM_STABLE_WAIT = 1000; // Wait 1s of DOM stability
const NETWORK_IDLE_WAIT = 500; // Wait 500ms of network idle
const CONTENT_PLATEAU_WAIT = 1000; // Wait 1s of no content growth
const MIN_CONTENT_LENGTH = 200; // Minimum chars to consider content "present"
const CONTENT_CHECK_INTERVAL = 200; // Check content growth every 200ms

// Pool of crawl tabs for parallel processing
// Each worker gets its own tab with debugger attached to bypass background throttling
let crawlTabPool = []; // Array of { tabId, inUse: boolean }
let debuggerAttached = new Set(); // Track which tabs have debugger attached

// Incognito window management
let incognitoWindowId = null; // ID of the incognito window (if using incognito mode)
let currentIncognitoMode = false; // Track if current crawl session uses incognito

/**
 * Check if the extension is allowed to run in incognito mode
 * User must enable this in chrome://extensions → extension details → "Allow in Incognito"
 * @returns {Promise<boolean>}
 */
export async function isIncognitoAllowed() {
  return new Promise((resolve) => {
    chrome.extension.isAllowedIncognitoAccess((allowed) => {
      resolve(allowed);
    });
  });
}

/**
 * Get or create an incognito window for crawling
 * @returns {Promise<number>} Window ID
 */
async function getOrCreateIncognitoWindow() {
  // Check if we already have an incognito window
  if (incognitoWindowId) {
    try {
      await chrome.windows.get(incognitoWindowId);
      return incognitoWindowId; // Window still exists
    } catch (e) {
      // Window was closed, reset
      incognitoWindowId = null;
    }
  }

  // Create new incognito window (minimized to reduce visual distraction)
  const window = await chrome.windows.create({
    incognito: true,
    state: 'minimized',
    focused: false
  });

  incognitoWindowId = window.id;
  console.log(`[TabFetcher] Created incognito window: ${incognitoWindowId}`);
  return incognitoWindowId;
}

/**
 * Fetch rendered content by opening URL in a tab
 *
 * Uses a robust multi-signal approach to detect when content is ready:
 * 1. Wait for initial page load (tab complete)
 * 2. Wait for network idle (no new resources loading)
 * 3. Wait for DOM stability (no mutations)
 * 4. Wait for content plateau (text length stops growing)
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Max wait time in ms
 * @param {string[]} options.waitForSelectors - CSS selectors to wait for
 * @returns {Promise<{html: string, text: string}>} Object with html (for link extraction) and text (for content storage)
 */
export async function fetchRenderedContent(url, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    waitForSelectors = [],
    useIncognito = false   // Use incognito window for clean session
  } = options;

  let poolEntry = null;

  try {
    console.log(`[TabFetcher] Starting fetch for: ${url} (incognito: ${useIncognito})`);

    // Check if chrome APIs are available
    if (!chrome || !chrome.tabs || !chrome.debugger) {
      throw new Error('chrome.tabs/debugger API not available - check permissions and reload extension');
    }

    // Check incognito access if requested
    if (useIncognito) {
      const allowed = await isIncognitoAllowed();
      if (!allowed) {
        throw new Error('Incognito mode requested but extension is not allowed in incognito. Enable it in chrome://extensions → Content Crawler → Details → "Allow in Incognito"');
      }
    }

    // Track incognito mode for this session
    currentIncognitoMode = useIncognito;

    // 1. Acquire a crawl tab from the pool (with debugger attached)
    poolEntry = await acquireCrawlTab(useIncognito);
    const tabId = poolEntry.tabId;

    // 2. Navigate the tab to the new URL
    await chrome.tabs.update(tabId, { url: url });
    console.log(`[TabFetcher] Navigating tab ${tabId} to: ${url}`);

    // 3. Wait for initial page load
    await waitForTabComplete(tabId, timeout);
    console.log(`[TabFetcher] Initial load complete for: ${url}`);

    // 4. Spoof Page Visibility API to make page think it's visible
    // Some sites defer rendering until document.visibilityState === 'visible'
    await spoofPageVisibility(tabId);

    // 5. Robust content detection - multiple signals
    await waitForContentReady(tabId, timeout);

    // 5. Wait for specific selectors if provided
    if (waitForSelectors.length > 0) {
      await waitForSelectorsPresent(tabId, waitForSelectors, timeout);
    }

    console.log(`[TabFetcher] Content ready, extracting from: ${url}`);

    // 6. Extract HTML (for link discovery), text (for content), metadata, markdown, and links
    const { html, text, metadata, markdown, markdownMeta, links } = await extractContent(tabId);

    console.log(`[TabFetcher] Extracted ${text.length} text characters, ${html.length} HTML characters, ${links?.length || 0} links from: ${url}`);
    if (markdown && markdownMeta) {
      console.log(`[TabFetcher] Markdown conversion: confidence=${(markdownMeta.confidence * 100).toFixed(0)}%, textLength=${markdownMeta.textLength}`);
    }
    return { html, text, metadata, markdown, markdownMeta, links };

  } catch (error) {
    // Log with full error details for debugging
    const errorDetails = error.name ? `${error.name}: ${error.message}` : error.message || String(error);
    console.error(`[TabFetcher] Error fetching ${url}:`, errorDetails);
    console.error(`[TabFetcher] Full error object:`, error);

    // Log to persistent error store for diagnostic reports
    logError('tab-fetcher', error, {
      url,
      useIncognito,
      tabId: poolEntry?.tabId,
      action: 'fetchRenderedContent'
    });

    // Throw error with details preserved
    const wrappedError = new Error(`Failed to fetch rendered content from ${url}: ${errorDetails}`);
    wrappedError.originalError = error;
    throw wrappedError;

  } finally {
    // Release the tab back to the pool for other workers to use
    if (poolEntry) {
      releaseCrawlTab(poolEntry);
    }
  }
}

/**
 * Acquire a crawl tab from the pool
 * If no tab is available, creates a new one with debugger attached
 * The debugger allows us to bypass Chrome's background tab throttling
 * @param {boolean} useIncognito - Whether to create tab in incognito window
 */
async function acquireCrawlTab(useIncognito = false) {
  // First, try to find an available tab in the pool
  for (const entry of crawlTabPool) {
    if (!entry.inUse) {
      // Verify the tab still exists
      try {
        await chrome.tabs.get(entry.tabId);
        entry.inUse = true;
        console.log(`[TabFetcher] Acquired existing tab from pool: ${entry.tabId}`);
        return entry;
      } catch (e) {
        // Tab was closed, clean up
        debuggerAttached.delete(entry.tabId);
        const index = crawlTabPool.indexOf(entry);
        if (index > -1) crawlTabPool.splice(index, 1);
      }
    }
  }

  // No available tab, create a new one
  let tab;

  if (useIncognito) {
    // Create tab in incognito window
    const windowId = await getOrCreateIncognitoWindow();
    tab = await chrome.tabs.create({
      url: 'about:blank',
      active: false,
      windowId: windowId
    });
    console.log(`[TabFetcher] Created new incognito tab: ${tab.id} in window ${windowId}`);
  } else {
    // Create regular background tab
    tab = await chrome.tabs.create({
      url: 'about:blank',
      active: false
    });
  }

  const entry = {
    tabId: tab.id,
    inUse: true
  };
  crawlTabPool.push(entry);

  // Attach debugger to bypass background tab throttling
  await attachDebugger(tab.id);

  console.log(`[TabFetcher] Created new crawl tab: ${tab.id} with debugger (pool size: ${crawlTabPool.length}, incognito: ${useIncognito})`);

  return entry;
}

/**
 * Attach Chrome debugger to a tab and enable focus emulation
 * This bypasses Chrome's background tab throttling
 */
async function attachDebugger(tabId) {
  if (debuggerAttached.has(tabId)) {
    return; // Already attached
  }

  try {
    // Attach debugger using Chrome DevTools Protocol
    await chrome.debugger.attach({ tabId }, '1.3');
    debuggerAttached.add(tabId);
    console.log(`[TabFetcher] Debugger attached to tab ${tabId}`);

    // Enable focus emulation - makes the page think it's focused
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.setFocusEmulationEnabled', { enabled: true });
    console.log(`[TabFetcher] Focus emulation enabled for tab ${tabId}`);

    // Optionally: Set the page lifecycle state to active
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Page.setWebLifecycleState', { state: 'active' });
      console.log(`[TabFetcher] Page lifecycle set to active for tab ${tabId}`);
    } catch (e) {
      // This command may not be available in all Chrome versions
      console.log(`[TabFetcher] Page.setWebLifecycleState not available (non-critical)`);
    }

  } catch (error) {
    console.error(`[TabFetcher] Failed to attach debugger to tab ${tabId}:`, error);
    throw new Error(`Failed to attach debugger: ${error.message}`);
  }
}

/**
 * Detach Chrome debugger from a tab
 */
async function detachDebugger(tabId) {
  if (!debuggerAttached.has(tabId)) {
    return;
  }

  try {
    await chrome.debugger.detach({ tabId });
    debuggerAttached.delete(tabId);
    console.log(`[TabFetcher] Debugger detached from tab ${tabId}`);
  } catch (e) {
    // Tab might already be closed
    debuggerAttached.delete(tabId);
  }
}

/**
 * Release a crawl tab back to the pool
 */
function releaseCrawlTab(entry) {
  entry.inUse = false;
  console.log(`[TabFetcher] Released tab back to pool: ${entry.tabId}`);
}

/**
 * Close all crawl tabs and detach debuggers (call this when crawl job is complete)
 */
export async function closeCrawlWindow() {
  console.log(`[TabFetcher] Closing ${crawlTabPool.length} crawl tabs...`);

  for (const entry of crawlTabPool) {
    try {
      // Detach debugger first
      await detachDebugger(entry.tabId);
      // Then close the tab
      await chrome.tabs.remove(entry.tabId);
      console.log(`[TabFetcher] Closed crawl tab: ${entry.tabId}`);
    } catch (e) {
      console.warn(`[TabFetcher] Could not close crawl tab ${entry.tabId}:`, e);
    }
  }

  crawlTabPool = [];
  debuggerAttached.clear();

  // Close incognito window if it was used
  if (incognitoWindowId) {
    try {
      await chrome.windows.remove(incognitoWindowId);
      console.log(`[TabFetcher] Closed incognito window: ${incognitoWindowId}`);
    } catch (e) {
      console.warn(`[TabFetcher] Could not close incognito window ${incognitoWindowId}:`, e);
    }
    incognitoWindowId = null;
  }

  currentIncognitoMode = false;
}

/**
 * Spoof the Page Visibility API to make the page think it's visible
 * This triggers any deferred rendering that depends on visibility state
 */
async function spoofPageVisibility(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Override document.visibilityState to return 'visible'
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: function() { return 'visible'; }
        });

        // Override document.hidden to return false
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: function() { return false; }
        });

        // Dispatch visibilitychange event to trigger any listeners
        document.dispatchEvent(new Event('visibilitychange'));

        // Also dispatch on window for frameworks that listen there
        window.dispatchEvent(new Event('visibilitychange'));

        // Trigger a focus event which some sites use instead of visibility
        window.dispatchEvent(new FocusEvent('focus'));
        document.dispatchEvent(new FocusEvent('focus'));

        console.log('[TabFetcher] Page visibility spoofed to visible');
      }
    });
    console.log(`[TabFetcher] Visibility spoofed for tab ${tabId}`);
  } catch (error) {
    console.warn(`[TabFetcher] Failed to spoof visibility:`, error);
  }
}

/**
 * Wait for tab to reach 'complete' status
 */
function waitForTabComplete(tabId, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Tab load timeout'));
    }, timeout);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    }

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
    }

    chrome.tabs.onUpdated.addListener(listener);

    // Check if already complete
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        cleanup();
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * Robust content detection using multiple signals.
 * Network idle + DOM stability + content plateau → Extract immediately
 *
 * @param {number} tabId - Tab ID
 * @param {number} timeout - Max wait time in ms
 */
async function waitForContentReady(tabId, timeout) {
  console.log(`[TabFetcher] Waiting for content ready...`);

  const startTime = Date.now();

  // Phase 1: Run network idle and DOM stability checks in parallel
  await Promise.race([
    Promise.all([
      waitForNetworkIdle(tabId, timeout).catch(() => {}),
      waitForDOMStability(tabId, timeout).catch(() => {})
    ]),
    sleep(Math.min(timeout, 10000)) // Cap at 10s for this phase
  ]);

  const elapsed = Date.now() - startTime;
  const remainingTimeout = Math.max(timeout - elapsed, 5000);

  // Phase 2: Wait for content to plateau
  const plateauResult = await waitForContentPlateau(tabId, Math.min(remainingTimeout, 10000));
  const contentLength = plateauResult?.finalLength || 0;
  console.log(`[TabFetcher] Content plateau: ${contentLength} chars`);

  console.log(`[TabFetcher] Content ready after ${Date.now() - startTime}ms`);
}

/**
 * Wait for content to stop growing
 * Monitors document.body.innerText.length and waits until it plateaus
 * @returns {Promise<{finalLength: number, checks: number, reason: string}|null>}
 */
async function waitForContentPlateau(tabId, timeout) {
  console.log(`[TabFetcher] Waiting for content plateau...`);

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForContentPlateauInPage,
      args: [CONTENT_PLATEAU_WAIT, MIN_CONTENT_LENGTH, CONTENT_CHECK_INTERVAL, timeout]
    });

    if (result && result[0] && result[0].result) {
      const { finalLength, checks, reason } = result[0].result;
      console.log(`[TabFetcher] Content plateau: ${finalLength} chars, ${checks} checks, reason: ${reason}`);
      return result[0].result;
    }
    return null;
  } catch (error) {
    console.warn(`[TabFetcher] Content plateau check failed:`, error);
    return null;
  }
}

/**
 * Injected function: Wait for content to plateau in page context
 * Monitors innerText length and returns when it stops growing
 */
function waitForContentPlateauInPage(plateauWait, minContentLength, checkInterval, maxTimeout) {
  return new Promise((resolve) => {
    let lastLength = 0;
    let plateauTimer = null;
    let maxTimer = null;
    let checkCount = 0;

    function getContentLength() {
      // Get text from main content areas if available, otherwise full body
      const mainContent = document.querySelector('main, article, [role="main"], .content, #content');
      const target = mainContent || document.body;
      return (target.innerText || '').length;
    }

    function checkContent() {
      checkCount++;
      const currentLength = getContentLength();

      if (currentLength !== lastLength) {
        // Content is still growing - reset plateau timer
        lastLength = currentLength;
        if (plateauTimer) clearTimeout(plateauTimer);

        // Start new plateau timer
        plateauTimer = setTimeout(() => {
          cleanup();
          resolve({
            finalLength: currentLength,
            checks: checkCount,
            reason: 'plateau'
          });
        }, plateauWait);
      }

      // Check minimum content threshold
      if (currentLength >= minContentLength && !plateauTimer) {
        // Content exists but hasn't changed yet - start plateau timer
        plateauTimer = setTimeout(() => {
          cleanup();
          resolve({
            finalLength: currentLength,
            checks: checkCount,
            reason: 'plateau-with-content'
          });
        }, plateauWait);
      }
    }

    function cleanup() {
      if (plateauTimer) clearTimeout(plateauTimer);
      if (maxTimer) clearTimeout(maxTimer);
      if (checkIntervalId) clearInterval(checkIntervalId);
    }

    // Check content periodically
    const checkIntervalId = setInterval(checkContent, checkInterval);

    // Initial check
    checkContent();

    // Max timeout fallback
    maxTimer = setTimeout(() => {
      cleanup();
      resolve({
        finalLength: getContentLength(),
        checks: checkCount,
        reason: 'timeout'
      });
    }, maxTimeout);
  });
}

/**
 * Wait for DOM to stabilize (no mutations for specified time)
 * Uses MutationObserver to detect when DOM stops changing
 */
async function waitForDOMStability(tabId, timeout) {
  console.log(`[TabFetcher] Waiting for DOM stability...`);

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForDOMStabilityInPage,
      args: [DOM_STABLE_WAIT, timeout]
    });

    if (result && result[0] && result[0].result) {
      console.log(`[TabFetcher] DOM stable after ${result[0].result.mutations} mutations`);
    }
  } catch (error) {
    console.warn(`[TabFetcher] DOM stability check failed:`, error);
    // Continue anyway - better to get content than fail completely
  }
}

/**
 * Injected function: Wait for DOM stability in the page context
 * This runs inside the tab with full DOM access
 */
function waitForDOMStabilityInPage(stabilityWait, maxTimeout) {
  return new Promise((resolve) => {
    let mutationCount = 0;
    let stabilityTimer = null;
    let maxTimer = null;

    const observer = new MutationObserver((mutations) => {
      mutationCount += mutations.length;

      // Reset stability timer on each mutation
      if (stabilityTimer) clearTimeout(stabilityTimer);

      stabilityTimer = setTimeout(() => {
        cleanup();
        resolve({ mutations: mutationCount, reason: 'stable' });
      }, stabilityWait);
    });

    function cleanup() {
      if (stabilityTimer) clearTimeout(stabilityTimer);
      if (maxTimer) clearTimeout(maxTimer);
      observer.disconnect();
    }

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    // Max timeout fallback
    maxTimer = setTimeout(() => {
      cleanup();
      resolve({ mutations: mutationCount, reason: 'timeout' });
    }, maxTimeout);

    // Initial stability check (if DOM already stable)
    stabilityTimer = setTimeout(() => {
      cleanup();
      resolve({ mutations: mutationCount, reason: 'immediate' });
    }, stabilityWait);
  });
}

/**
 * Wait for network to be idle (no requests for specified time)
 * Uses Performance API to monitor resource loading
 */
async function waitForNetworkIdle(tabId, timeout) {
  console.log(`[TabFetcher] Waiting for network idle...`);

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForNetworkIdleInPage,
      args: [NETWORK_IDLE_WAIT, timeout]
    });

    if (result && result[0] && result[0].result) {
      console.log(`[TabFetcher] Network idle after ${result[0].result.resources} resources`);
    }
  } catch (error) {
    console.warn(`[TabFetcher] Network idle check failed:`, error);
  }
}

/**
 * Injected function: Wait for network idle in the page context
 */
function waitForNetworkIdleInPage(idleWait, maxTimeout) {
  return new Promise((resolve) => {
    let idleTimer = null;
    let maxTimer = null;
    let lastResourceCount = 0;

    function checkNetworkIdle() {
      const entries = performance.getEntriesByType('resource');
      const currentCount = entries.length;

      if (currentCount === lastResourceCount) {
        // No new resources - network is idle
        if (idleTimer) clearTimeout(idleTimer);

        idleTimer = setTimeout(() => {
          cleanup();
          resolve({ resources: currentCount, reason: 'idle' });
        }, idleWait);
      } else {
        // New resources loaded - reset timer
        lastResourceCount = currentCount;
        if (idleTimer) clearTimeout(idleTimer);

        // Check again soon
        setTimeout(checkNetworkIdle, 100);
      }
    }

    function cleanup() {
      if (idleTimer) clearTimeout(idleTimer);
      if (maxTimer) clearTimeout(maxTimer);
    }

    // Start checking
    checkNetworkIdle();

    // Max timeout fallback
    maxTimer = setTimeout(() => {
      cleanup();
      const entries = performance.getEntriesByType('resource');
      resolve({ resources: entries.length, reason: 'timeout' });
    }, maxTimeout);
  });
}

/**
 * Wait for specific CSS selectors to appear
 */
async function waitForSelectorsPresent(tabId, selectors, timeout) {
  console.log(`[TabFetcher] Waiting for selectors: ${selectors.join(', ')}`);

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForSelectorsInPage,
      args: [selectors, timeout]
    });

    if (result && result[0] && result[0].result) {
      console.log(`[TabFetcher] Selectors found: ${result[0].result.found.join(', ')}`);
    }
  } catch (error) {
    console.warn(`[TabFetcher] Selector wait failed:`, error);
  }
}

/**
 * Injected function: Wait for selectors in the page context
 */
function waitForSelectorsInPage(selectors, maxTimeout) {
  return new Promise((resolve) => {
    const found = new Set();
    let checkInterval = null;
    let maxTimer = null;

    function checkSelectors() {
      selectors.forEach(selector => {
        if (document.querySelector(selector)) {
          found.add(selector);
        }
      });

      // All found?
      if (found.size === selectors.length) {
        cleanup();
        resolve({ found: Array.from(found), reason: 'complete' });
      }
    }

    function cleanup() {
      if (checkInterval) clearInterval(checkInterval);
      if (maxTimer) clearTimeout(maxTimer);
    }

    // Check every 100ms
    checkInterval = setInterval(checkSelectors, 100);

    // Initial check
    checkSelectors();

    // Max timeout fallback
    maxTimer = setTimeout(() => {
      cleanup();
      resolve({ found: Array.from(found), reason: 'timeout' });
    }, maxTimeout);
  });
}

/**
 * Extract both HTML and text content from the tab
 * Returns HTML for link discovery and text for content storage
 * Also processes markdown conversion in tab context (where DOM is available)
 */
async function extractContent(tabId) {
  // Inject Turndown and GFM plugin for markdown conversion (Readability no longer used)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['lib/vendor/turndown.js', 'lib/vendor/turndown-plugin-gfm.js']
    });
  } catch (error) {
    console.warn('[TabFetcher] Failed to inject markdown libraries:', error);
    // Continue anyway - we'll just skip markdown processing
  }

  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Extract metadata from page head
      function extractMetadata() {
        const metadata = {};

        // Helper function to safely get content
        const getContent = (selector, attr = 'content') => {
          const el = document.querySelector(selector);
          return el ? el[attr] : null;
        };

        // Standard meta tags
        metadata.description = getContent('meta[name="description"]');
        metadata.keywords = getContent('meta[name="keywords"]');
        metadata.author = getContent('meta[name="author"]');
        metadata.generator = getContent('meta[name="generator"]');

        // Open Graph
        metadata.ogTitle = getContent('meta[property="og:title"]');
        metadata.ogDescription = getContent('meta[property="og:description"]');
        metadata.ogType = getContent('meta[property="og:type"]');
        metadata.ogSiteName = getContent('meta[property="og:site_name"]');

        // Article metadata
        metadata.articleSection = getContent('meta[property="article:section"]');
        const tagElements = document.querySelectorAll('meta[property="article:tag"]');
        metadata.articleTags = tagElements.length > 0
          ? Array.from(tagElements).map(tag => tag.content).filter(Boolean)
          : null;

        // Canonical URL
        metadata.canonical = getContent('link[rel="canonical"]', 'href');

        // JSON-LD structured data
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        let jsonLdData = null;

        if (jsonLdScripts.length > 0) {
          jsonLdScripts.forEach(script => {
            try {
              const data = JSON.parse(script.textContent);
              if (data && (data.headline || data.description || data.name)) {
                // Store first valid JSON-LD with descriptive content
                if (!jsonLdData) {
                  jsonLdData = {
                    type: data['@type'] || null,
                    headline: data.headline || null,
                    description: data.description || null,
                    name: data.name || null,
                    author: data.author?.name || null
                  };
                }
              }
            } catch(e) {
              // Silently skip invalid JSON-LD
            }
          });
        }

        metadata.jsonLd = jsonLdData;

        // Clean up null values
        Object.keys(metadata).forEach(key => {
          if (metadata[key] === null || metadata[key] === undefined) {
            delete metadata[key];
          }
        });

        return metadata;
      }

      // Process markdown conversion using direct body conversion (no Readability)
      // This approach preserves all content and is more reliable for documentation sites
      function processMarkdown(html, url, text) {
        try {
          // Check if TurndownService is available
          if (typeof TurndownService === 'undefined') {
            console.log('[TabFetcher] Turndown library not available, skipping conversion');
            return { markdown: null, markdownMeta: null };
          }

          /**
           * Remove noise elements from a document clone.
           * Removes navigation, sidebars, ads, and other non-content elements.
           *
           * @param {Document} doc - Document to clean (will be modified)
           */
          function removeNoiseElements(doc) {
            const noiseSelectors = [
              // Scripts and styles
              'script', 'style', 'noscript',
              // Navigation and UI elements
              'nav', 'header', 'footer', 'aside',
              '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
              '.header', '.footer', '.breadcrumb', '.breadcrumbs',
              // Sidebar variations (common in documentation sites)
              '#side-bar', '#sidebar', '#sideBar', '#SideBar',
              '#left-sidebar', '#right-sidebar', '#leftSidebar', '#rightSidebar',
              '.side-bar', '.sideBar', '.left-sidebar', '.right-sidebar',
              '#nav-btn-container', '.nav-button', '.nav-footer',
              '.toc', '#toc', '.table-of-contents', '#table-of-contents',
              // CSS Modules patterns (keyword followed by hash separator __)
              // Matches patterns like: componentName_documentationSidebar__hash, styles_mainNavigation__abc123
              // Broader patterns - keyword anywhere before the __ hash separator
              '[class*="Sidebar__"]', '[class*="sidebar__"]',
              '[class*="SideBar__"]', '[class*="sideBar__"]',
              '[class*="Sidenav__"]', '[class*="sidenav__"]',
              '[class*="SideNav__"]', '[class*="sideNav__"]',
              '[class*="Navigation__"]', '[class*="navigation__"]',
              '[class*="NavMenu__"]', '[class*="navMenu__"]',
              '[class*="NavBar__"]', '[class*="navBar__"]', '[class*="Navbar__"]', '[class*="navbar__"]',
              '[class*="TopNav__"]', '[class*="topNav__"]',
              '[class*="SideMenu__"]', '[class*="sideMenu__"]',
              '[class*="Drawer__"]', '[class*="drawer__"]',
              '[class*="LeftPanel__"]', '[class*="leftPanel__"]',
              '[class*="RightPanel__"]', '[class*="rightPanel__"]',
              // Material UI (MUI) specific patterns
              '[class^="MuiDrawer"]', '[class*=" MuiDrawer"]',
              '[class^="MuiAppBar"]', '[class*=" MuiAppBar"]',
              // Data attributes commonly used for navigation JS control
              '[data-sidebar]', '[data-drawer]', '[data-navigation]',
              '[data-twe-sidenav-init]', '[data-twe-navbar-init]',
              // Ads and social
              '.ad', '.ads', '.advertisement', '.social-share', '.share-buttons',
              // Cookie banners and popups
              '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
              '.popup', '.modal', '.overlay',
              // Comments
              '.comments', '.comment-section', '#comments',
              // Hidden elements
              '[hidden]', '[aria-hidden="true"]',
              // Role-based noise
              '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
              '[role="complementary"]', '[role="search"]',
              // Additional common noise patterns
              '.related-posts', '.recommended', '.more-articles',
              '.author-bio', '.author-card', '.post-author',
              '.newsletter', '.subscribe', '.signup-form',
              '.share-widget', '.social-links', '.social-buttons',
              '.promo', '.promotion', '.banner',
              '.feedback', '.rating', '.reactions'
            ];

            noiseSelectors.forEach(selector => {
              try {
                doc.querySelectorAll(selector).forEach(el => el.remove());
              } catch (e) {
                // Ignore invalid selectors
              }
            });
          }

          /**
           * Create and configure the Turndown service with all custom rules.
           *
           * @returns {TurndownService} Configured Turndown instance
           */
          function createTurndownService() {
            const turndownService = new TurndownService({
              headingStyle: 'atx',
              codeBlockStyle: 'fenced',
              bulletListMarker: '-',
              emDelimiter: '_',
              strongDelimiter: '**',
              linkStyle: 'inlined'
            });

            // Add GFM tables support
            if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.tables) {
              turndownService.use(turndownPluginGfm.tables);
            }

            // Custom rule: Handle <code> elements containing links
            // Converts <code><a href="url">text</a></code> to [`text`](url)
            turndownService.addRule('codeWithLink', {
              filter: function (node) {
                if (node.nodeName !== 'CODE') return false;
                if (node.parentNode && node.parentNode.nodeName === 'PRE') return false;

                const children = Array.from(node.childNodes);
                const meaningfulChildren = children.filter(child => {
                  if (child.nodeType === 3) {
                    return child.textContent.trim() !== '';
                  }
                  return true;
                });

                return meaningfulChildren.length === 1 &&
                       meaningfulChildren[0].nodeName === 'A';
              },
              replacement: function (content, node) {
                const link = node.querySelector('a');
                if (!link) return '`' + content + '`';

                const href = link.getAttribute('href') || '';
                const text = link.textContent || '';
                const title = link.getAttribute('title');

                const titlePart = title ? ' "' + title.replace(/"/g, '\\"') + '"' : '';
                return '[`' + text + '`](' + href + titlePart + ')';
              }
            });

            return turndownService;
          }

          /**
           * Post-process markdown to clean up formatting issues.
           *
           * @param {string} markdown - Raw markdown from Turndown
           * @returns {string} Cleaned markdown
           */
          function postProcessMarkdown(markdown) {
            let result = markdown;
            result = result.replace(/\n{4,}/g, '\n\n\n');
            result = result.replace(/```(\w*)\n\n+/g, '```$1\n');
            result = result.replace(/\n\n+```/g, '\n```');
            result = result.replace(/^([-*+])\s{2,}/gm, '$1 ');
            result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
            result = result.split('\n').map(line => line.trimEnd()).join('\n');
            result = result.trim() + '\n';
            return result;
          }

          /**
           * Detect and normalize non-standard code blocks that don't use <pre> tags.
           * Some syntax highlighters (like react-syntax-highlighter) wrap code in
           * <span> or <div> with white-space:pre styling instead of using <pre> tags.
           * This converts them to standard <pre><code> structure before Turndown processes them.
           *
           * Detection heuristics (conservative, multi-signal approach):
           * 1. Look for containers with multiple sibling <code> elements (not inside <pre>)
           * 2. One <code> must appear to be line numbers (by class or content)
           * 3. Another <code> must contain actual code (syntax tokens or non-digit content)
           *
           * @param {Document} doc - DOM document to process
           */
          function normalizeNonPreCodeBlocks(doc) {
            const allCodes = Array.from(doc.querySelectorAll('code'));
            const processed = new Set();

            for (const code of allCodes) {
              if (processed.has(code)) continue;
              // Skip if already inside a <pre> - those are handled by normalizeCodeBlocks()
              if (code.closest('pre')) continue;

              const parent = code.parentElement;
              if (!parent) continue;

              // Get sibling <code> elements (direct children of same parent)
              const siblingCodes = Array.from(parent.children).filter(el => el.tagName === 'CODE');
              if (siblingCodes.length < 2) continue;

              // Mark all siblings as processed to avoid duplicate handling
              siblingCodes.forEach(c => processed.add(c));

              // Identify which <code> is line numbers vs actual code
              let lineNumberCode = null;
              let actualCodeElement = null;

              for (const codeEl of siblingCodes) {
                const text = (codeEl.textContent || '').trim();

                // Check for line number indicators:
                // 1. Has children with known line-number classes
                const hasLineNumberChildren = codeEl.querySelector(
                  '.react-syntax-highlighter-line-number, ' +
                  '.line-number, .line-numbers, .linenumber, .linenumbers, ' +
                  '.hljs-ln-numbers, .hljs-ln-n, [data-line-number]'
                );

                // 2. Content is only digits and whitespace (e.g., "1 2 3 4 5")
                const isOnlyDigits = /^[\d\s\n]+$/.test(text);

                if (hasLineNumberChildren || (isOnlyDigits && text.length > 0)) {
                  lineNumberCode = codeEl;
                } else {
                  // Check for syntax highlighting tokens (strong signal of actual code)
                  const hasTokens = codeEl.querySelector(
                    '.token, .punctuation, .keyword, .string, .number, ' +
                    '[class*="hljs-"], [class*="prism-"]'
                  );

                  // Has tokens OR has non-digit content = actual code
                  if (hasTokens || !isOnlyDigits) {
                    actualCodeElement = codeEl;
                  }
                }
              }

              // Only proceed if we confidently found both patterns
              if (lineNumberCode && actualCodeElement) {
                const codeText = actualCodeElement.textContent || '';

                // Try to detect language from various sources
                let language = '';
                const sources = [actualCodeElement, parent, parent.parentElement];
                for (const el of sources) {
                  if (!el || !el.className) continue;
                  const match = el.className.match(/language-(\S+)/);
                  if (match) {
                    language = match[1];
                    break;
                  }
                }

                // Create standard <pre><code> structure
                const pre = doc.createElement('pre');
                const newCode = doc.createElement('code');
                if (language) newCode.className = 'language-' + language;
                newCode.textContent = codeText;
                pre.appendChild(newCode);

                // Replace parent element with the new <pre>
                if (parent.parentNode) {
                  parent.parentNode.replaceChild(pre, parent);
                }
              }
            }
          }

          /**
           * Normalize code blocks in the document before markdown conversion.
           * Handles syntax highlighter output with line numbers, multiple <code> elements, etc.
           *
           * @param {Document} doc - DOM document to process
           */
          function normalizeCodeBlocks(doc) {
            const preTags = doc.querySelectorAll('pre');

            preTags.forEach(pre => {
              // Remove known decorative elements (line numbers, copy buttons, etc.)
              const decorativeSelectors = [
                '.react-syntax-highlighter-line-number',
                '.line-number', '.line-numbers', '.linenumber', '.linenumbers',
                '.hljs-ln-numbers', '.hljs-ln-n', '[data-line-number]',
                '.copy-button', '.copy-code', 'button.copy',
                '.code-toolbar > .toolbar', '.prism-show-language', '.line-numbers-rows'
              ];

              decorativeSelectors.forEach(selector => {
                try {
                  pre.querySelectorAll(selector).forEach(el => el.remove());
                } catch (e) {
                  // Ignore invalid selectors
                }
              });

              // Get all direct <code> children
              const codeElements = Array.from(pre.querySelectorAll(':scope > code'));

              // If 0 or 1 code elements, nothing special to do
              if (codeElements.length <= 1) return;

              // Multiple <code> elements - find the actual code (not line numbers)
              let actualCodeText = '';
              let detectedLanguage = '';

              for (const code of codeElements) {
                const text = code.textContent || '';
                const className = code.className || '';

                // Skip line numbers
                if (/line-?numbers?|linenumbers?/i.test(className)) continue;
                const trimmedText = text.trim();
                if (!trimmedText) continue;
                if (/^[\d\s\n]+$/.test(trimmedText)) continue;

                // Skip if all children are line number spans
                const children = code.querySelectorAll('span');
                if (children.length > 0) {
                  const allLineNumbers = Array.from(children).every(span =>
                    /line-?number|linenumber/i.test(span.className || '')
                  );
                  if (allLineNumbers) continue;
                }

                // Found actual code
                actualCodeText = text;
                const langMatch = className.match(/language-(\S+)/);
                if (langMatch) detectedLanguage = langMatch[1];
                break;
              }

              // Normalize the <pre> structure if we found code
              if (actualCodeText) {
                if (!detectedLanguage) {
                  const preClass = pre.className || '';
                  const preLangMatch = preClass.match(/language-(\S+)/);
                  if (preLangMatch) detectedLanguage = preLangMatch[1];
                }
                if (!detectedLanguage) {
                  detectedLanguage = pre.getAttribute('data-language') ||
                                    pre.getAttribute('data-lang') || '';
                }

                const newCode = doc.createElement('code');
                if (detectedLanguage) newCode.className = 'language-' + detectedLanguage;
                newCode.textContent = actualCodeText;

                while (pre.firstChild) pre.removeChild(pre.firstChild);
                pre.appendChild(newCode);
              }
            });
          }

          /**
           * Resolve relative URLs to absolute URLs for standalone markdown files.
           * Converts relative paths like "/docs/api" to full URLs like "https://example.com/docs/api"
           * so that links work when the markdown file is used outside the original website context.
           *
           * @param {Document} doc - Document to process (will be modified)
           * @param {string} baseUrl - Base URL for resolving relative paths
           */
          function resolveRelativeUrls(doc, baseUrl) {
            // Resolve anchor hrefs
            doc.querySelectorAll('a[href]').forEach(anchor => {
              const href = anchor.getAttribute('href');
              if (!href) return;

              // Skip already absolute URLs, data URIs, javascript:, mailto:, tel:, etc.
              if (/^(https?:\/\/|data:|javascript:|mailto:|tel:|#)/i.test(href)) return;

              try {
                const absoluteUrl = new URL(href, baseUrl).href;
                anchor.setAttribute('href', absoluteUrl);
              } catch (e) {
                // Invalid URL, leave as-is
              }
            });

            // Resolve image srcs
            doc.querySelectorAll('img[src]').forEach(img => {
              const src = img.getAttribute('src');
              if (!src) return;

              // Skip already absolute URLs and data URIs
              if (/^(https?:\/\/|data:)/i.test(src)) return;

              try {
                const absoluteUrl = new URL(src, baseUrl).href;
                img.setAttribute('src', absoluteUrl);
              } catch (e) {
                // Invalid URL, leave as-is
              }
            });
          }

          /**
           * Flatten block elements inside anchor tags to prevent malformed markdown links.
           * Block elements (div, p, etc.) inside <a> tags cause Turndown to create
           * links with newlines in the text, like: [\n\ntext\n\n](url)
           * This function replaces block elements with their text content.
           *
           * @param {Document} doc - Document to process (will be modified)
           */
          function flattenBlockElementsInAnchors(doc) {
            const anchors = doc.querySelectorAll('a');

            anchors.forEach(anchor => {
              // Check if anchor contains any block-level elements
              const blockElements = anchor.querySelectorAll('div, p, section, article, header, footer, main, aside, nav, ul, ol, li, table, tr, td, th, blockquote, figure, figcaption, address, h1, h2, h3, h4, h5, h6');

              if (blockElements.length === 0) return;

              // Get the combined text content, normalized
              const textContent = anchor.textContent || '';
              // Normalize whitespace: collapse multiple spaces/newlines to single space
              const normalizedText = textContent.replace(/\s+/g, ' ').trim();

              // Preserve the href and other attributes
              const href = anchor.getAttribute('href');
              const title = anchor.getAttribute('title');

              // Clear the anchor and set normalized text
              anchor.textContent = normalizedText;

              // Restore attributes (textContent clears them)
              if (href) anchor.setAttribute('href', href);
              if (title) anchor.setAttribute('title', title);
            });
          }

          // Clone and prepare document for conversion
          const cleanDoc = document.cloneNode(true);
          const currentPageUrl = window.location.href;
          normalizeNonPreCodeBlocks(cleanDoc);  // Convert non-standard code blocks to <pre><code>
          normalizeCodeBlocks(cleanDoc);         // Clean up <pre> elements (line numbers, etc.)
          flattenBlockElementsInAnchors(cleanDoc);
          resolveRelativeUrls(cleanDoc, currentPageUrl);
          removeNoiseElements(cleanDoc);

          // Convert to markdown using Turndown
          const turndownService = createTurndownService();
          let markdown = turndownService.turndown(cleanDoc.body.innerHTML);
          markdown = postProcessMarkdown(markdown);

          // Get text content for metrics
          const cleanText = cleanDoc.body.textContent || cleanDoc.body.innerText || '';
          const textLength = cleanText.length;

          // Calculate quality metrics
          const linkMatches = cleanDoc.body.innerHTML.match(/<a\s+/gi) || [];
          const linkDensity = textLength > 0 ? linkMatches.length / (textLength / 100) : 0;
          const hasHeaders = /^#{1,6}\s+.+$/m.test(markdown);
          const hasCodeBlocks = /```/.test(markdown);
          const hasLists = /^[-*+]\s+/m.test(markdown);
          const hasTables = /\|.+\|/.test(markdown);
          const hasStructure = hasHeaders || hasCodeBlocks || hasLists || hasTables;
          const h2Count = (markdown.match(/^##\s+/gm) || []).length;

          // Calculate confidence based on content quality
          let confidence = 0.85; // Start with good confidence for direct conversion
          if (textLength < 200) confidence -= 0.3;
          if (textLength > 1000) confidence += 0.05;
          if (linkDensity > 3.0) confidence -= 0.2; // High link density = likely index
          if (hasStructure) confidence += 0.1;
          if (hasTables) confidence += 0.05; // Tables often indicate valuable content
          if (h2Count > 20) confidence -= 0.1; // Many h2s might be index page
          confidence = Math.max(0, Math.min(1, confidence));

          return {
            markdown: markdown,
            markdownMeta: {
              confidence: confidence,
              isArticle: confidence > 0.5,
              title: document.title,
              byline: null,
              excerpt: cleanText.substring(0, 200).trim(),
              siteName: null,
              textLength: textLength,
              linkDensity: linkDensity,
              hasStructure: hasStructure,
              h2Count: h2Count,
              hasTables: hasTables
            }
          };
        } catch (error) {
          console.error('[TabFetcher] Error processing markdown:', error);
          return {
            markdown: null,
            markdownMeta: {
              confidence: 0,
              isArticle: false,
              reason: 'processing-error',
              error: error.message
            }
          };
        }
      }

      /**
       * Extract all links from the page using DOM APIs.
       * This is more reliable than regex because it runs after JavaScript
       * and can access computed styles to filter invisible elements.
       *
       * @returns {string[]} Array of absolute URLs
       */
      function extractLinks() {
        const links = new Set();
        const baseUrl = window.location.href;

        // Helper to check if an element is visible
        function isVisible(el) {
          if (!el) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0' &&
                 el.offsetParent !== null;
        }

        // Helper to resolve and validate URLs
        function addUrl(href) {
          if (!href || typeof href !== 'string') return;
          href = href.trim();

          // Skip non-http links
          if (href.startsWith('mailto:') ||
              href.startsWith('tel:') ||
              href.startsWith('javascript:') ||
              href.startsWith('data:') ||
              href.startsWith('#') ||
              href === '') {
            return;
          }

          try {
            // Resolve relative URLs to absolute
            const absoluteUrl = new URL(href, baseUrl).href;

            // Only include http/https URLs
            if (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://')) {
              links.add(absoluteUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }

        // 1. Standard <a href> links (most common)
        document.querySelectorAll('a[href]').forEach(anchor => {
          // Optionally filter invisible links (commented out for now - we want all links)
          // if (!isVisible(anchor)) return;
          addUrl(anchor.getAttribute('href'));
        });

        // 2. Links in data attributes (common in SPAs)
        document.querySelectorAll('[data-href], [data-url], [data-link]').forEach(el => {
          addUrl(el.getAttribute('data-href'));
          addUrl(el.getAttribute('data-url'));
          addUrl(el.getAttribute('data-link'));
        });

        // 3. Links in onclick handlers (basic pattern matching)
        document.querySelectorAll('[onclick]').forEach(el => {
          const onclick = el.getAttribute('onclick') || '';

          // Match patterns like: location.href='/page', window.location='/page', etc.
          const patterns = [
            /location\.href\s*=\s*['"]([^'"]+)['"]/gi,
            /location\s*=\s*['"]([^'"]+)['"]/gi,
            /window\.open\s*\(\s*['"]([^'"]+)['"]/gi,
            /navigate\s*\(\s*['"]([^'"]+)['"]/gi,
            /href\s*:\s*['"]([^'"]+)['"]/gi
          ];

          patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(onclick)) !== null) {
              addUrl(match[1]);
            }
          });
        });

        // 4. Links in buttons with data-navigate or similar
        document.querySelectorAll('button[data-navigate], button[data-to], [role="link"]').forEach(el => {
          addUrl(el.getAttribute('data-navigate'));
          addUrl(el.getAttribute('data-to'));
          addUrl(el.getAttribute('href'));
        });

        // 5. Next.js/React Router Link components often render as <a> but may have data-href
        document.querySelectorAll('[data-next-link], [data-router-link]').forEach(el => {
          const anchor = el.tagName === 'A' ? el : el.querySelector('a');
          if (anchor) addUrl(anchor.getAttribute('href'));
        });

        // 6. Area elements in image maps
        document.querySelectorAll('area[href]').forEach(area => {
          addUrl(area.getAttribute('href'));
        });

        // 7. Links in JSON-LD structured data
        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
          try {
            const json = JSON.parse(script.textContent);
            const extractFromJson = (obj) => {
              if (!obj || typeof obj !== 'object') return;
              for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string' && (key === 'url' || key === '@id' || key === 'mainEntityOfPage')) {
                  addUrl(value);
                } else if (typeof value === 'object') {
                  extractFromJson(value);
                }
              }
            };
            extractFromJson(json);
          } catch (e) {
            // Invalid JSON, skip
          }
        });

        // 8. Sitemap links in HTML (some sites embed sitemap-like structures)
        document.querySelectorAll('loc').forEach(loc => {
          addUrl(loc.textContent);
        });

        // 9. Monitor history.pushState/replaceState for SPA route discovery
        // This captures routes that Angular/React/Vue Router navigate to
        const capturedSpaRoutes = [];
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(state, title, url) {
          if (url) {
            capturedSpaRoutes.push(url.toString());
          }
          return originalPushState.call(this, state, title, url);
        };

        history.replaceState = function(state, title, url) {
          if (url) {
            capturedSpaRoutes.push(url.toString());
          }
          return originalReplaceState.call(this, state, title, url);
        };

        // 10. Detect clickable elements with cursor:pointer (potential SPA navigation)
        // Click them to discover routes, but limit to avoid side effects
        const clickableElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          // Must have pointer cursor and be visible
          if (style.cursor !== 'pointer') return false;
          if (!isVisible(el)) return false;

          // Must not be a standard link (those are already captured)
          if (el.tagName === 'A' && el.getAttribute('href')) return false;

          // Must not be a form button or input (avoid triggering actions)
          if (el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit') return false;
          if (el.tagName === 'INPUT') return false;

          // Skip if element text suggests it's an action button (not navigation)
          const text = (el.textContent || '').toLowerCase();
          const actionWords = ['submit', 'delete', 'remove', 'buy', 'purchase', 'add to cart', 'checkout', 'pay', 'confirm'];
          if (actionWords.some(word => text.includes(word))) return false;

          return true;
        });

        console.log(`[TabFetcher] Found ${clickableElements.length} clickable elements with cursor:pointer`);

        // Click up to 50 elements to discover routes (limit to prevent excessive clicking)
        const maxClickableToTest = 50;
        const originalUrl = window.location.href;
        let clickedCount = 0;

        for (let i = 0; i < Math.min(maxClickableToTest, clickableElements.length); i++) {
          const el = clickableElements[i];

          try {
            // Trigger a synthetic click event
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });

            el.dispatchEvent(clickEvent);
            clickedCount++;

            // Check if URL changed (synchronously or after microtask)
            // Use a microtask to let Angular Router update
            const checkUrl = () => {
              if (window.location.href !== originalUrl) {
                capturedSpaRoutes.push(window.location.href);
                // Navigate back immediately
                history.back();
              }
            };

            // Check immediately and after microtask
            checkUrl();
            Promise.resolve().then(checkUrl);

          } catch (e) {
            // Click failed, skip this element
          }
        }

        console.log(`[TabFetcher] Clicked ${clickedCount} elements, captured ${capturedSpaRoutes.length} SPA routes`);

        // Restore original history methods
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;

        // Add captured SPA routes to the links set
        capturedSpaRoutes.forEach(url => addUrl(url));

        console.log(`[TabFetcher] Extracted ${links.size} links using DOM APIs (including ${capturedSpaRoutes.length} SPA routes)`);
        return Array.from(links);
      }

      // Get current page URL
      const currentUrl = window.location.href;
      const html = document.documentElement.outerHTML;
      const text = document.body.innerText;
      const metadata = extractMetadata();
      const { markdown, markdownMeta } = processMarkdown(html, currentUrl, text);
      const links = extractLinks();

      // Add debug info for Service Worker logging
      if (markdownMeta) {
        markdownMeta._debugInfo = {
          originalTextLength: text.length,
          extractedVia: 'direct-conversion',
          timestamp: new Date().toISOString()
        };
      }

      // Return all extracted data:
      // - html: for link extraction fallback (contains <a> tags)
      // - text: for content storage (clean text via innerText)
      // - metadata: extracted from page head
      // - markdown: converted markdown (or null)
      // - markdownMeta: quality metrics (or null)
      // - links: DOM-extracted links (more reliable than regex)
      return {
        html,
        text,
        metadata,
        markdown,
        markdownMeta,
        links
      };
    }
  });

  if (!result || !result[0] || !result[0].result) {
    throw new Error('Failed to extract content from tab');
  }

  return result[0].result;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get recommended mode based on URL patterns
 * Documentation sites can often use balanced mode
 */
export function getRecommendedMode(url) {
  const urlLower = url.toLowerCase();

  // Static documentation generators - fast mode
  if (urlLower.includes('github.io') ||
      urlLower.includes('readthedocs.io') ||
      urlLower.includes('gitbook.io')) {
    return FetchMode.FAST;
  }

  // Known SPAs - thorough mode
  if (urlLower.includes('react') ||
      urlLower.includes('vue') ||
      urlLower.includes('angular')) {
    return FetchMode.THOROUGH;
  }

  // Default to balanced
  return FetchMode.BALANCED;
}
