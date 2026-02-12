/**
 * Webscribe ABP Runtime
 * Version: 0.1.0
 *
 * Implements the Agentic Browser Protocol for the Webscribe Chrome extension.
 * Exposes 17 capabilities for crawling, storage, content conversion, diagnostics, and scraping.
 */

(function() {
  'use strict';

  // =============================================================================
  // CONSTANTS & CONFIGURATION
  // =============================================================================

  const PROTOCOL_VERSION = '0.1';
  const APP_ID = 'com.nicholasdao.webscribe';
  const APP_NAME = 'Webscribe';
  const MESSAGE_TIMEOUT = 30000; // 30 seconds

  const ERROR_CODES = {
    NOT_INITIALIZED: 'NOT_INITIALIZED',
    UNKNOWN_CAPABILITY: 'UNKNOWN_CAPABILITY',
    INVALID_PARAMS: 'INVALID_PARAMS',
    OPERATION_FAILED: 'OPERATION_FAILED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    TIMEOUT: 'TIMEOUT',
    CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED'
  };

  // =============================================================================
  // STATE
  // =============================================================================

  let initialized = false;
  let sessionId = null;
  let appVersion = null;

  // =============================================================================
  // UTILITY FUNCTIONS - Service Worker Messaging
  // =============================================================================

  /**
   * Send a message to the service worker using MessageChannel pattern
   * @param {string} type - Message type
   * @param {any} data - Message data
   * @returns {Promise<any>} Response data
   */
  async function _sendMessage(type, data) {
    return new Promise((resolve, reject) => {
      (async () => {
        let timeoutId = null;
        let messageChannel = null;
        let responseCalled = false;

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (messageChannel && messageChannel.port1) {
            try {
              messageChannel.port1.close();
            } catch (e) {
              // Port already closed, ignore
            }
          }
          responseCalled = true;
        };

        try {
          // Wait for service worker to be ready
          await navigator.serviceWorker.ready;

          if (!navigator.serviceWorker.controller) {
            reject(new Error('Service worker controller not available'));
            return;
          }

          // Create message channel for response
          messageChannel = new MessageChannel();

          messageChannel.port1.onmessage = (event) => {
            if (!responseCalled && event.data.type === 'RESPONSE') {
              cleanup();
              if (event.data.data.error) {
                reject(new Error(event.data.data.error));
              } else {
                resolve(event.data.data);
              }
            }
          };

          // Timeout after 30 seconds
          timeoutId = setTimeout(() => {
            if (!responseCalled) {
              cleanup();
              reject(new Error('Service worker request timeout'));
            }
          }, MESSAGE_TIMEOUT);

          // Send message to service worker
          navigator.serviceWorker.controller.postMessage(
            { type, data },
            [messageChannel.port2]
          );
        } catch (error) {
          cleanup();
          reject(error);
        }
      })();
    });
  }

  /**
   * Create an error response
   */
  function _createErrorResponse(code, message, retryable = false) {
    return {
      success: false,
      error: {
        code,
        message,
        retryable
      }
    };
  }

  /**
   * Create a success response
   */
  function _createSuccessResponse(data) {
    return {
      success: true,
      data
    };
  }

  // =============================================================================
  // UTILITY FUNCTIONS - Export Utils (Vanilla JS)
  // =============================================================================

  /**
   * Sanitize URL to create valid filename
   */
  function _sanitizeFileName(url) {
    let filename = url;

    // Strip protocol
    filename = filename.replace(/^https?:\/\//, '');

    // Replace invalid filesystem characters
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');

    // Replace slashes with hyphens
    filename = filename.replace(/\//g, '-');

    // Collapse consecutive hyphens/underscores
    filename = filename.replace(/[-_]{2,}/g, '-');

    // Truncate to 200 characters
    filename = filename.substring(0, 200);

    // Remove trailing special characters
    filename = filename.replace(/[-._]+$/, '');

    return filename || 'page';
  }

  /**
   * Get domain-based filename
   */
  function _getDomainFileName(baseUrl) {
    try {
      const url = new URL(baseUrl);
      let domain = url.hostname.replace(/^www\./, '');
      let path = url.pathname.replace(/^\//, '').replace(/\//g, '-');

      let filename = path ? `${domain}-${path}` : domain;

      // Sanitize
      filename = filename.replace(/[<>:"/\\|?*]/g, '_');
      filename = filename.replace(/[-_]+$/, '');

      return filename || 'export';
    } catch (e) {
      return 'export';
    }
  }

  /**
   * Format page metadata as YAML frontmatter
   */
  function _formatMetadataAsYAML(page) {
    if (!page.metadata) return '';

    const lines = ['---'];
    const meta = page.metadata;

    lines.push(`url: "${page.url}"`);

    if (meta.canonical) {
      lines.push(`canonical: "${meta.canonical}"`);
    }

    if (page.alternateUrls && page.alternateUrls.length > 1) {
      lines.push('alternate_urls:');
      page.alternateUrls.slice(1).forEach(url => {
        lines.push(`  - "${url}"`);
      });
    }

    if (meta.ogTitle || meta.jsonLd?.headline) {
      const title = (meta.ogTitle || meta.jsonLd?.headline || '').replace(/"/g, '\\"');
      lines.push(`title: "${title}"`);
    }

    if (meta.description || meta.ogDescription || meta.jsonLd?.description) {
      const desc = (meta.description || meta.ogDescription || meta.jsonLd?.description || '').replace(/"/g, '\\"');
      lines.push(`description: "${desc}"`);
    }

    if (meta.author || meta.jsonLd?.author) {
      const author = (meta.author || meta.jsonLd?.author || '').replace(/"/g, '\\"');
      lines.push(`author: "${author}"`);
    }

    if (meta.generator) {
      lines.push(`generator: "${meta.generator.replace(/"/g, '\\"')}"`);
    }

    if (meta.ogType || meta.jsonLd?.type) {
      const type = meta.ogType || meta.jsonLd?.type;
      lines.push(`type: "${type}"`);
    }

    if (meta.keywords) {
      lines.push(`keywords: "${meta.keywords.replace(/"/g, '\\"')}"`);
    }

    if (meta.ogSiteName || meta.jsonLd?.name) {
      const siteName = (meta.ogSiteName || meta.jsonLd?.name || '').replace(/"/g, '\\"');
      lines.push(`site_name: "${siteName}"`);
    }

    if (meta.articleSection) {
      lines.push(`section: "${meta.articleSection.replace(/"/g, '\\"')}"`);
    }

    if (meta.articleTags && meta.articleTags.length > 0) {
      lines.push('tags:');
      meta.articleTags.forEach(tag => {
        lines.push(`  - "${tag.replace(/"/g, '\\"')}"`);
      });
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format markdown with metadata
   */
  function _formatMarkdownWithMetadata(page) {
    const yaml = _formatMetadataAsYAML(page);
    const markdown = page.markdown || '';
    return yaml + markdown;
  }

  /**
   * Check if markdown is available and meets confidence threshold
   */
  function _isMarkdownAvailable(page, confidenceThreshold = 0.5) {
    return !!(page.markdown &&
              page.markdownMeta &&
              page.markdownMeta.confidence >= confidenceThreshold);
  }

  /**
   * Get content for format with fallback logic
   */
  function _getContentForFormat(page, requestedFormat, confidenceThreshold = 0.5) {
    const result = {
      format: requestedFormat,
      content: '',
      fallback: false,
      reason: undefined
    };

    if (requestedFormat === 'html') {
      if (page.html && page.html.length > 0) {
        result.content = page.html;
        result.fallback = false;
      } else {
        result.content = page.content;
        result.format = 'text';
        result.fallback = true;
        result.reason = 'unavailable';
      }
    } else if (requestedFormat === 'markdown') {
      if (page.markdown && page.markdownMeta) {
        if (page.markdownMeta.confidence >= confidenceThreshold) {
          result.content = page.markdown;
          result.fallback = false;
        } else {
          result.content = page.content;
          result.format = 'text';
          result.fallback = true;
          result.reason = 'low-confidence';
        }
      } else {
        result.content = page.content;
        result.format = 'text';
        result.fallback = true;
        result.reason = page.markdown ? 'metadata-missing' : 'unavailable';
      }
    } else {
      // text
      result.content = page.content;
      result.fallback = false;
    }

    return result;
  }

  /**
   * Format concatenated content (text)
   */
  function _formatConcatenatedContent(pages) {
    return pages.map(page => {
      const separator = '='.repeat(80);
      const header = `URL: ${page.url}`;

      // Add metadata section
      let metadataSection = '';
      if (page.metadata) {
        if (page.metadata.title) metadataSection += `\nTitle: ${page.metadata.title}`;
        if (page.metadata.description) metadataSection += `\nDescription: ${page.metadata.description}`;
        if (page.metadata.author) metadataSection += `\nAuthor: ${page.metadata.author}`;
        if (page.metadata.keywords) metadataSection += `\nKeywords: ${page.metadata.keywords}`;
      }

      return `${separator}\n${header}${metadataSection}\n${separator}\n\n${page.content}\n`;
    }).join('\n');
  }

  /**
   * Format concatenated markdown
   */
  function _formatConcatenatedMarkdown(pages, confidenceThreshold = 0.5) {
    return pages.map(page => {
      if (_isMarkdownAvailable(page, confidenceThreshold)) {
        return _formatMarkdownWithMetadata(page);
      } else {
        const separator = '='.repeat(80);
        const header = `URL: ${page.url}`;

        // Add metadata section for fallback
        let metadataSection = '';
        if (page.metadata) {
          if (page.metadata.title) metadataSection += `\nTitle: ${page.metadata.title}`;
          if (page.metadata.description) metadataSection += `\nDescription: ${page.metadata.description}`;
          if (page.metadata.author) metadataSection += `\nAuthor: ${page.metadata.author}`;
          if (page.metadata.keywords) metadataSection += `\nKeywords: ${page.metadata.keywords}`;
        }

        return `${separator}\n${header}${metadataSection}\n${separator}\n\n${page.content}\n`;
      }
    }).join('\n---\n\n');
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Crawl Operations
  // =============================================================================

  /**
   * Handler: crawl.start
   */
  async function _crawlStart(params) {
    try {
      if (!params.urls || (Array.isArray(params.urls) && params.urls.length === 0)) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'urls parameter is required and must not be empty');
      }

      const result = await _sendMessage('START_CRAWL', {
        baseUrl: params.urls,
        options: params.options || {}
      });

      return _createSuccessResponse({
        jobId: result.jobId,
        status: 'started'
      });
    } catch (error) {
      console.error('[ABP] crawl.start error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: crawl.status
   */
  async function _crawlStatus(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }

      // Get active crawl status
      const statusResult = await _sendMessage('GET_CRAWL_STATUS', {});

      // Get job details
      const jobResult = await _sendMessage('GET_JOB', { jobId: params.jobId });

      // Merge results
      const responseData = {
        active: statusResult.active || false,
        jobId: params.jobId,
        pagesProcessed: statusResult.active ? statusResult.pagesProcessed : 0,
        pagesFound: statusResult.active ? statusResult.pagesFound : 0,
        queueSize: statusResult.active ? statusResult.queueSize : 0,
        inProgress: statusResult.active ? statusResult.inProgress : [],
        job: jobResult.job
      };

      return _createSuccessResponse(responseData);
    } catch (error) {
      console.error('[ABP] crawl.status error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: crawl.cancel
   */
  async function _crawlCancel(params) {
    try {
      await _sendMessage('CANCEL_CRAWL', {});
      return _createSuccessResponse({ status: 'cancelled' });
    } catch (error) {
      console.error('[ABP] crawl.cancel error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: crawl.resume
   */
  async function _crawlResume(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }

      const result = await _sendMessage('RESUME_CRAWL', {
        jobId: params.jobId,
        options: params.options || {}
      });

      return _createSuccessResponse({
        jobId: result.jobId,
        status: 'resumed'
      });
    } catch (error) {
      console.error('[ABP] crawl.resume error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Storage Operations
  // =============================================================================

  /**
   * Handler: storage.jobs.list
   */
  async function _storageJobsList(params) {
    try {
      const result = await _sendMessage('GET_JOBS', {});
      return _createSuccessResponse({ jobs: result.jobs || [] });
    } catch (error) {
      console.error('[ABP] storage.jobs.list error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: storage.jobs.get
   */
  async function _storageJobsGet(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }

      const result = await _sendMessage('GET_JOB', { jobId: params.jobId });
      return _createSuccessResponse({ job: result.job });
    } catch (error) {
      console.error('[ABP] storage.jobs.get error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: storage.jobs.delete
   */
  async function _storageJobsDelete(params) {
    try {
      if (!params.jobIds) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobIds parameter is required');
      }

      const jobIds = Array.isArray(params.jobIds) ? params.jobIds : [params.jobIds];
      let deleted = 0;

      for (const jobId of jobIds) {
        try {
          await _sendMessage('DELETE_JOB', { jobId });
          deleted++;
        } catch (error) {
          console.error(`[ABP] Failed to delete job ${jobId}:`, error);
        }
      }

      return _createSuccessResponse({ deleted });
    } catch (error) {
      console.error('[ABP] storage.jobs.delete error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: storage.jobs.update
   */
  async function _storageJobsUpdate(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }
      if (!params.updates) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'updates parameter is required');
      }

      // Update the job
      await _sendMessage('UPDATE_JOB', {
        jobId: params.jobId,
        updates: params.updates
      });

      // Get the updated job
      const result = await _sendMessage('GET_JOB', { jobId: params.jobId });
      return _createSuccessResponse({ job: result.job });
    } catch (error) {
      console.error('[ABP] storage.jobs.update error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: storage.pages.list
   */
  async function _storagePagesList(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }

      const result = await _sendMessage('GET_PAGES', { jobId: params.jobId });
      return _createSuccessResponse({ pages: result.pages || [] });
    } catch (error) {
      console.error('[ABP] storage.pages.list error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: storage.pages.search
   */
  async function _storagePagesSearch(params) {
    try {
      if (!params.query) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'query parameter is required');
      }

      const result = await _sendMessage('SEARCH', { query: params.query });
      return _createSuccessResponse({ pages: result.results || [] });
    } catch (error) {
      console.error('[ABP] storage.pages.search error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Content Conversion & Export
  // =============================================================================

  /**
   * Handler: convert.toFormat
   */
  async function _convertToFormat(params) {
    try {
      if (!params.jobId) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobId parameter is required');
      }
      if (!params.format || !['text', 'markdown', 'html'].includes(params.format)) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'format must be "text", "markdown", or "html"');
      }

      const confidenceThreshold = params.confidenceThreshold || 0.5;
      const includeMetadata = params.includeMetadata !== false;

      // Single page conversion
      if (params.pageId) {
        const pagesResult = await _sendMessage('GET_PAGES', { jobId: params.jobId });
        const page = pagesResult.pages.find(p => p.id === params.pageId);

        if (!page) {
          return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, `Page ${params.pageId} not found`);
        }

        const formatResult = _getContentForFormat(page, params.format, confidenceThreshold);
        const responseData = {
          format: formatResult.format,
          content: formatResult.content,
          fallback: formatResult.fallback
        };

        if (formatResult.reason) {
          responseData.reason = formatResult.reason;
        }

        if (includeMetadata && page.metadata) {
          responseData.metadata = page.metadata;
        }

        return _createSuccessResponse(responseData);
      }

      // All pages conversion
      const pagesResult = await _sendMessage('GET_PAGES', { jobId: params.jobId });
      const pages = pagesResult.pages || [];

      let content;
      let fallbackCount = 0;

      if (params.format === 'markdown') {
        content = _formatConcatenatedMarkdown(pages, confidenceThreshold);
        fallbackCount = pages.filter(p => !_isMarkdownAvailable(p, confidenceThreshold)).length;
      } else {
        content = _formatConcatenatedContent(pages);
      }

      return _createSuccessResponse({
        format: params.format,
        content,
        pageCount: pages.length,
        fallbackCount
      });
    } catch (error) {
      console.error('[ABP] convert.toFormat error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: export.asArchive
   */
  async function _exportAsArchive(params) {
    try {
      if (!params.jobIds) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'jobIds parameter is required');
      }
      if (!params.format || !['text', 'markdown'].includes(params.format)) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'format must be "text" or "markdown"');
      }

      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, 'JSZip library not available');
      }

      const jobIds = Array.isArray(params.jobIds) ? params.jobIds : [params.jobIds];
      const confidenceThreshold = params.confidenceThreshold || 0.5;
      const zip = new JSZip();

      // Process each job
      for (const jobId of jobIds) {
        try {
          // Get job details
          const jobResult = await _sendMessage('GET_JOB', { jobId });
          const job = jobResult.job;

          if (!job) {
            console.warn(`[ABP] Job ${jobId} not found, skipping`);
            continue;
          }

          // Get pages
          const pagesResult = await _sendMessage('GET_PAGES', { jobId });
          const pages = pagesResult.pages || [];

          if (pages.length === 0) {
            console.warn(`[ABP] No pages for job ${jobId}, skipping`);
            continue;
          }

          // Create folder name from job
          const folderName = _getDomainFileName(job.baseUrl || job.baseUrls?.[0] || jobId);

          // Add each page to ZIP
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            let content;
            let extension;

            if (params.format === 'markdown' && _isMarkdownAvailable(page, confidenceThreshold)) {
              content = _formatMarkdownWithMetadata(page);
              extension = '.md';
            } else {
              content = page.content;
              extension = params.format === 'markdown' ? '.md' : '.txt';
            }

            const filename = _sanitizeFileName(page.url) + extension;
            const filePath = `${folderName}/${filename}`;
            zip.file(filePath, content);
          }
        } catch (error) {
          console.error(`[ABP] Error processing job ${jobId}:`, error);
        }
      }

      // Check if ZIP is empty
      let fileCount = 0;
      zip.forEach(() => fileCount++);

      if (fileCount === 0) {
        return _createErrorResponse(
          ERROR_CODES.OPERATION_FAILED,
          'No pages found to export in specified jobs'
        );
      }

      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const arrayBuffer = await zipBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Convert to base64 using chunked encoding to avoid stack overflow
      const CHUNK_SIZE = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      const filename = jobIds.length === 1 ?
        `${_getDomainFileName(jobIds[0])}.zip` :
        `webscribe-export-${Date.now()}.zip`;

      return _createSuccessResponse({
        document: {
          content: base64,
          mimeType: 'application/zip',
          encoding: 'base64',
          size: bytes.length,
          filename
        }
      });
    } catch (error) {
      console.error('[ABP] export.asArchive error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Scraping
  // =============================================================================

  /**
   * Handler: scrape.pickContent
   */
  async function _scrapePickContent(params) {
    try {
      if (!params.url) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'url parameter is required');
      }

      // Validate URL is web-accessible
      try {
        const url = new URL(params.url);
        if (!url.protocol.startsWith('http')) {
          return _createErrorResponse(
            ERROR_CODES.INVALID_PARAMS,
            'URL must start with http:// or https://'
          );
        }
      } catch (e) {
        return _createErrorResponse(
          ERROR_CODES.INVALID_PARAMS,
          'Invalid URL format'
        );
      }

      const selector = params.selector || 'body';
      const useIncognito = params.useIncognito || false;

      // Check if Turndown is available
      if (typeof TurndownService === 'undefined') {
        return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, 'TurndownService not available');
      }

      let tabId = null;
      let listener = null;
      let loadTimeout = null;

      try {
        // Create tab
        const tab = await chrome.tabs.create({
          url: params.url,
          active: false
        });
        tabId = tab.id;

        // Wait for page to load
        await new Promise((resolve, reject) => {
          loadTimeout = setTimeout(() => {
            reject(new Error('Page load timeout'));
          }, 30000);

          listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
              clearTimeout(loadTimeout);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };

          chrome.tabs.onUpdated.addListener(listener);
        });

        // Extract content from selector
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => {
            const element = document.querySelector(sel);
            if (!element) {
              return { error: 'Selector not found' };
            }

            const clone = element.cloneNode(true);

            // Remove scripts and styles
            clone.querySelectorAll('script, style').forEach(el => el.remove());

            return {
              html: clone.innerHTML,
              text: element.innerText,
              title: document.title,
              url: window.location.href
            };
          },
          args: [selector]
        });

        const result = results[0]?.result;

        if (!result || result.error) {
          return _createErrorResponse(
            ERROR_CODES.OPERATION_FAILED,
            result?.error || 'Failed to extract content'
          );
        }

        // Convert HTML to markdown using Turndown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced'
        });

        // Add GFM plugin if available
        if (typeof turndownPluginGfm !== 'undefined') {
          turndownService.use(turndownPluginGfm.gfm);
        }

        const markdown = turndownService.turndown(result.html);

        return _createSuccessResponse({
          url: result.url,
          title: result.title,
          html: result.html,
          markdown,
          text: result.text,
          metadata: {
            selector,
            extractedAt: new Date().toISOString()
          }
        });
      } finally {
        // Clean up listener
        if (listener) {
          try {
            chrome.tabs.onUpdated.removeListener(listener);
          } catch (e) {
            console.warn('[ABP] Failed to remove listener:', e);
          }
        }

        // Clean up timeout
        if (loadTimeout) {
          clearTimeout(loadTimeout);
        }

        // Always close the tab
        if (tabId !== null) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (error) {
            console.warn('[ABP] Failed to close tab:', error);
          }
        }
      }
    } catch (error) {
      console.error('[ABP] scrape.pickContent error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Diagnostics
  // =============================================================================

  /**
   * Handler: diagnostics.getReport
   */
  async function _diagnosticsGetReport(params) {
    try {
      const format = params.format || 'json';

      if (!['json', 'string'].includes(format)) {
        return _createErrorResponse(ERROR_CODES.INVALID_PARAMS, 'format must be "json" or "string"');
      }

      const result = await _sendMessage('GENERATE_ERROR_REPORT', { format });

      return _createSuccessResponse({
        report: result.report,
        format: result.format
      });
    } catch (error) {
      console.error('[ABP] diagnostics.getReport error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: diagnostics.getErrors
   */
  async function _diagnosticsGetErrors(params) {
    try {
      const countOnly = params.countOnly || false;

      if (countOnly) {
        const result = await _sendMessage('GET_ERROR_COUNT', {});
        return _createSuccessResponse({ count: result.count });
      } else {
        const result = await _sendMessage('GET_ERROR_LOGS', {});
        return _createSuccessResponse({
          logs: result.logs || [],
          count: result.logs?.length || 0
        });
      }
    } catch (error) {
      console.error('[ABP] diagnostics.getErrors error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  /**
   * Handler: diagnostics.clearErrors
   */
  async function _diagnosticsClearErrors(params) {
    try {
      await _sendMessage('CLEAR_ERROR_LOGS', {});
      return _createSuccessResponse({ cleared: true });
    } catch (error) {
      console.error('[ABP] diagnostics.clearErrors error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY HANDLERS - Extension Info
  // =============================================================================

  /**
   * Handler: extension.getInfo
   */
  async function _extensionGetInfo(params) {
    try {
      const manifest = chrome.runtime.getManifest();
      const extensionId = chrome.runtime.id;

      const info = {
        name: manifest.name,
        version: manifest.version,
        manifestVersion: manifest.manifest_version,
        extensionId
      };

      // Try to get storage usage
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          info.storageUsage = {
            usage: estimate.usage,
            quota: estimate.quota,
            usagePercentage: estimate.quota > 0 ?
              Math.round((estimate.usage / estimate.quota) * 100) : 0
          };
        }
      } catch (error) {
        console.warn('[ABP] Failed to get storage estimate:', error);
      }

      return _createSuccessResponse(info);
    } catch (error) {
      console.error('[ABP] extension.getInfo error:', error);
      return _createErrorResponse(ERROR_CODES.OPERATION_FAILED, error.message, true);
    }
  }

  // =============================================================================
  // CAPABILITY DEFINITIONS
  // =============================================================================

  function _getCapabilityList() {
    return [
      {
        name: 'crawl.start',
        description: 'Start a new web crawl for one or more URLs',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            urls: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'URL or array of URLs to crawl'
            },
            options: {
              type: 'object',
              properties: {
                maxWorkers: { type: 'number', minimum: 1, maximum: 10, default: 5 },
                pageLimit: { type: 'number', minimum: 1 },
                strictPathMatching: { type: 'boolean', default: true },
                skipCache: { type: 'boolean', default: false },
                useIncognito: { type: 'boolean', default: false },
                followExternalLinks: { type: 'boolean', default: false },
                maxExternalHops: { type: 'number', minimum: 1, maximum: 5, default: 1 },
                waitForSelectors: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          required: ['urls']
        }
      },
      {
        name: 'crawl.status',
        description: 'Get current status and progress of a crawl job',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Crawl job ID' }
          },
          required: ['jobId']
        }
      },
      {
        name: 'crawl.cancel',
        description: 'Cancel the active crawl',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'crawl.resume',
        description: 'Resume an interrupted crawl job',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID to resume' },
            options: {
              type: 'object',
              properties: {
                maxWorkers: { type: 'number', minimum: 1, maximum: 10 },
                pageLimit: { type: 'number', minimum: 1 },
                strictPathMatching: { type: 'boolean' },
                skipCache: { type: 'boolean' },
                useIncognito: { type: 'boolean' },
                followExternalLinks: { type: 'boolean' },
                maxExternalHops: { type: 'number', minimum: 1, maximum: 5 }
              }
            }
          },
          required: ['jobId']
        }
      },
      {
        name: 'storage.jobs.list',
        description: 'List all crawl jobs sorted by creation date',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'storage.jobs.get',
        description: 'Get a specific crawl job by ID',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID' }
          },
          required: ['jobId']
        }
      },
      {
        name: 'storage.jobs.delete',
        description: 'Delete one or more jobs and their pages',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobIds: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Job ID or array of job IDs to delete'
            }
          },
          required: ['jobIds']
        }
      },
      {
        name: 'storage.jobs.update',
        description: 'Update metadata on a crawl job',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID' },
            updates: { type: 'object', description: 'Fields to update' }
          },
          required: ['jobId', 'updates']
        }
      },
      {
        name: 'storage.pages.list',
        description: 'Get all pages for a crawl job',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID' }
          },
          required: ['jobId']
        }
      },
      {
        name: 'storage.pages.search',
        description: 'Search pages by URL substring',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'URL search query' }
          },
          required: ['query']
        }
      },
      {
        name: 'convert.toFormat',
        description: 'Convert page content to text, markdown, or HTML with metadata',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string', description: 'Job ID' },
            pageId: { type: 'string', description: 'Optional page ID for single page conversion' },
            format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Output format' },
            confidenceThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
            includeMetadata: { type: 'boolean', default: true }
          },
          required: ['jobId', 'format']
        }
      },
      {
        name: 'export.asArchive',
        description: 'Package pages from jobs into a ZIP archive',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            jobIds: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ],
              description: 'Job ID or array of job IDs'
            },
            format: { type: 'string', enum: ['text', 'markdown'], description: 'Content format' },
            confidenceThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.5 }
          },
          required: ['jobIds', 'format']
        }
      },
      {
        name: 'scrape.pickContent',
        description: 'Extract content from a specific element on a URL',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to scrape' },
            selector: { type: 'string', default: 'body', description: 'CSS selector to extract' },
            useIncognito: { type: 'boolean', default: false }
          },
          required: ['url']
        }
      },
      {
        name: 'diagnostics.getReport',
        description: 'Generate a comprehensive diagnostic report',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'string'], default: 'json' }
          }
        }
      },
      {
        name: 'diagnostics.getErrors',
        description: 'Get error logs or error count',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {
            countOnly: { type: 'boolean', default: false }
          }
        }
      },
      {
        name: 'diagnostics.clearErrors',
        description: 'Clear all stored error logs',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'extension.getInfo',
        description: 'Get extension metadata, version, and storage usage',
        available: true,
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  // =============================================================================
  // PUBLIC ABP INTERFACE
  // =============================================================================

  window.abp = {
    protocolVersion: PROTOCOL_VERSION,
    app: {
      id: APP_ID,
      name: APP_NAME,
      version: null // Set during initialize
    },
    initialized: false,
    sessionId: null,

    /**
     * Initialize the ABP session
     */
    async initialize(params) {
      console.log('[ABP] Initializing session');

      // Get app version from manifest
      const manifest = chrome.runtime.getManifest();
      appVersion = manifest.version;
      this.app.version = appVersion;

      // Generate session ID
      sessionId = crypto.randomUUID();
      this.sessionId = sessionId;
      initialized = true;
      this.initialized = true;

      console.log('[ABP] Session initialized:', sessionId);

      return {
        sessionId,
        protocolVersion: PROTOCOL_VERSION,
        app: this.app,
        capabilities: _getCapabilityList().map(c => ({
          name: c.name,
          available: c.available
        })),
        features: {
          notifications: false,
          progress: false,
          elicitation: false,
          dynamicCapabilities: false
        }
      };
    },

    /**
     * Shutdown the ABP session
     */
    async shutdown() {
      console.log('[ABP] Shutting down session:', sessionId);
      initialized = false;
      this.initialized = false;
      sessionId = null;
      this.sessionId = null;
    },

    /**
     * Call a capability
     */
    async call(capability, params = {}) {
      if (!initialized) {
        return _createErrorResponse(
          ERROR_CODES.NOT_INITIALIZED,
          'ABP session not initialized. Call initialize() first.'
        );
      }

      console.log('[ABP] Calling capability:', capability, params);

      // Route to handlers
      switch (capability) {
        case 'crawl.start':
          return _crawlStart(params);
        case 'crawl.status':
          return _crawlStatus(params);
        case 'crawl.cancel':
          return _crawlCancel(params);
        case 'crawl.resume':
          return _crawlResume(params);
        case 'storage.jobs.list':
          return _storageJobsList(params);
        case 'storage.jobs.get':
          return _storageJobsGet(params);
        case 'storage.jobs.delete':
          return _storageJobsDelete(params);
        case 'storage.jobs.update':
          return _storageJobsUpdate(params);
        case 'storage.pages.list':
          return _storagePagesList(params);
        case 'storage.pages.search':
          return _storagePagesSearch(params);
        case 'convert.toFormat':
          return _convertToFormat(params);
        case 'export.asArchive':
          return _exportAsArchive(params);
        case 'scrape.pickContent':
          return _scrapePickContent(params);
        case 'diagnostics.getReport':
          return _diagnosticsGetReport(params);
        case 'diagnostics.getErrors':
          return _diagnosticsGetErrors(params);
        case 'diagnostics.clearErrors':
          return _diagnosticsClearErrors(params);
        case 'extension.getInfo':
          return _extensionGetInfo(params);
        default:
          return _createErrorResponse(
            ERROR_CODES.UNKNOWN_CAPABILITY,
            `Unknown capability: ${capability}`
          );
      }
    },

    /**
     * List all available capabilities
     */
    listCapabilities() {
      // Return plain array - NOT wrapped in { success, data }
      return _getCapabilityList();
    }
  };

  console.log('[ABP] Runtime loaded. Protocol version:', PROTOCOL_VERSION);
})();
