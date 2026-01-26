/**
 * Utility functions for exporting crawled pages
 */

export interface PageMetadata {
  description?: string;
  keywords?: string;
  author?: string;
  generator?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogSiteName?: string;
  articleSection?: string;
  articleTags?: string[];
  canonical?: string;
  jsonLd?: {
    type?: string;
    headline?: string;
    description?: string;
    name?: string;
    author?: string;
  };
}

export interface MarkdownMeta {
  confidence: number;
  isArticle: boolean;
  title?: string;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  textLength?: number;
  linkDensity?: number;
  extractionRatio?: number;
  hasStructure?: boolean;
  reason?: string;
  urlHints?: any;
  qualityChecks?: any;
}

export interface Page {
  id: string;
  url: string;
  content: string;
  contentLength: number;
  metadata?: PageMetadata | null;
  markdown?: string | null;
  markdownMeta?: MarkdownMeta | null;
  alternateUrls?: string[];
  html?: string | null;
}

/**
 * Sanitizes a URL to create a valid file name
 * Always uses the full canonical URL without protocol (e.g., "example.com-docs-api")
 * Removes invalid characters and limits length
 */
export function sanitizeFileName(url: string): string {
  // Use full canonical URL without protocol
  let path = url.replace(/^https?:\/\//, '') || 'index';

  // Replace invalid file system characters with underscores
  path = path.replace(/[<>:"/\\|?*]/g, '_');

  // Replace slashes with hyphens to flatten directory structure
  path = path.replace(/\//g, '-');

  // Replace multiple consecutive underscores/hyphens with a single one
  path = path.replace(/[-_]+/g, '-');

  // Limit length to 200 chars (leave room for extension)
  if (path.length > 200) {
    path = path.substring(0, 200);
  }

  // Remove trailing dots, spaces, hyphens, or underscores
  path = path.replace(/[.\s\-_]+$/, '');

  // Ensure we have a valid filename
  return path || 'page';
}

/**
 * Formats metadata as human-readable text
 */
function formatMetadata(page: Page): string {
  const metadata = page.metadata;
  const alternateUrls = page.alternateUrls;

  const lines: string[] = [];

  if (!metadata || Object.keys(metadata).length === 0) {
    // Add alternate URLs if they exist (more than just the primary URL)
    if (alternateUrls && alternateUrls.length > 1) {
      lines.push(`Alternate URLs: ${alternateUrls.slice(1).join(', ')}`);
    }
    return lines.length > 0 ? '\n' + lines.join('\n') + '\n' : '';
  }

  // Canonical URL (first)
  if (metadata.canonical) {
    lines.push(`Canonical URL: ${metadata.canonical}`);
  }

  // Add alternate URLs if they exist (more than just the primary URL)
  if (alternateUrls && alternateUrls.length > 1) {
    lines.push(`Alternate URLs: ${alternateUrls.slice(1).join(', ')}`);
  }

  // Title (OG Title)
  if (metadata.ogTitle) {
    lines.push(`Title: ${metadata.ogTitle}`);
  }

  // Description (use ogDescription as fallback for description)
  const description = metadata.description || metadata.ogDescription;
  if (description) {
    lines.push(`Description: ${description}`);
  }

  // Generator
  if (metadata.generator) {
    lines.push(`Generator: ${metadata.generator}`);
  }

  // Type (OG Type)
  if (metadata.ogType) {
    lines.push(`Type: ${metadata.ogType}`);
  }

  // Other metadata fields
  if (metadata.keywords) {
    lines.push(`Keywords: ${metadata.keywords}`);
  }
  if (metadata.author) {
    lines.push(`Author: ${metadata.author}`);
  }
  if (metadata.ogSiteName) {
    lines.push(`Site Name: ${metadata.ogSiteName}`);
  }

  // Article metadata
  if (metadata.articleSection) {
    lines.push(`Section: ${metadata.articleSection}`);
  }
  if (metadata.articleTags && metadata.articleTags.length > 0) {
    lines.push(`Tags: ${metadata.articleTags.join(', ')}`);
  }

  // JSON-LD
  if (metadata.jsonLd) {
    if (metadata.jsonLd.headline) {
      lines.push(`Headline: ${metadata.jsonLd.headline}`);
    }
    if (metadata.jsonLd.type) {
      lines.push(`Schema Type: ${metadata.jsonLd.type}`);
    }
  }

  return lines.length > 0 ? '\n' + lines.join('\n') + '\n' : '';
}

/**
 * Formats concatenated content from multiple pages (raw text format)
 * Each page is delimited with URL headers and includes metadata
 */
export function formatConcatenatedContent(pages: Page[]): string {
  return pages.map((page) => {
    const separator = '='.repeat(80);
    const metadataSection = formatMetadata(page);

    return `${separator}
URL: ${page.url}${metadataSection}
${separator}

${page.content}

`;
  }).join('\n');
}

/**
 * Formats concatenated markdown content from multiple pages
 * Each page includes YAML Front Matter metadata and markdown content
 * Falls back to raw text for pages without valid markdown
 */
export function formatConcatenatedMarkdown(pages: Page[], confidenceThreshold: number = 0.5): string {
  return pages.map((page) => {
    if (isMarkdownAvailable(page, confidenceThreshold)) {
      return formatMarkdownWithMetadata(page);
    } else {
      // Fallback to raw text format for pages without valid markdown
      const separator = '='.repeat(80);
      const metadataSection = formatMetadata(page);
      return `${separator}
URL: ${page.url}${metadataSection}
${separator}

${page.content}

`;
    }
  }).join('\n---\n\n');
}

/**
 * Calculates the total size of concatenated content in bytes
 */
export function calculateContentSize(pages: Page[]): number {
  const concatenated = formatConcatenatedContent(pages);
  return new Blob([concatenated]).size;
}

/**
 * Formats bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Checks if content size is safe for clipboard
 * Returns true if size is acceptable, false otherwise
 */
export function isClipboardSizeSafe(pages: Page[]): boolean {
  const sizeInBytes = calculateContentSize(pages);
  const sizeInMB = sizeInBytes / (1024 * 1024);

  // Conservative 10MB limit for clipboard stability
  return sizeInMB <= 10;
}

/**
 * Gets a domain-safe filename from a base URL
 */
export function getDomainFileName(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    const domain = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\//g, '-').replace(/^-|-$/g, '');

    let filename = domain;
    if (path) {
      filename += `-${path}`;
    }

    // Sanitize the result
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    filename = filename.replace(/[-_]+/g, '-');

    return filename || 'export';
  } catch {
    return 'export';
  }
}

/**
 * Content format types
 */
export type ContentFormat = 'text' | 'markdown' | 'html';

/**
 * Result of getting content in requested format
 */
export interface ContentFormatResult {
  format: ContentFormat;
  content: string;
  fallback: boolean;
  reason?: string;
}

/**
 * Get content in requested format with confidence threshold check
 * @param page - Page object with content, markdown, and html
 * @param requestedFormat - Desired format ('text', 'markdown', or 'html')
 * @param confidenceThreshold - Minimum confidence score (0-1) for markdown (default 0.5)
 * @returns Content format result with actual format used and fallback status
 */
export function getContentForFormat(
  page: Page,
  requestedFormat: ContentFormat,
  confidenceThreshold: number = 0.5
): ContentFormatResult {
  if (requestedFormat === 'html') {
    // Check if HTML is available
    if (page.html) {
      return {
        format: 'html',
        content: page.html,
        fallback: false
      };
    } else {
      // HTML unavailable - fallback to text
      return {
        format: 'text',
        content: page.content,
        fallback: true,
        reason: 'unavailable'
      };
    }
  }

  if (requestedFormat === 'markdown') {
    // Check if markdown is available and meets threshold
    if (page.markdown && page.markdownMeta) {
      if (page.markdownMeta.confidence >= confidenceThreshold) {
        return {
          format: 'markdown',
          content: page.markdown,
          fallback: false
        };
      } else {
        // Low confidence - fallback to text
        return {
          format: 'text',
          content: page.content,
          fallback: true,
          reason: 'low-confidence'
        };
      }
    } else {
      // Markdown unavailable - fallback to text
      return {
        format: 'text',
        content: page.content,
        fallback: true,
        reason: page.markdown ? 'metadata-missing' : 'unavailable'
      };
    }
  }

  // Text format always works
  return {
    format: 'text',
    content: page.content,
    fallback: false
  };
}

/**
 * Check if markdown is available for a page with given threshold
 */
export function isMarkdownAvailable(page: Page, confidenceThreshold: number = 0.5): boolean {
  return !!(page.markdown && page.markdownMeta && page.markdownMeta.confidence >= confidenceThreshold);
}

/**
 * Check if HTML is available for a page
 */
export function isHtmlAvailable(page: Page): boolean {
  return !!(page.html && page.html.length > 0);
}

/**
 * Get confidence level description
 */
export function getConfidenceDescription(confidence: number): string {
  if (confidence >= 0.8) return 'Very High';
  if (confidence >= 0.6) return 'High';
  if (confidence >= 0.4) return 'Medium';
  if (confidence >= 0.2) return 'Low';
  return 'Very Low';
}

/**
 * Formats metadata as YAML Front Matter
 */
function formatMetadataAsYAML(page: Page): string {
  const url = page.url;
  const metadata = page.metadata;
  const alternateUrls = page.alternateUrls;

  const lines: string[] = ['---', `url: ${url}`];

  if (!metadata || Object.keys(metadata).length === 0) {
    // Add alternate URLs if they exist (more than just the primary URL)
    if (alternateUrls && alternateUrls.length > 1) {
      lines.push('alternate_urls:');
      alternateUrls.forEach(altUrl => {
        lines.push(`  - ${altUrl}`);
      });
    }
    lines.push('---');
    return lines.join('\n') + '\n\n';
  }

  // Canonical URL (second, after url)
  if (metadata.canonical) {
    lines.push(`canonical: ${metadata.canonical}`);
  }

  // Add alternate URLs if they exist (more than just the primary URL)
  if (alternateUrls && alternateUrls.length > 1) {
    lines.push('alternate_urls:');
    alternateUrls.forEach(altUrl => {
      lines.push(`  - ${altUrl}`);
    });
  }

  // Title (OG Title renamed to just "title")
  if (metadata.ogTitle) {
    const escaped = metadata.ogTitle.replace(/"/g, '\\"');
    lines.push(`title: "${escaped}"`);
  }

  // Description (use ogDescription as fallback for description)
  const description = metadata.description || metadata.ogDescription;
  if (description) {
    // Escape and quote if contains special characters
    const escaped = description.replace(/"/g, '\\"');
    lines.push(`description: "${escaped}"`);
  }

  // Generator
  if (metadata.generator) {
    lines.push(`generator: ${metadata.generator}`);
  }

  // Type (OG Type renamed to just "type")
  if (metadata.ogType) {
    lines.push(`type: ${metadata.ogType}`);
  }

  // Other metadata fields
  if (metadata.keywords) {
    lines.push(`keywords: ${metadata.keywords}`);
  }
  if (metadata.author) {
    lines.push(`author: ${metadata.author}`);
  }
  if (metadata.ogSiteName) {
    lines.push(`og_site_name: ${metadata.ogSiteName}`);
  }

  // Article metadata
  if (metadata.articleSection) {
    lines.push(`section: ${metadata.articleSection}`);
  }
  if (metadata.articleTags && metadata.articleTags.length > 0) {
    lines.push(`tags:`);
    metadata.articleTags.forEach(tag => {
      lines.push(`  - ${tag}`);
    });
  }

  // JSON-LD
  if (metadata.jsonLd) {
    if (metadata.jsonLd.headline) {
      const escaped = metadata.jsonLd.headline.replace(/"/g, '\\"');
      lines.push(`headline: "${escaped}"`);
    }
    if (metadata.jsonLd.type) {
      lines.push(`schema_type: ${metadata.jsonLd.type}`);
    }
  }

  lines.push('---');
  return lines.join('\n') + '\n\n';
}

/**
 * Format markdown content with metadata header
 * @param page - Page with markdown and metadata
 * @returns Formatted markdown with YAML Front Matter metadata
 */
export function formatMarkdownWithMetadata(page: Page): string {
  const yamlFrontMatter = formatMetadataAsYAML(page);
  return yamlFrontMatter + (page.markdown || '');
}
