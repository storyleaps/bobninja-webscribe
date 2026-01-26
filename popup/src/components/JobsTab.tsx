import { useState, useEffect, useMemo } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { useSearch } from '@/hooks/useSearch';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { CheckCircle2, AlertCircle, Loader2, Trash2, FileText, Copy, ExternalLink, ArrowLeft, Search, ChevronRight, ChevronLeft, FileArchive, MoreVertical, Play } from 'lucide-react';
import JSZip from 'jszip';
import { crawlerAPI } from '@/lib/service-worker-client';
import { PageContentViewer } from './PageContentViewer';
import {
  sanitizeFileName,
  formatConcatenatedContent,
  formatConcatenatedMarkdown,
  calculateContentSize,
  formatBytes,
  isClipboardSizeSafe,
  getDomainFileName,
  isMarkdownAvailable,
  getContentForFormat,
  formatMarkdownWithMetadata,
  type Page,
  type ContentFormat
} from '@/lib/export-utils';

type ModalView = 'closed' | 'job-details' | 'page-content' | 'delete-confirmation' | 'delete-single-job';

export function JobsTab() {
  const { jobs, loading, deleteJob, getJobPages, refresh: refreshJobs } = useJobs();
  const { results: searchResults, loading: searchLoading, search: performSearch, clear: clearSearch } = useSearch();
  const { toast } = useToast();

  // Modal state
  const [modalView, setModalView] = useState<ModalView>('closed');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [jobPages, setJobPages] = useState<any[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Search state (for filtering pages within a job)
  const [searchQuery, setSearchQuery] = useState('');

  // Global search state (for searching across all jobs)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Format selector state for page view
  const [pageViewFormat] = useState<ContentFormat>('markdown');
  const confidenceThreshold = 0.5;

  // Bulk selection state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [jobsToDelete, setJobsToDelete] = useState<any[]>([]);
  const [jobToDelete, setJobToDelete] = useState<any | null>(null);

  // Track navigation origin (to know where back button should go)
  const [cameFromSearch, setCameFromSearch] = useState(false);

  // Pagination state
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Listen for crawl completion to refresh job list
  useEffect(() => {
    const unsubscribe = crawlerAPI.onProgress((progressData) => {
      // Check if crawl completed (queue empty and no pages in progress)
      if (progressData.queueSize === 0 && (!progressData.inProgress || progressData.inProgress.length === 0)) {
        // Crawl completed (or cancelled), refresh job list to update status
        console.log('[JobsTab] Crawl completed, refreshing job list');
        refreshJobs();
      }
    });

    return unsubscribe;
  }, [refreshJobs]);

  // Debounced global search
  useEffect(() => {
    if (!globalSearchQuery.trim()) {
      clearSearch();
      return;
    }

    const timer = setTimeout(() => {
      performSearch(globalSearchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [globalSearchQuery, performSearch, clearSearch]);

  // Open a search result (page) in the modal
  const handleOpenSearchResult = async (page: any) => {
    setSelectedPage(page);
    setModalView('page-content');
    setCameFromSearch(true);

    // Fetch job info if jobId is available
    if (page.jobId) {
      try {
        const job = await crawlerAPI.getJob(page.jobId);
        setSelectedJob(job);
      } catch (error) {
        console.error('Failed to fetch job:', error);
        setSelectedJob(null);
      }
    }
  };

  // Get snippet from content with query highlighted
  const getSnippet = (content: string, query: string, maxLength = 150) => {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    const snippet = content.substring(start, end);

    return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
  };

  // Resume interrupted crawl
  const handleResumeCrawl = async (job: any) => {
    try {
      // Check if there's already an active crawl
      const status = await crawlerAPI.getCrawlStatus();
      if (status.active) {
        toast({
          variant: "destructive",
          title: "Cannot resume",
          description: "There is already a capture in progress. Please wait for it to complete or cancel it first."
        });
        return;
      }

      // Resume the existing job (continues from where it left off)
      await crawlerAPI.resumeCrawl(job.id);

      toast({
        variant: "success",
        title: "Capture resumed!",
        description: `Resuming capture for ${job.baseUrl}`
      });

      // Close the modal and switch to Crawl tab to see progress
      handleCloseModal();
      window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'crawl' }));
    } catch (err) {
      console.error('Failed to resume crawl:', err);
      toast({
        variant: "destructive",
        title: "Failed to resume",
        description: err instanceof Error ? err.message : "Failed to resume the capture"
      });
    }
  };

  // Mark job as completed
  const handleMarkAsCompleted = async (job: any) => {
    try {
      await crawlerAPI.updateJob(job.id, { status: 'completed' });

      // Update the selected job state
      setSelectedJob({ ...job, status: 'completed' });

      // Refresh jobs list
      refreshJobs();

      toast({
        variant: "success",
        title: "Job marked as completed",
        description: `${job.baseUrl} has been marked as completed.`
      });
    } catch (err) {
      console.error('Failed to mark job as completed:', err);
      toast({
        variant: "destructive",
        title: "Failed to update job",
        description: err instanceof Error ? err.message : "Failed to mark job as completed"
      });
    }
  };

  // Open job details modal
  const handleOpenJob = async (job: any) => {
    setSelectedJob(job);
    setModalView('job-details');
    setSearchQuery('');

    // Load pages for this job
    setLoadingPages(true);
    try {
      const pages = await getJobPages(job.id);
      setJobPages(pages);
    } catch (err) {
      console.error('Failed to load pages:', err);
      toast({
        variant: "destructive",
        title: "Failed to load pages",
        description: "Could not load the pages for this job"
      });
    } finally {
      setLoadingPages(false);
    }
  };

  // Open page content view
  const handleOpenPage = (page: any) => {
    setSelectedPage(page);
    setModalView('page-content');
  };

  // Handle back button
  const handleBack = () => {
    if (modalView === 'page-content') {
      if (cameFromSearch) {
        // Return to search results
        handleCloseModal();
      } else {
        // Return to job details
        setModalView('job-details');
        setSelectedPage(null);
      }
    } else if (modalView === 'job-details') {
      handleCloseModal();
    }
  };

  // Close modal completely
  const handleCloseModal = () => {
    setModalView('closed');
    setSelectedJob(null);
    setSelectedPage(null);
    setJobPages([]);
    setSearchQuery('');
    setCameFromSearch(false);
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, jobs.length);
  const paginatedJobs = useMemo(() => {
    return jobs.slice(startIndex, endIndex);
  }, [jobs, startIndex, endIndex]);

  // Reset to page 1 when jobs list changes significantly
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  // Checkbox state calculations - based on current page
  const allOnPageSelected = paginatedJobs.length > 0 && paginatedJobs.every(job => selectedJobIds.has(job.id));
  const someOnPageSelected = paginatedJobs.some(job => selectedJobIds.has(job.id)) && !allOnPageSelected;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Escape key - handle modals or clear selection
      if (e.key === 'Escape') {
        if (modalView !== 'closed') {
          e.preventDefault();
          handleBack();
        } else if (selectedJobIds.size > 0) {
          e.preventDefault();
          handleClearSelection();
        }
        return;
      }

      // Only handle other shortcuts when modal is closed
      if (modalView !== 'closed') return;

      // Ctrl/Cmd + A - Select all on current page
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && paginatedJobs.length > 0) {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Delete/Backspace - Delete selected jobs
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedJobIds.size > 0) {
        e.preventDefault();
        handleBulkDeleteClick();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [modalView, selectedJobIds, paginatedJobs]);

  // Listen for open-job events (from Search tab)
  useEffect(() => {
    const handleOpenJobEvent = (event: any) => {
      const jobId = event.detail;
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        handleOpenJob(job);
      }
    };

    window.addEventListener('open-job', handleOpenJobEvent);
    return () => window.removeEventListener('open-job', handleOpenJobEvent);
  }, [jobs]);

  // Filter pages based on search
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return jobPages;
    const query = searchQuery.toLowerCase();
    return jobPages.filter(page =>
      page.url.toLowerCase().includes(query)
    );
  }, [jobPages, searchQuery]);

  // Handle select all/none for current page
  const handleSelectAll = () => {
    const newSelected = new Set(selectedJobIds);
    if (allOnPageSelected) {
      // Deselect all on current page
      paginatedJobs.forEach(job => newSelected.delete(job.id));
    } else {
      // Select all on current page
      paginatedJobs.forEach(job => newSelected.add(job.id));
    }
    setSelectedJobIds(newSelected);
  };

  // Handle individual checkbox (index is relative to paginatedJobs)
  const handleSelectJob = (jobId: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const newSelected = new Set(selectedJobIds);

    // Shift+click for range selection (within current page)
    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);

      for (let i = start; i <= end; i++) {
        newSelected.add(paginatedJobs[i].id);
      }
    } else {
      // Regular click - toggle
      if (newSelected.has(jobId)) {
        newSelected.delete(jobId);
      } else {
        newSelected.add(jobId);
      }
    }

    setSelectedJobIds(newSelected);
    setLastClickedIndex(index);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedJobIds(new Set());
    setLastClickedIndex(null);
  };

  // Open bulk delete confirmation
  const handleBulkDeleteClick = () => {
    const jobsToRemove = jobs.filter(job => selectedJobIds.has(job.id));
    setJobsToDelete(jobsToRemove);
    setModalView('delete-confirmation');
  };

  // Confirm bulk delete
  const handleConfirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedJobIds);

    try {
      // Delete all selected jobs
      await Promise.all(idsToDelete.map(id => deleteJob(id)));

      toast({
        variant: "success",
        title: `${idsToDelete.length} job${idsToDelete.length > 1 ? 's' : ''} deleted!`,
        description: "The selected jobs have been removed"
      });

      // Clear selection and close modal
      handleClearSelection();
      setModalView('closed');
      setJobsToDelete([]);
    } catch (err) {
      console.error('Failed to delete jobs:', err);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete some jobs. Please try again."
      });
    }
  };

  // Calculate total pages for bulk delete confirmation
  const totalPagesToDelete = useMemo(() => {
    return jobsToDelete.reduce((sum, job) => sum + job.pagesProcessed, 0);
  }, [jobsToDelete]);

  // Calculate total content size
  const totalContentSize = useMemo(() => {
    if (jobPages.length === 0) return 0;
    return calculateContentSize(jobPages as Page[]);
  }, [jobPages]);

  // Export: Copy all to clipboard as markdown
  const handleCopyAllAsMarkdown = async () => {
    if (jobPages.length === 0) return;

    // Check if size is safe for clipboard
    if (!isClipboardSizeSafe(jobPages as Page[])) {
      const sizeInMB = (totalContentSize / (1024 * 1024)).toFixed(1);
      toast({
        variant: "destructive",
        title: "Content too large for clipboard",
        description: `Total size: ${sizeInMB}MB. Please use download instead (max 10MB for clipboard).`
      });
      return;
    }

    try {
      const concatenated = formatConcatenatedMarkdown(jobPages as Page[], confidenceThreshold);
      await navigator.clipboard.writeText(concatenated);

      toast({
        variant: "success",
        title: "Copied to clipboard!",
        description: `${jobPages.length} pages as markdown (${formatBytes(totalContentSize)})`
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Clipboard access denied or content too large"
      });
    }
  };

  // Export: Copy all to clipboard as raw text
  const handleCopyAllAsRawText = async () => {
    if (jobPages.length === 0) return;

    // Check if size is safe for clipboard
    if (!isClipboardSizeSafe(jobPages as Page[])) {
      const sizeInMB = (totalContentSize / (1024 * 1024)).toFixed(1);
      toast({
        variant: "destructive",
        title: "Content too large for clipboard",
        description: `Total size: ${sizeInMB}MB. Please use download instead (max 10MB for clipboard).`
      });
      return;
    }

    try {
      const concatenated = formatConcatenatedContent(jobPages as Page[]);
      await navigator.clipboard.writeText(concatenated);

      toast({
        variant: "success",
        title: "Copied to clipboard!",
        description: `${jobPages.length} pages as raw text (${formatBytes(totalContentSize)})`
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Clipboard access denied or content too large"
      });
    }
  };


  // Export: Single .txt file
  const handleExportSingleTxt = () => {
    if (jobPages.length === 0 || !selectedJob) return;

    const concatenated = formatConcatenatedContent(jobPages as Page[]);
    const blob = new Blob([concatenated], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getDomainFileName(selectedJob.baseUrl)}_all_pages.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      variant: "success",
      title: "Download started!",
      description: `Downloading ${jobPages.length} pages as single .txt file`
    });
  };

  // Export: ZIP all .txt files
  const handleExportZipTxt = async () => {
    if (jobPages.length === 0 || !selectedJob) return;

    toast({
      title: "Preparing export...",
      description: "Creating ZIP archive with .txt files"
    });

    try {
      const zip = new JSZip();

      // Add each page as a separate .txt file with metadata
      jobPages.forEach((page: any) => {
        const fileName = sanitizeFileName(page.url) + '.txt';
        const formattedContent = formatConcatenatedContent([page as Page]);
        zip.file(fileName, formattedContent);
      });

      // Generate ZIP file
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getDomainFileName(selectedJob.baseUrl)}_all_pages_txt.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Export complete!",
        description: `${jobPages.length} .txt files downloaded as ZIP`
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create ZIP archive. Please try again."
      });
    }
  };

  // Count markdown-available pages
  const markdownAvailableCount = useMemo(() => {
    const confidenceThreshold = 0.5;
    return jobPages.filter(page => isMarkdownAvailable(page as Page, confidenceThreshold)).length;
  }, [jobPages]);

  // Export: Single .md file
  const handleExportSingleMd = () => {
    if (jobPages.length === 0 || !selectedJob) return;

    const confidenceThreshold = 0.5;
    const markdownPages: string[] = [];

    jobPages.forEach((page: any) => {
      const result = getContentForFormat(page as Page, 'markdown', confidenceThreshold);

      // Use markdown with metadata if available, otherwise text with warning
      const content = result.fallback
        ? `${'='.repeat(80)}\nURL: ${page.url}\n[Markdown unavailable: ${result.reason}]\n${'='.repeat(80)}\n\n${result.content}\n\n`
        : formatMarkdownWithMetadata(page as Page) + '\n';

      markdownPages.push(content);
    });

    const concatenated = markdownPages.join('\n');
    const blob = new Blob([concatenated], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getDomainFileName(selectedJob.baseUrl)}_all_pages.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      variant: "success",
      title: "Download started!",
      description: `Downloading ${markdownAvailableCount}/${jobPages.length} pages as markdown`
    });
  };

  // Export: ZIP all .md files
  const handleExportZipMd = async () => {
    if (jobPages.length === 0 || !selectedJob) return;

    toast({
      title: "Preparing export...",
      description: "Creating ZIP archive with .md files"
    });

    try {
      const zip = new JSZip();
      const confidenceThreshold = 0.5;

      // Add each page as a separate .md file
      jobPages.forEach((page: any) => {
        const fileName = sanitizeFileName(page.url) + '.md';
        const result = getContentForFormat(page as Page, 'markdown', confidenceThreshold);

        // Use formatted markdown with metadata if available, otherwise text with warning
        const content = result.fallback
          ? `${'='.repeat(80)}\nURL: ${page.url}\n[Markdown unavailable: ${result.reason}]\n${'='.repeat(80)}\n\n${result.content}`
          : formatMarkdownWithMetadata(page as Page);

        zip.file(fileName, content);
      });

      // Generate ZIP file
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getDomainFileName(selectedJob.baseUrl)}_all_pages_md.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Export complete!",
        description: `${markdownAvailableCount}/${jobPages.length} pages as markdown in ZIP`
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create ZIP archive. Please try again."
      });
    }
  };

  // ===========================================
  // BULK OPERATIONS (for selected jobs in list)
  // ===========================================

  // Helper: Fetch all pages from selected jobs
  const fetchPagesFromSelectedJobs = async (): Promise<Page[]> => {
    const selectedJobsList = jobs.filter(job => selectedJobIds.has(job.id));
    const allPages: Page[] = [];

    for (const job of selectedJobsList) {
      try {
        const pages = await getJobPages(job.id);
        allPages.push(...(pages as Page[]));
      } catch (err) {
        console.error(`Failed to fetch pages for job ${job.id}:`, err);
      }
    }

    return allPages;
  };

  // Bulk: Copy all as raw text
  const handleBulkCopyAsRawText = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to copy"
        });
        return;
      }

      const totalSize = calculateContentSize(allPages);
      if (!isClipboardSizeSafe(allPages)) {
        const sizeInMB = (totalSize / (1024 * 1024)).toFixed(1);
        toast({
          variant: "destructive",
          title: "Content too large for clipboard",
          description: `Total size: ${sizeInMB}MB. Please use download instead (max 10MB for clipboard).`
        });
        return;
      }

      const concatenated = formatConcatenatedContent(allPages);
      await navigator.clipboard.writeText(concatenated);

      toast({
        variant: "success",
        title: "Copied to clipboard!",
        description: `${allPages.length} pages as raw text (${formatBytes(totalSize)})`
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Clipboard access denied or content too large"
      });
    }
  };

  // Bulk: Copy all as markdown
  const handleBulkCopyAsMarkdown = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to copy"
        });
        return;
      }

      const totalSize = calculateContentSize(allPages);
      if (!isClipboardSizeSafe(allPages)) {
        const sizeInMB = (totalSize / (1024 * 1024)).toFixed(1);
        toast({
          variant: "destructive",
          title: "Content too large for clipboard",
          description: `Total size: ${sizeInMB}MB. Please use download instead (max 10MB for clipboard).`
        });
        return;
      }

      const concatenated = formatConcatenatedMarkdown(allPages, confidenceThreshold);
      await navigator.clipboard.writeText(concatenated);

      toast({
        variant: "success",
        title: "Copied to clipboard!",
        description: `${allPages.length} pages as markdown (${formatBytes(totalSize)})`
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Clipboard access denied or content too large"
      });
    }
  };

  // Bulk: Export as ZIP with raw text files
  const handleBulkExportZipTxt = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing export...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to export"
        });
        return;
      }

      const zip = new JSZip();

      allPages.forEach((page) => {
        const fileName = sanitizeFileName(page.url) + '.txt';
        const formattedContent = formatConcatenatedContent([page]);
        zip.file(fileName, formattedContent);
      });

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_jobs_${selectedJobIds.size}_all_pages_txt.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Export complete!",
        description: `${allPages.length} .txt files from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''} downloaded as ZIP`
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create ZIP archive. Please try again."
      });
    }
  };

  // Bulk: Export as ZIP with markdown files
  const handleBulkExportZipMd = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing export...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to export"
        });
        return;
      }

      const zip = new JSZip();

      allPages.forEach((page) => {
        const fileName = sanitizeFileName(page.url) + '.md';
        const result = getContentForFormat(page, 'markdown', confidenceThreshold);
        const content = result.fallback
          ? `${'='.repeat(80)}\nURL: ${page.url}\n[Markdown unavailable: ${result.reason}]\n${'='.repeat(80)}\n\n${result.content}`
          : formatMarkdownWithMetadata(page);
        zip.file(fileName, content);
      });

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_jobs_${selectedJobIds.size}_all_pages_md.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Export complete!",
        description: `${allPages.length} .md files from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''} downloaded as ZIP`
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create ZIP archive. Please try again."
      });
    }
  };

  // Bulk: Export as single raw text file
  const handleBulkExportSingleTxt = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing export...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to export"
        });
        return;
      }

      const concatenated = formatConcatenatedContent(allPages);
      const blob = new Blob([concatenated], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_jobs_${selectedJobIds.size}_all_pages.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Download started!",
        description: `${allPages.length} pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''} as single .txt file`
      });
    } catch (err) {
      console.error('Failed to export:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create file. Please try again."
      });
    }
  };

  // Bulk: Export as single markdown file
  const handleBulkExportSingleMd = async () => {
    if (selectedJobIds.size === 0) return;

    toast({
      title: "Preparing export...",
      description: `Fetching pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''}`
    });

    try {
      const allPages = await fetchPagesFromSelectedJobs();

      if (allPages.length === 0) {
        toast({
          variant: "destructive",
          title: "No pages found",
          description: "Selected jobs have no pages to export"
        });
        return;
      }

      const markdownPages: string[] = [];

      allPages.forEach((page) => {
        const result = getContentForFormat(page, 'markdown', confidenceThreshold);
        const content = result.fallback
          ? `${'='.repeat(80)}\nURL: ${page.url}\n[Markdown unavailable: ${result.reason}]\n${'='.repeat(80)}\n\n${result.content}\n\n`
          : formatMarkdownWithMetadata(page) + '\n';
        markdownPages.push(content);
      });

      const concatenated = markdownPages.join('\n');
      const blob = new Blob([concatenated], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_jobs_${selectedJobIds.size}_all_pages.md`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        variant: "success",
        title: "Download started!",
        description: `${allPages.length} pages from ${selectedJobIds.size} job${selectedJobIds.size > 1 ? 's' : ''} as single .md file`
      });
    } catch (err) {
      console.error('Failed to export:', err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to create file. Please try again."
      });
    }
  };

  const handleDelete = (jobId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const job = jobs.find(j => j.id === jobId) || selectedJob;
    setJobToDelete(job);
    setModalView('delete-single-job');
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      await deleteJob(jobToDelete.id);
      toast({
        variant: "success",
        title: "Job deleted!",
        description: "The job has been removed"
      });

      // Close modals
      setModalView('closed');
      setJobToDelete(null);

      // Close job details modal if deleting current job
      if (selectedJob?.id === jobToDelete.id) {
        handleCloseModal();
      }
    } catch (err) {
      console.error('Failed to delete job:', err);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete the job. Please try again."
      });
    }
  };

  const getStatusIcon = (job: any) => {
    if (job.status === 'completed') {
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    }
    if (job.status === 'in_progress') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />;
    }
    if (job.status === 'completed_with_errors') {
      return <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
    }
    return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format page name for display
  // - Single base URL: show path relative to base (e.g., "about", "blog/post-1")
  // - Multiple base URLs: show full canonical URL without protocol (e.g., "example.com/about")
  const getPageDisplayName = (pageUrl: string, baseUrl: string, baseUrls?: string[]) => {
    const hasMultipleBaseUrls = baseUrls && baseUrls.length > 1;

    if (hasMultipleBaseUrls) {
      // Multiple base URLs: show canonical URL without protocol
      // pageUrl is already canonical (www. stripped, etc.)
      return pageUrl.replace(/^https?:\/\//, '');
    }

    // Single base URL: show path relative to base
    // Normalize both URLs by removing trailing slashes for comparison
    const normalizedPageUrl = pageUrl.replace(/\/$/, '');
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    // Remove base URL and leading slash
    const path = normalizedPageUrl.replace(normalizedBaseUrl, '').replace(/^\//, '');

    return path || 'index';
  };

  // Only show loading state when modal is closed to prevent unmounting the Dialog
  if (loading && modalView === 'closed') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading jobs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only show empty state when modal is closed to prevent unmounting the Dialog
  if (jobs.length === 0 && modalView === 'closed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Saved Sites</CardTitle>
          <CardDescription>
            Browse and manage your captured content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No saved content yet. Start capturing to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we're in global search mode
  const isGlobalSearchActive = globalSearchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Global Search Input - p-1 provides space for focus ring */}
      <div className="relative p-1 shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search all pages by URL..."
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Conditionally render: Search Results OR Job List */}
      {isGlobalSearchActive ? (
        // Global Search Results
        <div className="flex flex-col flex-1 overflow-hidden mt-4">
          {searchResults.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground shrink-0">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </div>
              <div className="flex-1 overflow-auto pr-1 mt-3">
                <div className="space-y-2 pb-2">
                  {searchResults.map((result) => (
                    <Card
                      key={result.id}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => handleOpenSearchResult(result)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-1.5">
                          <div className="text-sm font-medium truncate">
                            {result.url}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(result.contentLength / 1024).toFixed(1)} KB
                          </div>
                          <div className="text-xs text-muted-foreground bg-muted p-2 rounded break-words line-clamp-4">
                            {getSnippet(result.content, globalSearchQuery)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          ) : !searchLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Card className="w-full">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No pages found with "{globalSearchQuery}" in URL
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      ) : (
        // Job List View
        <div className="flex flex-col flex-1 overflow-hidden mt-4">
          {/* Gmail-style Action Bar - Always visible */}
          <div className="flex items-center gap-1 shrink-0 pb-2 border-b">
            {/* Left side: Checkbox, Delete (conditional), Three-dot menu */}
            <Checkbox
              checked={allOnPageSelected}
              ref={(el) => {
                // Set indeterminate state for partial selection
                if (el) {
                  const input = el.querySelector('input') || el;
                  if ('indeterminate' in input) {
                    (input as HTMLInputElement).indeterminate = someOnPageSelected;
                  }
                }
              }}
              onCheckedChange={handleSelectAll}
              aria-label="Select all jobs on this page"
              className="ml-4 mr-1"
            />

            {/* Delete button - only when items selected (red) */}
            {selectedJobIds.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleBulkDeleteClick}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete selected"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {/* Three-dot menu - only visible when items selected */}
            {selectedJobIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[220px]">
                  {/* Copy to Clipboard */}
                  <DropdownMenuLabel className="text-xs">
                    Copy to Clipboard
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={handleBulkCopyAsRawText}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy as raw text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkCopyAsMarkdown}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy as markdown
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Download as ZIP */}
                  <DropdownMenuLabel className="text-xs">
                    Download as ZIP
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={handleBulkExportZipTxt}>
                    <FileArchive className="h-4 w-4 mr-2" />
                    Zip using raw text files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkExportZipMd}>
                    <FileArchive className="h-4 w-4 mr-2" />
                    Zip using markdown files
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Download as Single File */}
                  <DropdownMenuLabel className="text-xs">
                    Download as Single File
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={handleBulkExportSingleTxt}>
                    <FileText className="h-4 w-4 mr-2" />
                    Single raw text file
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkExportSingleMd}>
                    <FileText className="h-4 w-4 mr-2" />
                    Single markdown file
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Delete */}
                  <DropdownMenuItem
                    onClick={handleBulkDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Selection count - when items selected */}
            {selectedJobIds.size > 0 && (
              <span className="text-sm text-muted-foreground ml-1">
                {selectedJobIds.size} selected
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side: Pagination */}
            <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
              <span className="mr-2">
                {jobs.length === 0 ? '0' : `${startIndex + 1}-${endIndex}`} of {jobs.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Job List - Cards with Checkboxes */}
          <div className="flex-1 overflow-auto pr-1 mt-3">
            <div className="space-y-2 pb-2">
              {paginatedJobs.map((job, index) => {
                const isSelected = selectedJobIds.has(job.id);
                return (
                  <Card
                    key={job.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleOpenJob(job)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleSelectJob(job.id, index, { shiftKey: false, stopPropagation: () => {} } as any)}
                          onClick={(e) => handleSelectJob(job.id, index, e as any)}
                          aria-label={`Select ${job.baseUrl}`}
                          className="mt-0.5"
                        />

                        {/* Status icon */}
                        <div className="pt-0.5">
                          {getStatusIcon(job)}
                        </div>

                        {/* Job info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-sm font-semibold truncate">
                            {job.baseUrl}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{job.pagesProcessed} pages</span>
                            <span>•</span>
                            <span>{formatDate(job.createdAt)}</span>
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Single Modal with Two Views */}
      <Dialog open={modalView !== 'closed'} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="p-0 max-w-[420px] gap-0 flex flex-col" aria-describedby={undefined}>
          {/* Modal Header with Back Button - pr-10 reserves space for dialog close button */}
          <div className="pl-4 pr-10 pt-3 pb-3 border-b flex items-center gap-2 shrink-0">
            {/* Back Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBack}
              className="h-7 w-7 p-0 shrink-0"
              title={modalView === 'page-content'
                ? (cameFromSearch ? 'Back to search results' : 'Back to job details')
                : 'Back to jobs'}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Breadcrumb with DialogTitle always present */}
            <div className="flex-1 min-w-0 flex items-center gap-1 text-sm">
              {modalView === 'job-details' ? (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <DialogTitle className="truncate font-semibold min-w-0 flex-1">
                    {selectedJob?.baseUrl || 'Job Details'}
                  </DialogTitle>
                  {selectedJob?.baseUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0"
                      title="Copy URL"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedJob.baseUrl);
                        toast({
                          variant: "success",
                          title: "URL copied!"
                        });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : modalView === 'page-content' ? (
                <>
                  <button
                    onClick={async () => {
                      setCameFromSearch(false);
                      setModalView('job-details');
                      setSelectedPage(null);
                      // Load pages if not already loaded
                      if (selectedJob && jobPages.length === 0) {
                        setLoadingPages(true);
                        try {
                          const pages = await getJobPages(selectedJob.id);
                          setJobPages(pages);
                        } catch (err) {
                          console.error('Failed to load pages:', err);
                          toast({
                            variant: "destructive",
                            title: "Failed to load pages",
                            description: "Could not load the pages for this job"
                          });
                        } finally {
                          setLoadingPages(false);
                        }
                      }
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline truncate max-w-[120px]"
                    title={selectedJob?.baseUrl}
                  >
                    {selectedJob?.baseUrl?.split('/')[2] || 'Job'}
                  </button>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <DialogTitle className="truncate flex items-center gap-1">
                    <button
                      onClick={() => selectedPage?.url && window.open(selectedPage.url, '_blank')}
                      className="text-sm hover:underline text-primary flex items-center gap-1 font-medium"
                      title={selectedPage?.url}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[180px]">
                        {selectedPage?.url.split('/').pop() || 'page'}
                      </span>
                    </button>
                  </DialogTitle>
                </>
              ) : (
                <DialogTitle className="truncate font-semibold">Loading...</DialogTitle>
              )}
            </div>
          </div>

          {/* Modal Content - Job Details View */}
          {modalView === 'job-details' && selectedJob && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Combined Search + Actions Row */}
              <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0">
                {/* Search - Flex grow */}
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>

                {/* Copy All Button (copies as markdown) */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAllAsMarkdown}
                  disabled={loadingPages || jobPages.length === 0}
                  className="h-9 w-9 p-0 shrink-0"
                  title="Copy all as markdown"
                  aria-label="Copy all as markdown"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                {/* More Actions Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 shrink-0"
                      title="More actions"
                      aria-label="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[240px]">
                    {/* Job Actions */}
                    {(selectedJob.status !== 'completed' || selectedJob.status === 'interrupted') && (
                      <>
                        <DropdownMenuLabel className="text-xs">
                          Job Actions
                        </DropdownMenuLabel>
                        {selectedJob.status !== 'completed' && (
                          <DropdownMenuItem onClick={() => handleMarkAsCompleted(selectedJob)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark as completed
                          </DropdownMenuItem>
                        )}
                        {selectedJob.status === 'interrupted' && (
                          <DropdownMenuItem onClick={() => handleResumeCrawl(selectedJob)}>
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Copy to Clipboard */}
                    <DropdownMenuLabel className="text-xs">
                      Copy to Clipboard
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleCopyAllAsRawText}
                      disabled={loadingPages || jobPages.length === 0}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy as raw text
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCopyAllAsMarkdown}
                      disabled={loadingPages || jobPages.length === 0}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy as markdown
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Download as ZIP */}
                    <DropdownMenuLabel className="text-xs">
                      Download as ZIP
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleExportZipTxt}
                      disabled={loadingPages || jobPages.length === 0}
                    >
                      <FileArchive className="h-4 w-4 mr-2" />
                      Zip using raw text files
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportZipMd}
                      disabled={loadingPages || jobPages.length === 0 || markdownAvailableCount === 0}
                    >
                      <FileArchive className="h-4 w-4 mr-2" />
                      Zip using markdown files
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Download as Single File */}
                    <DropdownMenuLabel className="text-xs">
                      Download as Single File
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={handleExportSingleTxt}
                      disabled={loadingPages || jobPages.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Single raw text file
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExportSingleMd}
                      disabled={loadingPages || jobPages.length === 0 || markdownAvailableCount === 0}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Single markdown file
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Danger Zone */}
                    <DropdownMenuItem
                      onClick={() => handleDelete(selectedJob.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status line - Compact with two rows */}
              <div className="px-4 pt-3 pb-2.5 bg-muted/30 border-b space-y-1 shrink-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getStatusIcon(selectedJob)}
                  <span className="font-medium text-foreground capitalize">
                    {selectedJob.status.replace('_', ' ')}
                  </span>
                  {selectedJob.status === 'interrupted' && (
                    <>
                      <span>-</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResumeCrawl(selectedJob);
                        }}
                        className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
                      >
                        Resume
                      </button>
                    </>
                  )}
                  <span>•</span>
                  <span>{selectedJob.pagesProcessed} pages</span>
                  <span>•</span>
                  <span>{formatBytes(totalContentSize)}</span>
                </div>
                <div className="text-xs text-muted-foreground pl-6">
                  {formatDate(selectedJob.createdAt)}
                </div>
              </div>

              {/* Pages list */}
              <div className="flex-1 overflow-hidden">
                {loadingPages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No pages match your search' : 'No pages found'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {filteredPages.map((page) => (
                        <button
                          key={page.id}
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-accent rounded-md transition-colors group"
                          onClick={() => handleOpenPage(page)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium group-hover:text-primary">
                                {getPageDisplayName(page.url, selectedJob.baseUrl, selectedJob.baseUrls)}
                              </div>
                              <div className="text-muted-foreground flex items-center gap-1.5">
                                <span>{(page.contentLength / 1024).toFixed(1)} KB</span>
                                {page.alternateUrls && page.alternateUrls.length > 1 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-blue-500" title={`Found under ${page.alternateUrls.length} URLs`}>
                                      {page.alternateUrls.length} URLs
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

            </div>
          )}

          {/* Modal Content - Page Content View */}
          {modalView === 'page-content' && selectedPage && (
            <PageContentViewer
              page={selectedPage as Page}
              confidenceThreshold={confidenceThreshold}
              defaultFormat={pageViewFormat}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Single Job Delete Confirmation Dialog - Centered */}
      <Dialog open={modalView === 'delete-single-job'} onOpenChange={(open) => !open && setModalView('closed')}>
        <DialogContent centered className="max-w-[340px] sm:max-w-[380px]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete job?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              {jobToDelete && (
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-sm font-medium truncate">{jobToDelete.baseUrl}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {jobToDelete.pagesProcessed} pages
                  </div>
                </div>
              )}
              <p className="text-sm text-destructive">
                This action cannot be undone.
              </p>
            </div>
          </DialogDescription>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalView('closed');
                setJobToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete Job
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog - Centered */}
      <Dialog open={modalView === 'delete-confirmation'} onOpenChange={(open) => !open && setModalView('closed')}>
        <DialogContent centered className="max-w-[340px] sm:max-w-[380px]">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {jobsToDelete.length} job{jobsToDelete.length > 1 ? 's' : ''}?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                This will delete <strong>{totalPagesToDelete} pages</strong> total.
              </p>
              <p className="text-sm text-destructive">
                This action cannot be undone.
              </p>
            </div>
          </DialogDescription>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setModalView('closed')}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBulkDelete}
            >
              Delete Jobs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
