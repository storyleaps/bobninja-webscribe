import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Copy, Download, ChevronDown, ExternalLink, FileText, FileCode, Code } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  formatConcatenatedContent,
  getContentForFormat,
  isMarkdownAvailable,
  isHtmlAvailable,
  formatMarkdownWithMetadata,
  type ContentFormat,
  type Page
} from '@/lib/export-utils';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';

interface PageContentViewerProps {
  page: Page;
  confidenceThreshold?: number;
  defaultFormat?: ContentFormat;
}

// Configure marked for safe rendering with links opening in new tabs
const renderer = new marked.Renderer();
const originalLinkRenderer = renderer.link.bind(renderer);
renderer.link = function(href: string, title: string | null | undefined, text: string) {
  const html = originalLinkRenderer(href, title, text);
  // Add target="_blank" and rel="noopener noreferrer" to open links in new tabs
  return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

/**
 * Transforms YAML Front Matter into an HTML callout card for visual rendering only.
 * This does NOT affect the actual content saved/copied - only how it's displayed.
 */
function transformYAMLToCallout(markdown: string): string {
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
  const metadata: Array<{ label: string; value: string }> = [];

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
      const arrayItems: string[] = [];
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

${markdownContent}`;

  return calloutHtml;
}

/**
 * Wraps code blocks (<pre> elements) with a container that includes a copy button.
 * The copy button appears in the top-right corner on hover.
 */
function addCopyButtonsToCodeBlocks(html: string): string {
  // SVG icon for the copy button (matches lucide-react Copy icon)
  const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

  // SVG icon for the check mark (shown after successful copy)
  const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  // Wrap each <pre> element with a container that has a copy button
  return html.replace(/<pre(\s[^>]*)?>([\s\S]*?)<\/pre>/gi, (_match, attrs, content) => {
    const attrStr = attrs || '';
    return `<div class="code-block-wrapper">
      <button class="code-copy-btn" title="Copy code" data-copy-icon='${copyIconSvg}' data-check-icon='${checkIconSvg}'>
        ${copyIconSvg}
      </button>
      <pre${attrStr}>${content}</pre>
    </div>`;
  });
}

/**
 * Reusable component for viewing page content with format selection and actions.
 * Handles both text and markdown formats, with copy/download/open-in-window actions.
 */
export function PageContentViewer({
  page,
  confidenceThreshold = 0.5,
  defaultFormat = 'markdown'
}: PageContentViewerProps) {
  const { toast } = useToast();
  const markdownContainerRef = useRef<HTMLDivElement>(null);

  // Check if markdown is available for this page
  const markdownAvailable = useMemo(
    () => isMarkdownAvailable(page, confidenceThreshold),
    [page, confidenceThreshold]
  );

  // Check if HTML is available for this page
  const htmlAvailable = useMemo(
    () => isHtmlAvailable(page),
    [page]
  );

  // Format selection state - default to markdown if available, otherwise text
  const [selectedFormat, setSelectedFormat] = useState<ContentFormat>(
    markdownAvailable ? defaultFormat : 'text'
  );

  // Get content for selected format
  const contentResult = useMemo(
    () => getContentForFormat(page, selectedFormat, confidenceThreshold),
    [page, selectedFormat, confidenceThreshold]
  );

  // Format content with metadata
  const displayContent = useMemo(() => {
    if (contentResult.format === 'html') {
      return page.html || '';
    } else if (contentResult.format === 'text') {
      return formatConcatenatedContent([page]);
    } else {
      return formatMarkdownWithMetadata(page);
    }
  }, [page, contentResult.format]);

  // Render markdown to HTML for preview
  const renderedMarkdown = useMemo(() => {
    if (contentResult.format === 'markdown' && displayContent) {
      try {
        const transformedMarkdown = transformYAMLToCallout(displayContent);
        const html = marked.parse(transformedMarkdown) as string;
        // Add copy buttons to code blocks
        return addCopyButtonsToCodeBlocks(html);
      } catch (error) {
        console.error('Error rendering markdown:', error);
        return null;
      }
    }
    return null;
  }, [displayContent, contentResult.format]);

  // Handle code block copy button clicks
  const handleCodeCopy = useCallback(async (button: HTMLButtonElement) => {
    const wrapper = button.closest('.code-block-wrapper');
    const pre = wrapper?.querySelector('pre');
    if (!pre) return;

    // Get the text content of the code block
    const code = pre.textContent || '';

    try {
      await navigator.clipboard.writeText(code);

      // Show check icon temporarily
      const copyIcon = button.getAttribute('data-copy-icon') || '';
      const checkIcon = button.getAttribute('data-check-icon') || '';

      button.innerHTML = checkIcon;
      button.classList.add('copied');

      setTimeout(() => {
        button.innerHTML = copyIcon;
        button.classList.remove('copied');
      }, 2000);

      toast({
        title: 'Code copied',
        description: 'Code block copied to clipboard',
      });
    } catch (err) {
      console.error('Failed to copy code:', err);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Failed to copy code to clipboard',
      });
    }
  }, [toast]);

  // Set up click event delegation for code copy buttons
  useEffect(() => {
    const container = markdownContainerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.code-copy-btn') as HTMLButtonElement | null;
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        handleCodeCopy(button);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [renderedMarkdown, handleCodeCopy]);

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    const formatName = contentResult.format === 'markdown' ? 'Markdown' : contentResult.format === 'html' ? 'HTML' : 'Raw text';
    toast({
      title: 'Copied to clipboard',
      description: `${formatName} content copied successfully`,
    });
  };

  // Handle download
  const handleDownload = () => {
    const extension = contentResult.format === 'markdown' ? 'md' : contentResult.format === 'html' ? 'html' : 'txt';
    const mimeType = contentResult.format === 'html' ? 'text/html' : 'text/plain';
    const blob = new Blob([displayContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.url.split('/').pop() || 'page'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: `Page downloaded as ${extension.toUpperCase()} file`,
    });
  };

  // Handle open in window
  const handleOpenInWindow = async () => {
    // Store preview data in chrome.storage for the preview window
    // @ts-ignore - Chrome extension API
    await chrome.storage.local.set({
      previewData: {
        content: displayContent,
        format: selectedFormat,
        url: page.url,
        title: page.url.split('/').pop() || 'Content Preview'
      }
    });

    // Open preview window
    // @ts-ignore - Chrome extension API
    chrome.windows.create({
      // @ts-ignore - Chrome extension API
      url: chrome.runtime.getURL('preview.html'),
      type: 'popup',
      width: 1000,
      height: 800,
      focused: true
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Format Selector */}
      <div className="px-4 py-2 border-b flex items-center shrink-0 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Format:</span>
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            <Button
              size="sm"
              variant={selectedFormat === 'text' ? 'default' : 'ghost'}
              onClick={() => setSelectedFormat('text')}
              className="h-6 px-2 text-xs gap-1.5"
            >
              <FileText className="h-3 w-3" />
              Raw Text
            </Button>
            <Button
              size="sm"
              variant={selectedFormat === 'markdown' ? 'default' : 'ghost'}
              onClick={() => setSelectedFormat('markdown')}
              className="h-6 px-2 text-xs gap-1.5"
              disabled={!markdownAvailable}
              title={!markdownAvailable ? 'Markdown not available for this page' : undefined}
            >
              <FileCode className="h-3 w-3" />
              Markdown
            </Button>
            <Button
              size="sm"
              variant={selectedFormat === 'html' ? 'default' : 'ghost'}
              onClick={() => setSelectedFormat('html')}
              className="h-6 px-2 text-xs gap-1.5"
              disabled={!htmlAvailable}
              title={!htmlAvailable ? 'HTML not available for this page' : undefined}
            >
              <Code className="h-3 w-3" />
              HTML
            </Button>
          </div>
        </div>
      </div>

      {/* Fallback warning */}
      {contentResult.fallback && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-950/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            ⚠️ {selectedFormat === 'html' ? 'HTML' : 'Markdown'} unavailable ({contentResult.reason === 'low-confidence' ? 'low confidence' : 'not generated'}). Showing text format.
          </p>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 px-2 py-2 overflow-hidden">
        <ScrollArea className="h-full" horizontal>
          {renderedMarkdown ? (
            /* Rendered Markdown Preview */
            <div
              ref={markdownContainerRef}
              className="prose prose-sm dark:prose-invert max-w-full w-full p-3 break-words overflow-x-auto prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-sm prose-li:text-sm prose-code:text-xs prose-pre:text-xs prose-img:rounded-md [&_pre]:overflow-x-auto [&_.code-block-wrapper]:relative [&_.code-block-wrapper]:group [&_.code-copy-btn]:absolute [&_.code-copy-btn]:top-2 [&_.code-copy-btn]:right-2 [&_.code-copy-btn]:p-1.5 [&_.code-copy-btn]:rounded-md [&_.code-copy-btn]:bg-muted/80 [&_.code-copy-btn]:hover:bg-muted [&_.code-copy-btn]:border [&_.code-copy-btn]:border-border/50 [&_.code-copy-btn]:text-muted-foreground [&_.code-copy-btn]:hover:text-foreground [&_.code-copy-btn]:opacity-0 [&_.code-block-wrapper:hover_.code-copy-btn]:opacity-100 [&_.code-copy-btn]:transition-opacity [&_.code-copy-btn]:cursor-pointer [&_.code-copy-btn.copied]:text-green-500 [&_.code-copy-btn.copied]:opacity-100 [&_.code-copy-btn]:flex [&_.code-copy-btn]:items-center [&_.code-copy-btn]:justify-center"
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            />
          ) : (
            /* Raw Text Preview */
            <pre className="text-xs whitespace-pre-wrap font-mono p-2 overflow-x-auto break-words w-full">
              {displayContent}
            </pre>
          )}
        </ScrollArea>
      </div>

      {/* Footer with actions */}
      <div className="px-4 py-3 border-t flex justify-between items-center bg-muted/50 shrink-0">
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenInWindow}
            className="h-7 px-3 text-xs rounded-none hover:bg-accent gap-1.5"
            title="Open content in a larger window for comfortable reading"
          >
            <ExternalLink className="h-3 w-3" />
            Open in Window
          </Button>
        </div>
        <div className="flex items-center border rounded-md overflow-hidden">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 px-3 text-xs rounded-none border-r hover:bg-accent"
          >
            <Copy className="h-3 w-3 mr-1.5" />
            Copy Page
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 rounded-none hover:bg-accent"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-3 w-3 mr-2" />
                Download as {contentResult.format === 'markdown' ? '.md' : contentResult.format === 'html' ? '.html' : '.txt'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
