/**
 * HTML to Markdown extractor
 * Extracts main content and converts to clean Markdown
 */

/**
 * Extract main content from HTML and convert to Markdown
 */
export function extractContent(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find main content element
  const mainContent = findMainContent(doc);
  if (!mainContent) {
    console.warn('Could not find main content in page:', url);
    return '# Content Not Found\n\nCould not extract main content from this page.';
  }

  // Remove noise elements
  removeNoiseElements(mainContent);

  // Convert to Markdown
  const markdown = convertToMarkdown(mainContent, url);

  // Clean up the Markdown
  return cleanMarkdown(markdown);
}

/**
 * Find the main content element
 * Priority: <main>, <article>, elements with content-related classes/ids
 */
function findMainContent(doc) {
  // Priority 1: <main> tag
  let main = doc.querySelector('main');
  if (main) return main;

  // Priority 2: <article> tag
  let article = doc.querySelector('article');
  if (article) return article;

  // Priority 3: Common content classes/ids
  const contentSelectors = [
    '[role="main"]',
    '.main-content',
    '#main-content',
    '.content',
    '#content',
    '.documentation',
    '.docs',
    '.doc-content',
    '.markdown-body'
  ];

  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) return element;
  }

  // Priority 4: Body as fallback
  return doc.body;
}

/**
 * Remove noise elements from content
 */
function removeNoiseElements(element) {
  const noiseSelectors = [
    'nav', 'header', 'footer',
    '.navigation', '.nav', '.navbar', '.menu', '.sidebar',
    '.header', '.footer',
    '.cookie', '.cookie-banner', '.cookie-consent',
    '.modal', '.popup', '.overlay',
    '.advertisement', '.ad', '.ads',
    '.social-share', '.share-buttons',
    'script', 'style', 'noscript'
  ];

  noiseSelectors.forEach(selector => {
    element.querySelectorAll(selector).forEach(el => el.remove());
  });
}

/**
 * Convert HTML element to Markdown
 */
function convertToMarkdown(element, baseUrl) {
  let markdown = '';

  // Process child nodes
  for (const node of element.childNodes) {
    markdown += processNode(node, baseUrl, 0);
  }

  return markdown;
}

/**
 * Process a single DOM node
 */
function processNode(node, baseUrl, depth) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    return text ? text + ' ' : '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node;
  const tagName = element.tagName.toLowerCase();

  // Headers
  if (tagName.match(/^h[1-6]$/)) {
    const level = parseInt(tagName[1]);
    const text = getTextContent(element);
    return '\n\n' + '#'.repeat(level) + ' ' + text + '\n\n';
  }

  // Paragraphs
  if (tagName === 'p') {
    const text = processChildren(element, baseUrl, depth);
    return '\n\n' + text.trim() + '\n\n';
  }

  // Code blocks
  if (tagName === 'pre') {
    const codeElement = element.querySelector('code');
    if (codeElement) {
      const code = codeElement.textContent;
      const language = detectLanguage(codeElement);
      return '\n\n```' + language + '\n' + code + '\n```\n\n';
    }
    return '\n\n```\n' + element.textContent + '\n```\n\n';
  }

  // Inline code
  if (tagName === 'code') {
    return '`' + element.textContent + '`';
  }

  // Strong/Bold
  if (tagName === 'strong' || tagName === 'b') {
    return '**' + processChildren(element, baseUrl, depth) + '**';
  }

  // Emphasis/Italic
  if (tagName === 'em' || tagName === 'i') {
    return '*' + processChildren(element, baseUrl, depth) + '*';
  }

  // Links
  if (tagName === 'a') {
    const href = element.getAttribute('href');
    const text = getTextContent(element);
    if (href) {
      const absoluteUrl = new URL(href, baseUrl).toString();
      return '[' + text + '](' + absoluteUrl + ')';
    }
    return text;
  }

  // Images
  if (tagName === 'img') {
    const src = element.getAttribute('src');
    const alt = element.getAttribute('alt') || '';
    if (src) {
      const absoluteUrl = new URL(src, baseUrl).toString();
      return '![' + alt + '](' + absoluteUrl + ')';
    }
    return '';
  }

  // Unordered lists
  if (tagName === 'ul') {
    let list = '\n';
    element.querySelectorAll(':scope > li').forEach(li => {
      const text = processChildren(li, baseUrl, depth);
      list += '- ' + text.trim() + '\n';
    });
    return list + '\n';
  }

  // Ordered lists
  if (tagName === 'ol') {
    let list = '\n';
    const items = element.querySelectorAll(':scope > li');
    items.forEach((li, index) => {
      const text = processChildren(li, baseUrl, depth);
      list += `${index + 1}. ` + text.trim() + '\n';
    });
    return list + '\n';
  }

  // Blockquotes
  if (tagName === 'blockquote') {
    const text = processChildren(element, baseUrl, depth);
    const lines = text.trim().split('\n');
    return '\n\n' + lines.map(line => '> ' + line).join('\n') + '\n\n';
  }

  // Horizontal rule
  if (tagName === 'hr') {
    return '\n\n---\n\n';
  }

  // Line break
  if (tagName === 'br') {
    return '  \n';
  }

  // Tables
  if (tagName === 'table') {
    return processTable(element);
  }

  // Divs and other containers - process children
  if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
    return processChildren(element, baseUrl, depth);
  }

  // Default: process children
  return processChildren(element, baseUrl, depth);
}

