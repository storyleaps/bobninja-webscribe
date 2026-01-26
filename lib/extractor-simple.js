/**
 * Simple text content cleanup
 * Processes plain text from document.body.innerText
 */

/**
 * Clean text content extracted from innerText
 * @param {string} text - Raw text from document.body.innerText
 * @param {string} url - Source URL (for reference)
 * @returns {string} Cleaned text content
 */
export function extractContent(text, url) {
  try {
    // innerText already does most of the work:
    // - Removes scripts, styles, hidden elements
    // - Decodes HTML entities
    // - Normalizes whitespace

    // Just do basic cleanup
    let cleaned = text;

    // Remove excessive blank lines (more than 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace from each line
    cleaned = cleaned.split('\n')
      .map(line => line.trimEnd())
      .join('\n');

    // Trim start and end
    cleaned = cleaned.trim();

    return cleaned || 'No content extracted from this page.';
  } catch (error) {
    console.error('Error cleaning text content:', error);
    return 'Error: Could not process content from this page.';
  }
}

