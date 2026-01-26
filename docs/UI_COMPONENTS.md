# UI Components Documentation

## Table of Contents

- [UI Components Documentation](#ui-components-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [React Architecture](#react-architecture)
    - [Tech Stack](#tech-stack)
    - [Build System](#build-system)
    - [Project Structure](#project-structure)
  - [Component Tree](#component-tree)
    - [App Component](#app-component)
    - [Component Hierarchy](#component-hierarchy)
    - [Tab Navigation](#tab-navigation)
  - [App Component](#app-component-1)
    - [Implementation](#implementation)
    - [State Management](#state-management)
    - [Tab Switching](#tab-switching)
    - [Custom Events](#custom-events)
  - [CaptureTab Component](#capturetab-component)
    - [Component Overview](#component-overview)
    - [Capture Modes (v2.24+)](#capture-modes-v224)
    - [State and Hooks](#state-and-hooks)
    - [UI States](#ui-states)
    - [Progress Display](#progress-display)
  - [JobsTab Component](#jobstab-component)
    - [Component Overview](#component-overview-1)
    - [State and Hooks](#state-and-hooks-1)
    - [Job List Display](#job-list-display)
    - [Gmail-Style Action Bar](#gmail-style-action-bar)
    - [Bulk Selection](#bulk-selection)
    - [Bulk Export Operations](#bulk-export-operations)
    - [Modal Views](#modal-views)
    - [Bulk Delete Confirmation](#bulk-delete-confirmation)
  - [SearchTab Component](#searchtab-component)
    - [Component Overview](#component-overview-2)
    - [State and Hooks](#state-and-hooks-2)
    - [Search Interface](#search-interface)
    - [Results Display](#results-display)
  - [PageContentViewer Component](#pagecontentviewer-component)
    - [Overview](#overview-2)
    - [Props](#props)
    - [Format Selection](#format-selection)
    - [Content Display](#content-display)
    - [Actions](#actions)
  - [PageContentModal Component](#pagecontentmodal-component)
    - [Overview](#overview-3)
    - [Props](#props-1)
    - [Modal Header](#modal-header)
  - [AboutDialog Component](#aboutdialog-component)
    - [Overview](#overview-4)
    - [Props](#props-2)
    - [Menu Items](#menu-items)
    - [Version Display](#version-display)
  - [SupportPage Component](#supportpage-component)
    - [Overview](#overview-5)
    - [Props](#props-3)
    - [Error Table](#error-table)
    - [Filtering](#filtering)
    - [Export Actions](#export-actions)
  - [ErrorBoundary Component](#errorboundary-component)
    - [Overview](#overview-6)
    - [Error Catching](#error-catching)
    - [Error Display](#error-display)
  - [Custom Hooks](#custom-hooks)
    - [useCrawl Hook](#usecrawl-hook)
    - [useJobs Hook](#usejobs-hook)
    - [useSearch Hook](#usesearch-hook)
  - [Service Worker Client](#service-worker-client)
    - [Communication Protocol](#communication-protocol)
    - [sendMessage Function](#sendmessage-function)
    - [Progress Listener](#progress-listener)
    - [API Functions](#api-functions)
  - [Export Utilities](#export-utilities)
    - [Overview](#overview-1)
    - [Core Functions](#core-functions)
    - [Integration with JobsTab](#integration-with-jobstab)
  - [shadcn/ui Components](#shadcnui-components)
    - [Component Library](#component-library)
    - [Tabs Components](#tabs-components)
    - [Card Components](#card-components)
    - [Form Components](#form-components)
  - [Dialog Modal](#dialog-modal)
    - [Content Viewer](#content-viewer)
    - [Dialog Structure](#dialog-structure)
    - [Actions Toolbar](#actions-toolbar)
  - [Toast Notifications](#toast-notifications)
    - [useToast Hook](#usetoast-hook)
    - [Toast Display](#toast-display)
    - [Toast Usage](#toast-usage)
  - [State Management](#state-management-1)
    - [Local State](#local-state)
    - [Hook-Based State](#hook-based-state)
    - [Service Worker Sync](#service-worker-sync)
  - [Real-Time Updates](#real-time-updates)
    - [Progress Updates](#progress-updates)
    - [Update Flow](#update-flow)
    - [State Reconciliation](#state-reconciliation)
  - [Error Handling](#error-handling)
    - [Try-Catch Patterns](#try-catch-patterns)
    - [User Feedback](#user-feedback)
    - [Error Recovery](#error-recovery)
  - [Loading States](#loading-states)
    - [Loading Indicators](#loading-indicators)
    - [Skeleton States](#skeleton-states)
    - [Empty States](#empty-states)
  - [User Interactions](#user-interactions)
    - [Start Crawl Flow](#start-crawl-flow)
    - [View Job Flow](#view-job-flow)
    - [Bulk Selection Flow](#bulk-selection-flow)
    - [Search Flow](#search-flow)
    - [Copy/Download Flow](#copydownload-flow)
  - [Styling and Theming](#styling-and-theming)
    - [Tailwind CSS](#tailwind-css)
    - [CSS Variables](#css-variables)
    - [Responsive Design](#responsive-design)
  - [Accessibility](#accessibility)
    - [Semantic HTML](#semantic-html)
    - [ARIA Labels](#aria-labels)
    - [Keyboard Navigation](#keyboard-navigation)
  - [Performance Optimizations](#performance-optimizations)
    - [React Optimizations](#react-optimizations)
    - [Lazy Loading](#lazy-loading)
    - [Virtualization](#virtualization)

---

## Overview

The UI layer is built with React and TypeScript, providing a modern, responsive interface for the Documentation Crawler extension. It uses shadcn/ui components for consistent design and Tailwind CSS for styling.

**Location**: `popup/src/`

**Key Features**:
- Three-tab interface (Crawl, Jobs, Search)
- Real-time progress updates
- Custom hooks for service worker communication
- shadcn/ui component library
- Toast notifications
- Dialog modals for content viewing
- About dialog with version information
- Three-dot menu for app settings
- Responsive 400px × 600px layout

---

## React Architecture

### Tech Stack

**Core**:
- React 18
- TypeScript
- Vite (build tool)

**UI Library**:
- shadcn/ui (component library)
- Radix UI (primitives)
- Tailwind CSS (styling)

**Icons**:
- lucide-react

### Build System

**Vite configuration** for Chrome extension:
- Builds to `popup/dist/`
- Entry point: `popup.html`
- HMR for development
- Optimized production builds

### Project Structure

```
popup/src/
├── App.tsx                    # Root component
├── main.tsx                   # React entry point
├── version.ts                 # Auto-generated version info
├── components/
│   ├── CrawlTab.tsx          # Crawl interface
│   ├── JobsTab.tsx           # Jobs list
│   ├── SearchTab.tsx         # Search interface
│   ├── PageContentViewer.tsx # Reusable page viewer component (v2.8+)
│   ├── PageContentModal.tsx  # Page viewer modal wrapper
│   ├── AboutDialog.tsx       # About/version dialog
│   └── ui/                   # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── tabs.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── toast.tsx
│       └── ...
├── hooks/
│   ├── useCrawl.ts           # Crawl state hook
│   ├── useJobs.ts            # Jobs state hook
│   ├── useSearch.ts          # Search state hook
│   └── use-toast.ts          # Toast notifications
└── lib/
    ├── service-worker-client.ts  # SW communication
    ├── export-utils.ts       # Export utilities
    └── utils.ts              # Utility functions
```

---

## Component Tree

### App Component

Root component with tab navigation and about dialog:

```tsx
<App>
  <div className="flex items-center justify-between mb-4">
    <h1>Documentation Crawler</h1>
    <Button onClick={() => setAboutOpen(true)}>
      <MoreVertical />
    </Button>
  </div>

  <Tabs>
    <TabsList>
      <TabsTrigger value="crawl">Crawl</TabsTrigger>
      <TabsTrigger value="jobs">Jobs</TabsTrigger>
      <TabsTrigger value="search">Search</TabsTrigger>
    </TabsList>
    <TabsContent value="crawl">
      <CrawlTab />
    </TabsContent>
    <TabsContent value="jobs">
      <JobsTab />
    </TabsContent>
    <TabsContent value="search">
      <SearchTab />
    </TabsContent>
  </Tabs>
  <Toaster />
  <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
</App>
```

### Component Hierarchy

```
App
├── Header
│   ├── h1 (title)
│   └── Button (three-dot menu → opens AboutDialog)
├── Tabs (shadcn/ui)
│   ├── TabsList
│   │   └── TabsTrigger × 3
│   └── TabsContent × 3
│       ├── CrawlTab
│       │   ├── Card
│       │   │   ├── Input
│       │   │   ├── Button
│       │   │   ├── Progress
│       │   │   └── Alert
│       │   └── ...
│       ├── JobsTab
│       │   ├── Accordion
│       │   │   └── AccordionItem × N
│       │   │       ├── Card
│       │   │       └── ScrollArea
│       │   └── Dialog
│       │       ├── ScrollArea
│       │       └── PageContentViewer (v2.8+)
│       └── SearchTab
│           ├── Card
│           │   ├── Input
│           │   └── Button
│           └── ScrollArea
│               └── Card × N
├── Toaster
├── AboutDialog
│   ├── AboutMenuItem × N (cards with icons)
│   └── Version text (discrete at bottom)
└── PageContentModal (used by Search tab)
    └── PageContentViewer (v2.8+)
```

### Tab Navigation

**Controlled tabs**:
```tsx
const [activeTab, setActiveTab] = useState("crawl");

<Tabs value={activeTab} onValueChange={setActiveTab}>
```

**Benefits**:
- Programmatic tab switching
- External tab control
- State preservation

---

## App Component

### Implementation

```tsx
function App() {
  const [activeTab, setActiveTab] = useState("crawl");
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    const handleTabSwitch = (event: any) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('switch-tab', handleTabSwitch);
    return () => window.removeEventListener('switch-tab', handleTabSwitch);
  }, []);

  return (
    <div className="w-[400px] h-[600px] bg-background text-foreground">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Documentation Crawler</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAboutOpen(true)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab components */}
        </Tabs>
      </div>
      <Toaster />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}
```

### State Management

**Active tab state**:
- Stored in `activeTab` state
- Controlled by `Tabs` component
- Persists during popup session

**About dialog state**:
- Stored in `aboutOpen` state
- Controlled by `AboutDialog` component
- Opened via three-dot menu button

**No persistence**:
- Tab resets to "crawl" on popup reopen
- AboutDialog closes on popup reopen
- Intentional: Start fresh each time

### Tab Switching

**Programmatic switching**:
```tsx
window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'jobs' }));
```

**Use cases**:
- "View in Jobs Tab" button after crawl completes
- Cross-tab navigation

### Custom Events

**Event pattern**:
```tsx
// Dispatch
window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'jobs' }));

// Listen
window.addEventListener('switch-tab', handleTabSwitch);
```

**Benefits**:
- Decoupled components
- Simple pub-sub pattern
- No prop drilling

---

## CrawlTab Component

### Component Overview

Main interface for starting crawls, monitoring progress, and picking content:

**Features**:
- **Two modes**: Crawl URL and Pick Content (radio button toggle)
- URL input with validation (Crawl URL mode)
- Content picker for interactive element selection (Pick Content mode)
- Start crawl button
- Real-time progress display
- Active crawl monitoring
- Cancel crawl button (red/destructive styling)
- Completion notification (success toast)
- Cancellation notification (warning toast with orange color)

### Crawl Modes (v2.24+)

**Crawl URL Mode**:
- Default mode for multi-page crawling
- URL input field(s) with validation
- Advanced options (workers, limits, incognito)
- Start Crawl floating button

**Pick Content Mode**:
- Interactive element selection from current page
- Injects content picker script into active tab
- Visual highlighting on hover
- Click to extract content (HTML, Markdown, plain text)
- Markdown auto-copied to clipboard
- Chrome notification on successful pick
- Two floating buttons when content exists:
  - "Reselect" (outline) - pick different content
  - "Save Selection" (primary) - save as job

### State and Hooks

```tsx
const [url, setUrl] = useState('');
const { isActive, progress, error, startCrawl, cancelCrawl } = useCrawl();
```

**Local state**: `url` (input value)

**Hook state**: `isActive`, `progress`, `error`

**Actions**: `startCrawl()`, `cancelCrawl()`

### UI States

**Three states**:

1. **Idle** (not active, no completion):
   - URL input
   - Start button
   - Example placeholder

2. **Active** (crawl in progress):
   - Progress bar
   - Metrics display (found, processed, queue)
   - Currently processing URLs
   - Cancel button
   - Background info alert

3. **Complete** (not active, has progress):
   - Completion checkmark
   - Success message
   - "View in Jobs Tab" button

### Progress Display

**Progress bar**:
```tsx
const progressPercentage = progress.pagesFound > 0
  ? (progress.pagesProcessed / progress.pagesFound) * 100
  : 0;

<Progress value={progressPercentage} className="h-2" />
```

**Metrics grid**:
```tsx
<div className="grid grid-cols-3 gap-4">
  <div>
    <div className="text-2xl font-bold text-primary">
      {progress.pagesFound}
    </div>
    <div className="text-xs text-muted-foreground">Found</div>
  </div>
  {/* Processed, Queue */}
</div>
```

**Currently processing**:
```tsx
{progress.inProgress && progress.inProgress.length > 0 && (
  <div>
    {progress.inProgress.slice(0, 3).map((pageUrl) => (
      <div className="text-xs truncate">{pageUrl}</div>
    ))}
  </div>
)}
```

---

## JobsTab Component

### Component Overview

Displays all crawl jobs with modal-based details and bulk selection:

**Features**:
- **Gmail-style action bar** - Always visible with checkbox, delete, menu, and pagination
- **Pagination** - 50 jobs per page with navigation arrows
- Clean card-based job list with status icons
- Always-visible checkboxes for bulk selection
- **Bulk export operations** - Copy/download across all selected jobs
- Modal-based job details view with compact status display
- **Resume button for interrupted jobs** - Restart cancelled crawls with validation
- Combined search and actions row for space efficiency
- Flexible export options (copy all, ZIP archives, single files)
- Modal-based page content viewer with YAML Front Matter callout styling
- Markdown format defaults when available
- Centered confirmation modal for single job deletion
- Smart bulk delete confirmation with sticky footer
- Keyboard shortcuts (Ctrl+A, Shift+click, Delete)
- Range selection support
- Copy/download actions for individual pages
- Cross-tab navigation support (from Search tab)
- Auto-refresh job list on crawl completion/cancellation

### State and Hooks

```tsx
const { jobs, loading, deleteJob, getJobPages } = useJobs();
const { toast } = useToast();

// Modal state
const [modalView, setModalView] = useState<ModalView>('closed');
const [selectedJob, setSelectedJob] = useState<any | null>(null);
const [selectedPage, setSelectedPage] = useState<any | null>(null);
const [jobPages, setJobPages] = useState<any[]>([]);
const [loadingPages, setLoadingPages] = useState(false);

// Search state
const [searchQuery, setSearchQuery] = useState('');

// Pagination state
const PAGE_SIZE = 50;
const [currentPage, setCurrentPage] = useState(1);

// Bulk selection state
const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
const [jobsToDelete, setJobsToDelete] = useState<any[]>([]);
```

**Hook state**: `jobs`, `loading`

**Modal state**: `modalView`, `selectedJob`, `selectedPage`, `jobPages`, `loadingPages`

**Pagination state**: `currentPage` (PAGE_SIZE = 50)

**Selection state**: `selectedJobIds`, `lastClickedIndex`, `jobsToDelete`

**Actions**: `deleteJob()`, `getJobPages()`

**Modal views**: `'closed'`, `'job-details'`, `'page-content'`, `'delete-confirmation'`

### Job List Display

**Paginated card-based list with checkboxes**:
```tsx
// Pagination calculations
const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
const startIndex = (currentPage - 1) * PAGE_SIZE;
const endIndex = Math.min(startIndex + PAGE_SIZE, jobs.length);
const paginatedJobs = jobs.slice(startIndex, endIndex);

{paginatedJobs.map((job, index) => {
  const isSelected = selectedJobIds.has(job.id);
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'hover:bg-accent/50'
      }`}
      onClick={() => handleOpenJob(job)}
    >
      <CardContent>
        <Checkbox checked={isSelected} onClick={handleSelectJob} />
        {/* Status icon */}
        {/* Job info */}
        <ChevronRight />
      </CardContent>
    </Card>
  );
})}
```

**Job card contents**:
- Checkbox (always visible, left side)
- Status icon (CheckCircle, Loader, AlertCircle)
- Base URL (truncated)
- Metadata (pages, date, failures)
- ChevronRight arrow indicator

**Visual selection feedback**:
- Selected cards have blue border (`border-primary`)
- Light blue background (`bg-primary/5`)
- Ring effect (`ring-1 ring-primary/20`)
- Smooth transitions

### Gmail-Style Action Bar

**Always-visible action bar** (replaces the old dynamic header):

```tsx
<div className="flex items-center gap-1 shrink-0 pb-2 border-b">
  {/* Checkbox - aligned with job cards */}
  <Checkbox
    checked={allOnPageSelected}
    onCheckedChange={handleSelectAll}
    className="ml-4 mr-1"
  />

  {/* Delete button - only when items selected (red) */}
  {selectedJobIds.size > 0 && (
    <Button variant="ghost" className="text-destructive">
      <Trash2 />
    </Button>
  )}

  {/* Three-dot menu - only when items selected */}
  {selectedJobIds.size > 0 && (
    <DropdownMenu>
      {/* Copy, ZIP, Single file, Delete options */}
    </DropdownMenu>
  )}

  {/* Selection count */}
  {selectedJobIds.size > 0 && (
    <span>{selectedJobIds.size} selected</span>
  )}

  <div className="flex-1" />

  {/* Pagination */}
  <span>{startIndex + 1}-{endIndex} of {jobs.length}</span>
  <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
    <ChevronLeft />
  </Button>
  <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>
    <ChevronRight />
  </Button>
</div>
```

**Action bar elements**:
- **Checkbox**: Select all/none on current page (indeterminate state for partial selection)
- **Delete button**: Red/destructive, only visible when ≥1 item selected
- **Three-dot menu**: Only visible when ≥1 item selected, contains bulk operations
- **Selection count**: Shows "X selected" when items are selected
- **Pagination**: Shows "X-Y of Z" with prev/next navigation arrows

### Bulk Selection

**Selection features**:
- **Select all/none**: Checkbox toggles all jobs on current page
- **Individual selection**: Click checkbox to toggle single job
- **Range selection**: Shift+click selects range between last clicked and current (within page)
- **Selection persists across pages**: Can select jobs on page 1, navigate to page 2, select more
- **Visual feedback**: Selected cards change appearance
- **Clear selection**: X button or Escape key

**Keyboard shortcuts**:
```tsx
// Ctrl/Cmd + A - Select all jobs on current page
if ((e.ctrlKey || e.metaKey) && e.key === 'a' && paginatedJobs.length > 0) {
  handleSelectAll();
}

// Delete/Backspace - Delete selected jobs
if ((e.key === 'Delete' || e.key === 'Backspace') && selectedJobIds.size > 0) {
  handleBulkDeleteClick();
}

// Escape - Clear selection
if (e.key === 'Escape' && selectedJobIds.size > 0) {
  handleClearSelection();
}
```

**Range selection (Shift+click)** - within current page:
```tsx
if (e.shiftKey && lastClickedIndex !== null) {
  const start = Math.min(lastClickedIndex, index);
  const end = Math.max(lastClickedIndex, index);
  for (let i = start; i <= end; i++) {
    newSelected.add(paginatedJobs[i].id);
  }
}
```

### Bulk Export Operations

**Three-dot menu** (visible when ≥1 job selected) contains bulk operations that aggregate content from all selected jobs:

**Copy to Clipboard**:
- Copy as raw text
- Copy as markdown

**Download as ZIP**:
- Zip using raw text files
- Zip using markdown files

**Download as Single File**:
- Single raw text file
- Single markdown file

**Delete**:
- Delete selected jobs (red/destructive)

**Bulk operation flow**:
1. Fetch pages from each selected job
2. Combine all pages into single array
3. Perform copy/export operation on combined dataset
4. Show progress toast while fetching
5. Show success message with total page count and job count

### Modal Views

**Single modal with three views**: Job Details, Page Content, Delete Confirmation

**View 1: Job Details**
```tsx
{modalView === 'job-details' && (
  <div className="flex flex-col h-[500px]">
    {/* Compact status line */}
    <div className="px-4 pt-0 pb-2.5 bg-muted/30 border-b">
      <div>{/* Status, pages, size */}</div>
      <div>{/* Date */}</div>
    </div>

    {/* Combined search + actions row */}
    <div className="px-4 py-2.5 border-b flex items-center gap-2">
      <Input /> {/* Search - flex-grow */}
      <div>{/* Split button - Copy All | Export */}</div>
      <Button>{/* Delete icon */}</Button>
    </div>

    {/* Pages list (scrollable) */}
  </div>
)}
```

Features:
- Breadcrumb navigation (`[← Back] Job URL [X]`)
- **Compact status display** - Two-line layout with status, page count, total size, and date
- **Combined search and actions row** - Search input, export split button, and delete icon in single row
- **Export split button** - "Copy All" primary action with dropdown for ZIP and single file exports
- **Smart clipboard handling** - 10MB safety check with clear error messaging
- Real-time page search and filtering
- Scrollable pages list
- Space-efficient layout for maximum page visibility

**View 2: Page Content**
```tsx
{modalView === 'page-content' && (
  <div className="flex flex-col h-[500px]">
    {/* Content area (pre tag) */}
    {/* Footer with copy/download actions */}
  </div>
)}
```

Features:
- Breadcrumb navigation (`[← Back] domain > page-name [X]`)
- Scrollable markdown content
- Copy/download dropdown menu

**Back button behavior**:
- In Page Content view: Returns to Job Details
- In Job Details view: Closes modal
- Keyboard: Escape key same as back button

**Navigation**:
```tsx
const handleBack = () => {
  if (modalView === 'page-content') {
    setModalView('job-details');
    setSelectedPage(null);
  } else if (modalView === 'job-details') {
    handleCloseModal();
  }
};
```

### Bulk Delete Confirmation

**Centered confirmation dialog** (matches single job delete modal):
```tsx
<Dialog open={modalView === 'delete-confirmation'}>
  <DialogContent centered className="max-w-[340px] sm:max-w-[380px]">
    <DialogTitle>Delete {jobsToDelete.length} jobs?</DialogTitle>
    <DialogDescription>
      <p>This will delete {totalPagesToDelete} pages total.</p>
      <p>This action cannot be undone.</p>
    </DialogDescription>
    <Button onClick={handleConfirmBulkDelete}>Delete Jobs</Button>
  </DialogContent>
</Dialog>
```

**Shows exactly**:
- Total pages being deleted
- Warning that action is permanent

**After deletion**:
- Success toast notification
- Selection cleared
- Modal closed
- Job list refreshed

---

## SearchTab Component

### Component Overview

Full-text search across all crawled pages with real-time filtering:

**Features**:
- Real-time search with 300ms debouncing (no search button needed)
- Search icon inside input with loading indicator
- Clickable search results that open page content modal
- Results list with context snippets
- Copy to clipboard action
- Page content modal with job breadcrumb navigation
- Navigate to job details from search results
- Empty and no-results states

### State and Hooks

```tsx
const [query, setQuery] = useState('');
const { results, loading, search } = useSearch();
const { toast } = useToast();

// Modal state
const [selectedPage, setSelectedPage] = useState<any | null>(null);
const [selectedJob, setSelectedJob] = useState<any | null>(null);
const [modalOpen, setModalOpen] = useState(false);
```

**Local state**: `query` (search input), modal state

**Hook state**: `results`, `loading`

**Actions**: `search()` (auto-triggered via useEffect)

### Search Interface

**Real-time search input**:
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    type="search"
    placeholder="Search for..."
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    className="pl-9 pr-9"
  />
  {loading && (
    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
  )}
</div>
```

**Real-time behavior**:
- Search triggers automatically 300ms after user stops typing
- No search button needed
- Loading spinner appears inside input on the right
- Search icon always visible on the left

### Results Display

**Clickable result card**:
```tsx
<Card
  className="cursor-pointer transition-colors hover:bg-accent/50"
  onClick={() => handleOpenPage(result)}
>
  <CardContent className="pt-4">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {result.url}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {(result.contentLength / 1024).toFixed(1)} KB
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy(result.content);
        }}
        className="shrink-0"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
    <div className="text-xs text-muted-foreground bg-muted p-2 rounded break-words">
      {getSnippet(result.content, query)}
    </div>
  </CardContent>
</Card>
```

**Interaction**:
- Click anywhere on card to open page content modal
- Copy button stops propagation to allow quick copy without opening modal
- Hover effect indicates clickability

**Snippet generation**:
```tsx
const getSnippet = (content: string, query: string, maxLength = 150) => {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    return content.substring(0, maxLength) + '...';
  }

  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 100);
  const snippet = content.substring(start, end);

  return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
};
```

**Context**: Shows ~50 chars before and ~100 chars after match

---

## Custom Hooks

### useCrawl Hook

**Purpose**: Manage crawl state and communicate with service worker

**State**:
```tsx
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
```

**Effects**:

1. **Check for active crawl on mount**:
```tsx
useEffect(() => {
  crawlerAPI.getCrawlStatus().then(status => {
    if (status.active) {
      setIsActive(true);
      setJobId(status.jobId);
      setProgress({ /* ... */ });
    }
  });
}, []);
```

2. **Listen for progress updates**:
```tsx
useEffect(() => {
  const unsubscribe = crawlerAPI.onProgress((progressData) => {
    setProgress({ /* ... */ });

    // Check if completed
    if (progressData.queueSize === 0 && progressData.inProgress.length === 0) {
      setIsActive(false);
      setJobId(null);
    }
  });

  return unsubscribe;
}, []);
```

**Actions**:
```tsx
const startCrawl = async (baseUrl: string) => {
  setError(null);
  const response = await crawlerAPI.startCrawl(baseUrl);
  setIsActive(true);
  setJobId(response.jobId);
  setProgress({ /* reset */ });
};

const cancelCrawl = async () => {
  await crawlerAPI.cancelCrawl();
  setIsActive(false);
  setJobId(null);
};
```

### useJobs Hook

**Purpose**: Load and manage job list

**State**:
```tsx
const [jobs, setJobs] = useState<Job[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Effect**:
```tsx
useEffect(() => {
  loadJobs();
}, []);

const loadJobs = useCallback(async () => {
  setLoading(true);
  const jobsList = await crawlerAPI.getJobs();
  setJobs(jobsList);
  setLoading(false);
}, []);
```

**Actions**:
```tsx
const deleteJob = async (jobId: string) => {
  await crawlerAPI.deleteJob(jobId);
  await loadJobs(); // Refresh list
};

const getJobPages = async (jobId: string): Promise<Page[]> => {
  return await crawlerAPI.getPages(jobId);
};
```

### useSearch Hook

**Purpose**: Perform search and manage results

**State**:
```tsx
const [results, setResults] = useState<SearchResult[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Action**:
```tsx
const search = useCallback(async (query: string) => {
  if (!query.trim()) {
    setResults([]);
    return;
  }

  setLoading(true);
  const searchResults = await crawlerAPI.search(query);
  setResults(searchResults);
  setLoading(false);
}, []);
```

**Clear**:
```tsx
const clear = useCallback(() => {
  setResults([]);
  setError(null);
}, []);
```

---

## Service Worker Client

### Communication Protocol

**Location**: `lib/service-worker-client.ts`

**Purpose**: Abstract service worker communication

**Pattern**: MessageChannel-based request/response

### sendMessage Function

Core communication function:

```tsx
export async function sendMessage(type: MessageType, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('Service worker not available'));
      return;
    }

    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      if (event.data.type === 'RESPONSE') {
        if (event.data.data.error) {
          reject(new Error(event.data.data.error));
        } else {
          resolve(event.data.data);
        }
      }
    };

    navigator.serviceWorker.controller.postMessage(
      { type, data },
      [messageChannel.port2]
    );

    setTimeout(() => {
      reject(new Error('Service worker request timeout'));
    }, 30000);
  });
}
```

### Progress Listener

**Subscribe to progress**:
```tsx
export function onCrawlProgress(callback: (progress: any) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data.type === 'CRAWL_PROGRESS') {
      callback(event.data.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
```

**Returns**: Cleanup function

### API Functions

**crawlerAPI object**:
```tsx
export const crawlerAPI = {
  async startCrawl(baseUrl: string) {
    return sendMessage('START_CRAWL', { baseUrl });
  },

  async cancelCrawl() {
    return sendMessage('CANCEL_CRAWL');
  },

  async getJobs() {
    const response = await sendMessage('GET_JOBS');
    return response.jobs || [];
  },

  async getPages(jobId: string) {
    const response = await sendMessage('GET_PAGES', { jobId });
    return response.pages || [];
  },

  async search(query: string) {
    const response = await sendMessage('SEARCH', { query });
    return response.results || [];
  },

  async getCrawlStatus() {
    return sendMessage('GET_CRAWL_STATUS');
  },

  onProgress(callback: (progress: any) => void) {
    return onCrawlProgress(callback);
  }
};
```

**contentPickerAPI object** (v2.24+):
```tsx
export const contentPickerAPI = {
  // Start content picker - injects picker into active tab
  async startPicker(): Promise<{ status: string; tabId?: number; error?: string }>;

  // Save picked content as a job with single page
  async savePickedContent(content: PickedContent): Promise<{ status: string; jobId?: string; error?: string }>;

  // Get pending picked content from storage
  async getPendingContent(): Promise<PickedContent | null>;

  // Clear pending picked content
  async clearPendingContent(): Promise<void>;
};
```

---

## Export Utilities

### Overview

**Location**: `lib/export-utils.ts`

**Purpose**: Provides utility functions for exporting crawled content in various formats (ZIP archives, single files, clipboard) with proper file name sanitization and content formatting.

**Dependencies**: Used by JobsTab component for bulk export operations.

### Core Functions

#### `sanitizeFileName(url: string, baseUrl: string): string`

Converts a URL into a valid file system name:
- Removes base URL to get relative path
- Replaces invalid characters (`<>:"/\|?*`) with underscores
- Flattens directory structure (slashes → hyphens)
- Limits length to 200 characters
- Returns "page" as fallback for empty results

**Example**:
```typescript
sanitizeFileName('https://example.com/api/docs/auth', 'https://example.com')
// Returns: "api-docs-auth"
```

#### `formatConcatenatedContent(pages: Page[]): string`

Formats multiple pages into a single concatenated string with URL headers:
- Each page separated by 80-character `=` line
- URL header clearly identifies content source
- Proper spacing between sections

**Format**:
```
================================================================================
URL: https://example.com/page1
================================================================================

[Page 1 content]


================================================================================
URL: https://example.com/page2
================================================================================

[Page 2 content]
```

#### `calculateContentSize(pages: Page[]): number`

Returns total byte size of concatenated content using `Blob` for accurate measurement.

#### `formatBytes(bytes: number): string`

Converts bytes to human-readable format (Bytes, KB, MB, GB) with appropriate precision.

**Example**: `1536` → `"1.5 KB"`

#### `isClipboardSizeSafe(pages: Page[]): boolean`

Safety check for clipboard operations:
- Returns `true` if content ≤ 10MB
- Returns `false` if content > 10MB (prevents clipboard crashes)

#### `getDomainFileName(baseUrl: string): string`

Extracts domain and path from URL to create a descriptive file name:
- Removes `www.` prefix
- Converts path to hyphens
- Sanitizes result

**Example**: `"https://docs.stripe.com/api"` → `"docs.stripe.com-api"`

### Integration with JobsTab

The export utilities are used in JobsTab for five export operations:

1. **Copy All to Clipboard** - Uses `isClipboardSizeSafe()` and `formatConcatenatedContent()`
2. **ZIP all .md files** - Uses `sanitizeFileName()` with JSZip library
3. **ZIP all .txt files** - Uses `sanitizeFileName()` with JSZip library
4. **Single .md file** - Uses `formatConcatenatedContent()` and `getDomainFileName()`
5. **Single .txt file** - Uses `formatConcatenatedContent()` and `getDomainFileName()`

---

## shadcn/ui Components

### Component Library

**shadcn/ui**: Copy-paste component library built on Radix UI

**Benefits**:
- Full control over components
- TypeScript support
- Accessible by default
- Customizable with Tailwind

### Tabs Components

**Tabs** (compound component):
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="crawl">Crawl</TabsTrigger>
  </TabsList>
  <TabsContent value="crawl">
    {/* Content */}
  </TabsContent>
</Tabs>
```

### Card Components

**Card** (content wrapper):
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Form Components

**Input**:
```tsx
import { Input } from "./ui/input";
import { Label } from "./ui/label";

<Label htmlFor="url">URL</Label>
<Input id="url" type="url" value={url} onChange={...} />
```

**Button**:
```tsx
import { Button } from "./ui/button";

<Button onClick={...} disabled={...}>
  Start Crawl
</Button>

<Button variant="outline">Cancel</Button>
<Button variant="ghost">Delete</Button>
```

---

## PageContentViewer Component

### Overview

**Reusable component** for viewing page content with format selection and actions. Extracted in v2.8.0 to eliminate code duplication between JobsTab and PageContentModal.

**Location**: `components/PageContentViewer.tsx`

**Used by**:
- `PageContentModal` - Search tab page viewer
- `JobsTab` - Jobs tab inline page viewer

**Features**:
- Format selector (Raw Text / Markdown toggle)
- Dual format rendering (text vs rendered markdown)
- Copy/download actions with split button
- Open in preview window capability
- Fallback warnings for low-confidence markdown
- YAML Front Matter transformation for visual display

### Props

```tsx
interface PageContentViewerProps {
  page: Page;                        // Page to display
  confidenceThreshold?: number;      // Markdown confidence threshold (default: 0.5)
  defaultFormat?: ContentFormat;     // Default format: 'text' | 'markdown' (default: 'markdown')
}
```

### Format Selection

**Format selector UI**:
```tsx
Format: [Raw Text] [Markdown]  [Open in Window →]
```

- **Raw Text** - Shows plain text with metadata header
- **Markdown** - Shows rendered markdown with styled callout card
- **Open in Window** - Opens content in separate Chrome Window (1000×800px popup)

**Automatic fallback**:
- If markdown unavailable, defaults to raw text
- Shows yellow warning banner when falling back

### Content Display

**Raw Text format**:
```tsx
<pre className="text-xs whitespace-pre-wrap font-mono p-2">
  {displayContent}
</pre>
```

**Markdown format**:
```tsx
<div className="prose prose-sm dark:prose-invert max-w-none p-3"
     dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
```

**Markdown Preview Features** (v2.7+):
- YAML Front Matter transformed into styled callout card (visual only)
- Metadata displayed as bulleted list with icon
- Typography optimized for readability
- Table support via GFM plugin (v2.8+)
- Transformation only affects visual rendering (copy/download preserves YAML)

### Actions

**Split button footer**:
- **Copy Page** (primary action) - Copies content to clipboard
- **Dropdown menu**:
  - Download as .md or .txt (based on selected format)

**Open in Window** (v2.8+):
- Opens content in separate Chrome Window (`preview.html`)
- Respects selected format (raw text or markdown)
- Window size: 1000×800px, type: popup
- Includes same action buttons (copy/download)

---

## PageContentModal Component

### Overview

**Thin wrapper modal** for displaying page content using `PageContentViewer`. Used by Search tab.

**Location**: `components/PageContentModal.tsx`

**Architecture**: Refactored in v2.8.0 - now delegates content viewing to `PageContentViewer` component.

**Responsibilities**:
- Dialog structure and modal state
- Breadcrumb navigation with job context
- Back button to return to previous view
- External link to open page in browser

### Props

```tsx
interface PageContentModalProps {
  page: any | null;           // Page to display
  open: boolean;              // Modal open state
  onClose: () => void;        // Close handler
  job?: any | null;           // Optional job context
  onNavigateToJob?: () => void; // Navigate to job handler
}
```

### Modal Header

**With job context** (from Search tab):
```tsx
[← Back] code.claude.com > setup [External Link Icon]
```
- Back arrow returns to search results
- Job name is clickable, navigates to job in Jobs tab
- Page name opens URL in new browser tab

**Without job context**:
```tsx
[← Back] setup [External Link Icon]
```
- Back arrow returns to job details
- Page name opens URL in new browser tab

---

## AboutDialog Component

### Overview

**Full-screen modal** for displaying application information, accessed via the three-dot menu in the top right corner.

**Location**: `components/AboutDialog.tsx`

**Features**:
- Fills entire popup space (400px × 600px)
- Card-based menu items with icons
- Version information display at bottom
- External links to documentation and GitHub
- Centered content layout

**Trigger**: Three-dot menu button (⋮) in App header

### Props

```tsx
interface AboutDialogProps {
  open: boolean;              // Modal open state
  onOpenChange: (open: boolean) => void;  // State handler
}
```

### Menu Items

**Card-based menu items** with icon, title, and description:

```tsx
<AboutMenuItem
  icon={BookOpen}
  title="Documentation"
  description="View the user guide and technical docs"
  onClick={() => window.open('https://...', '_blank')}
/>

<AboutMenuItem
  icon={Github}
  title="GitHub Repository"
  description="Report issues and contribute"
  onClick={() => window.open('https://...', '_blank')}
/>
```

**Menu item structure**:
- Icon in rounded background circle
- Title text (bold)
- Description text (muted)
- Hover state with accent background
- Full-width clickable button

### Version Display

**Discrete text at bottom** (not a card):

```tsx
<div className="mt-8 text-center text-sm text-muted-foreground">
  Documentation Crawler — Version {VERSION}
</div>
```

**Version format**: Displays full custom version from `version.ts`:
- Example: `Documentation Crawler — Version 2.3.1.251122.c3bd3e4`
- Format: `<app-name> — Version <semver>.<timestamp>.<git-sha>`

**Usage in App.tsx**:

```tsx
const [aboutOpen, setAboutOpen] = useState(false);

<Button variant="ghost" size="icon" onClick={() => setAboutOpen(true)}>
  <MoreVertical className="h-4 w-4" />
</Button>

<AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
```

---

## SupportPage Component

### Overview

**Sliding panel** for viewing error logs and generating diagnostic reports, accessed via the Support menu item in AboutDialog.

**Location**: `components/SupportPage.tsx`

**Features**:
- Slides in from right with smooth animation
- Back button navigation (no close icon)
- Error log table with expandable rows
- Source and date filtering
- Export respects current filters
- Copy to clipboard and download as JSON
- Clear all logs with confirmation

**Added in**: v2.22.0

### Props

```tsx
interface SupportPageProps {
  open: boolean;              // Panel open state
  onBack: () => void;         // Back button handler
}
```

### Error Table

**Columns**:
- **Time**: Relative time (e.g., "2m ago") with full timestamp on hover
- **Source**: Colored badge (crawler=blue, tab-fetcher=purple, popup=green, service-worker=orange)
- **Message**: Truncated error message

**Expandable rows** reveal:
- Full error message
- Context (URL, jobId, action, etc.)
- Stack trace (monospace, scrollable)
- "Copy this error" button

### Filtering

**Source filter**: Dropdown with all available error sources
**Date filter**: All time, Today, This week, This month

**Dynamic count**: Header shows "X of Y errors" when filtered

### Export Actions

**Copy**: Copies filtered errors as formatted markdown
**Download**: Downloads filtered errors as JSON file
**Clear All**: Deletes all logs (with confirmation dialog)

**Export format includes**:
- Report metadata (timestamp, filters applied)
- Extension and browser info
- Full error details with stack traces

---

## ErrorBoundary Component

### Overview

**React error boundary** for catching rendering errors in the popup UI.

**Location**: `components/ErrorBoundary.tsx`

**Features**:
- Catches errors in component tree
- Displays user-friendly error screen
- Logs errors to service worker for diagnostics
- Provides "Try Again" and "Reload" options

**Added in**: v2.22.0

### Error Catching

```tsx
// In main.tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Catches**:
- React rendering errors
- Errors in event handlers (if thrown during render)
- Errors in lifecycle methods

**Does NOT catch**:
- Event handler errors (use try-catch)
- Async errors (use global handlers)
- Server-side rendering errors (N/A for extension)

### Error Display

**Error screen shows**:
- Error icon (AlertCircle)
- "Something went wrong" heading
- Error message (truncated)
- "Try Again" button (resets error boundary)
- "Reload" button (refreshes popup)

**Error logging**:
- Sends error details to service worker via `LOG_ERROR` message
- Includes component stack trace for debugging
- Persisted in IndexedDB for diagnostic reports

---

## Dialog Modal (Legacy)

### Content Viewer

**Note**: This section describes the old inline dialog pattern. New code should use `PageContentModal` component instead.

**Features**:
- URL header with copy button
- Scrollable markdown preview
- Actions toolbar (copy, download)
- Responsive layout

### Dialog Structure

```tsx
<Dialog open={!!selectedPage} onOpenChange={(open) => !open && setSelectedPage(null)}>
  <DialogContent className="p-0">
    {/* Header */}
    <div className="px-4 pt-3 pb-3 border-b">
      <DialogTitle asChild>
        <button onClick={() => window.open(selectedPage.url)}>
          <ExternalLink />
          <span className="truncate">{selectedPage.url}</span>
        </button>
      </DialogTitle>
      <Button onClick={copyUrl}>
        <Copy />
      </Button>
    </div>

    {/* Content */}
    <div className="flex-1 px-2 py-2">
      <ScrollArea className="h-[calc(100vh-14rem)]">
        <pre className="text-xs whitespace-pre-wrap">
          {selectedPage.content}
        </pre>
      </ScrollArea>
    </div>

    {/* Footer */}
    <div className="px-4 py-3 border-t flex justify-end">
      <Button onClick={copyContent}>
        <Copy /> Copy Page
      </Button>
      <DropdownMenu>
        <DropdownMenuItem onClick={downloadMd}>
          <Download /> Download as .md
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadTxt}>
          <Download /> Download as .txt
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  </DialogContent>
</Dialog>
```

### Actions Toolbar

**Copy button**:
```tsx
<Button onClick={() => {
  navigator.clipboard.writeText(selectedPage.content);
  toast({ title: "Content copied!" });
}}>
  <Copy /> Copy Page
</Button>
```

**Download as Markdown**:
```tsx
<DropdownMenuItem onClick={() => {
  const blob = new Blob([selectedPage.content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${selectedPage.url.split('/').pop()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}}>
  <Download /> Download as .md
</DropdownMenuItem>
```

---

## Toast Notifications

### useToast Hook

**Hook from shadcn/ui**:
```tsx
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();
```

**Usage**:
```tsx
toast({
  variant: "success",
  title: "Job deleted!",
  description: "The crawl job has been removed"
});

toast({
  variant: "destructive",
  title: "Delete failed",
  description: "Failed to delete the job. Please try again."
});
```

### Toast Display

**Toaster component**:
```tsx
import { Toaster } from "./components/ui/toaster";

<App>
  {/* App content */}
  <Toaster />
</App>
```

**Position**: Toasts appear at the bottom of the popup and slide in from below.

**Auto-dismiss**: All toasts auto-dismiss after 2 seconds (hardcoded in `toaster.tsx`).

**Variants**:
- `default` - Neutral gray/dark background
- `success` - Green background (`bg-green-500`)
- `destructive` - Red background for errors
- `warning` - Orange background (`bg-orange-500`) for cancellation/warning states

### Toast Usage

**Success notifications**:
- Content copied
- Job deleted
- Download started

**Error notifications**:
- Delete failed
- Search failed
- Crawl start failed

---

## State Management

### Local State

**Component-level state** with `useState`:
```tsx
const [url, setUrl] = useState('');
const [expandedJob, setExpandedJob] = useState('');
const [selectedPage, setSelectedPage] = useState(null);
```

**Ephemeral state**: Lost on popup close

### Hook-Based State

**Custom hooks** encapsulate service worker communication:
```tsx
const { isActive, progress, startCrawl } = useCrawl();
const { jobs, loading, deleteJob } = useJobs();
const { results, search } = useSearch();
```

**State synchronization**:
- Hooks fetch from service worker
- Listen for real-time updates
- Update local state

### Service Worker Sync

**On mount**: Check for active crawl
```tsx
useEffect(() => {
  crawlerAPI.getCrawlStatus().then(status => {
    if (status.active) {
      // Restore crawl state
    }
  });
}, []);
```

**Real-time**: Listen for progress
```tsx
useEffect(() => {
  return crawlerAPI.onProgress((progress) => {
    setProgress(progress);
  });
}, []);
```

---

## Real-Time Updates

### Progress Updates

**Service worker broadcasts** progress:
```tsx
broadcastProgress(jobId, progress);
```

**Popup listens**:
```tsx
crawlerAPI.onProgress((progress) => {
  setProgress(progress);
});
```

**Update frequency**: After each URL is processed (~0.5-2 seconds)

### Update Flow

```
Service Worker        Popup
      |                 |
      |--- PROGRESS --->|
      |                 |- Update state
      |                 |- Re-render UI
      |                 |
      |--- PROGRESS --->|
      |                 |- Update state
      |                 |- Re-render UI
```

### State Reconciliation

**Popup can reopen mid-crawl**:

1. Popup opens
2. Calls `getCrawlStatus()`
3. If active, restore state
4. Subscribe to progress updates
5. Display current progress

**No state loss**: Service worker is source of truth

---

## Error Handling

### Try-Catch Patterns

**Async operations wrapped**:
```tsx
const handleStartCrawl = async () => {
  try {
    await startCrawl(url);
  } catch (err) {
    console.error('Failed to start crawl:', err);
  }
};
```

**Hook-level error state**:
```tsx
const [error, setError] = useState<string | null>(null);

try {
  await crawlerAPI.startCrawl(baseUrl);
} catch (err) {
  setError(err.message);
  throw err;
}
```

### User Feedback

**Alert component** for errors:
```tsx
{error && (
  <Alert variant="destructive">
    <AlertCircle />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

**Toast for actions**:
```tsx
toast({
  variant: "destructive",
  title: "Error",
  description: error.message
});
```

### Error Recovery

**Clear error on retry**:
```tsx
const startCrawl = async (baseUrl: string) => {
  setError(null); // Clear previous error
  // ...
};
```

**User can**:
- Retry failed actions
- See error details
- Continue using other features

---

## Loading States

### Loading Indicators

**Spinner icons**:
```tsx
import { Loader2 } from 'lucide-react';

{loading ? (
  <Loader2 className="h-4 w-4 animate-spin" />
) : (
  <Search />
)}
```

**Disabled buttons during loading**:
```tsx
<Button disabled={loading || !query.trim()}>
  Search
</Button>
```

### Skeleton States

**Loading card**:
```tsx
{loading && (
  <Card>
    <CardContent className="pt-6">
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">
          Loading jobs...
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

### Empty States

**No jobs**:
```tsx
{jobs.length === 0 && !loading && (
  <Card>
    <CardContent>
      <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
      <p className="text-sm text-muted-foreground">
        No crawl jobs yet. Start a new crawl to get started.
      </p>
    </CardContent>
  </Card>
)}
```

**No results**:
```tsx
{results.length === 0 && query && !loading && (
  <p>No results found for "{query}"</p>
)}
```

---

## User Interactions

### Start Crawl Flow

1. User enters URL
2. Clicks "Start Crawl" or presses Enter
3. `handleStartCrawl()` called
4. `useCrawl.startCrawl()` sends message to service worker
5. Service worker starts crawl
6. Response with job ID
7. UI switches to "active" state
8. Progress updates displayed in real-time
9. User can cancel or close popup

### View Job Flow

1. User clicks job card in list
2. `handleOpenJob()` called
3. Modal opens with job details view
4. Pages fetched from service worker
5. Pages displayed in scrollable list with search
6. User can search/filter pages
7. User clicks page in list
8. Modal transitions to page content view
9. Markdown content displayed
10. User can copy or download
11. User clicks back button to return to job details
12. User clicks back again or X to close modal

### Bulk Selection Flow

1. User clicks checkbox on job card(s)
2. Action bar appears showing selection count
3. User can:
   - Click more checkboxes (individual selection)
   - Shift+click for range selection
   - Ctrl/Cmd+A to select all
   - Click checkbox in action bar to select/deselect all
4. User clicks Delete button in action bar (or presses Delete key)
5. Smart confirmation dialog shows:
   - List of jobs to be deleted
   - Total pages that will be deleted
   - Warning that action is permanent
6. User confirms deletion
7. All selected jobs deleted
8. Success toast notification
9. Selection cleared
10. Job list refreshed

### Search Flow

1. User enters search query
2. Clicks "Search" or presses Enter
3. `handleSearch()` called
4. `useSearch.search()` sends query to service worker
5. Service worker searches IndexedDB
6. Results returned
7. Results displayed with snippets
8. User can copy page content

### Copy/Download Flow

**Copy to clipboard**:
1. User clicks copy button
2. `navigator.clipboard.writeText()` called
3. Success toast displayed

**Download as file**:
1. User clicks download option
2. Blob created from content
3. Object URL generated
4. Temporary `<a>` element created and clicked
5. Download starts
6. Object URL revoked
7. Success toast displayed

---

## Styling and Theming

### Tailwind CSS

**Utility-first CSS framework**:
```tsx
<div className="w-[400px] min-h-[500px] bg-background text-foreground">
  <div className="p-4 overflow-hidden">
    <h1 className="text-xl font-bold mb-4">Title</h1>
  </div>
</div>
```

**Common patterns**:
- `flex`, `grid` for layout
- `gap-*` for spacing
- `text-*` for typography
- `bg-*`, `text-*` for colors

### CSS Variables

**Theme colors** (CSS variables):
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  /* ... */
}
```

**Usage in Tailwind**:
- `bg-background` → `var(--background)`
- `text-foreground` → `var(--foreground)`
- `bg-primary` → `var(--primary)`

### Responsive Design

**Fixed dimensions**:
- Width: `400px`
- Min height: `500px`

**Overflow handling**:
- `overflow-hidden` on containers
- `ScrollArea` for scrollable content
- `truncate` for text overflow

---

## Accessibility

### Semantic HTML

**Proper elements**:
```tsx
<button onClick={...}>Action</button>
<label htmlFor="url">URL</label>
<input id="url" type="url" />
```

**Not**:
```tsx
<div onClick={...}>Action</div> // ❌ Bad
```

### ARIA Labels

**Dialog accessibility**:
```tsx
<DialogContent aria-describedby={undefined}>
  <DialogTitle>Page Content</DialogTitle>
  {/* Content */}
</DialogContent>
```

**Button labels**:
```tsx
<Button title="Copy URL">
  <Copy />
</Button>
```

### Keyboard Navigation

**Enter key support**:
```tsx
<Input
  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
/>
```

**Focus management**:
- Buttons are keyboard accessible
- Dialogs trap focus
- Tabs are keyboard navigable

---

## Performance Optimizations

### React Optimizations

**useCallback** for stable references:
```tsx
const loadJobs = useCallback(async () => {
  // ...
}, []);
```

**Conditional rendering**:
```tsx
{isActive && <ActiveCrawlUI />}
{!isActive && <IdleUI />}
```

### Lazy Loading

**Pages loaded on demand**:
```tsx
if (!jobPages[jobId]) {
  const pages = await getJobPages(jobId);
  setJobPages(prev => ({ ...prev, [jobId]: pages }));
}
```

**Benefits**:
- Faster initial render
- Lower memory usage
- Better performance

### Virtualization

**Not currently implemented** but could be added for:
- Long job lists (100+)
- Large page lists (1000+)

**Trade-off**: Popup typically has <50 jobs, not needed
