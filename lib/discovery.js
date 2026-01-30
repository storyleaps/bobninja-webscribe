/**
 * URL discovery module
 * Handles sitemap.xml parsing and link extraction from HTML
 * Supports sitemap index files (recursive parsing with timeouts)
 */

import { canonicalizeUrl, isUnderBasePath, isUnderAnyBasePath, isInternalUrl, resolveUrl, isValidUrl } from './utils.js';

// Sitemap discovery timeouts (in milliseconds)
const SITEMAP_FETCH_TIMEOUT = 10000;      // 10 seconds per sitemap fetch
const NESTED_SITEMAP_TIMEOUT = 5000;      // 5 seconds per nested sitemap
const TOTAL_DISCOVERY_TIMEOUT = 30000;    // 30 seconds max for entire sitemap discovery
const MAX_SITEMAP_DEPTH = 2;              // Maximum nesting depth for sitemap indexes

/**
 * Fetch with timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if XML content is a sitemap index (contains references to other sitemaps)
 * @param {string} xmlText - The XML content
 * @returns {boolean}
 */
function isSitemapIndex(xmlText) {
  // Sitemap indexes use <sitemapindex> root element or contain <sitemap> elements
  return /<sitemapindex/i.test(xmlText) || /<sitemap>/i.test(xmlText);
}

/**
 * Extract nested sitemap URLs from a sitemap index
 * @param {string} xmlText - The sitemap index XML content
 * @returns {string[]} Array of sitemap URLs
 */
function extractNestedSitemapUrls(xmlText) {
  const sitemapUrls = [];

  // Match <sitemap><loc>URL</loc></sitemap> patterns
  // The URL is inside <loc> tags within <sitemap> elements
  const sitemapRegex = /<sitemap[^>]*>[\s\S]*?<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>[\s\S]*?<\/sitemap>/gi;
  let match;

  while ((match = sitemapRegex.exec(xmlText)) !== null) {
    const url = match[1].trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      sitemapUrls.push(url);
    }
  }

  return sitemapUrls;
}

/**
 * Extract page URLs from a regular sitemap (not an index)
 * @param {string} xmlText - The sitemap XML content
 * @returns {string[]} Array of page URLs
 */
