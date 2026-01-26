/**
 * Preview window script for rendering page content
 * Loads content from chrome.storage and renders based on format (text or markdown)
 */

/**
 * Transforms YAML Front Matter into an HTML callout card for visual rendering only.
 * This does NOT affect the actual content saved/copied - only how it's displayed.
 */
function transformYAMLToCallout(markdown) {
  // Check if markdown starts with YAML Front Matter
  if (!markdown.startsWith('---\n')) {
    return markdown;
  }

  // Extract YAML Front Matter
  const yamlEndIndex = markdown.indexOf('\n---\n', 4);
  if (yamlEndIndex === -1) {
    return markdown; // Invalid YAML format, return as-is
  }

  const yamlContent = markdown.substring(4, yamlEndIndex);
  const markdownContent = markdown.substring(yamlEndIndex + 5);

  // Parse YAML into key-value pairs
  const lines = yamlContent.split('\n').filter(line => line.trim());
  const metadata = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip array items (they'll be handled by their parent field)
    if (line.trim().startsWith('- ')) continue;

    // Parse key: value
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    let label = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Check if this is an array field (value is empty and next line starts with '- ')
    if (!value && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
      // Collect all array items following this field
      const arrayItems = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('- ')) {
        arrayItems.push(lines[j].trim().substring(2));
        j++;
      }

      if (arrayItems.length > 0) {
        // Convert snake_case to Title Case for display
        const displayLabel = label.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        metadata.push({ label: displayLabel, value: arrayItems.join(', ') });
      }
      continue;
    }

    // Skip if value is empty (not an array field)
    if (!value) continue;

    // Remove quotes from value if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }

    // Convert snake_case to Title Case for display
    label = label.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    metadata.push({ label, value });
  }

  // Generate HTML callout
  const listItems = metadata.map(item =>
    `  <li><strong>${item.label}:</strong> ${item.value}</li>`
  ).join('\n');

  const calloutHtml = `<div class="metadata-callout">
  <div class="metadata-callout-header">📄 Page Metadata</div>
  <ul class="metadata-callout-list">
${listItems}
  </ul>
</div>

`;

  return calloutHtml + markdownContent;
}

// Global variables to store content and metadata
let currentContent = '';
let currentFormat = '';
let currentUrl = '';
let currentTitle = '';

// SVG icons for code copy button
const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * Wraps code blocks (<pre> elements) with a container that includes a copy button.
 */
function addCopyButtonsToCodeBlocks(html) {
  return html.replace(/<pre(\s[^>]*)?>([\s\S]*?)<\/pre>/gi, (_match, attrs, content) => {
    const attrStr = attrs || '';
    return `<div class="code-block-wrapper">
      <button class="code-copy-btn" title="Copy code">
        ${copyIconSvg}
      </button>
      <pre${attrStr}>${content}</pre>
    </div>`;
  });
}

/**
 * Handle code block copy button click
 */
function handleCodeCopyClick(button) {
  const wrapper = button.closest('.code-block-wrapper');
  const pre = wrapper?.querySelector('pre');
  if (!pre) return;

  const code = pre.textContent || '';

  navigator.clipboard.writeText(code)
    .then(() => {
      // Show check icon temporarily
      button.innerHTML = checkIconSvg;
      button.classList.add('copied');

      setTimeout(() => {
        button.innerHTML = copyIconSvg;
        button.classList.remove('copied');
      }, 2000);

      showToast('Code copied', 'Code block copied to clipboard', 'success');
    })
    .catch(err => {
      console.error('Failed to copy code:', err);
      showToast('Copy failed', 'Failed to copy code to clipboard');
    });
}

