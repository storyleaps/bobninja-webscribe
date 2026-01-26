/**
 * Centralized Error Logger for diagnostic reporting
 * Captures errors from all extension contexts and stores them for user reporting
 * VERSION: 1.0.0
 */

import { saveErrorLog, getAllErrorLogs, getErrorLogCount, clearErrorLogs, cleanupOldErrorLogs } from '../storage/db.js';

const ERROR_LOGGER_VERSION = '1.0.0';

// Extension version (will be set from manifest or passed in)
let extensionVersion = null;

/**
 * Initialize the error logger with extension version
 * @param {string} version - Extension version from manifest
 */
export function initErrorLogger(version) {
  extensionVersion = version;
  console.log(`[ErrorLogger] Initialized v${ERROR_LOGGER_VERSION} for extension v${version}`);

  // Clean up old logs on init
  cleanupOldErrorLogs().catch(err => {
    console.warn('[ErrorLogger] Failed to cleanup old logs:', err);
  });
}

/**
 * Log an error to the persistent store
 * @param {string} source - Source of the error (e.g., 'service-worker', 'crawler', 'tab-fetcher', 'popup')
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Additional context (URL, jobId, action, etc.)
 */
export async function logError(source, error, context = {}) {
  try {
    const errorEntry = {
      source,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      context: {
        ...context,
        timestamp: new Date().toISOString()
      },
      extensionVersion: extensionVersion,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    };

    await saveErrorLog(errorEntry);
    console.log(`[ErrorLogger] Logged error from ${source}:`, errorEntry.message);
  } catch (logError) {
    // Don't throw if logging fails - just console.error
    console.error('[ErrorLogger] Failed to log error:', logError);
    console.error('[ErrorLogger] Original error:', error);
  }
}

/**
 * Get all error logs
 * @returns {Promise<Array>} Array of error log entries
 */
export async function getErrorLogs() {
  return getAllErrorLogs();
}

/**
 * Get error log count
 * @returns {Promise<number>} Number of error logs
 */
export async function getErrorCount() {
  return getErrorLogCount();
}

/**
 * Clear all error logs
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllErrorLogs() {
  return clearErrorLogs();
}

/**
 * Generate a comprehensive diagnostic report
 * Includes error logs, extension info, and browser info
 * @returns {Promise<Object>} Diagnostic report object
 */
export async function generateDiagnosticReport() {
  const errorLogs = await getAllErrorLogs();

  // Get browser/platform info
  const browserInfo = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    language: typeof navigator !== 'undefined' ? navigator.language : 'unknown'
  };

  // Get Chrome extension specific info if available
  let chromeInfo = {};
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const manifest = chrome.runtime.getManifest();
      chromeInfo = {
        extensionId: chrome.runtime.id,
        manifestVersion: manifest.manifest_version,
        extensionName: manifest.name,
        extensionVersion: manifest.version
      };
    } catch (e) {
      chromeInfo = { error: 'Could not read manifest' };
    }
  }

  const report = {
    reportGenerated: new Date().toISOString(),
    reportVersion: '1.0',
    extension: {
      version: extensionVersion || chromeInfo.extensionVersion || 'unknown',
      errorLoggerVersion: ERROR_LOGGER_VERSION,
      ...chromeInfo
    },
    browser: browserInfo,
    errorSummary: {
      totalErrors: errorLogs.length,
      errorsBySource: groupErrorsBySource(errorLogs),
      oldestError: errorLogs.length > 0 ? new Date(errorLogs[errorLogs.length - 1].timestamp).toISOString() : null,
      newestError: errorLogs.length > 0 ? new Date(errorLogs[0].timestamp).toISOString() : null
    },
    errorLogs: errorLogs.map(log => ({
      id: log.id,
      timestamp: new Date(log.timestamp).toISOString(),
      source: log.source,
      message: log.message,
      stack: log.stack,
      context: log.context
    }))
  };

  return report;
}

/**
 * Generate a diagnostic report as formatted string (for clipboard)
 * @returns {Promise<string>} Formatted report string
 */
export async function generateDiagnosticReportString() {
  const report = await generateDiagnosticReport();

  let output = `# Content Crawler Diagnostic Report\n`;
  output += `Generated: ${report.reportGenerated}\n\n`;

  output += `## Extension Info\n`;
  output += `- Version: ${report.extension.version}\n`;
  output += `- Extension ID: ${report.extension.extensionId || 'N/A'}\n\n`;

  output += `## Browser Info\n`;
  output += `- User Agent: ${report.browser.userAgent}\n`;
  output += `- Platform: ${report.browser.platform}\n`;
  output += `- Language: ${report.browser.language}\n\n`;

  output += `## Error Summary\n`;
  output += `- Total Errors: ${report.errorSummary.totalErrors}\n`;
  if (report.errorSummary.oldestError) {
    output += `- Date Range: ${report.errorSummary.oldestError} to ${report.errorSummary.newestError}\n`;
  }
  output += `- Errors by Source:\n`;
  for (const [source, count] of Object.entries(report.errorSummary.errorsBySource)) {
    output += `  - ${source}: ${count}\n`;
  }
  output += `\n`;

  output += `## Error Logs\n\n`;
  for (const log of report.errorLogs) {
    output += `### ${log.timestamp} [${log.source}]\n`;
    output += `**Message:** ${log.message}\n`;
    if (log.context && Object.keys(log.context).length > 0) {
      output += `**Context:** ${JSON.stringify(log.context, null, 2)}\n`;
    }
    if (log.stack) {
      output += `**Stack Trace:**\n\`\`\`\n${log.stack}\n\`\`\`\n`;
    }
    output += `\n---\n\n`;
  }

  return output;
}

/**
 * Helper function to group errors by source
 * @param {Array} errorLogs - Array of error log entries
 * @returns {Object} Object with source as key and count as value
 */
function groupErrorsBySource(errorLogs) {
  const grouped = {};
  for (const log of errorLogs) {
    const source = log.source || 'unknown';
    grouped[source] = (grouped[source] || 0) + 1;
  }
  return grouped;
}
