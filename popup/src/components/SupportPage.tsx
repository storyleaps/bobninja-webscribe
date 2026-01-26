import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, Copy, Trash2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { errorLogAPI } from '@/lib/service-worker-client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ErrorLog {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

interface SupportPageProps {
  open: boolean;
  onBack: () => void;
}

// Source badge colors
const SOURCE_COLORS: Record<string, string> = {
  'capture': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'tab-fetcher': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  'popup': 'bg-green-500/10 text-green-500 border-green-500/20',
  'service-worker': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  'unknown': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

// Date filter options
const DATE_FILTERS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

export function SupportPage({ open, onBack }: SupportPageProps) {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const { toast } = useToast();

  // Fetch error logs on mount
  useEffect(() => {
    if (open) {
      fetchErrorLogs();
    }
  }, [open]);

  const fetchErrorLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await errorLogAPI.getErrorLogs();
      setErrorLogs(logs);
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
      toast({
        title: 'Failed to load errors',
        description: 'Could not fetch error logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique sources for filter dropdown
  const availableSources = useMemo(() => {
    const sources = new Set(errorLogs.map(log => log.source));
    return Array.from(sources).sort();
  }, [errorLogs]);

  // Filter errors based on selected filters
  const filteredLogs = useMemo(() => {
    let filtered = errorLogs;

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(log => log.source === sourceFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      let cutoff: number;

      switch (dateFilter) {
        case 'today':
          cutoff = now - day;
          break;
        case 'week':
          cutoff = now - (7 * day);
          break;
        case 'month':
          cutoff = now - (30 * day);
          break;
        default:
          cutoff = 0;
      }

      filtered = filtered.filter(log => log.timestamp > cutoff);
    }

    return filtered;
  }, [errorLogs, sourceFilter, dateFilter]);

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Format full timestamp
  const formatFullTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Generate report for filtered errors
  const generateFilteredReport = async (format: 'json' | 'string'): Promise<any> => {
    const report = {
      reportGenerated: new Date().toISOString(),
      reportVersion: '1.0',
      filters: {
        source: sourceFilter,
        date: dateFilter,
        totalErrors: errorLogs.length,
        filteredErrors: filteredLogs.length,
      },
      extension: {
        version: typeof chrome !== 'undefined' && chrome.runtime ? (chrome.runtime as any).getManifest?.()?.version || 'unknown' : 'unknown',
      },
      browser: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
      errorLogs: filteredLogs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp).toISOString(),
        source: log.source,
        message: log.message,
        stack: log.stack,
        context: log.context,
      })),
    };

    if (format === 'string') {
      let output = `# Webscribe Diagnostic Report\n`;
      output += `Generated: ${report.reportGenerated}\n`;
      output += `Showing: ${report.filters.filteredErrors} of ${report.filters.totalErrors} errors\n`;
      if (sourceFilter !== 'all') output += `Source filter: ${sourceFilter}\n`;
      if (dateFilter !== 'all') output += `Date filter: ${dateFilter}\n`;
      output += `\n## Browser Info\n`;
      output += `- User Agent: ${report.browser.userAgent}\n`;
      output += `- Platform: ${report.browser.platform}\n\n`;
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

    return report;
  };

  // Copy filtered errors to clipboard
  const handleCopyToClipboard = async () => {
    try {
      const report = await generateFilteredReport('string');
      await navigator.clipboard.writeText(report);
      toast({
        title: 'Copied to clipboard',
        description: `${filteredLogs.length} error(s) copied`,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Download filtered errors as JSON
  const handleDownload = async () => {
    try {
      const report = await generateFilteredReport('json');
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: 'Report downloaded',
        description: `${filteredLogs.length} error(s) exported`,
      });
    } catch (error) {
      console.error('Failed to download:', error);
      toast({
        title: 'Download failed',
        description: 'Could not generate report',
        variant: 'destructive',
      });
    }
  };

  // Clear all error logs
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all error logs? This cannot be undone.')) {
      return;
    }

    try {
      await errorLogAPI.clearErrorLogs();
      setErrorLogs([]);
      setExpandedRows(new Set());
      toast({
        title: 'Logs cleared',
        description: 'All error logs have been deleted',
      });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      toast({
        title: 'Clear failed',
        description: 'Could not clear error logs',
        variant: 'destructive',
      });
    }
  };

  // Copy single error to clipboard
  const handleCopySingleError = async (log: ErrorLog, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const errorText = [
        `Timestamp: ${formatFullTime(log.timestamp)}`,
        `Source: ${log.source}`,
        `Message: ${log.message}`,
        log.context ? `Context: ${JSON.stringify(log.context, null, 2)}` : null,
        log.stack ? `Stack Trace:\n${log.stack}` : null,
      ].filter(Boolean).join('\n\n');

      await navigator.clipboard.writeText(errorText);
      toast({
        title: 'Error copied',
        description: 'Error details copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div
      className={cn(
        "absolute inset-0 bg-background z-50 flex flex-col transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold flex-1">Error Logs</h2>
        <span className="text-sm text-muted-foreground">
          {filteredLogs.length === errorLogs.length
            ? `${errorLogs.length} error${errorLogs.length === 1 ? '' : 's'}`
            : `${filteredLogs.length} of ${errorLogs.length}`}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="text-sm bg-background border border-border rounded px-2 py-1"
        >
          <option value="all">All sources</option>
          {availableSources.map(source => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm bg-background border border-border rounded px-2 py-1"
        >
          {DATE_FILTERS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyToClipboard}
          disabled={filteredLogs.length === 0}
          className="h-7 w-7"
          title="Copy to clipboard"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={filteredLogs.length === 0}
          className="h-7 w-7"
          title="Download as JSON"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>

        {errorLogs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Error list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            <p className="text-sm">
              {errorLogs.length === 0
                ? 'No errors recorded in the last 30 days'
                : 'No errors match the current filters'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  index % 2 === 0 ? "bg-background" : "bg-muted/20"
                )}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-2 p-3"
                  onClick={() => toggleRow(log.id)}
                >
                  {expandedRows.has(log.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}

                  <span
                    className="text-xs text-muted-foreground w-16 flex-shrink-0"
                    title={formatFullTime(log.timestamp)}
                  >
                    {formatRelativeTime(log.timestamp)}
                  </span>

                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-1.5 py-0 flex-shrink-0",
                      SOURCE_COLORS[log.source] || SOURCE_COLORS['unknown']
                    )}
                  >
                    {log.source}
                  </Badge>

                  <span className="text-sm truncate flex-1">
                    {log.message}
                  </span>
                </div>

                {/* Expanded details */}
                {expandedRows.has(log.id) && (
                  <div className="px-3 pb-3 pl-9 space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Full Message
                      </div>
                      <div className="text-sm bg-muted/50 p-2 rounded break-all">
                        {log.message}
                      </div>
                    </div>

                    {log.context && Object.keys(log.context).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Context
                        </div>
                        <div className="text-xs bg-muted/50 p-2 rounded font-mono">
                          {Object.entries(log.context).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="break-all">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.stack && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Stack Trace
                        </div>
                        <div className="text-xs bg-muted/50 p-2 rounded font-mono overflow-x-auto max-h-32 overflow-y-auto whitespace-pre">
                          {log.stack}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={(e) => handleCopySingleError(log, e)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy this error
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
