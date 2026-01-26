import { useState, useEffect } from 'react';
import { crawlerAPI } from '@/lib/service-worker-client';

interface CrawlProgress {
  pagesFound: number;
  pagesProcessed: number;
  pagesFailed: number;
  queueSize: number;
  inProgress: string[];
}

export function useCrawl() {
  const [isActive, setIsActive] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CrawlProgress>({
    pagesFound: 0,
    pagesProcessed: 0,
    pagesFailed: 0,
    queueSize: 0,
    inProgress: []
  });
  const [error, setError] = useState<string | null>(null);

  // Check for active crawl on mount
  useEffect(() => {
    crawlerAPI.getCrawlStatus().then(status => {
      if (status.active) {
        setIsActive(true);
        setJobId(status.jobId);
        setProgress({
          pagesFound: status.pagesFound || 0,
          pagesProcessed: status.pagesProcessed || 0,
          pagesFailed: 0,
          queueSize: status.queueSize || 0,
          inProgress: status.inProgress || []
        });
      }
    }).catch(console.error);
  }, []);

  // Listen for progress updates
  useEffect(() => {
    const unsubscribe = crawlerAPI.onProgress((progressData) => {
      setProgress({
        pagesFound: progressData.pagesFound || 0,
        pagesProcessed: progressData.pagesProcessed || 0,
        pagesFailed: progressData.pagesFailed || 0,
        queueSize: progressData.queueSize || 0,
        inProgress: progressData.inProgress || []
      });

      // Check if crawl completed (queue empty and no pages in progress)
      if (progressData.queueSize === 0 && (!progressData.inProgress || progressData.inProgress.length === 0)) {
        setIsActive(false);
        setJobId(null);
      }
    });

    return unsubscribe;
  }, []);

  const startCrawl = async (baseUrl: string | string[], options?: any) => {
    try {
      setError(null);
      const response = await crawlerAPI.startCrawl(baseUrl, options);
      setIsActive(true);
      setJobId(response.jobId);
      setProgress({
        pagesFound: 0,
        pagesProcessed: 0,
        pagesFailed: 0,
        queueSize: 0,
        inProgress: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start crawl');
      throw err;
    }
  };

  const cancelCrawl = async () => {
    try {
      await crawlerAPI.cancelCrawl();
      setIsActive(false);
      setJobId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel crawl');
      throw err;
    }
  };

  return {
    isActive,
    jobId,
    progress,
    error,
    startCrawl,
    cancelCrawl
  };
}
