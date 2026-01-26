/**
 * Web Crawler Orchestration
 * Manages crawl queue, rate limiting, and coordinates content extraction
 * Uses tab-based rendering to extract clean text and markdown content
 * VERSION: 2.1.0
 */

console.log('🚀 [Crawler] Loading crawler.js v2.0.0');

import { discoverInitialUrls, extractLinksFromHtml } from './discovery.js';
import { extractContent } from './extractor-simple.js';
import { canonicalizeUrl, computeContentHash, isUnderBasePath, isInternalUrl } from './utils.js';
import { fetchRenderedContent, closeCrawlWindow } from './tab-fetcher.js';
import {
  createJob,
  updateJob,
  savePage,
  getPageByCanonicalUrl,
  getPageByContentHash,
  updatePageAlternateUrls,
  getDBVersion
} from '../storage/db.js';
import { logError } from './error-logger.js';

const DEFAULT_MAX_WORKERS = 5;
const MIN_MAX_WORKERS = 1;
const MAX_MAX_WORKERS = 10;
const DELAY_BETWEEN_REQUESTS = 500; // ms
const REQUEST_TIMEOUT = 30000; // 30 seconds

// External link crawling configuration
const DEFAULT_MAX_EXTERNAL_HOPS = 1;
const MIN_MAX_EXTERNAL_HOPS = 1;
const MAX_MAX_EXTERNAL_HOPS = 5;

/**
 * CrawlJob class manages a single crawl operation
 */
export class CrawlJob {
  constructor(baseUrl, options = {}) {
    // Handle both single URL and array of URLs
    this.baseUrls = Array.isArray(baseUrl) ? baseUrl : [baseUrl];
    this.baseUrl = this.baseUrls[0]; // For backward compatibility
    this.canonicalBaseUrls = this.baseUrls.map(url => canonicalizeUrl(url)).filter(Boolean);
    this.canonicalBaseUrl = this.canonicalBaseUrls[0]; // For backward compatibility

    this.queue = []; // URLs to crawl
    this.inProgress = new Set(); // URLs currently being crawled
    this.completed = new Set(); // Canonical URLs already crawled
    this.completedPerBaseUrl = new Map(); // Track completed pages per base URL for per-URL limits
    this.inProgressPerBaseUrl = new Map(); // Track in-progress pages per base URL
    this.failed = new Set(); // URLs that failed
    this.failedDetails = new Map(); // Detailed error information for failed URLs
    this.activeWorkers = 0;
    this.isPaused = false;
    this.isCancelled = false;
    this.jobId = null;
    this.onProgress = null; // Callback for progress updates

    // Concurrent workers configuration (1-10, default 5)
    const requestedWorkers = options.maxWorkers || DEFAULT_MAX_WORKERS;
    this.maxWorkers = Math.max(MIN_MAX_WORKERS, Math.min(MAX_MAX_WORKERS, requestedWorkers));

    // Page limit configuration (optional, default unlimited)
    this.pageLimit = options.pageLimit && options.pageLimit > 0 ? options.pageLimit : null;

    // Tab-based rendering options (always enabled)
    this.waitForSelectors = options.waitForSelectors || [];
    this.skipCache = options.skipCache || false; // Force refresh, ignore cache

    // Strict path matching (default: true)
    // When true: /financial-apis matches /financial-apis/overview but NOT /financial-apis-blog
    // When false: /financial-apis matches both /financial-apis/overview AND /financial-apis-blog
    this.strictPathMatching = options.strictPathMatching !== undefined ? options.strictPathMatching : true;

    // Incognito mode: crawl in a new incognito window for clean session
    this.useIncognito = options.useIncognito || false;

    // External link crawling configuration
    // When enabled, the crawler will follow links outside the base URL scope
    this.followExternalLinks = options.followExternalLinks || false;

    // Maximum depth for external links (1 = only direct links from base pages)
    // Only used when followExternalLinks is true
    const requestedHops = options.maxExternalHops || DEFAULT_MAX_EXTERNAL_HOPS;
    this.maxExternalHops = Math.max(MIN_MAX_EXTERNAL_HOPS, Math.min(MAX_MAX_EXTERNAL_HOPS, requestedHops));

    // Track depth for each URL (internal URLs are depth 0, external URLs have depth 1+)
    this.urlDepths = new Map(); // url → depth

    // Initialize per-base-URL tracking
    this.canonicalBaseUrls.forEach(baseUrl => {
      this.completedPerBaseUrl.set(baseUrl, new Set());
      this.inProgressPerBaseUrl.set(baseUrl, new Set());
    });
  }

