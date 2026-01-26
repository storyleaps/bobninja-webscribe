/**
 * IndexedDB wrapper for storing crawl jobs and pages
 */

const DB_NAME = 'DocumentationCrawlerDB';
const DB_VERSION = 6;
const JOBS_STORE = 'jobs';
const PAGES_STORE = 'pages';
const ERROR_LOGS_STORE = 'errorLogs';

// Error log retention period (30 days in milliseconds)
const ERROR_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Delete the database (for migrations that require clean slate)
 * WARNING: This will delete all stored data!
 */
export function deleteDB() {
  return new Promise((resolve, reject) => {
    console.log(`[DB] Deleting database: ${DB_NAME}`);
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log(`[DB] Database deleted successfully`);
      resolve();
    };
    request.onerror = () => {
      console.error(`[DB] Failed to delete database:`, request.error);
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn(`[DB] Database deletion blocked - close all tabs using this extension`);
      reject(new Error('Database deletion blocked - close all tabs and try again'));
    };
  });
}

/**
 * Force migration by deleting and recreating the database
 * WARNING: This will delete all stored data!
 */
export async function forceMigration() {
  console.log(`[DB] Force migration: Deleting and recreating database...`);

  try {
    // Close existing connection first
    if (dbInstance) {
      console.log(`[DB] Closing existing database connection...`);
      dbInstance.close();
      dbInstance = null;
      dbPromise = null;
    }

    // Wait a bit to ensure connection is fully closed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Delete the old database
    await deleteDB();
    console.log(`[DB] Old database deleted`);

    // Wait a bit to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create new database with current schema
    const db = await initDB();
    console.log(`[DB] New database created with v${DB_VERSION} schema`);

    console.log(`[DB] Force migration complete!`);

    return { success: true, message: 'Database recreated successfully' };
  } catch (error) {
    console.error(`[DB] Force migration failed:`, error);
    throw error;
  }
}

// Singleton database connection
let dbInstance = null;
let dbPromise = null;

/**
 * Get current database version without opening it
 */
export async function getDBVersion() {
  const databases = await indexedDB.databases();
  const db = databases.find(d => d.name === DB_NAME);
  return db ? db.version : 0;
}

/**
 * Check if database needs migration and trigger it
 */
export async function checkAndMigrate() {
  const currentVersion = await getDBVersion();
  console.log(`[DB] Current database version: ${currentVersion}, Expected: ${DB_VERSION}`);

  if (currentVersion < DB_VERSION) {
    console.log(`[DB] Database needs migration from v${currentVersion} to v${DB_VERSION}`);
    console.log(`[DB] Closing existing connections and triggering migration...`);

    // Close existing connection if any
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
      dbPromise = null;
    }

    // Opening the database will trigger onupgradeneeded
    const db = await initDB();
    console.log(`[DB] Migration triggered successfully`);
    return true;
  } else {
    console.log(`[DB] Database is up to date`);
    return false;
  }
}

/**
 * Initialize IndexedDB with jobs and pages stores (Singleton Pattern)
 */
