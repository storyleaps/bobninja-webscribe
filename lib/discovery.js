/**
 * URL discovery module
 * Handles sitemap.xml parsing and link extraction from HTML
 */

import { canonicalizeUrl, isUnderBasePath, isUnderAnyBasePath, isInternalUrl, resolveUrl, isValidUrl } from './utils.js';

/**
 * Try to discover URLs from sitemap.xml
 * Returns array of canonical URLs or null if sitemap not found
 * @param {string|string[]} baseUrls - The base URL(s) to discover from
 * @param {boolean} strictPathMatching - If true, use strict path hierarchy matching
 */
export async function discoverFromSitemap(baseUrls, strictPathMatching = true) {
  try {
    // Handle both single URL and array of URLs
    const urlArray = Array.isArray(baseUrls) ? baseUrls : [baseUrls];
    const firstUrl = urlArray[0];

    const domain = new URL(firstUrl).origin;
    const sitemapUrl = `${domain}/sitemap.xml`;

    console.log('Checking for sitemap at:', sitemapUrl);

    const response = await fetch(sitemapUrl, {
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });

    if (!response.ok) {
      console.log('Sitemap not found:', response.status);
      return null;
    }

    const xmlText = await response.text();
    const urls = parseSitemap(xmlText);

    // Canonicalize all base URLs
    const canonicalBases = urlArray.map(url => canonicalizeUrl(url)).filter(Boolean);

    // Filter to only URLs under ANY of the base paths
    const filteredUrls = urls
      .map(url => canonicalizeUrl(url))
      .filter(url => url && isUnderAnyBasePath(url, canonicalBases, strictPathMatching));

    console.log(`Found ${filteredUrls.length} URLs in sitemap under ${canonicalBases.length} base path(s) (strict: ${strictPathMatching})`);
    return filteredUrls;
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return null;
  }
}

/**
 * Parse sitemap XML and extract URLs
 * Using regex since DOMParser is not available in service workers
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
