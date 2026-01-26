# Development Guide

## Table of Contents

- [Development Guide](#development-guide)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
    - [Required Software](#required-software)
    - [Optional Tools](#optional-tools)
  - [Project Setup](#project-setup)
    - [Initial Installation](#initial-installation)
    - [Verify Installation](#verify-installation)
  - [Project Structure](#project-structure)
    - [Directory Layout](#directory-layout)
    - [File Responsibilities](#file-responsibilities)
  - [Development Workflow](#development-workflow)
    - [Building the Popup](#building-the-popup)
      - [Development Mode (with HMR)](#development-mode-with-hmr)
      - [Production Build](#production-build)
    - [Loading Extension in Chrome](#loading-extension-in-chrome)
    - [Making Changes](#making-changes)
      - [Popup Changes](#popup-changes)
      - [Core Module Changes](#core-module-changes)
      - [Service Worker Changes](#service-worker-changes)
  - [Build Configuration](#build-configuration)
    - [Vite Configuration](#vite-configuration)
    - [TypeScript Configuration](#typescript-configuration)
    - [Tailwind CSS Configuration](#tailwind-css-configuration)
  - [Development Tools](#development-tools)
    - [Chrome DevTools for Popup](#chrome-devtools-for-popup)
    - [Service Worker Console](#service-worker-console)
    - [IndexedDB Inspector](#indexeddb-inspector)
    - [Network Monitoring](#network-monitoring)
  - [Code Style and Linting](#code-style-and-linting)
    - [TypeScript (Popup)](#typescript-popup)
    - [JavaScript (Core Modules)](#javascript-core-modules)
    - [ESLint Configuration](#eslint-configuration)
  - [Common Development Tasks](#common-development-tasks)
    - [Adding a New UI Component](#adding-a-new-ui-component)
    - [Adding a New Message Type](#adding-a-new-message-type)
    - [Adding a New Storage Function](#adding-a-new-storage-function)
    - [Modifying Extraction Logic](#modifying-extraction-logic)
  - [Debugging Tips](#debugging-tips)
    - [Popup Not Loading](#popup-not-loading)
    - [Service Worker Errors](#service-worker-errors)
    - [Build Failures](#build-failures)
    - [Storage Issues](#storage-issues)
  - [Performance Profiling](#performance-profiling)
    - [Capture Speed](#capture-speed)
    - [Memory Usage](#memory-usage)
    - [Storage Size](#storage-size)

---

## Overview

This guide covers setting up the development environment, understanding the build process, and common development workflows for the Documentation Crawler extension.

---

## Prerequisites

### Required Software

**Node.js 18+**
```bash
node --version
# Should output: v18.0.0 or higher
```

**npm** (comes with Node.js)
```bash
npm --version
# Should output: 9.0.0 or higher
```

**Google Chrome** (for testing)
```bash
google-chrome --version
# Any recent version works
```

### Optional Tools

**ImageMagick** (for icon generation)
```bash
brew install imagemagick  # macOS
sudo apt install imagemagick  # Linux
```

**Git** (for version control)
```bash
git --version
```

**GitHub CLI** (for automated releases)
```bash
gh --version
# Install from: https://cli.github.com/
```

Required for `push-release.js` script to publish build artifacts to GitHub Releases.

---

## Project Setup

### Initial Installation

```bash
# Navigate to project root
cd /path/to/extension

# Install popup dependencies
cd popup
npm install

# Verify all dependencies installed
npm list --depth=0
```

**Dependencies Installed**:
- **Runtime**: react, react-dom, lucide-react, react-markdown, react-syntax-highlighter, jszip
- **UI**: @radix-ui/* (12 primitives), class-variance-authority, clsx, tailwind-merge
- **Build**: vite, @vitejs/plugin-react, typescript
- **Styling**: tailwindcss, postcss, autoprefixer, tailwindcss-animate

### Verify Installation

```bash
# Build popup to verify everything works
npm run build

# Check output
ls -la ../popup-dist/
# Should see: index.html, assets/popup.js, assets/popup.css
```

---

## Project Structure

### Directory Layout

```
extension/
├── manifest.json              # Extension configuration
├── service-worker.js          # Background orchestration
├── icons/                     # Extension icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── lib/                       # Core crawling modules (Vanilla JS)
│   ├── crawler.js            # Crawl orchestration
│   ├── discovery.js          # URL discovery
│   ├── extractor-simple.js   # HTML → Markdown
│   └── utils.js              # URL utilities
├── storage/                   # IndexedDB wrapper
│   └── db.js                 # Storage API
├── popup/                     # React UI
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # Main app component
│       ├── index.css         # Global styles + theme
│       ├── components/
│       │   ├── ui/           # shadcn/ui components (10+)
│       │   ├── CrawlTab.tsx
│       │   ├── JobsTab.tsx
│       │   └── SearchTab.tsx
│       ├── hooks/
│       │   ├── useCrawl.ts
│       │   ├── useJobs.ts
│       │   ├── useSearch.ts
│       │   └── use-toast.ts
│       └── lib/
│           ├── utils.ts      # shadcn utilities
│           └── service-worker-client.ts
├── popup-dist/                # Build output (generated)
│   ├── index.html
│   └── assets/
│       ├── popup.js
│       └── popup.css
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    ├── STORAGE.md
    ├── CAPTURER.md
    ├── DISCOVERY.md
    ├── EXTRACTOR.md
    ├── SERVICE_WORKER.md
    └── UI_COMPONENTS.md
```

### File Responsibilities

**manifest.json** - Extension metadata, permissions, entry points
**service-worker.js** - Background message router, crawl coordinator
**lib/*.js** - Pure JavaScript modules (service worker compatible)
**storage/db.js** - IndexedDB operations
**popup/src/** - React TypeScript UI components
**popup-dist/** - Compiled production build (generated by Vite)

---

## Development Workflow

### Building the Popup

#### Development Mode (with HMR)

```bash
cd popup
npm run dev
```

**Features**:
- Hot Module Replacement (instant updates)
- Runs on `http://localhost:5173`
- TypeScript type checking
- Tailwind CSS with JIT compilation

**Usage**:
- Open browser to `http://localhost:5173`
- Edit files in `src/`
- Changes reflect immediately
- **Note**: Service worker features won't work in dev mode (need extension context)

#### Production Build

```bash
cd popup
npm run build
```

**Output**: `../popup-dist/` directory

**What Happens**:
1. TypeScript compiles (`tsc`)
2. Vite bundles React app
3. Tailwind purges unused CSS
4. Assets minified and optimized
5. Output written to `popup-dist/`

**Build Output**:
```
popup-dist/
├── index.html           # Entry point
└── assets/
    ├── popup.js        # ~228 KB bundled JS
    └── popup.css       # ~20 KB purged CSS
```

### Loading Extension in Chrome

**First Time**:
```
1. Build popup: cd popup && npm run build
2. Open Chrome: chrome://extensions/
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked"
5. Select /path/to/extension directory
6. Extension appears with "DC" icon
```

**After Changes**:
```
1. Rebuild if popup changed: npm run build
2. Go to chrome://extensions/
3. Click reload button 🔄 on extension
4. Test changes
```

### Making Changes

#### Popup Changes

**React Components** (`popup/src/components/*.tsx`):

```bash
# 1. Edit component
vim popup/src/components/CrawlTab.tsx

# 2. Rebuild
cd popup && npm run build

# 3. Reload extension in Chrome
# chrome://extensions/ → reload button

# 4. Test in popup
# Click extension icon
```

**Styles** (`popup/src/index.css` or Tailwind classes):

```bash
# 1. Edit CSS or Tailwind classes
vim popup/src/components/JobsTab.tsx
# Change className="text-sm" to className="text-base"

# 2. Rebuild (Tailwind re-purges)
npm run build

# 3. Reload extension
```

#### Core Module Changes

**Crawler, Discovery, Extractor** (`lib/*.js`):

```bash
# 1. Edit module
vim lib/crawler.js

# 2. NO BUILD NEEDED (vanilla JS, no compilation)

# 3. Reload extension in Chrome
# chrome://extensions/ → reload

# 4. Test crawl
# Start a new crawl, check service worker console
```

**Important**: Core modules are loaded directly by service worker. Changes take effect immediately after extension reload.

#### Service Worker Changes

**service-worker.js**:

```bash
# 1. Edit service worker
vim service-worker.js

# 2. NO BUILD NEEDED

# 3. Reload extension
# chrome://extensions/ → reload

# 4. Verify service worker restarted
# Click "service worker" link to see console
# Should see "Service worker started"
```

**Service Worker Restart**:
- Extension reload always restarts service worker
- Active crawls are lost (not persisted yet)
- IndexedDB data persists

---

## Build Configuration

### Vite Configuration

**File**: `popup/vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  base: './',  // Relative paths for extension
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // @ imports
    },
  },
  build: {
    outDir: '../popup-dist',  // Output outside popup/
    rollupOptions: {
      input: { popup: path.resolve(__dirname, 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js',     // popup.js
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',  // popup.css
      },
    },
  },
});
```

**Key Settings**:
- `base: './'` → Use relative paths (required for Chrome extensions)
- `outDir: '../popup-dist'` → Build outside popup source directory
- `@` alias → Import as `@/components/Button` instead of `../../../components/Button`

### TypeScript Configuration

**File**: `popup/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]  // Path alias support
    }
  }
}
```

**Key Settings**:
- `strict: true` → Full TypeScript strictness
- `noUnusedLocals: true` → Error on unused variables
- `jsx: "react-jsx"` → New JSX transform (no React import needed)

### Tailwind CSS Configuration

**File**: `popup/tailwind.config.ts`

```typescript
export default {
  darkMode: ["class"],  // Toggle via .dark class
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",  // Scan all source files
  ],
  theme: {
    extend: {
      colors: {
        // CSS variables from index.css
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", ... },
        // ... (shadcn/ui color system)
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

**Theme Variables** (`popup/src/index.css`):
- Light and dark mode CSS variables
- Color scheme via HSL values
- Custom fonts (Inter, JetBrains Mono)

---

## Development Tools

### Chrome DevTools for Popup

**Open DevTools**:
```
1. Click extension icon to open popup
2. Right-click anywhere in popup
3. Select "Inspect"
```

**Useful Panels**:
- **Console**: React errors, log messages
- **Elements**: Inspect DOM, CSS
- **Network**: See service worker messages (not HTTP requests)
- **Application → Storage → IndexedDB**: Browse database

**Tips**:
- Keep DevTools open while developing
- Check console for React warnings
- Use React DevTools extension for component tree

### Service Worker Console

**Access**:
```
1. Go to chrome://extensions/
2. Find "Documentation Crawler"
3. Click blue "service worker" link under "Inspect views"
```

**What You'll See**:
```
Service worker started
Received message: START_CRAWL { baseUrl: "https://..." }
Checking for sitemap at: https://example.com/sitemap.xml
Initial URLs discovered: 47
Processing: https://example.com/api/authentication
Extracted 12 unique links from https://example.com/api/authentication
Saved: https://example.com/api/authentication - Found 12 new links
...
Crawl complete!
Processed: 45
Failed: 2
```

**Tips**:
- This is where crawler logs appear
- Monitor fetch errors here
- See real crawl activity
- Service worker auto-terminates after ~30s idle

### IndexedDB Inspector

**Access**:
```
1. Open popup → Right-click → Inspect
2. Go to Application tab
3. Expand IndexedDB → DocumentationCrawlerDB
```

**Stores**:
- **jobs**: View all crawl jobs
- **pages**: View extracted pages

**Actions**:
- Click record to view data
- Right-click → Delete to remove records
- Refresh button to reload data

**Useful for**:
- Verify pages are saving
- Check job status
- Debug storage issues
- Manually clear data

### Network Monitoring

**Service Worker Requests**:
```
Service worker console → Network tab
```

Shows:
- Sitemap fetches
- Page HTML fetches
- Response times and sizes

**Popup Requests**:
```
Popup DevTools → Network tab
```

Shows:
- MessageChannel communication (not visible)
- No external requests (all via service worker)

---

## Code Style and Linting

### TypeScript (Popup)

**Strict Mode Enabled**:
- All type errors must be fixed
- No `any` types without explicit annotation
- Unused variables cause build failure

**Common Issues**:
```typescript
// ❌ Error: Type 'string | undefined'
const url = props.url;  // might be undefined

// ✅ Fix: Handle undefined
const url = props.url || '';

// ❌ Error: Unused variable
const handleClick = () => { };  // never called

// ✅ Fix: Remove or use it
```

### JavaScript (Core Modules)

**ES Modules**:
- Use `import/export` (not `require`)
- Service worker supports ES modules (Manifest V3)

**Style**:
- JSDoc comments for functions
- Descriptive variable names
- Error handling in async functions

### ESLint Configuration

**Setup** (TODO):
```bash
cd popup
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npx eslint --init
```

**Run Linting**:
```bash
npm run lint
```

---

## Common Development Tasks

### Adding a New UI Component

**Example**: Add a theme toggle button

```bash
# 1. Create component
vim popup/src/components/ThemeToggle.tsx
```

```typescript
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Moon /> : <Sun />}
    </Button>
  );
}
```

```bash
# 2. Import in App.tsx
# Add: import { ThemeToggle } from "./components/ThemeToggle";

# 3. Rebuild
npm run build

# 4. Reload extension
```

### Adding a New Message Type

**Example**: Add "PAUSE_CRAWL" message

**Step 1: Update service-worker.js**
```javascript
case 'PAUSE_CRAWL':
  await handlePauseCrawl(event);
  break;

async function handlePauseCrawl(event) {
  const crawl = getActiveCrawl();
  if (crawl) {
    crawl.pause();
    sendResponse(event, { status: 'paused' });
  } else {
    sendResponse(event, { error: 'No active crawl' });
  }
}
```

**Step 2: Update service-worker-client.ts**
```typescript
type MessageType =
  | 'START_CRAWL'
  | 'PAUSE_CRAWL'  // Add this
  | ...

async pauseCrawl() {
  return sendMessage('PAUSE_CRAWL');
}
```

**Step 3: Use in UI**
```typescript
// In CrawlTab.tsx
const handlePause = async () => {
  await crawlerAPI.pauseCrawl();
};
```

**Step 4: Rebuild and test**
```bash
cd popup && npm run build
# Reload extension
```

### Adding a New Storage Function

**Example**: Get pages by status

**Edit**: `storage/db.js`

```javascript
export async function getPagesByStatus(status) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAGES_STORE], 'readonly');
    const store = transaction.objectStore(PAGES_STORE);
    const index = store.index('status');  // Use existing index
    const request = index.getAll(status);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**Usage**:
```javascript
const failedPages = await getPagesByStatus('failed');
console.log(`${failedPages.length} pages failed`);
```

### Modifying Extraction Logic

**Example**: Add support for `<dl>` definition lists

**Edit**: `lib/extractor-simple.js`

```javascript
// In convertToMarkdown function, add:

// Definition lists
markdown = markdown.replace(/<dt[^>]*>(.*?)<\/dt>/gi, '\n**$1**  ');
markdown = markdown.replace(/<dd[^>]*>(.*?)<\/dd>/gi, '\n$1\n');
markdown = markdown.replace(/<\/?dl[^>]*>/gi, '\n');
```

**Test**:
```bash
# 1. Reload extension (no build needed for JS files)
# 2. Start a crawl on a site with <dl> tags
# 3. Check extracted markdown
```

---

## Debugging Tips

### Popup Not Loading

**Symptoms**: Blank popup or tiny square

**Checks**:
```bash
# 1. Verify popup-dist exists
ls -la popup-dist/

# 2. Verify index.html has relative paths
cat popup-dist/index.html
# Should see: <script src="./assets/popup.js">
# Not: <script src="/assets/popup.js">

# 3. Check for build errors
cd popup && npm run build
```

**Fix**:
- Ensure `base: './'` in vite.config.ts
- Rebuild: `npm run build`
- Reload extension

### Service Worker Errors

**Symptoms**: Crawl doesn't start, no logs

**Checks**:
```
1. chrome://extensions/
2. Check for "Errors" button (red)
3. Click to see error details
4. Click "service worker" link
5. Check if it says "inactive" (terminated)
```

**Common Errors**:
```
// Error: Cannot find module
// Fix: Check import paths use .js extension

// Error: DOMParser is not defined
// Fix: Use regex-based parsing instead

// Error: window is not defined
// Fix: Remove DOM API usage from service worker context
```

### Build Failures

**TypeScript Errors**:
```bash
# View detailed errors
cd popup
npm run build

# Common fixes:
# - Add missing types
# - Remove unused imports
# - Fix strict null checks
```

**Vite Errors**:
```bash
# Clear cache and rebuild
rm -rf popup/node_modules/.vite
npm run build
```

### Storage Issues

**Pages Not Saving**:
```
1. Open popup DevTools
2. Application → IndexedDB → DocumentationCrawlerDB
3. Check if stores exist (jobs, pages)
4. Manually add a record to test
5. Check service worker console for storage errors
```

**Database Corruption**:
```javascript
// Clear all data (nuclear option)
indexedDB.deleteDatabase('DocumentationCrawlerDB');
// Reload extension
```

---

## Performance Profiling

### Crawl Speed

**Measure**:
```javascript
// In crawler.js
const startTime = Date.now();

// ... crawl happens ...

const duration = (Date.now() - startTime) / 1000;
console.log(`Crawled ${pages} pages in ${duration}s`);
console.log(`Rate: ${(pages / duration).toFixed(2)} pages/sec`);
```

**Expected**:
- ~2 pages/second (rate-limited)
- 100 pages = ~50 seconds
- Network latency affects actual speed

### Memory Usage

**Monitor in Chrome**:
```
1. chrome://extensions/
2. Click "service worker" link
3. DevTools → Memory tab
4. Take heap snapshot
5. Look for large objects
```

**Expected**:
- Active crawl: 1-2 MB (queue + metadata)
- Should not grow unboundedly
- Memory released after crawl completes

### Storage Size

**Check Usage**:
```javascript
// In popup console
const size = await navigator.storage.estimate();
console.log(`Using ${(size.usage / 1024 / 1024).toFixed(2)} MB`);
```

**Breakdown**:
- 100-page site: ~1-2 MB
- 500-page site: ~5-10 MB
- Jobs metadata: ~10-50 KB total

---

## Summary

**Key Commands**:
```bash
# Install dependencies
cd popup && npm install

# Development mode (HMR)
npm run dev

# Production build
npm run build

# Lint (future)
npm run lint
```

**Development Loop**:
1. Make changes to code
2. Rebuild if popup changed: `npm run build`
3. Reload extension: chrome://extensions/ → 🔄
4. Test in popup and service worker console
5. Repeat

**Debugging Checklist**:
- ✅ Check popup DevTools console
- ✅ Check service worker console
- ✅ Inspect IndexedDB data
- ✅ Verify build output
- ✅ Test with small site first

For testing procedures, see [TESTING.md](./TESTING.md).