function extractPageUrls(xmlText) {
  const urls = [];

  // Extract URLs from <loc> tags using regex
  // Matches <loc>URL</loc> or <loc><![CDATA[URL]]></loc>
  const locRegex = /<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xmlText)) !== null) {
    const url = match[1].trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // Skip URLs that look like sitemaps (end with .xml)
      // These should be handled as nested sitemaps, not pages
      if (!url.toLowerCase().endsWith('.xml')) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Recursively fetch and parse sitemaps with timeout protection
 * @param {string} sitemapUrl - URL of the sitemap to fetch
 * @param {number} depth - Current recursion depth
 * @param {number} startTime - Start time of the discovery process
 * @returns {Promise<string[]>} Array of discovered page URLs
 */
async function fetchAndParseSitemap(sitemapUrl, depth, startTime) {
  // Check total timeout
  if (Date.now() - startTime > TOTAL_DISCOVERY_TIMEOUT) {
    console.log(`[Discovery] Total timeout reached, stopping sitemap discovery`);
    return [];
  }

  // Check depth limit
  if (depth > MAX_SITEMAP_DEPTH) {
    console.log(`[Discovery] Max sitemap depth (${MAX_SITEMAP_DEPTH}) reached, skipping: ${sitemapUrl}`);
    return [];
  }

  const timeout = depth === 0 ? SITEMAP_FETCH_TIMEOUT : NESTED_SITEMAP_TIMEOUT;

  try {
    console.log(`[Discovery] Fetching sitemap (depth ${depth}): ${sitemapUrl}`);

    const response = await fetchWithTimeout(sitemapUrl, timeout);

    if (!response.ok) {
      console.log(`[Discovery] Sitemap not found (${response.status}): ${sitemapUrl}`);
      return [];
    }

    const xmlText = await response.text();

    // Check if this is a sitemap index
    if (isSitemapIndex(xmlText)) {
      console.log(`[Discovery] Detected sitemap index: ${sitemapUrl}`);

      const nestedSitemapUrls = extractNestedSitemapUrls(xmlText);
      console.log(`[Discovery] Found ${nestedSitemapUrls.length} nested sitemaps`);

      // Fetch each nested sitemap (with timeout checks)
      const allUrls = [];
      for (const nestedUrl of nestedSitemapUrls) {
        // Check total timeout before each nested fetch
        if (Date.now() - startTime > TOTAL_DISCOVERY_TIMEOUT) {
          console.log(`[Discovery] Total timeout reached, stopping nested sitemap fetching`);
          break;
        }

        try {
          const nestedUrls = await fetchAndParseSitemap(nestedUrl, depth + 1, startTime);
          allUrls.push(...nestedUrls);
        } catch (error) {
          // Log and continue - don't let one failed sitemap stop the others
          console.warn(`[Discovery] Failed to fetch nested sitemap ${nestedUrl}:`, error.message);
        }
      }

      // Also extract any direct page URLs from the index (some indexes have both)
      const directUrls = extractPageUrls(xmlText);
      allUrls.push(...directUrls);

      console.log(`[Discovery] Total URLs from sitemap index: ${allUrls.length}`);
      return allUrls;
    } else {
      // Regular sitemap - extract page URLs
      const urls = extractPageUrls(xmlText);
      console.log(`[Discovery] Parsed ${urls.length} URLs from sitemap: ${sitemapUrl}`);
      return urls;
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[Discovery] Sitemap fetch timeout (${timeout}ms): ${sitemapUrl}`);
    } else {
      console.warn(`[Discovery] Error fetching sitemap ${sitemapUrl}:`, error.message);
    }
    return [];
  }
}

/**
 * Try to discover URLs from sitemap.xml
 * Handles both regular sitemaps and sitemap indexes (recursive parsing)
 * Returns array of canonical URLs or null if sitemap not found
 * @param {string|string[]} baseUrls - The base URL(s) to discover from
 * @param {boolean} strictPathMatching - If true, use strict path hierarchy matching
 */
export async function discoverFromSitemap(baseUrls, strictPathMatching = true) {
  const startTime = Date.now();

  try {
    // Handle both single URL and array of URLs
    const urlArray = Array.isArray(baseUrls) ? baseUrls : [baseUrls];
    const firstUrl = urlArray[0];

    const domain = new URL(firstUrl).origin;
    const sitemapUrl = `${domain}/sitemap.xml`;

    console.log('Checking for sitemap at:', sitemapUrl);

    // Fetch and parse sitemap (handles sitemap indexes recursively)
    const urls = await fetchAndParseSitemap(sitemapUrl, 0, startTime);

    if (urls.length === 0) {
      console.log('[Discovery] No URLs found in sitemap');
      return null;
    }

    // Canonicalize all base URLs
    const canonicalBases = urlArray.map(url => canonicalizeUrl(url)).filter(Boolean);

    // Filter to only URLs under ANY of the base paths
    const filteredUrls = urls
      .map(url => canonicalizeUrl(url))
      .filter(url => url && isUnderAnyBasePath(url, canonicalBases, strictPathMatching));

    const elapsed = Date.now() - startTime;
    console.log(`Found ${filteredUrls.length} URLs in sitemap under ${canonicalBases.length} base path(s) (strict: ${strictPathMatching}, took ${elapsed}ms)`);
    return filteredUrls;
  } catch (error) {
    console.error('Error in sitemap discovery:', error);
    return null;
  }
}

/**
 * Parse sitemap XML and extract URLs
 * Using regex since DOMParser is not available in service workers
 * @deprecated Use fetchAndParseSitemap instead for recursive sitemap index support
 */
function parseSitemap(xmlText) {
  const urls = [];

  // Extract URLs from <loc> tags using regex
  // Matches <loc>URL</loc> or <loc><![CDATA[URL]]></loc>
  const locRegex = /<loc>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xmlText)) !== null) {
    const url = match[1].trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      urls.push(url);
    }
  }

  console.log(`Parsed ${urls.length} URLs from sitemap`);
  return urls;
}

/**
 * Extract links from HTML page
 * Returns array of {url, depth} objects for use with the crawler's depth tracking
 * Using regex since DOMParser is not available in service workers
 * @param {string} html - The HTML content to extract links from
 * @param {string} pageUrl - The URL of the page being processed
 * @param {string|string[]} baseUrls - The base URL(s) to filter links against
 * @param {boolean|object} options - Options object or boolean for backward compatibility
 *   - strictPathMatching: boolean (default: true) - Use strict path hierarchy matching
 *   - followExternalLinks: boolean (default: false) - Also extract links outside base paths
 *   - currentDepth: number (default: 0) - Depth of the current page
 *   - maxExternalHops: number (default: 1) - Maximum depth for external links
 * @returns {Array<{url: string, depth: number}>} Array of link objects with URL and depth
 */
export function extractLinksFromHtml(html, pageUrl, baseUrls, options = {}) {
  // Handle backward compatibility: if options is a boolean, treat it as strictPathMatching
  const opts = typeof options === 'boolean'
    ? { strictPathMatching: options }
    : options;

  const {
    strictPathMatching = true,
    followExternalLinks = false,
    currentDepth = 0,
    maxExternalHops = 1
  } = opts;

  const links = [];

  // Handle both single URL and array of URLs
  const urlArray = Array.isArray(baseUrls) ? baseUrls : [baseUrls];
  const canonicalBases = urlArray.map(url => canonicalizeUrl(url)).filter(Boolean);

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

  // Helper function to process a single href and add to links if valid
  function processHref(href) {
    if (!href) return;
    href = href.trim();
    if (!href) return;

    // Skip suspiciously long hrefs (likely data URIs or corrupted data)
    if (href.length > 2000) {
      console.warn(`[Link Extraction] Skipping suspiciously long href (${href.length} chars)`);
      return;
    }

    // Skip non-http(s) links
    if (href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href.startsWith('data:') ||
        href.startsWith('#')) {
      return;
    }

    // Resolve relative URLs to absolute
    const absoluteUrl = resolveUrl(href, pageUrl);
    if (!absoluteUrl || !isValidUrl(absoluteUrl)) {
      return;
    }

    // Skip downloadable files
    try {
      const urlPath = new URL(absoluteUrl).pathname.toLowerCase();
      const hasDownloadExtension = downloadExtensions.some(ext => urlPath.endsWith(ext));
      if (hasDownloadExtension) {
        console.log(`[Link Extraction] Skipping downloadable file: ${absoluteUrl}`);
        return;
      }
    } catch (e) {
      return;
    }

    // Canonicalize the URL
    const canonicalUrl = canonicalizeUrl(absoluteUrl);
    if (!canonicalUrl) return;

    // Check if this is an internal link (under any base path)
    const isInternal = isInternalUrl(canonicalUrl, canonicalBases, strictPathMatching);

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

  // Extract hrefs using multiple regex patterns to handle edge cases

  // Pattern 1: Standard quoted hrefs - <a ...href="URL"...> or <a ...href='URL'...>
  const quotedHrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = quotedHrefRegex.exec(html)) !== null) {
    processHref(match[1]);
  }

  // Pattern 2: Unquoted hrefs - <a href=/page> (valid HTML5)
  const unquotedHrefRegex = /<a[^>]+href=([^\s>"']+)[^>]*>/gi;
  while ((match = unquotedHrefRegex.exec(html)) !== null) {
    const href = match[1];
    // Filter out matches that might include tag content or look malformed
    if (!href.includes('<') && !href.includes('>') && !href.includes('=')) {
      processHref(href);
    }
  }

  // Pattern 3: Area elements in image maps - <area href="URL">
  const areaHrefRegex = /<area[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = areaHrefRegex.exec(html)) !== null) {
    processHref(match[1]);
  }

  // Deduplicate by URL (keep first occurrence's depth)
  const seen = new Map();
  const uniqueLinks = [];
  for (const link of links) {
    if (!seen.has(link.url)) {
      seen.set(link.url, true);
      uniqueLinks.push(link);
    }
  }

  const internalCount = uniqueLinks.filter(l => l.depth === 0).length;
  const externalCount = uniqueLinks.length - internalCount;
  console.log(`Extracted ${uniqueLinks.length} unique links from ${pageUrl} (${internalCount} internal, ${externalCount} external, strict: ${strictPathMatching})`);

  return uniqueLinks;
}

/**
 * Discover URLs using both sitemap and crawling
 * Returns initial set of URLs to crawl
 * @param {string|string[]} baseUrls - The base URL(s) to discover from
 * @param {boolean} strictPathMatching - If true, use strict path hierarchy matching
 */
export async function discoverInitialUrls(baseUrls, strictPathMatching = true) {
  // Handle both single URL and array of URLs
  const urlArray = Array.isArray(baseUrls) ? baseUrls : [baseUrls];

  const urls = new Set();

  // Always include all base URLs themselves
  urlArray.forEach(baseUrl => {
    const canonical = canonicalizeUrl(baseUrl);
    if (canonical) urls.add(canonical);
  });

  // Try sitemap first
  const sitemapUrls = await discoverFromSitemap(urlArray, strictPathMatching);
  if (sitemapUrls && sitemapUrls.length > 0) {
    sitemapUrls.forEach(url => urls.add(url));
    console.log(`Initial discovery: ${urls.size} URLs from sitemap for ${urlArray.length} base path(s) (strict: ${strictPathMatching})`);
  } else {
    console.log(`Initial discovery: Starting with ${urlArray.length} base URL(s) only`);
  }

  return Array.from(urls);
}