export function initDB() {
  // Return existing promise if already initializing
  if (dbPromise) {
    return dbPromise;
  }

  // Return existing instance if already open
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  // Create new connection
  dbPromise = new Promise((resolve, reject) => {
    console.log(`[DB] Opening database: ${DB_NAME} v${DB_VERSION}`);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error(`[DB] Error opening database:`, request.error);
      dbPromise = null; // Reset on error
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log(`[DB] Database opened successfully`);
      dbInstance = request.result;

      // Reset singleton if connection closes
      dbInstance.onclose = () => {
        console.log(`[DB] Database connection closed`);
        dbInstance = null;
        dbPromise = null;
      };

      dbPromise = null; // Promise fulfilled, clear it
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      const oldVersion = event.oldVersion;

      console.log(`[DB] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

      // Version 1: Initial setup (LEGACY - only for upgrades from v1)
      // When creating a new database from scratch, we go straight to latest version
      if (oldVersion < 1) {
        console.log(`[DB] Creating new database with v${DB_VERSION} schema (latest)`);

        // Create jobs store
        if (!db.objectStoreNames.contains(JOBS_STORE)) {
          const jobsStore = db.createObjectStore(JOBS_STORE, { keyPath: 'id' });
          jobsStore.createIndex('canonicalBaseUrl', 'canonicalBaseUrl', { unique: false });
          jobsStore.createIndex('status', 'status', { unique: false });
          jobsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create pages store with latest schema (v3)
        if (!db.objectStoreNames.contains(PAGES_STORE)) {
          const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
          pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
          pagesStore.createIndex('jobId', 'jobId', { unique: false });
          pagesStore.createIndex('status', 'status', { unique: false });
          // Compound index for fast content-based duplicate detection within a job
          pagesStore.createIndex('jobId_contentHash', ['jobId', 'contentHash'], { unique: false });
        }
      }

      // Version 2: Allow duplicate URLs across jobs (remove unique constraint)
      if (oldVersion < 2 && oldVersion >= 1) {
        console.log(`[DB] Migration v1 → v2: Removing unique constraint on canonicalUrl`);
        console.warn(`[DB] WARNING: All existing pages will be deleted during this migration`);

        if (db.objectStoreNames.contains(PAGES_STORE)) {
          // Delete and recreate the pages store to change the index
          console.log(`[DB] Deleting pages store to recreate indexes`);
          db.deleteObjectStore(PAGES_STORE);
        }

        // Recreate with non-unique canonicalUrl index
        console.log(`[DB] Creating new pages store with non-unique canonicalUrl index`);
        const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
        pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
        pagesStore.createIndex('jobId', 'jobId', { unique: false });
        pagesStore.createIndex('status', 'status', { unique: false });
        console.log(`[DB] Migration v1 → v2 complete`);
      }

      // Version 3: Add content hash deduplication and alternate URLs
      if (oldVersion < 3) {
        console.log(`[DB] Migration v${oldVersion} → v3: Adding content hash and alternate URLs support`);

        if (db.objectStoreNames.contains(PAGES_STORE)) {
          // Delete and recreate the pages store to add new indexes
          console.log(`[DB] Deleting pages store to recreate with new indexes`);
          db.deleteObjectStore(PAGES_STORE);
        }

        // Recreate with content hash index
        console.log(`[DB] Creating new pages store with contentHash index`);
        const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: 'id' });
        pagesStore.createIndex('canonicalUrl', 'canonicalUrl', { unique: false });
        pagesStore.createIndex('jobId', 'jobId', { unique: false });
        pagesStore.createIndex('status', 'status', { unique: false });
        // Compound index for fast duplicate detection within a job
        pagesStore.createIndex('jobId_contentHash', ['jobId', 'contentHash'], { unique: false });
        console.log(`[DB] Migration v${oldVersion} → v3 complete`);
        console.log(`[DB] New features: Content-based deduplication, alternate URLs tracking`);
      }

      // Version 4: Add metadata support for page head information
      if (oldVersion < 4) {
        console.log(`[DB] Migration v${oldVersion} → v4: Adding metadata support`);
        console.log(`[DB] Note: Metadata field will be added to page records automatically (no schema change needed)`);
        console.log(`[DB] New pages will have metadata from <head> tags extracted and stored`);
        console.log(`[DB] Existing pages will have metadata=null until re-crawled`);
        console.log(`[DB] Migration v${oldVersion} → v4 complete`);
        console.log(`[DB] New feature: Metadata extraction (description, og:tags, keywords, etc.)`);
      }

      // Version 5: Add markdown conversion support with confidence scoring
      if (oldVersion < 5) {
        console.log(`[DB] Migration v${oldVersion} → v5: Adding markdown conversion support`);
        console.log(`[DB] Note: markdown and markdownMeta fields will be added automatically (no schema change needed)`);
        console.log(`[DB] New pages will have markdown conversion attempted with quality assessment`);
        console.log(`[DB] Markdown format will be available alongside text format for pages with confidence > threshold`);
        console.log(`[DB] Existing pages will have markdown=null until re-crawled`);
        console.log(`[DB] Migration v${oldVersion} → v5 complete`);
        console.log(`[DB] New feature: Intelligent markdown conversion with Readability.js + Turndown`);
      }

      // Version 6: Add error logs store for diagnostic reporting
      if (oldVersion < 6) {
        console.log(`[DB] Migration v${oldVersion} → v6: Adding error logs store`);

        if (!db.objectStoreNames.contains(ERROR_LOGS_STORE)) {
          const errorLogsStore = db.createObjectStore(ERROR_LOGS_STORE, { keyPath: 'id' });
          errorLogsStore.createIndex('timestamp', 'timestamp', { unique: false });
          errorLogsStore.createIndex('source', 'source', { unique: false });
          errorLogsStore.createIndex('level', 'level', { unique: false });
          console.log(`[DB] Created errorLogs store with timestamp, source, and level indexes`);
        }

        console.log(`[DB] Migration v${oldVersion} → v6 complete`);
        console.log(`[DB] New feature: Error logging for diagnostic reports`);
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ================ JOBS OPERATIONS ================

/**
 * Create a new crawl job
 * @param {string|string[]} baseUrl - Single base URL or array of base URLs
 * @param {string|string[]} canonicalBaseUrl - Single canonical URL or array of canonical URLs
 */
export async function createJob(baseUrl, canonicalBaseUrl) {
  const db = await initDB();

  // Handle both single URL and multiple URLs
  const baseUrls = Array.isArray(baseUrl) ? baseUrl : [baseUrl];
  const canonicalBaseUrls = Array.isArray(canonicalBaseUrl) ? canonicalBaseUrl : [canonicalBaseUrl];

  const job = {
    id: generateId(),
    baseUrl: baseUrls[0], // First URL for backward compatibility
    canonicalBaseUrl: canonicalBaseUrls[0], // First canonical URL for backward compatibility
    baseUrls: baseUrls, // Array of all base URLs
    canonicalBaseUrls: canonicalBaseUrls, // Array of all canonical base URLs
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
    pagesFound: 0,
    pagesProcessed: 0,
    pagesFailed: 0,
    errors: []
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readwrite');
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.add(job);

    request.onsuccess = () => resolve(job);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a job by ID
 */
export async function getJob(jobId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readonly');
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.get(jobId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all jobs, sorted by createdAt (newest first)
 */
export async function getAllJobs() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readonly');
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const jobs = request.result;
      jobs.sort((a, b) => b.createdAt - a.createdAt);
      resolve(jobs);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Find job by canonical base URL
 */
export async function getJobByBaseUrl(canonicalBaseUrl) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readonly');
    const store = transaction.objectStore(JOBS_STORE);
    const index = store.index('canonicalBaseUrl');
    const request = index.get(canonicalBaseUrl);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a job
 */
export async function updateJob(jobId, updates) {
  const db = await initDB();
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');

  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readwrite');
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.put(updatedJob);

    request.onsuccess = () => resolve(updatedJob);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a job and all its pages
 */
export async function deleteJob(jobId) {
  const db = await initDB();

  // Delete all pages for this job
  await deletePagesByJobId(jobId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([JOBS_STORE], 'readwrite');
    const store = transaction.objectStore(JOBS_STORE);
    const request = store.delete(jobId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// ================ PAGES OPERATIONS ================

/**
 * Save a page
 * Note: Always creates a new page entry for each job, even if the URL was crawled before
 */
export async function savePage(jobId, url, canonicalUrl, content, status = 'success', html = null, contentHash = null, metadata = null, markdown = null, markdownMeta = null) {
  const db = await initDB();

  // Always create a new page entry for this job
  const page = {
    id: generateId(),
    url,
    canonicalUrl,
    jobId,
    content,
    format: 'text', // Primary format is plain text (was 'markdown' but now means format of 'content' field)
    extractedAt: Date.now(),
    contentLength: content.length,
    status,
    conversionWarnings: [],
    html: html, // Store HTML for future cache hits (enables skipping tab rendering)
    contentHash: contentHash, // Hash of content for deduplication (v3)
    alternateUrls: [url], // Array of URLs serving the same content (v3), starts with primary URL
    metadata: metadata || null, // Metadata extracted from page head (v4)
    markdown: markdown || null, // Markdown-converted content (v5)
    markdownMeta: markdownMeta || null // Markdown quality metadata with confidence score (v5)
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readwrite');
    const store = transaction.objectStore(PAGES_STORE);
    const request = store.add(page);

    request.onsuccess = () => resolve(page);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a page by canonical URL
 */
export async function getPageByCanonicalUrl(canonicalUrl) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readonly');
    const store = transaction.objectStore(PAGES_STORE);
    const index = store.index('canonicalUrl');
    const request = index.get(canonicalUrl);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a page by content hash within a specific job
 * Used for content-based deduplication
 */
export async function getPageByContentHash(jobId, contentHash) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readonly');
    const store = transaction.objectStore(PAGES_STORE);
    const index = store.index('jobId_contentHash');
    const request = index.get([jobId, contentHash]);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a page to add an alternate URL
 */
export async function updatePageAlternateUrls(pageId, newUrl) {
  const db = await initDB();

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readwrite');
    const store = transaction.objectStore(PAGES_STORE);

    // Get the existing page
    const getRequest = store.get(pageId);

    getRequest.onsuccess = () => {
      const page = getRequest.result;
      if (!page) {
        reject(new Error('Page not found'));
        return;
      }

      // Add new URL to alternateUrls if not already there
      if (!page.alternateUrls) {
        page.alternateUrls = [page.url]; // Initialize with primary URL if missing
      }

      if (!page.alternateUrls.includes(newUrl)) {
        page.alternateUrls.push(newUrl);
      }

      // Update the page
      const putRequest = store.put(page);
      putRequest.onsuccess = () => resolve(page);
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Get all pages for a job
 */
export async function getPagesByJobId(jobId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readonly');
    const store = transaction.objectStore(PAGES_STORE);
    const index = store.index('jobId');
    const request = index.getAll(jobId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete all pages for a job
 */
export async function deletePagesByJobId(jobId) {
  const db = await initDB();
  const pages = await getPagesByJobId(jobId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readwrite');
    const store = transaction.objectStore(PAGES_STORE);

    let deletedCount = 0;
    pages.forEach(page => {
      const request = store.delete(page.id);
      request.onsuccess = () => {
        deletedCount++;
        if (deletedCount === pages.length) {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (pages.length === 0) {
      resolve(0);
    }
  });
}

/**
 * Search pages by URL
 */
export async function searchPages(query) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readonly');
    const store = transaction.objectStore(PAGES_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allPages = request.result;
      const lowerQuery = query.toLowerCase();
      const results = allPages.filter(page =>
        page.url.toLowerCase().includes(lowerQuery)
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get storage size estimate
 */
export async function getStorageSize() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage,
      quota: estimate.quota,
      usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
      quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2)
    };
  }
  return null;
}

// ================ ERROR LOGS OPERATIONS ================

/**
 * Save an error log entry
 * @param {Object} errorEntry - Error log entry
 * @param {string} errorEntry.source - Source of the error (service-worker, crawler, tab-fetcher, popup, etc.)
 * @param {string} errorEntry.message - Error message
 * @param {string} errorEntry.stack - Stack trace (if available)
 * @param {Object} errorEntry.context - Additional context (URL being processed, job ID, etc.)
 */
export async function saveErrorLog(errorEntry) {
  const db = await initDB();

  const entry = {
    id: generateId(),
    timestamp: Date.now(),
    level: 'error',
    source: errorEntry.source || 'unknown',
    message: errorEntry.message || 'Unknown error',
    stack: errorEntry.stack || null,
    context: errorEntry.context || {},
    extensionVersion: errorEntry.extensionVersion || null,
    userAgent: errorEntry.userAgent || null
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ERROR_LOGS_STORE], 'readwrite');
    const store = transaction.objectStore(ERROR_LOGS_STORE);
    const request = store.add(entry);

    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all error logs, sorted by timestamp (newest first)
 */
export async function getAllErrorLogs() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ERROR_LOGS_STORE], 'readonly');
    const store = transaction.objectStore(ERROR_LOGS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const logs = request.result;
      logs.sort((a, b) => b.timestamp - a.timestamp);
      resolve(logs);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get error log count
 */
export async function getErrorLogCount() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ERROR_LOGS_STORE], 'readonly');
    const store = transaction.objectStore(ERROR_LOGS_STORE);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all error logs
 */
export async function clearErrorLogs() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ERROR_LOGS_STORE], 'readwrite');
    const store = transaction.objectStore(ERROR_LOGS_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete error logs older than retention period (30 days)
 */
export async function cleanupOldErrorLogs() {
  const db = await initDB();
  const cutoffTime = Date.now() - ERROR_LOG_RETENTION_MS;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ERROR_LOGS_STORE], 'readwrite');
    const store = transaction.objectStore(ERROR_LOGS_STORE);
    const index = store.index('timestamp');

    // Get all entries older than cutoff
    const range = IDBKeyRange.upperBound(cutoffTime);
    const request = index.openCursor(range);

    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        console.log(`[DB] Cleaned up ${deletedCount} old error logs`);
        resolve(deletedCount);
      }
    };

    request.onerror = () => reject(request.error);
  });
}