  /**
   * Find which base URL a given URL belongs to
   * @param {string} url - The canonical URL to check
   * @returns {string|null} The matching canonical base URL, or null if none match
   */
  getMatchingBaseUrl(url) {
    for (const baseUrl of this.canonicalBaseUrls) {
      if (isUnderBasePath(url, baseUrl, this.strictPathMatching)) {
        return baseUrl;
      }
    }
    return null;
  }

  /**
   * Start the crawl
   */
  async start() {
    console.log('Starting crawl for:', this.baseUrl);

    // Check database version - warn if migration needed
    try {
      const dbVersion = await getDBVersion();
      const expectedVersion = 2;

      if (dbVersion < expectedVersion) {
        console.warn('⚠️  DATABASE MIGRATION NEEDED ⚠️');
        console.warn(`Current database version: ${dbVersion}, Expected: ${expectedVersion}`);
        console.warn('Crawling may fail if you try to recrawl URLs that already exist in the database.');
        console.warn('See error messages below for migration instructions if crawl fails.');
      } else {
        console.log(`✅ Database version OK: v${dbVersion}`);
      }
    } catch (error) {
      console.warn('Could not check database version:', error);
    }

    // Create job in database (pass all base URLs)
    const job = await createJob(this.baseUrls, this.canonicalBaseUrls);
    this.jobId = job.id;

    // Update job status
    await updateJob(this.jobId, { status: 'in_progress' });

    // Discover initial URLs (pass all base URLs)
    const initialUrls = await discoverInitialUrls(this.baseUrls, this.strictPathMatching);
    console.log('Initial URLs discovered:', initialUrls.length, 'from', this.baseUrls.length, 'base path(s)');

    // Add to queue
    initialUrls.forEach(url => this.addToQueue(url));

    // Update job with found pages
    await updateJob(this.jobId, {
      pagesFound: this.queue.length
    });

    // Start workers
    this.startWorkers();

    return this.jobId;
  }

  /**
   * Add URL to queue if not already processed
   * @param {string} url - The URL to add
   * @param {number} depth - The depth of this URL (0 = internal/base, 1+ = external hops)
   */
  addToQueue(url, depth = 0) {
    const canonical = canonicalizeUrl(url);
    if (!canonical) return;

    // Check if already processed or in queue
    if (this.completed.has(canonical) ||
        this.inProgress.has(canonical) ||
        this.queue.includes(canonical)) {
      return;
    }

    // Check if this is an internal URL
    const isInternal = isInternalUrl(canonical, this.canonicalBaseUrls, this.strictPathMatching);

    // For internal URLs, always use depth 0
    const actualDepth = isInternal ? 0 : depth;

    // For external URLs, check if we're allowed to follow them and if depth is within limit
    if (!isInternal) {
      if (!this.followExternalLinks) {
        // External links not allowed
        return;
      }
      if (actualDepth > this.maxExternalHops) {
        // Exceeds max hop limit
        console.log(`[Crawler] Skipping external URL (depth ${actualDepth} > max ${this.maxExternalHops}): ${canonical}`);
        return;
      }
    }

    // Check if this URL's base URL has reached its page limit (only for internal URLs)
    if (this.pageLimit && isInternal) {
      const matchingBaseUrl = this.getMatchingBaseUrl(canonical);
      if (matchingBaseUrl && !this.hasCapacityForBaseUrl(matchingBaseUrl)) {
        // Skip this URL - its base URL has reached the limit
        return;
      }
    }

    // Store the depth for this URL
    this.urlDepths.set(canonical, actualDepth);

    this.queue.push(canonical);
  }

  /**
   * Start worker threads
   */
  startWorkers() {
    console.log(`[Crawler] Starting ${this.maxWorkers} workers with ${this.queue.length} URLs in queue`);
    for (let i = 0; i < this.maxWorkers; i++) {
      this.runWorker();
    }
  }