// Toast notification function
function showToast(title, description, variant = 'default') {
  const toast = document.createElement('div');
  toast.className = `toast${variant === 'success' ? ' success' : ''}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-description">${description}</div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Copy to clipboard function
function copyToClipboard() {
  navigator.clipboard.writeText(currentContent)
    .then(() => {
      showToast(
        'Copied to clipboard',
        `${currentFormat === 'markdown' ? 'Markdown' : 'Raw text'} content copied successfully`,
        'success'
      );
    })
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('Copy failed', 'Failed to copy content to clipboard');
    });
}

// Download file function
function downloadFile() {
  // Close dropdown menu
  const menu = document.getElementById('dropdown-menu');
  if (menu) {
    menu.classList.remove('show');
  }

  const extension = currentFormat === 'markdown' ? 'md' : 'txt';
  const blob = new Blob([currentContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentTitle || 'page'}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(
    'Downloaded',
    `Page downloaded as ${extension.toUpperCase()} file`,
    'success'
  );
}

// Toggle dropdown menu
function toggleDropdown(e) {
  e.preventDefault();
  e.stopPropagation(); // Prevent event from bubbling
  const menu = document.getElementById('dropdown-menu');
  menu.classList.toggle('show');
}

// Configure marked to open links in new tabs
const renderer = new marked.Renderer();
const originalLinkRenderer = renderer.link.bind(renderer);
renderer.link = function(href, title, text) {
  const html = originalLinkRenderer(href, title, text);
  // Add target="_blank" and rel="noopener noreferrer" to open links in new tabs
  return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};
marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

(async function() {
  const container = document.getElementById('content-container');
  const headerTitle = document.getElementById('header-title');
  const headerUrl = document.getElementById('header-url');
  const headerFormat = document.getElementById('header-format');

  try {
    // Get preview data from chrome.storage.local
    const result = await chrome.storage.local.get('previewData');

    if (!result.previewData) {
      throw new Error('No preview data found');
    }

    const { content, format, url, title } = result.previewData;

    // Store in global variables
    currentContent = content;
    currentFormat = format;
    currentUrl = url;
    currentTitle = title;

    // Update header
    headerTitle.textContent = title || 'Content Preview';
    headerUrl.textContent = url || '';
    headerFormat.textContent = format === 'markdown' ? 'Markdown' : 'Raw Text';

    // Update document title
    document.title = title ? `${title} - Preview` : 'Content Preview';

    // Update download button text
    const downloadText = document.getElementById('download-text');
    downloadText.textContent = `Download as .${format === 'markdown' ? 'md' : 'txt'}`;

    // Render content based on format
    if (format === 'markdown') {
      // Transform YAML Front Matter to callout, then render markdown
      const transformedContent = transformYAMLToCallout(content);
      let html = marked.parse(transformedContent);
      // Add copy buttons to code blocks
      html = addCopyButtonsToCodeBlocks(html);
      container.innerHTML = '';
      container.className = 'markdown-content';
      container.innerHTML = html;

      // Set up event delegation for code copy buttons
      container.addEventListener('click', (e) => {
        const button = e.target.closest('.code-copy-btn');
        if (button) {
          e.preventDefault();
          e.stopPropagation();
          handleCodeCopyClick(button);
        }
      });
    } else {
      // Render text
      container.innerHTML = '';
      container.className = 'text-content';
      container.textContent = content;
    }

    // Set up button event listeners
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const dropdownBtn = document.getElementById('dropdown-btn');

    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadFile);
    dropdownBtn.addEventListener('click', toggleDropdown);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('dropdown-menu');
      const dropdownBtn = document.getElementById('dropdown-btn');

      // Close if clicking outside both the button and menu
      if (menu && !dropdownBtn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
      }
    });

    // Clean up storage after loading (optional - keeps storage clean)
    await chrome.storage.local.remove('previewData');

  } catch (error) {
    console.error('Error loading preview:', error);
    container.innerHTML = `
      <div class="error">
        <div class="error-icon">⚠️</div>
        <div>Failed to load content</div>
        <div style="font-size: 12px; margin-top: 8px; color: #9ca3af;">${error.message}</div>
      </div>
    `;
    headerTitle.textContent = 'Error';
    headerFormat.textContent = 'Error';
  }
})();
