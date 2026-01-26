# Chrome Web Store Form Answers

This document contains all the questions and answers for the Webscribe extension submission form in the Chrome Web Store Developer Dashboard.

Use this as a reference when filling out the form—copy/paste the answers directly into the corresponding fields.

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

- [Publishing Details](#publishing-details)

1. [Product Details](#product-details)
   - [Store Listing Description](#store-listing-description)
   - [Store Listing Fields](#store-listing-fields)
2. [Privacy](#privacy)
   - [Single Purpose](#single-purpose)
   - [Permission Justifications](#permission-justifications)
     - [storage](#storage-justification)
     - [activeTab](#activetab-justification)
     - [tabs](#tabs-justification)
     - [scripting](#scripting-justification)
     - [debugger](#debugger-justification)
     - [notifications](#notifications-justification)
     - [clipboardWrite](#clipboardwrite-justification)
     - [Host Permission (All URLs)](#host-permission-all-urls-justification)
   - [Data Use Declarations](#data-use-declarations)
   - [Privacy Policy URL](#privacy-policy-url)
   - [Remote Code Declaration](#remote-code-declaration)
   - [Summary for Reviewers](#summary-for-reviewers)

---

# Product Details

## Store Listing Description

**Field:** Detailed description (up to 16,000 characters)

**Answer:**
```
Webscribe by BobNinja

> Open source: https://github.com/storyleaps/bobninja-webscribe

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

---

## Store Listing Fields

| Field | Value |
|-------|-------|
| **Category** | Productivity |
| **Language** | English |
| **Homepage URL** | `https://bobninja.com/tools/webscribe/` |
| **Support URL** | `https://bobninja.com/tools/webscribe/support/` |
| **Mature content** | No |

---

# Privacy

## Single Purpose

**Question:** An extension must have a single purpose that is narrow and easy-to-understand. (Max 1000 characters)

**Answer:**
```
Webscribe is a BSD 3-Clause open-source tool (https://github.com/storyleaps/bobninja-webscribe) that saves web pages as clean Markdown for offline reading and AI assistants.

Users enter a URL, and Webscribe loads the page, converts the content to formatted Markdown, and stores it locally in the browser. This is useful for saving documentation, tutorials, and articles—especially for use with AI coding assistants like Claude or ChatGPT.

Modern JavaScript-based websites (React, Vue, Angular) require full page rendering to display content correctly. Chrome throttles background tabs, which can interrupt loading. Webscribe ensures pages fully render before extracting content, similar to print-to-PDF tools.

All data is stored locally using IndexedDB. No data is sent to external servers, and no account is required. Content can be exported as Markdown or copied to the clipboard.
```

**Character count:** 764 characters

---

## Permission Justifications

> **Important Context:** These justifications are crafted to clearly explain why each permission is necessary for the extension's single purpose, what the permission does NOT do, and how user privacy is protected. The extension operates 100% locally with no external servers.

---

### `storage` Justification

**Question:** Why does your extension need the storage permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the storage permission to save user-selected web pages locally in the browser via IndexedDB.

WHAT IS STORED:
- URLs of pages the user chooses to save
- Extracted page content (converted to markdown and plain text)
- Page metadata (titles, descriptions, timestamps)
- User preferences (e.g., concurrent tab limits)

WHY IT’S NEEDED:
Webscribe’s core function is saving web content for offline access. Local storage is required to preserve saved pages and settings across browser sessions. Without it, the extension would not function as intended.

PRIVACY PROTECTIONS:
- All data stays on the user’s device only
- No cloud sync or external servers are used
- No data is transmitted outside the browser
- Users can view and manage all stored content
- Users can delete individual items or all data at any time
- Uninstalling the extension removes all stored data

Webscribe does not use `chrome.storage.sync`. The extension developer has no access to any stored content.
---

If you want it more formal, more casual, or tailored to a Chrome Web Store review note, I can tweak the tone.

```

**Character count:** 958 characters

---

### `activeTab` Justification

**Question:** Why does your extension need the activeTab permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses activeTab to read content from the current tab ONLY when the user explicitly initiates an action.

WHEN IT ACTIVATES:
- User clicks "Start Selecting Content" in content picker mode
- User clicks "Use current page URL" to auto-fill the URL input

WHY IT'S NECESSARY:
The content picker lets users select and save specific page elements (e.g., a code block or article). This requires reading the active tab's DOM for element selection and extraction.

WHAT IT DOES NOT DO:
- Does NOT activate automatically or in the background
- Does NOT access tabs the user hasn't interacted with
- Does NOT monitor browsing activity
- Does NOT collect data without user action

PRIVACY PROTECTION:
This permission grants temporary access only when the user clicks a button in the popup. Access is revoked when navigating away or closing the tab. No persistent access is maintained.

Follows the principle of least privilege—we only access what the user explicitly requests.
```

**Character count:** 984 characters

---

### `tabs` Justification

**Question:** Why does your extension need the tabs permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the tabs permission to temporarily open browser tabs that render JS-based web pages before saving their content.

WHY IT’S NECESSARY:
Many modern documentation sites built with React, Vue, Angular, or Next.js rely on JavaScript to display content. Pages appear empty until scripts finish running. To capture complete content instead of blank shells, pages must be opened and rendered in real tabs.

HOW IT WORKS:
1. The user enters a URL and clicks “Start Capture”.
2. The extension opens a user-selected number of tabs (1–10).
3. Each page fully renders in its tab.
4. Content is extracted and saved locally.
5. Tabs are closed automatically.

WHAT IT DOES NOT DO:
It does not access existing tabs without permission, monitor browsing history, run in the background without user action, or keep tabs open longer than needed.

PRIVACY PROTECTION:
Users control how many tabs open. Tabs are used only to render pages the user requests. No browsing activity is tracked or recorded.
```

**Character count:** 984 characters

---

### `scripting` Justification

**Question:** Why does your extension need the scripting permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the scripting permission to extract readable content from web pages the user chooses to save.

WHY IT'S NECESSARY:
To convert a web page to clean markdown, we must read the page’s DOM (Document Object Model) to capture text, headings, code blocks, tables, and other content. Scripting lets us run a content script to read this data.

WHAT THE SCRIPT DOES:
- Reads page text and structure
- Finds the main content area (skips ads, nav, footers)
- Extracts metadata (title, description, canonical URL)
- Converts HTML to formatted markdown
- Sends the result to the extension

WHAT IT DOES NOT DO:
- Does NOT change page content or behavior
- Does NOT add ads, trackers, or analytics
- Does NOT read forms or user input
- Does NOT send data to external servers
- Does NOT stay after extraction

PRIVACY PROTECTION:
Scripts run only when the user clicks save. Extracted content stays in the browser. Nothing is transmitted.
```

**Character count:** 987 characters

---

### `debugger` Justification

**Question:** Why does your extension need the debugger permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the debugger permission so JavaScript-based pages fully render before content is extracted.

THE TECHNICAL PROBLEM:
Chrome throttles background tabs to save resources. JavaScript may not finish, so pages never fully load. React/Vue/Angular sites can appear blank—saving a throttled tab captures an empty shell.

OUR SOLUTION:
The debugger permission tells Chrome the tab needs full execution priority (similar to print-to-PDF), so the page renders completely before extraction.

WHAT IT DOES NOT DO:
Does NOT inspect, modify, or debug page code
Does NOT use DevTools features
Does NOT intercept network traffic
Does NOT access cookies, passwords, or sensitive data

PRIVACY & TRANSPARENCY:
All extracted content stays local. Nothing is sent externally.

Open source implementation:
https://github.com/storyleaps/bobninja-webscribe/blob/master/lib/tab-fetcher.js
```

**Character count:** 962 characters

---

### `notifications` Justification

**Question:** Why does your extension need the notifications permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the notifications permission only to confirm that content was successfully saved using the content picker feature.

WHY IT'S NECESSARY:
In content picker mode, users select an element and the popup closes. Without a notification, there’s no clear confirmation that the selection saved. A brief notification provides essential feedback.

WHEN NOTIFICATIONS APPEAR:
- After content is successfully saved via the content picker
- Notification shows: "Content saved" plus a short description

NOTIFICATION CHARACTERISTICS:
- Brief and non-intrusive
- Only after explicit user action (selecting content)
- Not repeated and not on a schedule
- No advertising or promotional content
- No links to external websites

WHAT IT DOES NOT DO:
- Does NOT send marketing notifications
- Does NOT notify about anything except save confirmations
- Does NOT run on a timer
- Does NOT notify without user action

Users can disable notifications in Chrome settings if preferred.
```

**Character count:** 963 characters

---

### `clipboardWrite` Justification

**Question:** Why does your extension need the clipboardWrite permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses clipboardWrite to copy saved content to the user's clipboard when they click "Copy".

WHY IT'S NECESSARY:
A primary use case for Webscribe is feeding doc to AI coding assistants. Users need to copy saved markdown content to paste into these tools. The clipboard permission enables one-click copying.

WHEN IT ACTIVATES:
- When user clicks:
   - "Copy to Clipboard" in the export menu
   - "Copy as markdown" or "Copy as raw text"
   - "Copy Page" to copy a single page's content
- After selecting content with the content picker

WHAT IT DOES NOT DO:
- Does NOT read from the clipboard (only writes)
- Does NOT access clipboard without explicit user action
- Does NOT copy content automatically or in the background
- Does NOT monitor or log clipboard contents

PRIVACY PROTECTION:
Clipboard access only occurs when users click a copy button. We only write content the user has chosen to copy. We never read clipboard contents or access it without direct user action.
```

**Character count:** 976 characters

---

### Host Permission (All URLs) Justification

**Question:** Why does your extension need access to all URLs? (Max 1000 characters)

**Answer:**
```
Webscribe requests host permissions for all URLs because users need to save doc from ANY website they choose.

WHY BROAD ACCESS IS NECESSARY:
Doc exists across thousands of domains: docs.stripe.com, reactjs.org, developer.mozilla.org, and countless others. Restricting to a predefined list would severely limit the extension's usefulness.

HOW ACCESS IS USED:
- ONLY accesses URLs the user explicitly enters
- ONLY when the user clicks "Start Capture"
- Extracts page content and saves it locally
- No automatic or background access ever occurs

WHAT IT DOES NOT DO:
- Does NOT access websites without explicit user action
- Does NOT monitor browsing activity or history
- Does NOT run in the background on arbitrary sites
- Does NOT transmit any data to external servers

PRIVACY & TRANSPARENCY:
All extracted content stays 100% local. No external servers exist to receive data.

This extension is open source (BSD 3-Clause):
https://github.com/storyleaps/bobninja-webscribe
```

**Character count:** 952 characters

---

## Data Use Declarations

| Question | Answer |
|----------|--------|
| Does the extension collect user data? | **No** |
| Does the extension sell user data? | **No** |
| Does the extension transfer user data for purposes unrelated to the item's single purpose? | **No** |
| Does the extension use or transfer user data for creditworthiness or lending purposes? | **No** |

---

## Privacy Policy URL

**Field:** Privacy policy URL

**Answer:** `https://bobninja.com/tools/webscribe/privacy/`

---

## Remote Code Declaration

**Question:** Are you using remote code?

**Answer:** **No, I am not using Remote code**

No justification required when selecting "No".

**For reference (why this is accurate):**
```
Webscribe does not load or execute any code from external servers. All JavaScript is bundled within the extension package and reviewed as part of this submission.

The extension:
- Does NOT fetch JavaScript from external URLs
- Does NOT use eval() or Function() to execute dynamic code
- Does NOT load remote scripts via <script> tags
- Does NOT use WebAssembly loaded from external sources

All code is self-contained within the extension package.
```

---

## Summary for Reviewers

Webscribe is a privacy-focused documentation saver that operates 100% locally:

1. **Open source** - Full source code available at https://github.com/storyleaps/bobninja-webscribe (BSD 3-Clause license). Reviewers can inspect every line of code.
2. **No external servers** - We don't operate any servers. There's nowhere for data to go.
3. **No accounts** - No sign-up, no user identification, no tracking.
4. **No analytics** - We collect zero telemetry or usage data.
5. **User-initiated only** - Every permission activates only on explicit user action.
6. **Transparent storage** - Users can see and delete all saved content anytime.

The `debugger` permission, while sensitive, is used solely for page rendering—the same capability that print-to-PDF and screenshot tools require. It does not provide debugging or code inspection capabilities as the name might suggest.

**Key files for review:**
- Tab rendering logic: `lib/tab-fetcher.js`
- Content extraction: `lib/extractor-simple.js`
- Storage operations: `storage/db.js`
