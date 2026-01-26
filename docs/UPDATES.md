# Extension Updates and Cache Management

## Table of Contents

- [Extension Updates and Cache Management](#extension-updates-and-cache-management)
  - [Problem: Code Changes Not Loading](#problem-code-changes-not-loading)
  - [Solution 1: Version Tracking (Automatic)](#solution-1-version-tracking-automatic)
    - [What We Implemented](#what-we-implemented)
    - [How It Works](#how-it-works)
    - [Benefits](#benefits)
  - [Solution 2: Manual Update Verification](#solution-2-manual-update-verification)
    - [Check Current Versions](#check-current-versions)
    - [Force Service Worker Restart (Development)](#force-service-worker-restart-development)
  - [Solution 3: Production Updates](#solution-3-production-updates)
    - [Chrome Web Store Auto-Updates](#chrome-web-store-auto-updates)
    - [Verifying Users Have Latest Version](#verifying-users-have-latest-version)
  - [Development Workflow](#development-workflow)
    - [Making Code Changes](#making-code-changes)
    - [Troubleshooting: "My changes aren't loading!"](#troubleshooting-my-changes-arent-loading)
  - [Cache Busting Checklist](#cache-busting-checklist)
  - [Why This Matters](#why-this-matters)
    - [Development Impact](#development-impact)
    - [Production Impact](#production-impact)
  - [Advanced: Module Import Caching](#advanced-module-import-caching)
  - [Quick Reference](#quick-reference)
    - [Verify Current Version](#verify-current-version)
    - [Force Update (Development)](#force-update-development)
    - [Check if Update Applied](#check-if-update-applied)
    - [Version Source of Truth](#version-source-of-truth)
  - [For Production Users](#for-production-users)
    - [Checking for Updates](#checking-for-updates)
    - [Force Extension Update](#force-extension-update)
  - [Summary](#summary)

---

## Problem: Code Changes Not Loading

Chrome extensions use aggressive caching for Service Workers and modules. This can cause issues where:
- **Development**: Code changes don't apply even after clicking "Reload"
- **Production**: Users on old versions don't get updates automatically

---

## Solution 1: Version Tracking (Automatic)

### What We Implemented

**Service Worker Version Tracking** (`service-worker.js`):
- `SERVICE_WORKER_VERSION` constant tracks current version
- `skipWaiting()` immediately activates new service worker (no waiting for tabs to close)
- `clients.claim()` takes control of all tabs immediately
- Version stored in `chrome.storage.local` for comparison
- Logs version updates to console

**Module Version Logging** (`lib/tab-fetcher.js`):
- `TAB_FETCHER_VERSION` constant for module tracking
- Logs module version on load for verification

### How It Works

```javascript
// service-worker.js
const SERVICE_WORKER_VERSION = '2.13.0';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Don't wait for old worker to stop
  // Store new version...
});

self.addEventListener('activate', (event) => {
  self.clients.claim(); // Take control immediately
  // Compare versions and log update...
});
```

### Benefits

✅ **Development**: Service worker restarts immediately on reload
✅ **Production**: Chrome Web Store updates apply without user action
✅ **Debugging**: Console logs show version transitions
✅ **Verification**: Can confirm which version is running

---

## Solution 2: Manual Update Verification

### Check Current Versions

**1. Open Service Worker Console:**
```
chrome://extensions/ → Content Crawler → Click "service worker"
```

**2. Look for version logs:**
```
🚀 Service worker v2.13.0 started
🚀 [TabFetcher] Loading tab-fetcher.js v2.13.0 (with structural loss detection)
```

**3. Check for update logs:**
```
[ServiceWorker] Updated from v2.12.0 to v2.13.0
```

### Force Service Worker Restart (Development)

If changes still aren't loading, try these escalating steps:

**Option A: Reload Extension** (fastest)
```
chrome://extensions/ → Click reload icon ↻
```

**Option B: Restart Service Worker** (more thorough)
```
1. chrome://extensions/ → Click "service worker"
2. In console, run: chrome.runtime.reload()
3. Or close console and click "service worker" again
```

**Option C: Remove and Reinstall** (nuclear option)
```
1. chrome://extensions/ → Remove extension
2. Close all Chrome windows with extension tabs
3. Reopen Chrome
4. chrome://extensions/ → Load unpacked
```

---

## Solution 3: Production Updates

### Chrome Web Store Auto-Updates

**How it works:**
- Chrome checks for updates every ~5 hours
- Updates download in background
- Applied when browser restarts OR extension reloads
- With `skipWaiting()` + `claim()`: applies immediately

**User timeline:**
```
Day 0: You publish v2.13.0 to Chrome Web Store
Day 0-1: Chrome reviews and approves update
Day 1: Update available in store
Day 1 (0-5 hours later): User's Chrome checks for updates
Day 1: Update downloads in background
Day 1: skipWaiting() + claim() apply update immediately
```

**No user action required** ✅

### Verifying Users Have Latest Version

Users can check their version:

**Method 1: About Dialog**
```
1. Click extension icon
2. Click ⋮ menu (top right)
3. Check version number at bottom
```

**Method 2: Extension Page**
```
chrome://extensions/ → Find "Content Crawler" → Check version
```

**Method 3: Service Worker Console**
```
chrome://extensions/ → Click "service worker" → Check startup log
```

---

## Development Workflow

### Making Code Changes

**1. Edit code** (any .js file):
```bash
# Edit lib/tab-fetcher.js, service-worker.js, etc.
```

**2. Increment version** (if significant change):
```javascript
// service-worker.js
const SERVICE_WORKER_VERSION = '2.14.0'; // Increment

// lib/tab-fetcher.js (if changed)
const TAB_FETCHER_VERSION = '2.14.0'; // Keep in sync
```

**3. If you changed popup UI** (React/TypeScript):
```bash
cd popup
npm run build
```

**4. Reload extension:**
```
chrome://extensions/ → Click reload ↻
```

**5. Verify versions in Service Worker console:**
```
🚀 Service worker v2.14.0 started
🚀 [TabFetcher] Loading tab-fetcher.js v2.14.0
[ServiceWorker] Updated from v2.13.0 to v2.14.0
```

### Troubleshooting: "My changes aren't loading!"

**Check 1: Are you editing the right file?**
```bash
# Verify your changes are saved
grep -n "YOUR_CHANGE" path/to/file.js
```

**Check 2: Did you rebuild the popup?** (if you edited React/TypeScript)
```bash
cd popup && npm run build
```

**Check 3: Is the Service Worker using the new code?**
```
chrome://extensions/ → "service worker" → Check version logs
```

**Check 4: Hard reset Service Worker:**
```
1. chrome://extensions/ → Remove extension
2. Close Service Worker console
3. chrome://extensions/ → Load unpacked
4. Check logs again
```

**Check 5: Are there JavaScript errors?**
```
Open Service Worker console and look for red errors
```

---

## Cache Busting Checklist

When releasing updates, follow this checklist:

- [ ] Increment `SERVICE_WORKER_VERSION` in `service-worker.js`
- [ ] Increment module versions (e.g., `TAB_FETCHER_VERSION`) if changed
- [ ] Update `manifest.json` version (required for Chrome Web Store)
- [ ] Rebuild popup if React/TypeScript changed: `cd popup && npm run build`
- [ ] Test locally: Remove + reinstall extension
- [ ] Verify version logs in Service Worker console
- [ ] Test that old → new version transition works
- [ ] Commit with version bump message
- [ ] Tag release: `git tag v2.13.0`

---

## Why This Matters

### Development Impact

**Before (problems):**
- ❌ Code changes not loading after reload
- ❌ Need to remove/reinstall extension constantly
- ❌ Confusion about which version is running
- ❌ Wasted time debugging "cached" old code

**After (with version tracking):**
- ✅ Immediate updates with `skipWaiting()` + `claim()`
- ✅ Clear version logs in console
- ✅ Can verify exact code version running
- ✅ Faster development iteration

### Production Impact

**Before (problems):**
- ❌ Users stuck on old versions for hours/days
- ❌ No way to confirm user has latest fix
- ❌ Bug reports for already-fixed issues

**After (with version tracking):**
- ✅ Updates apply within 5 hours automatically
- ✅ Version displayed in UI (About dialog)
- ✅ Can ask users "What version do you have?"
- ✅ Logs show version transitions

---

## Advanced: Module Import Caching

Chrome also caches ES module imports. To ensure modules reload:

**1. Service Worker imports are cached by Chrome**
```javascript
import { startCrawl } from './lib/crawler.js'; // Cached!
```

**2. Dynamic imports bypass cache** (use sparingly)
```javascript
const { startCrawl } = await import(`./lib/crawler.js?v=${Date.now()}`);
```

**3. Our solution: skipWaiting() + version tracking**
- Forces Service Worker restart
- New worker re-imports all modules
- Version logs confirm new code loaded

---

## Quick Reference

### Verify Current Version

**Service Worker Console:**
```
chrome://extensions/ → "service worker" → Check first log line
Expected: 🚀 Service worker v2.13.0 started
```

### Force Update (Development)

**1-liner in Service Worker console:**
```javascript
chrome.runtime.reload()
```

### Check if Update Applied

**After reload, look for:**
```
[ServiceWorker] Updated from vX.X.X to vY.Y.Y
```

### Version Source of Truth

- `service-worker.js` line 11: `SERVICE_WORKER_VERSION`
- `lib/tab-fetcher.js` line 10: `TAB_FETCHER_VERSION`
- `manifest.json` line 4: `"version"`

Keep these in sync for releases.

---

## For Production Users

### Checking for Updates

**Chrome automatically checks for updates every ~5 hours.**

To manually check:
```
1. chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Update" button (top left)
```

### Force Extension Update

```
1. chrome://extensions/
2. Find "Content Crawler"
3. Click "Remove"
4. Visit Chrome Web Store
5. Click "Add to Chrome" (gets latest version)
```

---

## Summary

| Scenario | Solution | User Action |
|----------|----------|-------------|
| Development: Changes not loading | `skipWaiting()` + version logs | Reload extension, check console |
| Production: Updates not applying | Auto-updates + `claim()` | None (automatic) |
| Debugging: Which version running? | Version logs in console | Check Service Worker console |
| Emergency: Force fresh install | Remove + reinstall | Remove → Load unpacked |

**Key insight**: The combination of `skipWaiting()`, `clients.claim()`, and version tracking ensures updates apply immediately in both development and production.
