/**
 * Markdown Processor Module
 *
 * Converts HTML to clean markdown using Readability.js and Turndown
 * Assesses content quality and provides confidence scores
 *
 * VERSION: 1.0.0
 */

import Readability from './vendor/Readability.js';
import TurndownService from './vendor/turndown.js';

console.log('🚀 [MarkdownProcessor] Loading markdown-processor.js v1.0.0');

/**
 * Process HTML content to markdown with quality assessment
 *
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL for heuristic analysis
 * @param {string} text - Plain text from innerText (for comparison)
 * @returns {Object} Result object with markdown and metadata
 */
export async function processHtmlToMarkdown(html, url, text) {
  try {
    console.log(`[MarkdownProcessor] Processing ${url}`);

    // 1. Pre-assessment based on URL patterns (non-blocking)
    const urlHints = analyzeUrl(url);
    console.log(`[MarkdownProcessor] URL hints:`, urlHints);

    // 2. Parse HTML into DOM
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 3. Try Readability extraction
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      console.log(`[MarkdownProcessor] Readability failed to extract article from ${url}`);
      return {
        markdown: null,
        markdownMeta: {
          confidence: 0,
          isArticle: false,
          reason: 'readability-failed',
          urlHints
        }
      };
    }

    console.log(`[MarkdownProcessor] Readability extracted article: "${article.title}"`);
    console.log(`[MarkdownProcessor] Text length: ${article.textContent.length}, Excerpt: ${article.excerpt?.substring(0, 50)}...`);

    // 4. Convert to markdown using Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',  // Use # style headings
      codeBlockStyle: 'fenced',  // Use ``` style code blocks
      bulletListMarker: '-',  // Use - for lists
      emDelimiter: '_',  // Use _ for emphasis
      strongDelimiter: '**',  // Use ** for bold
      linkStyle: 'inlined'  // Use inline [text](url) style
    });

    const markdown = turndownService.turndown(article.content);
    console.log(`[MarkdownProcessor] Converted to markdown (${markdown.length} chars)`);

    // 5. Post-process markdown
    const cleaned = postProcessMarkdown(markdown);
    console.log(`[MarkdownProcessor] Cleaned markdown (${cleaned.length} chars)`);

    // 6. Assess quality and calculate confidence
    const quality = assessMarkdownQuality(article, text, cleaned, urlHints);
    console.log(`[MarkdownProcessor] Quality assessment: confidence=${quality.confidence.toFixed(2)}, isArticle=${quality.isArticle}`);

    // 7. Return result with all metadata
    return {
      markdown: cleaned,
      markdownMeta: {
        confidence: quality.confidence,
        isArticle: quality.isArticle,

        // Readability metadata
        title: article.title,
        byline: article.byline,
        excerpt: article.excerpt,
        siteName: article.siteName,

        // Quality metrics
        textLength: article.textContent.length,
        linkDensity: quality.linkDensity,
        extractionRatio: quality.extractionRatio,
        hasStructure: quality.hasStructure,

        // URL analysis
        urlHints,

        // Detailed checks (for debugging)
        qualityChecks: quality.checks
      }
    };

  } catch (error) {
    console.error(`[MarkdownProcessor] Error processing ${url}:`, error);
    return {
      markdown: null,
      markdownMeta: {
        confidence: 0,
        isArticle: false,
        reason: 'processing-error',
        error: error.message
      }
    };
  }
}

/**
 * Analyze URL for content type hints
 * @param {string} url - URL to analyze
 * @returns {Object} URL analysis result
 */
function analyzeUrl(url) {
  const urlLower = url.toLowerCase();

  // Patterns that suggest index/list pages
  const indexPatterns = [
    { pattern: /\/(blog|posts|articles|archive|category|tag|tags|search)\/?$/i, type: 'blog-index' },
    { pattern: /\/(index|sitemap|contents|toc)\.html?$/i, type: 'index-page' },
    { pattern: /\/\d{4}\/(0?[1-9]|1[0-2])\/?$/i, type: 'date-archive' },
    { pattern: /\/(tree|blob|src)\/[a-f0-9]{40}/i, type: 'git-repo' },
    { pattern: /\?q=|&q=|\?s=|&s=/i, type: 'search-results' }
  ];

  for (const { pattern, type } of indexPatterns) {
    if (pattern.test(url)) {
      return {
        likelyIndex: true,
        indexType: type,
        confidence: 0.7
      };
    }
  }

  // Patterns that suggest article pages
  const articlePatterns = [
    { pattern: /\/(\d{4}\/\d{2}\/\d{2}|blog|post|article)\/[^\/]+\/?$/i, type: 'blog-post' },
    { pattern: /\/(docs|documentation|guide|tutorial)\/[^\/]+/i, type: 'documentation' },
    { pattern: /\/[^\/]+-\d+\.html?$/i, type: 'article-with-id' }
  ];

  for (const { pattern, type } of articlePatterns) {
    if (pattern.test(url)) {
      return {
        likelyIndex: false,
        articleType: type,
        confidence: 0.7
      };
    }
  }

  return {
    likelyIndex: false,
    articleType: 'unknown',
    confidence: 0.5
  };
}

