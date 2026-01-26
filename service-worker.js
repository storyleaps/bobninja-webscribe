/**
 * Service Worker for Webscribe Chrome Extension
 * Handles background web crawling and message passing with popup
 * VERSION: 2.13.0
 */

import { startCrawl, resumeCrawl, getActiveCrawl, cancelActiveCrawl } from './lib/crawler.js';
import { initDB, checkAndMigrate, forceMigration, getAllJobs, getJob, deleteJob, updateJob, getPagesByJobId, searchPages, getAllErrorLogs, clearErrorLogs, getErrorLogCount, createJob, savePage } from './storage/db.js';
import { canonicalizeUrl } from './lib/utils.js';
import { initErrorLogger, logError, generateDiagnosticReport, generateDiagnosticReportString } from './lib/error-logger.js';

// Current service worker version - increment this when making changes
const SERVICE_WORKER_VERSION = '2.14.0';

console.log(`🚀 Service worker v${SERVICE_WORKER_VERSION} started`);

// Initialize error logger with extension version
try {
  const manifest = chrome.runtime.getManifest();
  initErrorLogger(manifest.version);
} catch (e) {
  initErrorLogger(SERVICE_WORKER_VERSION);
}

// Global error handlers for uncaught errors
self.addEventListener('error', (event) => {
  console.error('[ServiceWorker] Uncaught error:', event.error);
  logError('service-worker', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: 'uncaught-error'
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[ServiceWorker] Unhandled promise rejection:', event.reason);
  logError('service-worker', event.reason, {
    type: 'unhandled-rejection'
  });
});

// Initialize database on install
self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing v${SERVICE_WORKER_VERSION}...`);

  // Skip waiting to immediately activate the new service worker
  // This ensures updates are applied without waiting for tabs to close
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      await initDB();
      await checkAndMigrate();

      // Store the new version
      await chrome.storage.local.set({ serviceWorkerVersion: SERVICE_WORKER_VERSION });
      console.log(`[ServiceWorker] Version ${SERVICE_WORKER_VERSION} installed`);
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] Activating v${SERVICE_WORKER_VERSION}...`);

  // Claim all clients immediately so the new service worker takes control
  // without waiting for page reload
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await initDB();
      await checkAndMigrate();

      // Check if this is an update
      const stored = await chrome.storage.local.get('serviceWorkerVersion');
      const previousVersion = stored.serviceWorkerVersion || 'unknown';

      if (previousVersion !== SERVICE_WORKER_VERSION) {
        console.log(`[ServiceWorker] Updated from v${previousVersion} to v${SERVICE_WORKER_VERSION}`);

        // Clear any cached state that might be stale
        // Note: We don't clear the database, just runtime caches
        console.log('[ServiceWorker] Clearing stale caches...');

        // Store the new version
        await chrome.storage.local.set({ serviceWorkerVersion: SERVICE_WORKER_VERSION });

        // Notify all open popups to refresh (if any)
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'SERVICE_WORKER_UPDATED',
            data: { version: SERVICE_WORKER_VERSION, previousVersion }
          });
        });

        console.log(`[ServiceWorker] Update complete. New version: ${SERVICE_WORKER_VERSION}`);
      } else {
        console.log(`[ServiceWorker] Activated (same version: ${SERVICE_WORKER_VERSION})`);
      }
    })()
  );
});

// Handle messages from popup
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

      // Content Picker handlers
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

/**
 * Start a new crawl
 */
async function handleStartCrawl(event, data) {
  const { baseUrl, options = {} } = data;

  if (!baseUrl) {
    throw new Error('Base URL is required');
  }

  // Check if crawl already in progress
  const activeCrawl = getActiveCrawl();
  if (activeCrawl) {
    throw new Error('A crawl is already in progress');
  }

  // Start crawl with progress callback and options
  const jobId = await startCrawl(baseUrl, (progress) => {
    // Broadcast progress to all connected clients
    broadcastProgress(jobId, progress);
  }, options);

  sendResponse(event, { jobId, status: 'started' });
}

/**
 * Resume an interrupted crawl
 */