  /**
   * Worker function - processes URLs from queue
   */
  async runWorker() {
    this.activeWorkers++;
    const workerId = this.activeWorkers;
    console.log(`[Crawler] Worker ${workerId} started (total active: ${this.activeWorkers})`);

    while (!this.isCancelled && !this.hasMetUniquePageRequirement()) {
      if (this.isPaused) {
        await this.sleep(1000);
        continue;
      }

      // Check if we can grab more URLs (conservative check to prevent over-crawling)
      if (!this.canGrabMoreUrls()) {
        console.log(`[Crawler] Worker ${workerId} stopping before grabbing URL (conservative limit: ${this.completed.size} unique + ${this.inProgress.size} in-progress = ${this.completed.size + this.inProgress.size} >= ${this.pageLimit})`);
        break;
      }

      // Get next URL from queue that has capacity for its base URL
      let url = null;
      let matchingBaseUrl = null;

      while (this.queue.length > 0) {
        const candidateUrl = this.queue.shift();
        const candidateBaseUrl = this.getMatchingBaseUrl(candidateUrl);

        // Check if this URL's base URL still has capacity
        if (!this.pageLimit || !candidateBaseUrl || this.hasCapacityForBaseUrl(candidateBaseUrl)) {
          url = candidateUrl;
          matchingBaseUrl = candidateBaseUrl;
          break;
        } else {
          // Skip this URL - its base URL has reached the limit
          console.log(`[Crawler] Worker ${workerId} skipping ${candidateUrl} (base URL ${candidateBaseUrl} at limit)`);
        }
      }

      // If no URL available, wait if other workers are still processing
      // (they might discover new URLs)
      if (!url) {
        const otherWorkersActive = this.inProgress.size > 0;
        if (otherWorkersActive) {
          console.log(`[Crawler] Worker ${workerId} waiting for queue (${this.inProgress.size} workers busy)`);
          await this.sleep(500);
          continue;
        } else {
          // No URL and no other workers active - we're done
          console.log(`[Crawler] Worker ${workerId} exiting (queue empty, no active workers)`);
          break;
        }
      }

      this.inProgress.add(url);
      // Track in per-base-URL map for page limits
      if (matchingBaseUrl) {
        const baseUrlInProgress = this.inProgressPerBaseUrl.get(matchingBaseUrl);
        if (baseUrlInProgress) baseUrlInProgress.add(url);
      }
      console.log(`[Crawler] Worker ${workerId} processing: ${url} (${this.inProgress.size} in progress)`);

      try {
        // Process this URL (will add to completed internally if unique)
        await this.processUrl(url);

        // Update job progress
        await updateJob(this.jobId, {
          pagesProcessed: this.completed.size,
          pagesFound: this.queue.length + this.inProgress.size + this.completed.size
        });

        // Notify progress
        this.notifyProgress();

      } catch (error) {
        // If cancelled, this is expected - don't treat as error
        if (this.isCancelled) {
          console.log(`[Crawler] Worker ${workerId} interrupted during ${url} (crawl cancelled)`);
        } else {
          // Check if this is a database constraint error (v1 schema issue)
          if (error.name === 'ConstraintError' && error.message.includes('canonicalUrl')) {
            console.error('❌ DATABASE MIGRATION REQUIRED ❌');
            console.error('');
            console.error('The database is still using v1 schema which prevents recrawling the same URL.');
            console.error('');
            console.error('🔧 TO FIX THIS ISSUE:');
            console.error('1. Open Chrome DevTools Console (F12)');
            console.error('2. Go to Application tab > IndexedDB');
            console.error('3. Right-click "DocumentationCrawlerDB" and select "Delete database"');
            console.error('4. Reload this extension in chrome://extensions/');
            console.error('5. Try crawling again');
            console.error('');
            console.error('⚠️  WARNING: This will delete all existing crawled data!');
            console.error('');
            console.error('Alternative: Run this command in the Service Worker console:');
            console.error('(async () => {');
            console.error('  const sw = await navigator.serviceWorker.ready;');
            console.error('  const channel = new MessageChannel();');
            console.error('  channel.port1.onmessage = (e) => console.log("Result:", e.data);');
            console.error('  sw.active.postMessage({ type: "FORCE_MIGRATION" }, [channel.port2]);');
            console.error('})();');
            console.error('');
          }

          // Extract meaningful error information from DOMException and other error types
          const errorDetails = this.formatError(error);
          console.error('Error processing URL:', url, errorDetails);

          // Log to persistent error store for diagnostic reports
          logError('crawler', error, {
            url,
            jobId: this.jobId,
            workerId,
            action: 'processUrl'
          });

          // Store error details for this URL
          this.failed.add(url);
          this.failedDetails.set(url, errorDetails);

          // Update job with error
          await updateJob(this.jobId, {
            pagesFailed: this.failed.size,
            errors: await this.getErrors()
          });
        }
      } finally {
        // Always clean up, even if we break or error
        this.inProgress.delete(url);
        // Remove from per-base-URL in-progress map
        if (matchingBaseUrl) {
          const baseUrlInProgress = this.inProgressPerBaseUrl.get(matchingBaseUrl);
          if (baseUrlInProgress) baseUrlInProgress.delete(url);
        }
      }

      // Check if we've met the unique page requirement AFTER cleanup
      if (this.hasMetUniquePageRequirement()) {
        console.log(`[Crawler] Worker ${workerId} stopping after processing (goal met: ${this.completed.size} unique pages >= ${this.pageLimit})`);
        break;
      }

      // Rate limiting delay
      await this.sleep(DELAY_BETWEEN_REQUESTS);
    }

    this.activeWorkers--;
    console.log(`[Crawler] Worker ${workerId} finished (${this.activeWorkers} workers remaining)`);

    // Check if all workers are done
    if (this.activeWorkers === 0 && (this.queue.length === 0 || this.hasMetUniquePageRequirement() || this.isCancelled)) {
      await this.onComplete();
    }
  }

