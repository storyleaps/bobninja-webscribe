/**
 * Content Picker - Interactive element selector for content extraction
 *
 * Injected into the current tab to allow users to select and extract
 * content from any element on the page.
 *
 * Features:
 * - Hover highlighting with visual feedback
 * - Click to select element
 * - Extract HTML, markdown, and plain text
 * - Auto-copy markdown to clipboard
 * - Escape key to cancel
 * - Prevents accidental navigation when clicking links
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__contentPickerActive) {
    console.log('[ContentPicker] Already active, skipping initialization');
    return;
  }
  window.__contentPickerActive = true;


  // ============================================
  // CONFIGURATION
  // ============================================

  const HIGHLIGHT_COLOR = 'rgba(59, 130, 246, 0.3)'; // Blue overlay
  const HIGHLIGHT_BORDER = '2px solid rgb(59, 130, 246)';
  const HIGHLIGHT_Z_INDEX = 2147483647; // Max z-index

  // ============================================
  // STATE
  // ============================================

  let highlightOverlay = null;
  let currentTarget = null;
  let isActive = true;

  // ============================================
  // HIGHLIGHT OVERLAY
  // ============================================

  function createHighlightOverlay() {
    const overlay = document.createElement('div');
    overlay.id = '__content-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      background: ${HIGHLIGHT_COLOR};
      border: ${HIGHLIGHT_BORDER};
      border-radius: 4px;
      z-index: ${HIGHLIGHT_Z_INDEX};
      transition: all 0.1s ease-out;
      display: none;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateHighlight(element) {
    if (!element || !highlightOverlay) return;

    const rect = element.getBoundingClientRect();
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';
  }

  function hideHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
  }

  // ============================================
  // CURSOR STYLING
  // ============================================

  function setCursorStyle(style) {
    document.body.style.cursor = style;
    // Apply to all elements to override their cursors
    const styleEl = document.createElement('style');
    styleEl.id = '__content-picker-cursor-style';
    styleEl.textContent = `* { cursor: ${style} !important; }`;
    document.head.appendChild(styleEl);
  }

  function resetCursorStyle() {
    document.body.style.cursor = '';
    const styleEl = document.getElementById('__content-picker-cursor-style');
    if (styleEl) styleEl.remove();
  }

  // ============================================
  // MARKDOWN CONVERSION (reuses tab-fetcher logic)
  // ============================================

  /**
   * Remove noise elements from a document/element clone.
   */
  function removeNoiseElements(root) {
    const noiseSelectors = [
      'script', 'style', 'noscript',
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
      '.header', '.footer', '.breadcrumb', '.breadcrumbs',
      '#side-bar', '#sidebar', '#sideBar', '#SideBar',
      '.toc', '#toc', '.table-of-contents',
      '[class*="Sidebar__"]', '[class*="sidebar__"]',
      '[class*="Navigation__"]', '[class*="navigation__"]',
      '.ad', '.ads', '.advertisement', '.social-share',
      '.cookie-banner', '.cookie-notice', '.gdpr',
      '.popup', '.modal', '.overlay',
      '.comments', '.comment-section', '#comments',
      '[hidden]', '[aria-hidden="true"]',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
    ];

    noiseSelectors.forEach(selector => {
      try {
        root.querySelectorAll(selector).forEach(el => el.remove());
      } catch (e) {
        // Ignore invalid selectors
      }
    });
  }

  /**
   * Create and configure the Turndown service.
   */
  function createTurndownService() {
    if (typeof TurndownService === 'undefined') {
      console.error('[ContentPicker] TurndownService not available');
      return null;
    }

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
    turndownService.addRule('codeWithLink', {
      filter: function(node) {
        if (node.nodeName !== 'CODE') return false;
        if (node.parentNode && node.parentNode.nodeName === 'PRE') return false;
        const children = Array.from(node.childNodes);
        const meaningfulChildren = children.filter(child => {
          if (child.nodeType === 3) return child.textContent.trim() !== '';
          return true;
        });
        return meaningfulChildren.length === 1 && meaningfulChildren[0].nodeName === 'A';
      },
      replacement: function(content, node) {
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
   * Post-process markdown to clean up formatting.
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
   * Normalize code blocks (handle syntax highlighters).
   */
  function normalizeCodeBlocks(root) {
    const preTags = root.querySelectorAll('pre');

    preTags.forEach(pre => {
      // Remove decorative elements
      const decorativeSelectors = [
        '.react-syntax-highlighter-line-number',
        '.line-number', '.line-numbers', '.linenumber',
        '.hljs-ln-numbers', '.hljs-ln-n', '[data-line-number]',
        '.copy-button', '.copy-code', 'button.copy'
      ];

      decorativeSelectors.forEach(selector => {
        try {
          pre.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {}
      });
    });
  }

  /**
   * Resolve relative URLs to absolute.
   */
  function resolveRelativeUrls(root, baseUrl) {
    root.querySelectorAll('a[href]').forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (/^(https?:\/\/|data:|javascript:|mailto:|tel:|#)/i.test(href)) return;
      try {
        anchor.setAttribute('href', new URL(href, baseUrl).href);
      } catch (e) {}
    });

    root.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (!src) return;
      if (/^(https?:\/\/|data:)/i.test(src)) return;
      try {
        img.setAttribute('src', new URL(src, baseUrl).href);
      } catch (e) {}
    });
  }

  /**
   * Flatten block elements inside anchors.
   */
  function flattenBlockElementsInAnchors(root) {
    root.querySelectorAll('a').forEach(anchor => {
      const blockElements = anchor.querySelectorAll('div, p, section, article, h1, h2, h3, h4, h5, h6');
      if (blockElements.length === 0) return;

      const textContent = anchor.textContent || '';
      const normalizedText = textContent.replace(/\s+/g, ' ').trim();
      const href = anchor.getAttribute('href');
      const title = anchor.getAttribute('title');

      anchor.textContent = normalizedText;
      if (href) anchor.setAttribute('href', href);
      if (title) anchor.setAttribute('title', title);
    });
  }

  /**
   * Extract content from an element.
   */
  function extractContent(element) {
    const url = window.location.href;
    const pageTitle = document.title;

    // Get raw HTML
    const html = element.outerHTML;

    // Get plain text (same as crawler: innerText)
    const text = element.innerText || '';

    // Process markdown
    let markdown = '';
    try {
      // Clone the element for processing
      const clone = element.cloneNode(true);

      // Apply all preprocessing
      normalizeCodeBlocks(clone);
      flattenBlockElementsInAnchors(clone);
      resolveRelativeUrls(clone, url);
      removeNoiseElements(clone);

      // Convert to markdown
      const turndownService = createTurndownService();
      if (turndownService) {
        markdown = turndownService.turndown(clone.innerHTML);
        markdown = postProcessMarkdown(markdown);
      } else {
        // Fallback to plain text if Turndown not available
        markdown = text;
      }
    } catch (error) {
      console.error('[ContentPicker] Markdown conversion failed:', error);
      markdown = text; // Fallback to plain text
    }

    return {
      url,
      title: pageTitle,
      html,
      markdown,
      text
    };
  }

  // ============================================
  // CLIPBOARD
  // ============================================

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('[ContentPicker] Clipboard copy failed:', error);
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (e) {
        console.error('[ContentPicker] Fallback copy also failed:', e);
        return false;
      }
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function handleMouseMove(event) {
    if (!isActive) return;

    // Find the best target element (skip very small or invisible elements)
    let target = event.target;

    // Skip the overlay itself
    if (target === highlightOverlay) return;

    // Skip body and html
    if (target === document.body || target === document.documentElement) return;

    currentTarget = target;
    updateHighlight(target);
  }

  function handleMouseOut(event) {
    if (!isActive) return;

    // Only hide if leaving the document
    if (!event.relatedTarget || event.relatedTarget === document.documentElement) {
      hideHighlight();
      currentTarget = null;
    }
  }

  async function handleClick(event) {
    if (!isActive) return;
    if (!currentTarget) return;

    // Prevent default behavior (links, buttons, etc.)
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Extract content
    const content = extractContent(currentTarget);

    // Copy markdown to clipboard
    const copied = await copyToClipboard(content.markdown);

    // Cleanup picker UI
    cleanup();

    // Store the picked content and notify service worker
    try {
      await chrome.storage.local.set({
        pickedContent: {
          ...content,
          copiedToClipboard: copied,
          timestamp: Date.now()
        }
      });

      // Send message to service worker to show notification
      chrome.runtime.sendMessage({
        type: 'CONTENT_PICKED',
        payload: {
          url: content.url,
          title: content.title,
          textLength: content.text.length,
          copied
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ContentPicker] Failed to send message:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.error('[ContentPicker] Failed to store content:', error);
    }
  }

  function handleKeyDown(event) {
    if (!isActive) return;

    // Escape key cancels picking
    if (event.key === 'Escape') {
      console.log('[ContentPicker] Cancelled by user (Escape)');
      cleanup();

      // Notify that picking was cancelled
      chrome.runtime.sendMessage({
        type: 'CONTENT_PICK_CANCELLED'
      });
    }
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  function cleanup() {
    isActive = false;
    window.__contentPickerActive = false;

    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    // Remove UI elements
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }

    resetCursorStyle();
  }

  function initialize() {
    // Create highlight overlay
    highlightOverlay = createHighlightOverlay();

    // Set crosshair cursor
    setCursorStyle('crosshair');

    // Add event listeners (capture phase to intercept before page handlers)
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }

  // Start the picker
  initialize();

})();
