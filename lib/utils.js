/**
 * Utility functions for URL normalization and validation
 */

/**
 * Normalize URL to canonical form
 * - Protocol: https:// (lowercase)
 * - Domain: lowercase
 * - Remove www subdomain
 * - Remove trailing slash (except root)
 * - Remove default ports
 * - Remove fragments (#)
 * - Remove query parameters (optional)
 */
export function canonicalizeUrl(urlString, removeQuery = true) {
  try {
    // Validate input is a string
    if (typeof urlString !== 'string') {
      return null;
    }

    // Check if string is suspiciously long (likely content instead of URL)
    if (urlString.length > 2000) {
      return null;
    }

    const url = new URL(urlString);

    // Normalize protocol to https
    url.protocol = 'https:';

    // Normalize hostname to lowercase and remove www
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    url.hostname = hostname;

    // Remove default ports
    if (url.port === '80' || url.port === '443') {
      url.port = '';
    }

    // Remove trailing slash from pathname (except root)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    // Remove fragment
    url.hash = '';

    // Remove query parameters if requested
    if (removeQuery) {
      url.search = '';
    }

    return url.toString();
  } catch (error) {
    console.error('Error canonicalizing URL:', urlString, error);
    return null;
  }
}

/**
 * Check if a URL is under a base path
 * Both URLs should be canonical
 * @param {string} url - The URL to check
 * @param {string} baseUrl - The base URL to check against
 * @param {boolean} strict - If true, ensures exact path hierarchy matching (default: true)
 *                           Strict mode: /api matches /api/users but NOT /api-docs
 *                           Loose mode: /api matches both /api/users AND /api-docs
 */
export function isUnderBasePath(url, baseUrl, strict = true) {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);

    // Must be same domain (canonical hostnames)
    if (urlObj.hostname !== baseObj.hostname) {
      return false;
    }

    // URL path must start with base path
    const urlPath = urlObj.pathname;
    const basePath = baseObj.pathname;

    if (!urlPath.startsWith(basePath)) {
      return false;
    }

    // If strict mode is enabled, ensure proper path hierarchy
    if (strict) {
      // After the base path, there must be:
      // 1. End of string (exact match)
      // 2. A forward slash (subdirectory)
      // 3. A query parameter (?) or hash (#) - checked via URL search/hash

      if (urlPath === basePath) {
        // Exact match
        return true;
      }

      // Special case: root path "/" matches all paths on the same origin
      // For root, any path like "/about", "/blog" should be valid
      if (basePath === '/') {
        return true;
      }

      // Check if the next character after basePath is a slash
      // This ensures /financial-apis matches /financial-apis/overview
      // but NOT /financial-apis-blog
      const nextChar = urlPath[basePath.length];
      return nextChar === '/';
    }

    // Loose mode: just check if it starts with base path (old behavior)
    return true;
  } catch (error) {
    console.error('Error checking base path:', url, baseUrl, error);
    return false;
  }
}

/**
 * Check if a URL is under ANY of multiple base paths
 * @param {string} url - The URL to check
 * @param {string|string[]} baseUrls - Single base URL or array of base URLs
 * @param {boolean} strict - If true, use strict path hierarchy matching
 * @returns {boolean} True if URL is under any of the base paths
 */
export function isUnderAnyBasePath(url, baseUrls, strict = true) {
  // Handle single URL (backward compatibility)
  if (typeof baseUrls === 'string') {
    return isUnderBasePath(url, baseUrls, strict);
  }

  // Handle array of URLs
  if (Array.isArray(baseUrls)) {
    return baseUrls.some(baseUrl => isUnderBasePath(url, baseUrl, strict));
  }

  return false;
}

/**
 * Check if a URL is "internal" (matches any of the base paths)
 * This is an alias for isUnderAnyBasePath, used for clarity when dealing with
 * external link crawling features.
 * @param {string} url - The URL to check
 * @param {string|string[]} baseUrls - Single base URL or array of base URLs
 * @param {boolean} strict - If true, use strict path hierarchy matching
 * @returns {boolean} True if URL is internal (under any base path)
 */
export function isInternalUrl(url, baseUrls, strict = true) {
  return isUnderAnyBasePath(url, baseUrls, strict);
}

/**
 * Resolve a relative URL to absolute
 */
export function resolveUrl(relativeUrl, baseUrl) {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    console.error('Error resolving URL:', relativeUrl, baseUrl, error);
    return null;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (error) {
    return null;
  }
}

/**
 * Validate URL format
 */
export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * Extract path from URL
 */
export function extractPath(urlString) {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch (error) {
    return null;
  }
}

/**
 * Compute SHA-256 hash of content for deduplication
 * Returns hex string like "a3f2c8d1e5..."
 */
export async function computeContentHash(content) {
  try {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Compute SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('Error computing content hash:', error);
    return null;
  }
}
