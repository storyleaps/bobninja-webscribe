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
Webscribe saves web pages as clean markdown for offline reading and AI assistants.

Users enter a URL, and Webscribe reads the page content, converts it to formatted markdown, and stores it locally in the browser. This is useful for saving documentation, tutorials, and articles for later use—especially for feeding to AI coding assistants like Claude or ChatGPT.

Modern websites built with JavaScript frameworks (React, Vue, Angular) require full page rendering to display their content. Chrome throttles background tabs, preventing pages from loading completely. Webscribe ensures each page fully renders before extracting content—similar to how print-to-PDF tools work.

All data is stored locally in the browser using IndexedDB. No data is transmitted to external servers. No accounts required. Users can export saved content as markdown files or copy to clipboard.
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
Webscribe uses the storage permission to save captured web page content locally in the user's browser using IndexedDB.

WHAT IT STORES:
- URLs of pages the user explicitly chooses to save
- Extracted page content (converted to markdown and plain text)
- Page metadata (titles, descriptions, timestamps)
- User preferences (e.g., number of concurrent tabs)

WHY IT'S NECESSARY:
The core purpose of Webscribe is saving web content for offline access. Without local storage, users couldn't persist their saved pages between browser sessions. This is fundamental to the extension's single purpose.

PRIVACY PROTECTION:
- All data remains exclusively on the user's device
- No data is synced to cloud services or external servers
- No data is transmitted anywhere outside the browser
- Users can view all stored content within the extension
- Users can delete individual items or all data at any time
- Uninstalling the extension removes all stored data

We do not use chrome.storage.sync—only local storage. The extension creator has no access to any stored content.
```

**Character count:** 958 characters

---

### `activeTab` Justification

**Question:** Why does your extension need the activeTab permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses activeTab to read content from the current tab ONLY when the user explicitly initiates an action.

WHEN IT ACTIVATES:
- When the user clicks "Start Selecting Content" in the content picker mode
- When the user clicks the "Use current page URL" button to auto-fill the URL input

WHY IT'S NECESSARY:
The content picker feature allows users to select and save specific elements from a web page (e.g., a code block or article section). This requires reading the DOM of the active tab to enable element selection and content extraction.

WHAT IT DOES NOT DO:
- Does NOT activate automatically or in the background
- Does NOT access tabs the user hasn't explicitly interacted with
- Does NOT monitor browsing activity
- Does NOT collect any data without user action

PRIVACY PROTECTION:
This permission only grants temporary access to the active tab when the user clicks a button in the extension popup. Access is revoked when the user navigates away or closes the tab. No persistent access is maintained.

This follows the principle of least privilege—we only access what the user explicitly requests.
```

**Character count:** 997 characters

---

### `tabs` Justification

**Question:** Why does your extension need the tabs permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the tabs permission to open browser tabs that render JavaScript-based web pages before saving their content.

WHY IT'S NECESSARY:
Modern documentation sites (React, Vue, Angular, Next.js) are built with JavaScript frameworks. The actual content only appears AFTER JavaScript executes. To save complete page content (not empty shells), we must open tabs where pages can fully render.

HOW IT WORKS:
1. User enters a URL and clicks "Start Capture"
2. Extension opens tabs (user-configurable: 1-10 concurrent tabs)
3. Each page fully renders in its tab
4. Content is extracted and saved locally
5. Tabs are closed automatically

WHAT IT DOES NOT DO:
- Does NOT access existing user tabs without permission
- Does NOT monitor or track browsing history
- Does NOT run in the background without user action
- Does NOT keep tabs open longer than needed for rendering

PRIVACY PROTECTION:
Users control how many tabs open simultaneously. All tabs are opened for the sole purpose of rendering pages the user explicitly requested. No browsing activity is monitored or recorded.
```

**Character count:** 984 characters

---

### `scripting` Justification

**Question:** Why does your extension need the scripting permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the scripting permission to extract readable content from web pages the user chooses to save.

WHY IT'S NECESSARY:
To convert a web page to clean markdown, we must read the page's DOM (Document Object Model) to extract text, headings, code blocks, tables, and other content. The scripting permission allows us to inject a content script that reads this information.

WHAT THE SCRIPT DOES:
- Reads the page's text content and structure
- Identifies the main content area (removing ads, navigation, footers)
- Extracts metadata (title, description, canonical URL)
- Converts HTML to formatted markdown
- Returns the extracted content to the extension

WHAT IT DOES NOT DO:
- Does NOT modify any page content or behavior
- Does NOT inject ads, trackers, or analytics
- Does NOT intercept form submissions or user input
- Does NOT communicate with external servers
- Does NOT persist after content extraction

PRIVACY PROTECTION:
Scripts only run on pages the user explicitly requests to save. All extracted content stays local in the browser. Nothing is transmitted externally.
```