  /**
   * Check if a specific base URL has capacity for more pages
   * @param {string} baseUrl - The canonical base URL to check
   * @returns {boolean} True if the base URL can accept more pages
   */
  hasCapacityForBaseUrl(baseUrl) {
    if (!this.pageLimit) return true;

    // Only count completed pages, not in-progress ones
    // This prevents under-crawling when URLs turn out to be duplicates
    const completed = this.completedPerBaseUrl.get(baseUrl) || new Set();
    return completed.size < this.pageLimit;
  }

  /**
   * Check if a specific base URL has met its page limit
   * @param {string} baseUrl - The canonical base URL to check
   * @returns {boolean} True if the base URL has met its limit
   */
  hasBaseUrlMetLimit(baseUrl) {
    if (!this.pageLimit) return false;

    const completed = this.completedPerBaseUrl.get(baseUrl) || new Set();
    return completed.size >= this.pageLimit;
  }

  /**
   * Check if we can grab more URLs from queue (conservative check to prevent over-crawling)
   * Used BEFORE grabbing a URL to prevent race conditions with concurrent workers
   * With per-URL limits: returns true if ANY base URL still has capacity
   */
  canGrabMoreUrls() {
    if (!this.pageLimit) return true;

    // Check if any base URL still has capacity
    for (const baseUrl of this.canonicalBaseUrls) {
      if (this.hasCapacityForBaseUrl(baseUrl)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if we've met the unique page requirement (liberal check)
   * Used AFTER processing to know if we've reached the goal
   * With per-URL limits: returns true if ALL base URLs have met their limits
   */
  hasMetUniquePageRequirement() {
    if (!this.pageLimit) return false;

    // Check if all base URLs have met their limits
    for (const baseUrl of this.canonicalBaseUrls) {
      if (!this.hasBaseUrlMetLimit(baseUrl)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Legacy method for backward compatibility
   * Delegates to canGrabMoreUrls (conservative check)
   */
  isPageLimitReached() {
    return !this.canGrabMoreUrls();
  }

  /**
   * Build options object for link extraction
   * @param {string} url - The URL being processed (to get its depth)
   * @returns {object} Options for extractLinksFromHtml
   */
  getLinkExtractionOptions(url) {
    const currentDepth = this.urlDepths.get(url) || 0;
    return {
      strictPathMatching: this.strictPathMatching,
      followExternalLinks: this.followExternalLinks,
      currentDepth,
      maxExternalHops: this.maxExternalHops
    };
  }

  /**
   * Process raw DOM-extracted links and apply filtering/depth logic
   * This is similar to extractLinksFromHtml but works with pre-extracted URLs
   * @param {string[]} rawLinks - Array of absolute URLs from DOM extraction
   * @param {string} pageUrl - The URL of the page the links were extracted from
   * @param {object} options - Link extraction options (from getLinkExtractionOptions)
   * @returns {Array<{url: string, depth: number}>} Filtered links with depth info
   */
  processRawLinks(rawLinks, pageUrl, options) {
    const {
      strictPathMatching = true,
      followExternalLinks = false,
      currentDepth = 0,
      maxExternalHops = 1
    } = options;

    const links = [];
    const seen = new Set();

    // Skip downloadable file extensions
    const downloadExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xlsm', '.ppt', '.pptx', '.odt', '.ods', '.odp',
      '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
      '.psd', '.ai', '.eps',
      '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',
      '.mp3', '.wav', '.flac', '.aac', '.ogg',
      '.exe', '.dmg', '.pkg', '.deb', '.rpm', '.apk',
      '.csv', '.xml', '.json', '.sql', '.db'
    ];

    for (const rawUrl of rawLinks) {
      // Canonicalize the URL
      const canonicalUrl = canonicalizeUrl(rawUrl);
      if (!canonicalUrl) continue;

      // Skip if already seen
      if (seen.has(canonicalUrl)) continue;
      seen.add(canonicalUrl);

      // Skip downloadable files
      try {
        const urlPath = new URL(canonicalUrl).pathname.toLowerCase();
        const isDownload = downloadExtensions.some(ext => urlPath.endsWith(ext));
        if (isDownload) {
          console.log(`[Crawler] Skipping downloadable file: ${canonicalUrl}`);
          continue;
        }
      } catch (e) {
        continue;
      }

      // Check if this is an internal link (under any base path)
      const isInternal = isInternalUrl(canonicalUrl, this.canonicalBaseUrls, strictPathMatching);

      if (isInternal) {
        // Internal links always have depth 0
        links.push({ url: canonicalUrl, depth: 0 });
      } else if (followExternalLinks) {
        // External link - calculate new depth
        const newDepth = currentDepth + 1;

        // Only include if within hop limit
        if (newDepth <= maxExternalHops) {
          links.push({ url: canonicalUrl, depth: newDepth });
        }
      }
      // else: external link not allowed, skip
    }

    const internalCount = links.filter(l => l.depth === 0).length;
    const externalCount = links.length - internalCount;
    console.log(`[Crawler] Processed ${links.length} links (${internalCount} internal, ${externalCount} external)`);

    return links;
  }

  /**
   * Process a single URL
   */
  async processUrl(url) {
    console.log('📄 Processing:', url);

    // Check if already in database (cache) - unless skipCache is enabled
    if (!this.skipCache) {
      const cached = await getPageByCanonicalUrl(url);
      if (cached) {
        console.log('✅ CACHE HIT:', url);
        console.log('   → Reusing cached content (skipping text extraction)');

        try {
          // Compute content hash for deduplication (use cached hash if available)
          const contentHash = cached.contentHash || await computeContentHash(cached.content);

          // Check for duplicate content within this job
          if (contentHash) {
            const existingPage = await getPageByContentHash(this.jobId, contentHash);

            if (existingPage) {
              console.log('   🔗 DUPLICATE CONTENT (from cache):', url);
              console.log('   → Same content as:', existingPage.url);
              console.log('   → Adding as alternate URL');

              // Update existing page with alternate URL
              await updatePageAlternateUrls(existingPage.id, url);

              // Still need to extract links
              const linkOptions = this.getLinkExtractionOptions(url);
              if (cached.html) {
                const links = extractLinksFromHtml(cached.html, url, this.canonicalBaseUrls, linkOptions);
                links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));
                console.log('   → Extracted', links.length, 'links from cached HTML');
              } else {
                const { html } = await this.fetchUrl(url);
                const links = extractLinksFromHtml(html, url, this.canonicalBaseUrls, linkOptions);
                links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));
                console.log('   → Extracted', links.length, 'links from fresh HTML');
              }

              console.log('   ✅ Updated alternate URLs');
              return; // Don't create new page
            }
          }

          // Check if limit already reached before saving (prevents race condition over-crawling)
          const baseUrl = this.getMatchingBaseUrl(url);
          if (this.pageLimit && baseUrl) {
            const currentCount = this.completedPerBaseUrl.get(baseUrl)?.size || 0;
            if (currentCount >= this.pageLimit) {
              console.log(`   ⏹️ Limit reached for ${baseUrl}, skipping save (already have ${currentCount}/${this.pageLimit})`);
              return;
            }
          }

          // Not a duplicate, save the cached content to this job (with markdown if available)
          await savePage(this.jobId, url, url, cached.content, 'success', cached.html, contentHash, cached.metadata || null, cached.markdown || null, cached.markdownMeta || null);

          // Mark as completed (unique content)
          this.completed.add(url);
          // Track in per-base-URL completed map (and remove from inProgress to avoid double-counting)
          if (baseUrl) {
            const baseUrlCompleted = this.completedPerBaseUrl.get(baseUrl);
            if (baseUrlCompleted) baseUrlCompleted.add(url);
            const baseUrlInProgress = this.inProgressPerBaseUrl.get(baseUrl);
            if (baseUrlInProgress) baseUrlInProgress.delete(url);
          }

          // Check if cached page has HTML stored
          const cachedLinkOptions = this.getLinkExtractionOptions(url);
          if (cached.html) {
            console.log('   → Reusing cached HTML (skipping tab rendering)');
            const links = extractLinksFromHtml(cached.html, url, this.canonicalBaseUrls, cachedLinkOptions);
            links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));
            console.log('   → Extracted', links.length, 'links from cache');
            console.log('   ✨ Fully cached! No tab opened.');
            return;
          } else {
            console.log('   ⚠️  Cached page missing HTML, fetching for link extraction...');
            console.log('   → Opening tab to get HTML');
            const { html } = await this.fetchUrl(url);
            const links = extractLinksFromHtml(html, url, this.canonicalBaseUrls, cachedLinkOptions);
            links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));
            console.log('   → Extracted', links.length, 'links from fresh HTML');
            return;
          }
        } catch (error) {
          // If we get a constraint error, it means the DB is still on v1
          if (error.name === 'ConstraintError') {
            console.error('Database constraint error - database may need migration to v2');
            console.error('Falling through to re-crawl the page instead of using cache');
            // Fall through to normal crawl below
          } else {
            throw error; // Re-throw other errors
          }
        }
      } else {
        console.log('❌ CACHE MISS:', url);
        console.log('   → Page not in cache, will crawl fresh');
      }
    } else {
      console.log('🔄 FORCE REFRESH:', url);
      console.log('   → Cache check skipped (skipCache enabled)');
    }

    // Fetch content (via tab rendering) - returns {html, text, metadata, markdown, markdownMeta, links}
    console.log('   → Opening tab to crawl page');
    const { html, text, metadata, markdown, markdownMeta, links: domLinks } = await this.fetchUrl(url);

    // Extract links - prefer DOM-extracted links, fall back to regex
    const freshLinkOptions = this.getLinkExtractionOptions(url);
    let links;

    if (domLinks && domLinks.length > 0) {
      // Use DOM-extracted links (more reliable) - need to filter and add depth
      console.log(`   → Using ${domLinks.length} DOM-extracted links`);
      links = this.processRawLinks(domLinks, url, freshLinkOptions);
    } else {
      // Fall back to regex extraction from HTML
      console.log('   → Falling back to regex link extraction');
      links = extractLinksFromHtml(html, url, this.canonicalBaseUrls, freshLinkOptions);
    }

    links.forEach(({ url: linkUrl, depth }) => this.addToQueue(linkUrl, depth));

    // Clean text content
    const cleanedText = extractContent(text, url);

    // Markdown processing already done in tab context
    if (markdown && markdownMeta) {
      console.log(`   ✅ Markdown: confidence=${(markdownMeta.confidence * 100).toFixed(0)}%, isArticle=${markdownMeta.isArticle}`);
    } else {
      console.log('   ⚠️  Markdown unavailable');
    }

    // Compute content hash for deduplication (IMPORTANT: Only use text content, not metadata)
    const contentHash = await computeContentHash(cleanedText);

    // Check for duplicate content within this job
    if (contentHash) {
      const existingPage = await getPageByContentHash(this.jobId, contentHash);

      if (existingPage) {
        console.log('🔗 DUPLICATE CONTENT:', url);
        console.log('   → Same content as:', existingPage.url);
        console.log('   → Adding as alternate URL');

        // Update existing page with alternate URL
        await updatePageAlternateUrls(existingPage.id, url);

        console.log('   ✅ Updated alternate URLs - Found', links.length, 'new links');
        return; // Don't create new page, don't count as unique content
      }
    }

    // Check if limit already reached before saving (prevents race condition over-crawling)
    const baseUrl = this.getMatchingBaseUrl(url);
    if (this.pageLimit && baseUrl) {
      const currentCount = this.completedPerBaseUrl.get(baseUrl)?.size || 0;
      if (currentCount >= this.pageLimit) {
        console.log(`   ⏹️ Limit reached for ${baseUrl}, skipping save (already have ${currentCount}/${this.pageLimit})`);
        return;
      }
    }

    // Save to database as new unique page (including HTML for cache, metadata, and markdown)
    await savePage(this.jobId, url, url, cleanedText, 'success', html, contentHash, metadata, markdown, markdownMeta);

    // Mark as completed (unique content)
    this.completed.add(url);
    // Track in per-base-URL completed map (and remove from inProgress to avoid double-counting)
    if (baseUrl) {
      const baseUrlCompleted = this.completedPerBaseUrl.get(baseUrl);
      if (baseUrlCompleted) baseUrlCompleted.add(url);
      const baseUrlInProgress = this.inProgressPerBaseUrl.get(baseUrl);
      if (baseUrlInProgress) baseUrlInProgress.delete(url);
    }

    console.log('   ✅ Saved:', url, '- Found', links.length, 'new links');
  }

  /**
   * Fetch URL using tab-based rendering
   * Returns {html, text, metadata, markdown, markdownMeta, links} where:
   * - html: for link extraction fallback
   * - text: for content storage
   * - metadata: extracted from page <head> tags
   * - markdown: converted markdown (or null)
   * - markdownMeta: quality metrics (or null)
   * - links: DOM-extracted links (more reliable than regex)
   */
  async fetchUrl(url) {
    console.log(`[Crawler] Fetching via tab rendering: ${url} (incognito: ${this.useIncognito})`);

    try {
      const content = await fetchRenderedContent(url, {
        timeout: REQUEST_TIMEOUT,
        waitForSelectors: this.waitForSelectors,
        useIncognito: this.useIncognito
      });
      console.log(`[Crawler] Tab rendering successful for: ${url}`);
      return content;
    } catch (error) {
      console.error(`[Crawler] Tab rendering failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get current errors for job
   */
  async getErrors() {
    const errors = [];
    for (const url of this.failed) {
      const errorDetails = this.failedDetails.get(url) || 'Failed to process';
      errors.push({
        url,
        canonicalUrl: url,
        error: errorDetails,
        timestamp: Date.now()
      });
    }
    return errors;
  }

  /**
   * Format error for logging and storage
   * Extracts meaningful information from DOMException and other error types
   */
  formatError(error) {
    if (!error) {
      return 'Unknown error';
    }

    // Handle DOMException specifically
    if (error.name && error.message) {
      // DOMException and standard Error objects
      return `${error.name}: ${error.message}`;
    }

    // Handle error objects with just a message
    if (error.message) {
      return error.message;
    }

    // Handle string errors
    if (typeof error === 'string') {
      return error;
    }

    // Try to stringify the error
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }

  /**
   * Called when crawl completes
   */
  async onComplete() {
    console.log('Crawl complete!');
    console.log('Processed:', this.completed.size);
    console.log('Failed:', this.failed.size);
    if (this.pageLimit) {
      console.log('Page limit per input URL:', this.pageLimit);
      console.log('Max total pages:', this.pageLimit * this.canonicalBaseUrls.length);
      // Log per-base-URL stats
      for (const baseUrl of this.canonicalBaseUrls) {
        const completed = this.completedPerBaseUrl.get(baseUrl) || new Set();
        console.log(`  ${baseUrl}: ${completed.size}/${this.pageLimit} pages`);
      }
    }

    // Clear the queue if page limit was reached or crawl was cancelled
    // This ensures the UI shows completion (queueSize === 0)
    if (this.isPageLimitReached() || this.isCancelled) {
      console.log('Clearing remaining queue due to', this.isCancelled ? 'cancellation' : 'page limit');
      this.queue = [];
      // Also clear any lingering inProgress items (shouldn't happen, but be safe)
      this.inProgress.clear();
      // Clear per-base-URL in-progress sets
      for (const set of this.inProgressPerBaseUrl.values()) {
        set.clear();
      }
    }

    // Determine completion status
    let status;
    if (this.isCancelled) {
      status = 'interrupted';
    } else if (this.isPageLimitReached()) {
      // Page limit reached - mark as completed (not interrupted)
      status = this.failed.size > 0 ? 'completed_with_errors' : 'completed';
    } else {
      status = this.failed.size > 0 ? 'completed_with_errors' : 'completed';
    }

    await updateJob(this.jobId, {
      status,
      pagesProcessed: this.completed.size,
      pagesFailed: this.failed.size
    });

    // Close the shared crawl window
    await closeCrawlWindow();

    this.notifyProgress();

    // Call completion callback if provided
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }

  /**
   * Notify progress callback
   */
  notifyProgress() {
    if (this.onProgress) {
      this.onProgress({
        pagesFound: this.queue.length + this.inProgress.size + this.completed.size,
        pagesProcessed: this.completed.size,
        pagesFailed: this.failed.size,
        queueSize: this.queue.length,
        inProgress: Array.from(this.inProgress)
      });
    }
  }

  /**
   * Pause crawl
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume crawl
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Cancel crawl
   */
  cancel() {
    this.isCancelled = true;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global active crawl (only one at a time)
let activeCrawl = null;

/**
 * Start a new crawl
 *
 * @param {string} baseUrl - Base URL to crawl
 * @param {Function} onProgress - Progress callback
 * @param {Object} options - Crawl options
 * @param {number} options.maxWorkers - Number of concurrent workers/tabs (1-10, default: 5)
 * @param {number} options.pageLimit - Maximum number of pages to crawl (optional, default: unlimited)
 * @param {string[]} options.waitForSelectors - CSS selectors to wait for
 * @param {boolean} options.skipCache - Force refresh, ignore cache (default: false)
 * @param {boolean} options.useIncognito - Crawl in incognito window for clean session (default: false)
 * @param {boolean} options.followExternalLinks - Follow links outside base URL scope (default: false)
 * @param {number} options.maxExternalHops - Maximum depth for external links, 1-5 (default: 1)
 */
export async function startCrawl(baseUrl, onProgress, options = {}) {
  console.log('[Crawler] startCrawl called with:', { baseUrl, options });

  if (activeCrawl) {
    throw new Error('A crawl is already in progress');
  }

  const crawl = new CrawlJob(baseUrl, options);
  crawl.onProgress = onProgress;

  console.log('[Crawler] CrawlJob created with:', {
    maxWorkers: crawl.maxWorkers,
    pageLimit: crawl.pageLimit
  });

  // Set callback to clear activeCrawl when complete
  crawl.onCompleteCallback = () => {
    console.log('Clearing active crawl');
    activeCrawl = null;
  };

  activeCrawl = crawl;

  try {
    const jobId = await crawl.start();
    return jobId;
  } catch (error) {
    activeCrawl = null;
    throw error;
  }
}

/**
 * Get active crawl status
 */
export function getActiveCrawl() {
  return activeCrawl;
}

/**
 * Cancel active crawl
 */
export function cancelActiveCrawl() {
  if (activeCrawl) {
    activeCrawl.cancel();
    activeCrawl = null;
  }
}