/**
 * Assess markdown quality and calculate confidence score
 *
 * @param {Object} article - Readability article result
 * @param {string} originalText - Original innerText for comparison
 * @param {string} markdown - Generated markdown
 * @param {Object} urlHints - URL analysis hints
 * @returns {Object} Quality assessment with confidence score
 */
function assessMarkdownQuality(article, originalText, markdown, urlHints) {
  const checks = {};

  // 1. Content length checks
  checks.textLength = article.textContent.length;
  checks.tooShort = article.textContent.length < 200;
  checks.reasonable = article.textContent.length >= 200 && article.textContent.length < 100000;

  // 2. Link density (high = likely index page with many links)
  const linkMatches = article.content.match(/<a\s+/gi) || [];
  checks.linkCount = linkMatches.length;
  checks.linkDensity = linkMatches.length / (article.textContent.length / 100); // Links per 100 words
  checks.tooManyLinks = checks.linkDensity > 2.5;

  // 3. Extraction ratio (how much of original text was kept)
  checks.extractionRatio = article.textContent.length / originalText.length;
  checks.tooLittle = checks.extractionRatio < 0.2; // Extracted <20% suggests index
  checks.mostContent = checks.extractionRatio > 0.5; // Extracted >50% is good

  // 4. Markdown structure analysis
  checks.hasHeaders = /^#{1,6}\s+.+$/m.test(markdown);
  checks.hasCodeBlocks = /```/.test(markdown);
  checks.hasLists = /^[-*+]\s+/m.test(markdown);
  checks.hasStructure = checks.hasHeaders || checks.hasCodeBlocks || checks.hasLists;

  // 5. Heading structure (many sibling headings = likely list)
  const h2Matches = markdown.match(/^##\s+/gm) || [];
  checks.h2Count = h2Matches.length;
  checks.tooManyH2s = h2Matches.length > 15;

  // 6. Semantic tag presence in original HTML
  checks.hasArticleTag = /<article\s/i.test(article.content);
  checks.hasMainTag = /<main\s/i.test(article.content);

  // 7. Excerpt quality (Readability provides this)
  checks.hasExcerpt = !!article.excerpt && article.excerpt.length > 20;

  // 8. Similarity check (markdown too similar to plain text = not helpful)
  const markdownText = markdown.trim();
  const originalTextTrim = originalText.trim();
  checks.similarityRatio = markdownText.length / originalTextTrim.length;
  checks.notHelpful = Math.abs(1 - checks.similarityRatio) < 0.1 && !checks.hasStructure;

  // Calculate confidence score (0-1)
  let confidence = 1.0;

  // Negative factors
  if (checks.tooShort) confidence -= 0.3;
  if (checks.tooManyLinks) confidence -= 0.25;
  if (checks.tooLittle) confidence -= 0.25;
  if (checks.tooManyH2s) confidence -= 0.15;
  if (checks.notHelpful) confidence -= 0.2;
  if (urlHints.likelyIndex) confidence -= 0.2;

  // Positive factors
  if (checks.hasStructure) confidence += 0.1;
  if (checks.hasArticleTag) confidence += 0.1;
  if (checks.hasExcerpt) confidence += 0.05;
  if (checks.mostContent) confidence += 0.1;
  if (checks.hasHeaders && checks.reasonable) confidence += 0.1;

  // Clamp to 0-1 range
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence,
    isArticle: confidence > 0.5,
    linkDensity: checks.linkDensity,
    extractionRatio: checks.extractionRatio,
    hasStructure: checks.hasStructure,
    checks
  };
}

/**
 * Post-process markdown to clean up formatting
 *
 * @param {string} markdown - Raw markdown from Turndown
 * @returns {string} Cleaned markdown
 */
function postProcessMarkdown(markdown) {
  let cleaned = markdown;

  // 1. Remove excessive blank lines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // 2. Clean up code blocks (ensure proper spacing)
  cleaned = cleaned.replace(/```(\w*)\n\n+/g, '```$1\n');
  cleaned = cleaned.replace(/\n\n+```/g, '\n```');

  // 3. Clean up list formatting (remove extra spaces)
  cleaned = cleaned.replace(/^([-*+])\s{2,}/gm, '$1 ');

  // 4. Fix heading spacing (ensure blank line before headings)
  cleaned = cleaned.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

  // 5. Remove trailing spaces from lines
  cleaned = cleaned.split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // 6. Trim start and end
  cleaned = cleaned.trim();

  // 7. Ensure document ends with single newline
  cleaned = cleaned + '\n';

  return cleaned;
}