/**
 * Process all children of an element
 */
function processChildren(element, baseUrl, depth) {
  let result = '';
  for (const child of element.childNodes) {
    result += processNode(child, baseUrl, depth + 1);
  }
  return result;
}

/**
 * Get text content without processing
 */
function getTextContent(element) {
  return element.textContent.trim().replace(/\s+/g, ' ');
}

/**
 * Detect programming language from code element classes
 */
function detectLanguage(codeElement) {
  const className = codeElement.className;
  const match = className.match(/(?:lang-|language-)(\w+)/);
  if (match) return match[1];

  // Common class names
  if (className.includes('javascript') || className.includes('js')) return 'javascript';
  if (className.includes('typescript') || className.includes('ts')) return 'typescript';
  if (className.includes('python') || className.includes('py')) return 'python';
  if (className.includes('bash') || className.includes('shell')) return 'bash';
  if (className.includes('json')) return 'json';
  if (className.includes('html')) return 'html';
  if (className.includes('css')) return 'css';

  return '';
}

/**
 * Process HTML table to Markdown
 */
function processTable(table) {
  let markdown = '\n\n';

  // Get headers
  const headers = [];
  const headerCells = table.querySelectorAll('thead th, thead td');
  if (headerCells.length === 0) {
    // Try first row of tbody
    const firstRow = table.querySelector('tbody tr');
    if (firstRow) {
      firstRow.querySelectorAll('th, td').forEach(cell => {
        headers.push(getTextContent(cell));
      });
    }
  } else {
    headerCells.forEach(cell => {
      headers.push(getTextContent(cell));
    });
  }

  if (headers.length > 0) {
    // Header row
    markdown += '| ' + headers.join(' | ') + ' |\n';
    // Separator row
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  }

  // Body rows
  const bodyRows = table.querySelectorAll('tbody tr');
  bodyRows.forEach(row => {
    const cells = [];
    row.querySelectorAll('td, th').forEach(cell => {
      cells.push(getTextContent(cell));
    });
    if (cells.length > 0) {
      markdown += '| ' + cells.join(' | ') + ' |\n';
    }
  });

  return markdown + '\n';
}

/**
 * Clean up Markdown output
 */
function cleanMarkdown(markdown) {
  // Remove excessive blank lines (max 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace from lines
  markdown = markdown.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // Trim start and end
  markdown = markdown.trim();

  return markdown;
}
