import { useState, useEffect, useCallback } from 'react';
import { crawlerAPI } from '@/lib/service-worker-client';

interface Job {
  id: string;
  baseUrl: string;
  baseUrls?: string[]; // Array of all base URLs (for multi-URL crawls)
  canonicalBaseUrl: string;
  createdAt: number;
  updatedAt: number;
  status: string;
  pagesFound: number;
  pagesProcessed: number;
  pagesFailed: number;
  errors: any[];
}

interface Page {
  id: string;
  url: string;
  canonicalUrl: string;
  jobId: string;
  content: string;
  format: string;
  extractedAt: number;
  contentLength: number;
  status: string;
  metadata?: any;
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const jobsList = await crawlerAPI.getJobs();
      setJobs(jobsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const deleteJob = async (jobId: string) => {
    try {
      await crawlerAPI.deleteJob(jobId);
      await loadJobs(); // Refresh list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const getJobPages = async (jobId: string): Promise<Page[]> => {
    try {
      return await crawlerAPI.getPages(jobId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to load pages');
    }
  };

  return {
    jobs,
    loading,
    error,
    refresh: loadJobs,
    deleteJob,
    getJobPages
  };
}