**Character count:** 987 characters

---

### `debugger` Justification

**Question:** Why does your extension need the debugger permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the debugger permission to ensure JavaScript-based web pages fully render before extracting content.

THE TECHNICAL PROBLEM:
Chrome throttles background tabs to conserve resources. JavaScript doesn't fully execute, and pages never finish loading. Sites built with React, Vue, or Angular display nothing until JavaScript runs—saving a throttled tab captures an empty shell.

OUR SOLUTION:
The debugger permission signals Chrome that a tab needs full execution priority, similar to print-to-PDF tools. This ensures pages completely render before extraction.

WHAT IT DOES NOT DO:
- Does NOT inspect, modify, or debug any page code
- Does NOT access developer tools functionality
- Does NOT intercept network requests or responses
- Does NOT access cookies, passwords, or sensitive data

PRIVACY & TRANSPARENCY:
All extracted content stays local. No data is transmitted externally.

This extension is open source. Reviewers can inspect the implementation:
https://github.com/storyleaps/bobninja-webscribe/blob/master/lib/tab-fetcher.js
```

**Character count:** 962 characters

---

### `notifications` Justification

**Question:** Why does your extension need the notifications permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses the notifications permission to confirm when content has been successfully saved using the content picker feature.

WHY IT'S NECESSARY:
When users use the content picker mode, they select an element on a web page and the popup closes. Without notifications, users would have no confirmation that their selection was saved successfully. A brief notification provides essential feedback.

WHEN NOTIFICATIONS APPEAR:
- After successfully saving content via the content picker
- Notification shows: "Content saved" with a brief description

NOTIFICATION CHARACTERISTICS:
- Brief and non-intrusive
- Only appears after explicit user action (selecting content)
- Does not appear repeatedly or on a schedule
- Does not contain advertising or promotional content
- Does not link to external websites

WHAT IT DOES NOT DO:
- Does NOT send promotional or marketing notifications
- Does NOT notify about anything other than save confirmations
- Does NOT run on a schedule or timer
- Does NOT notify without user-initiated action

Users can disable notifications in Chrome settings if preferred.
```

**Character count:** 963 characters

---

### `clipboardWrite` Justification

**Question:** Why does your extension need the clipboardWrite permission? (Max 1000 characters)

**Answer:**
```
Webscribe uses clipboardWrite to copy saved content to the user's clipboard when they click "Copy" buttons.

WHY IT'S NECESSARY:
A primary use case for Webscribe is feeding documentation to AI coding assistants (Claude, ChatGPT, Copilot). Users need to copy saved markdown content to paste into these tools. The clipboard permission enables one-click copying.

WHEN IT ACTIVATES:
- When user clicks "Copy to Clipboard" in the export menu
- When user clicks "Copy as markdown" or "Copy as raw text"
- When user clicks "Copy Page" to copy a single page's content
- After selecting content with the content picker (auto-copies markdown)

WHAT IT DOES NOT DO:
- Does NOT read from the clipboard (only writes)
- Does NOT access clipboard without explicit user action
- Does NOT copy content automatically or in the background
- Does NOT monitor or log clipboard contents

PRIVACY PROTECTION:
Clipboard access only occurs when users explicitly click a copy button. We only write content the user has chosen to copy. We never read clipboard contents or access it without direct user action.
```

**Character count:** 976 characters

---

### Host Permission (All URLs) Justification

**Question:** Why does your extension need access to all URLs? (Max 1000 characters)

**Answer:**
```
Webscribe requests host permissions for all URLs because users need to save documentation from ANY website they choose.

WHY BROAD ACCESS IS NECESSARY:
Documentation exists across thousands of domains: docs.stripe.com, reactjs.org, developer.mozilla.org, nextjs.org, kubernetes.io, and countless others. Restricting to a predefined list would severely limit the extension's usefulness.

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