async function handleResumeCrawl(event, data) {
  const { jobId, options = {} } = data;

  try {
    if (!jobId) {
      throw new Error('Job ID is required to resume');
    }

    // Check if crawl already in progress
    const activeCrawl = getActiveCrawl();
    if (activeCrawl) {
      throw new Error('A crawl is already in progress');
    }

    // Resume crawl with progress callback and options
    await resumeCrawl(jobId, (progress) => {
      // Broadcast progress to all connected clients
      broadcastProgress(jobId, progress);
    }, options);

    sendResponse(event, { jobId, status: 'resumed' });
  } catch (error) {
    console.error('[ServiceWorker] Failed to resume crawl:', error);
    logError('service-worker', error, {
      action: 'handleResumeCrawl',
      jobId
    });
    throw error; // Re-throw to be caught by outer handler
  }
}

/**
 * Cancel active crawl
 */
async function handleCancelCrawl(event) {
  cancelActiveCrawl();
  sendResponse(event, { status: 'cancelled' });
}

/**
 * Get all jobs
 */
async function handleGetJobs(event) {
  const jobs = await getAllJobs();
  sendResponse(event, { jobs });
}

/**
 * Get a specific job
 */
async function handleGetJob(event, data) {
  const { jobId } = data;
  const job = await getJob(jobId);
  sendResponse(event, { job });
}

/**
 * Delete a job
 */
async function handleDeleteJob(event, data) {
  const { jobId } = data;
  await deleteJob(jobId);
  sendResponse(event, { status: 'deleted' });
}

/**
 * Update a job
 */
async function handleUpdateJob(event, data) {
  const { jobId, updates } = data;
  await updateJob(jobId, updates);
  sendResponse(event, { status: 'updated' });
}

/**
 * Get pages for a job
 */
async function handleGetPages(event, data) {
  const { jobId } = data;
  const pages = await getPagesByJobId(jobId);
  sendResponse(event, { pages });
}

/**
 * Search pages
 */
async function handleSearch(event, data) {
  const { query } = data;
  const results = await searchPages(query);
  sendResponse(event, { results });
}

/**
 * Get current crawl status
 */
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

/**
 * Force database migration by deleting and recreating
 * WARNING: This deletes all data!
 */
async function handleForceMigration(event) {
  console.log('[ServiceWorker] Force migration requested');

  try {
    const result = await forceMigration();
    sendResponse(event, result);
  } catch (error) {
    console.error('[ServiceWorker] Force migration failed:', error);
    sendResponse(event, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Send response to message sender
 */
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

/**
 * Broadcast progress update to all clients
 */
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

// ================ ERROR LOG HANDLERS ================

/**
 * Get all error logs
 */
async function handleGetErrorLogs(event) {
  const logs = await getAllErrorLogs();
  sendResponse(event, { logs });
}

/**
 * Get error log count
 */
async function handleGetErrorCount(event) {
  const count = await getErrorLogCount();
  sendResponse(event, { count });
}

/**
 * Clear all error logs
 */
async function handleClearErrorLogs(event) {
  await clearErrorLogs();
  sendResponse(event, { status: 'cleared' });
}

/**
 * Generate diagnostic error report
 * @param {Object} data - Options for report generation
 * @param {string} data.format - 'json' or 'string' (default: 'json')
 */
async function handleGenerateErrorReport(event, data = {}) {
  const format = data?.format || 'json';

  if (format === 'string') {
    const report = await generateDiagnosticReportString();
    sendResponse(event, { report, format: 'string' });
  } else {
    const report = await generateDiagnosticReport();
    sendResponse(event, { report, format: 'json' });
  }
}

/**
 * Log an error from external source (popup, content script, etc.)
 */
async function handleLogError(event, data = {}) {
  const { source, message, stack, context } = data;

  // Create error object for logging
  const error = new Error(message);
  if (stack) error.stack = stack;

  await logError(source || 'external', error, context || {});
  sendResponse(event, { status: 'logged' });
}

// ================ CONTENT PICKER HANDLERS ================

/**
 * Start content picker by injecting script into active tab
 */
async function handleStartContentPicker(event) {
  try {
    // Get the active tab in the last focused window (excludes popup)
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let activeTab = tabs[0];

    // If no tab found, try current window
    if (!activeTab) {
      const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = currentTabs[0];
    }

    if (!activeTab) {
      throw new Error('No active tab found. Please open a web page first.');
    }

    // Check if we can inject into this tab
    const url = activeTab.url || '';

    if (!url || url === '') {
      throw new Error('Cannot access this tab. Please navigate to a web page.');
    }

    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:') ||
        url.startsWith('file://') || url.startsWith('devtools://')) {
      throw new Error(`Cannot pick content from this page (${url.split('/')[0]}//). Please navigate to a regular web page (http:// or https://).`);
    }

    // First inject Turndown libraries
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['lib/vendor/turndown.js', 'lib/vendor/turndown-plugin-gfm.js']
    });

    // Then inject the content picker
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['lib/content-picker.js']
    });

    sendResponse(event, { status: 'started', tabId: activeTab.id });

  } catch (error) {
    console.error('[ServiceWorker] Failed to start content picker:', error);
    sendResponse(event, { error: error.message });
  }
}

