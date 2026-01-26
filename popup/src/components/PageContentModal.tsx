import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { ExternalLink, ArrowLeft, ChevronRight } from 'lucide-react';
import { PageContentViewer } from './PageContentViewer';

interface PageContentModalProps {
  page: any | null;
  open: boolean;
  onClose: () => void;
  job?: any | null;
  onNavigateToJob?: () => void;
}

export function PageContentModal({ page, open, onClose, job, onNavigateToJob }: PageContentModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="p-0 max-w-[420px] gap-0 flex flex-col" aria-describedby={undefined} showClose={false}>
        {/* Modal Header */}
        <div className="px-4 pt-3 pb-3 border-b flex items-center gap-2 shrink-0">
          {/* Back Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 p-0 shrink-0"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Breadcrumb with job (if provided) or just page title */}
          <div className="flex-1 min-w-0 flex items-center gap-1 text-sm">
            {job ? (
              <>
                {/* Job name - clickable */}
                <button
                  onClick={onNavigateToJob}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline truncate max-w-[120px]"
                  title={job.baseUrl}
                >
                  {job.baseUrl.split('/')[2] || 'Job'}
                </button>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                {/* Page title */}
                <DialogTitle className="truncate flex items-center gap-1">
                  <button
                    onClick={() => page?.url && window.open(page.url, '_blank')}
                    className="text-sm hover:underline text-primary flex items-center gap-1 font-medium"
                    title={page?.url}
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[180px]">
                      {page?.url.split('/').pop() || 'page'}
                    </span>
                  </button>
                </DialogTitle>
              </>
            ) : (
              /* No job context - just show page title */
              <DialogTitle className="truncate flex items-center gap-1">
                <button
                  onClick={() => page?.url && window.open(page.url, '_blank')}
                  className="text-sm hover:underline text-primary flex items-center gap-1 font-medium"
                  title={page?.url}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[300px]">
                    {page?.url.split('/').pop() || 'page'}
                  </span>
                </button>
              </DialogTitle>
            )}
          </div>
        </div>

        {/* Page Content Viewer */}
        {page && <PageContentViewer page={page} confidenceThreshold={0.5} defaultFormat="markdown" />}
      </DialogContent>
    </Dialog>
  );
}
