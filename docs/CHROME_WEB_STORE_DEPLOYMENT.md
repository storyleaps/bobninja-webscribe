# Chrome Web Store Deployment Guide

This guide covers how to deploy Webscribe to the Chrome Web Store.

## Publishing Details

| Field | Value |
|-------|-------|
| Extension ID | `ldephafjgplbfbaimdboekjcoceihkmj` |
| Store URL | https://chromewebstore.google.com/detail/ldephafjgplbfbaimdboekjcoceihkmj |
| Developer Dashboard | https://chrome.google.com/webstore/devconsole |
| Publishing Account | `nic@neap.co` |

Use the Developer Dashboard to check published or pending approval extensions.

---

## Table of Contents

- [Chrome Web Store Deployment Guide](#chrome-web-store-deployment-guide)
  - [Publishing Details](#publishing-details)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Deployment Workflow](#deployment-workflow)
    - [Step 1: Bump Version](#step-1-bump-version)
    - [Step 2: Update Changelog](#step-2-update-changelog)
    - [Step 3: Build the Popup](#step-3-build-the-popup)
    - [Step 4: Create ZIP Package](#step-4-create-zip-package)
    - [Step 5: Commit Changelog](#step-5-commit-changelog)
    - [Step 6: Push to Remote](#step-6-push-to-remote)
    - [Step 7: (Optional) Push to GitHub Releases](#step-7-optional-push-to-github-releases)
    - [Step 8: Upload to Chrome Web Store](#step-8-upload-to-chrome-web-store)
  - [Store Assets](#store-assets)
    - [Screenshots](#screenshots)
    - [Promotional Tiles](#promotional-tiles)
  - [Store Listing Content](#store-listing-content)
    - [Description](#description)
    - [Store Listing Fields](#store-listing-fields)
  - [Privacy Tab](#privacy-tab)
    - [Single Purpose Description](#single-purpose-description)
    - [Permission Justifications](#permission-justifications)
    - [Data Use Declarations](#data-use-declarations)
  - [URLs and Contact Info](#urls-and-contact-info)
  - [Post-Submission](#post-submission)

---

## Overview

Webscribe is published to the Chrome Web Store under the name **"Webscribe by BobNinja"**. The extension is owned by **Cloudless Consulting Pty Ltd**.

**Chrome Developer Dashboard:** https://chrome.google.com/webstore/devconsole

---

## Prerequisites

Before deploying, ensure you have:

1. **Chrome Developer Account** - $5 one-time registration fee
2. **Developer Profile Complete** - Company name, contact email, physical address
3. **Website Pages Live** - Privacy policy, support page, landing page
4. **Screenshots Ready** - Located in `docs/screenshots/`
5. **Promo Tiles Ready** - Small (440x280) and marquee (1400x560)

---

## Deployment Workflow

### Step 1: Bump Version

Before creating a new release, bump the version number:

```bash
node rls.js <version>
```

Example:
```bash
node rls.js 3.2.0
```

This command:
- Updates `manifest.json` with the new version
- Creates a version file with timestamp and git commit hash
- Creates git commits and tags

To check the current version:
```bash
node v.js
```

### Step 2: Update Changelog

After bumping the version, update the changelog using the Claude Code slash command:

```bash
# In Claude Code, run:
/changelog
```

This automatically generates a changelog entry based on the conversation context and recent changes.

### Step 3: Build the Popup

Build the popup UI before packaging:

```bash
cd popup && npm run build && cd ..
```

### Step 4: Create ZIP Package

Create the ZIP file for Chrome Web Store upload:

```bash
node pkg.js
```

This creates `out/webscribe-extension.zip` containing only the necessary files:
- `manifest.json`
- `service-worker.js`
- `popup-dist/` (built popup UI)
- `lib/` (core libraries)
- `storage/` (IndexedDB wrapper)
- `icons/`

The `out/` folder is gitignored.

### Step 5: Commit Changelog

Commit the changelog changes generated in Step 2:

```bash
git add CHANGELOG.md && git commit -m "docs: update CHANGELOG.md"
```

### Step 6: Push to Remote

Push all commits and tags to the remote repository:

```bash
git push && git push --tags
```

**Important:** This step must be completed before creating a GitHub Release (Step 7), because the release is associated with the git tag. If the tag doesn't exist on the remote, the release creation will fail.

### Step 7: (Optional) Push to GitHub Releases

Store the build artifact on GitHub for version history:

```bash
node push-release.js "Release notes or changelog here"
```

**Note:** This command requires the version tag to exist on the remote repository. Always run `git push --tags` (Step 6) before this step, otherwise the release will fail with a "tag not found" error.

This step is optional but recommended. It allows you to:
- Download and redeploy any previous version without rebuilding
- Track deployment history
- Roll back quickly in case of issues
- Audit exactly what was submitted to Chrome Web Store

### Step 8: Upload to Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"** or select your existing extension
3. Upload `out/webscribe-extension.zip`
4. Fill in all required fields (see sections below)
5. Click **"Submit for Review"**

---

## Store Assets

### Screenshots

Screenshots are stored in `docs/screenshots/` and should be uploaded in order:

| # | File | Description |
|---|------|-------------|
| 1 | `01-default.png` | Main capture view with URL input and "Start Capture" button |
| 2 | `02-content-selection.png` | Content picker mode with instructions |
| 3 | `03-jobs-list.png` | Jobs tab showing list of saved sites |
| 4 | `04-extract-options-list.png` | Export options dropdown menu |
| 5 | `05-content-capture-viewer.png` | Content viewer with format selector |

**Dimensions:** 1280x800 or 640x400 pixels (PNG or JPEG)

### Promotional Tiles

| Asset | Dimensions | Notes |
|-------|------------|-------|
| Small promo tile | 440x280 px | Displayed in search results |
| Marquee promo tile | 1400x560 px | Featured sections banner |

**Design Guidelines:**
- Use brand color `#FACC14` (yellow) as primary accent
- Dark background (`#0f172a`) for contrast
- Include "Webscribe" text and tagline
- Clean, professional aesthetic

---

## Store Listing Content

### Description

Use the following description (paste into the "Detailed description" field):

```
Webscribe by BobNinja

Save web pages as clean markdown or text for offline reading, AI assistants, and research. Webscribe reads website content and converts it to beautifully formatted markdown—perfect for feeding documentation to Claude, ChatGPT, or building your own reference library.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY FEATURES

📖 Save Any Web Page
• Convert web pages to clean markdown or plain text
• Handles modern JavaScript sites (React, Vue, Angular documentation)
• Removes ads, navigation, and clutter automatically
• Preserves code blocks, tables, and formatting

📚 Capture Entire Documentation Sites
• Enter a URL and save all linked pages automatically
• Discovers pages via sitemap.xml and internal links
• Set page limits to control scope
• Works in the background—close the popup and it keeps working

🎯 Content Picker Mode
• Click on any element to save just that section
• Perfect for grabbing specific code examples or articles
• One-click copy to clipboard

📤 Flexible Export
• Copy to clipboard (single pages or all)
• Download as .md or .txt files
• Export as ZIP archives
• View as raw text, markdown, or HTML

🔍 Search & Organize
• Search across all saved content
• Filter by URL
• Bulk select and delete
• Organized by save job

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY WEBSCRIBE CAPTURES PAGES CORRECTLY

Modern documentation sites (React, Next.js, Vue, Stripe, etc.) are built with JavaScript frameworks. The actual content only appears AFTER JavaScript runs—before that, the page is essentially empty.

Here's the problem: Chrome automatically throttles background tabs to save resources. This means JavaScript doesn't fully execute, and pages never finish loading. If you tried to save a page in a throttled tab, you'd get an empty shell instead of the actual documentation.

Webscribe solves this by ensuring each page fully renders before capturing. This is similar to how print-to-PDF or full-page screenshot tools work—they also need pages to completely load before capturing.

The result: You get the complete, fully-rendered content every time, not broken pages with missing text.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 100% LOCAL & PRIVATE

Your privacy is protected by design:

• All data stored in YOUR browser only (IndexedDB)
• No accounts or sign-up required
• No cloud storage or external servers
• No tracking, analytics, or telemetry
• No data ever leaves your device
• We cannot access your saved content—it's yours alone
• Delete everything with one click

Webscribe has no server component. There's literally nowhere for your data to go except your own browser.

Read our full privacy policy: https://bobninja.com/tools/webscribe/privacy/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERFECT FOR

• Feeding documentation to AI coding assistants (Claude, ChatGPT, Copilot)
• Building offline reference libraries
• Saving tutorials and guides for later
• Research and note-taking
• Archiving content before it disappears

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW IT WORKS

1. Enter a URL (or paste multiple URLs)
2. Click "Start Capture" and watch pages being saved
3. View, search, and export your saved content
4. Content stays in your browser until you delete it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPEN SOURCE

Webscribe is open source under the BSD 3-Clause license. You can inspect every line of code, report issues, or contribute on GitHub:

https://github.com/storyleaps/bobninja-webscribe

We believe transparency builds trust—especially for an extension that requests sensitive permissions. See exactly what the code does.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUPPORT

• Website: https://bobninja.com/tools/webscribe/
• Support: https://bobninja.com/tools/webscribe/support/
• How-to Guide: https://bobninja.com/tools/webscribe/guide/
• GitHub: https://github.com/storyleaps/bobninja-webscribe

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Made with care by BobNinja
```

### Store Listing Fields

| Field | Value |
|-------|-------|
| Category | Productivity |
| Language | English |
| Mature content | No |

---

## Privacy Tab

### Single Purpose Description

```
Webscribe saves web pages as markdown for offline reading and AI assistants. Modern JavaScript-based websites require full page rendering to display their content—Chrome throttles background tabs, preventing this. Webscribe ensures pages fully render before extracting content, similar to print-to-PDF tools. All data stays local in your browser; nothing is transmitted externally.
```

### Permission Justifications

For each permission, provide the following justifications:

| Permission | Justification |
|------------|---------------|
| `storage` | Saves page content locally in IndexedDB for offline access. All data remains on the user's device and is never transmitted to external servers. |
| `activeTab` | Reads content from the current tab when the user clicks "Save" or uses the content picker. Only activates on explicit user action. |
| `tabs` | Opens browser tabs to fully render JavaScript-based pages before saving. Users can configure how many tabs run simultaneously (1-10). |
| `scripting` | Reads page content (text, markdown, metadata) from tabs the user chooses to save. Does not modify page content or behavior. |
| `debugger` | Enables complete page rendering for JavaScript-based websites. Modern documentation sites (React, Vue, Angular) require JavaScript to display content. Background tabs are throttled by Chrome, preventing pages from loading fully. This permission ensures pages completely render before content is saved—similar to how print-to-PDF or screenshot tools work. The extension does not inspect, modify, or debug page code. This extension is open source—reviewers can inspect the implementation at https://github.com/storyleaps/bobninja-webscribe |
| `notifications` | Shows a brief confirmation when content is successfully saved using the content picker feature. |
| `clipboardWrite` | Copies saved content to the clipboard when the user clicks "Copy" buttons. Only activates on explicit user action. |
| `host_permissions (all URLs)` | Allows users to save content from any website they choose. The extension only accesses URLs that users explicitly enter—no automatic or background access occurs. |

### Data Use Declarations

Answer **"No"** to all data collection questions:
- Does the extension collect personally identifiable information? **No**
- Does the extension collect health information? **No**
- Does the extension collect financial information? **No**
- Does the extension collect authentication information? **No**
- Does the extension collect personal communications? **No**
- Does the extension collect location data? **No**
- Does the extension collect web history? **No**
- Does the extension collect user activity? **No**
- Does the extension collect website content? **No** (stored locally only)

**Remote Code Declaration:** Certify that the extension does not execute remote code.

---

## URLs and Contact Info

| Field | Value |
|-------|-------|
| Homepage URL | `https://bobninja.com/tools/webscribe/` |
| Support URL | `https://bobninja.com/tools/webscribe/support/` |
| Privacy Policy URL | `https://bobninja.com/tools/webscribe/privacy/` |
| GitHub Repository | `https://github.com/storyleaps/bobninja-webscribe` |
| Support Email | `nic@bobninja.com` |
| Developer/Company | Cloudless Consulting Pty Ltd |
| Jurisdiction | New South Wales, Australia |

---

## Post-Submission

After submitting:

1. **Review Time:** Typically 1-3 business days, but can take longer for extensions with sensitive permissions (like `debugger`)

2. **If Rejected:** Review the rejection reason carefully. Common issues:
   - Permission justifications not clear enough
   - Screenshots showing problematic terminology
   - Privacy policy not accessible

3. **If Approved:** The extension will be live on the Chrome Web Store. Monitor reviews and support requests.

4. **Updates:** For future updates, repeat the deployment workflow (bump version → build → package → upload)
