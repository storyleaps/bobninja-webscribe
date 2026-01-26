/**
 * Service Worker communication client
 * Handles message passing between popup and service worker
 */

type MessageType =
  | 'START_CRAWL'
  | 'CANCEL_CRAWL'
  | 'GET_JOBS'
  | 'GET_JOB'
  | 'DELETE_JOB'
  | 'UPDATE_JOB'
  | 'GET_PAGES'
  | 'SEARCH'
  | 'GET_CRAWL_STATUS'
  | 'GET_ERROR_LOGS'
  | 'GET_ERROR_COUNT'
  | 'CLEAR_ERROR_LOGS'
  | 'GENERATE_ERROR_REPORT'
  | 'START_CONTENT_PICKER'
  | 'SAVE_PICKED_CONTENT';

interface ServiceWorkerMessage {
  type: MessageType;
  data?: any;
}

interface ServiceWorkerResponse {
  type: 'RESPONSE' | 'CRAWL_PROGRESS';
  data: any;
}

/**
 * Send message to service worker and wait for response
 */
export async function sendMessage(type: MessageType, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('Service worker not available'));
      return;
    }

    // Create message channel for response
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event: MessageEvent<ServiceWorkerResponse>) => {
      if (event.data.type === 'RESPONSE') {
        if (event.data.data.error) {
          reject(new Error(event.data.data.error));
        } else {
          resolve(event.data.data);
        }
      }
    };

    // Send message to service worker
    navigator.serviceWorker.controller.postMessage(
      { type, data } as ServiceWorkerMessage,
      [messageChannel.port2]
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Service worker request timeout'));
    }, 30000);
  });
}

/**
 * Listen for progress updates from service worker
 */
export function onCrawlProgress(callback: (progress: any) => void): () => void {
  const handler = (event: MessageEvent<ServiceWorkerResponse>) => {
    if (event.data.type === 'CRAWL_PROGRESS') {
      callback(event.data.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

// API functions

export const crawlerAPI = {
  /**
   * Start a new crawl
   */
  async startCrawl(baseUrl: string | string[], options?: any) {
    return sendMessage('START_CRAWL', { baseUrl, options });
  },

  /**
   * Cancel active crawl
   */
  async cancelCrawl() {
    return sendMessage('CANCEL_CRAWL');
  },

  /**
   * Get all jobs
   */
  async getJobs() {
    const response = await sendMessage('GET_JOBS');
    return response.jobs || [];
  },

  /**
   * Get a specific job
   */
  async getJob(jobId: string) {
    const response = await sendMessage('GET_JOB', { jobId });
    return response.job;
  },

  /**
   * Delete a job
   */
  async deleteJob(jobId: string) {
    return sendMessage('DELETE_JOB', { jobId });
  },

  /**
   * Update a job
   */
  async updateJob(jobId: string, updates: Record<string, any>) {
    return sendMessage('UPDATE_JOB', { jobId, updates });
  },

  /**
   * Get pages for a job
   */
  async getPages(jobId: string) {
    const response = await sendMessage('GET_PAGES', { jobId });
    return response.pages || [];
  },

  /**
   * Search pages
   */
  async search(query: string) {
    const response = await sendMessage('SEARCH', { query });
    return response.results || [];
  },

  /**
   * Get current crawl status
   */
  async getCrawlStatus() {
    return sendMessage('GET_CRAWL_STATUS');
  },

  /**
   * Subscribe to crawl progress
   */
  onProgress(callback: (progress: any) => void) {
    return onCrawlProgress(callback);
  }
};

// Error Log API
export const errorLogAPI = {
  /**
   * Get all error logs
   */
  async getErrorLogs() {
    const response = await sendMessage('GET_ERROR_LOGS');
    return response.logs || [];
  },

  /**
   * Get error log count
   */
  async getErrorCount(): Promise<number> {
    const response = await sendMessage('GET_ERROR_COUNT');
    return response.count || 0;
  },

  /**
   * Clear all error logs
   */
  async clearErrorLogs() {
    return sendMessage('CLEAR_ERROR_LOGS');
  },

  /**
   * Generate diagnostic report as JSON
   */
  async generateReport(): Promise<any> {
    const response = await sendMessage('GENERATE_ERROR_REPORT', { format: 'json' });
    return response.report;
  },

  /**
   * Generate diagnostic report as formatted string
   */
  async generateReportString(): Promise<string> {
    const response = await sendMessage('GENERATE_ERROR_REPORT', { format: 'string' });
    return response.report;
  }
};

// Content Picker API
export interface PickedContent {
  url: string;
  title: string;
  html: string;
  markdown: string;
  text: string;
  copiedToClipboard?: boolean;
  timestamp?: number;
}

export const contentPickerAPI = {
  /**
   * Start content picker - injects picker into active tab
   */
  async startPicker(): Promise<{ status: string; tabId?: number; error?: string }> {
    return sendMessage('START_CONTENT_PICKER');
  },

  /**
   * Save picked content as a job with single page
   */
  async savePickedContent(content: PickedContent): Promise<{ status: string; jobId?: string; error?: string }> {
    return sendMessage('SAVE_PICKED_CONTENT', content);
  },

  /**
   * Get pending picked content from storage
   */
  async getPendingContent(): Promise<PickedContent | null> {
    return new Promise((resolve) => {
      // @ts-ignore - Chrome extension API
      chrome.storage.local.get(['pickedContent'], (result: Record<string, unknown>) => {
        resolve((result.pickedContent as PickedContent) || null);
      });
    });
  },

  /**
   * Clear pending picked content
   */
  async clearPendingContent(): Promise<void> {
    return new Promise((resolve) => {
      // @ts-ignore - Chrome extension API
      chrome.storage.local.remove(['pickedContent'], () => {
        resolve();
      });
    });
  }
};