/**
 * Save picked content as a job with single page
 */
async function handleSavePickedContent(event, data) {
  const { url, title, html, markdown, text } = data;

  try {
    if (!url || !text) {
      throw new Error('Invalid picked content: missing URL or text');
    }

    // Normalize URL for consistency
    const canonicalUrl = canonicalizeUrl(url);

    // Create a new job for the picked content
    const job = await createJob(url, canonicalUrl);

    // Calculate markdown metadata
    const markdownMeta = {
      confidence: 0.9, // High confidence since user selected it
      isArticle: true,
      title: title,
      textLength: text.length,
      source: 'content-picker'
    };

    // Save the page
    await savePage(
      job.id,
      url,
      canonicalUrl,
      text,        // content (plain text)
      'success',   // status
      html,        // html
      null,        // contentHash (not needed for single page)
      { title },   // metadata
      markdown,    // markdown
      markdownMeta // markdownMeta
    );

    // Update job status to completed
    await updateJob(job.id, {
      status: 'completed',
      pagesFound: 1,
      pagesProcessed: 1,
      pagesFailed: 0
    });

    sendResponse(event, { status: 'saved', jobId: job.id });

    // Clear the picked content from storage
    await chrome.storage.local.remove('pickedContent');

  } catch (error) {
    console.error('[ServiceWorker] Failed to save picked content:', error);
    sendResponse(event, { error: error.message });
  }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log('[ServiceWorker] Notification clicked:', notificationId);

  // Check if this is a content picker notification
  const stored = await chrome.storage.local.get('lastContentPickerNotification');
  if (stored.lastContentPickerNotification === notificationId) {
    // Open the popup (user will see the picked content ready to save)
    // Note: We can't programmatically open the popup, but we can open a window
    // For now, just clear the notification
    await chrome.notifications.clear(notificationId);
  }
});

// Handle messages from content scripts (chrome.runtime.sendMessage)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};

  if (type === 'CONTENT_PICKED') {
    (async () => {
      try {
        await handleContentPickedFromContentScript(payload);
        sendResponse({ received: true, success: true });
      } catch (error) {
        console.error('[ServiceWorker] Error handling CONTENT_PICKED:', error);
        sendResponse({ received: true, success: false, error: error.message });
      }
    })();
    return true;
  } else if (type === 'CONTENT_PICK_CANCELLED') {
    sendResponse({ received: true });
    return false;
  }

  return false;
});

/**
 * Handle content picked message from content script
 */
async function handleContentPickedFromContentScript(data) {
  const { copied } = data || {};

  try {
    const notificationId = 'content-picked-' + Date.now();

    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Content Selected',
      message: copied
        ? 'Markdown copied to clipboard! Open extension to save.'
        : 'Content extracted. Open extension to save.',
      priority: 2
    });

    await chrome.storage.local.set({
      lastContentPickerNotification: notificationId
    });

  } catch (error) {
    console.error('[ServiceWorker] Failed to show notification:', error);
  }
}

console.log('Service worker loaded');
