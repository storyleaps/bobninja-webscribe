# Release Management

This document explains how to create releases for the Documentation Crawler Chrome Extension.

## Table of Contents

- [Release Management](#release-management)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [What the Script Does](#what-the-script-does)
  - [Custom Version Format](#custom-version-format)
  - [The Commit Hash Challenge](#the-commit-hash-challenge)
  - [Version Checker Script](#version-checker-script)
  - [After Running the Script](#after-running-the-script)
    - [1. Review the Commits](#1-review-the-commits)
    - [2. Verify the Version File](#2-verify-the-version-file)
    - [3. Update the Changelog](#3-update-the-changelog)
    - [4. Build the Extension](#4-build-the-extension)
    - [5. Package the Extension](#5-package-the-extension)
    - [6. Commit the Changelog](#6-commit-the-changelog)
    - [7. Push to Remote](#7-push-to-remote)
    - [8. (Optional) Create GitHub Release](#8-optional-create-github-release)
  - [Files Updated During Release](#files-updated-during-release)
  - [Using the Version in Popup UI](#using-the-version-in-popup-ui)

---

## Quick Start

To create a new release:

```bash
# 1. Bump version
node rls.js <version>

# 2. Update changelog (Claude Code slash command)
/changelog

# 3. Build the popup
cd popup && npm run build && cd ..

# 4. Package for Chrome Web Store
node pkg.js

# 5. Commit changelog
git add CHANGELOG.md && git commit -m "docs: update CHANGELOG.md"

# 6. Push to remote
git push && git push --tags

# 7. (Optional) Push to GitHub Releases
node push-release.js "Release notes here"
```

Example:
```bash
node rls.js 2.2.0
/changelog
cd popup && npm run build && cd ..
node pkg.js
git add CHANGELOG.md && git commit -m "docs: update CHANGELOG.md"
git push && git push --tags
node push-release.js "Add new feature X"
```

## What the Script Does

The `rls.js` script automates the entire release process:

1. **Validates version format** - Ensures the version follows semver (x.x.x)
2. **Updates version files** - Updates `manifest.json` and `popup/package.json`
3. **Creates version bump commit** - Commits manifest.json and package.json
4. **Gets commit hash** - Retrieves the hash of the version bump commit
5. **Generates version file** - Creates `popup/src/version.ts` with the correct commit hash
6. **Commits version file** - Creates a separate commit for version.ts
7. **Tags the release** - Creates a git tag (e.g., `v2.2.0`)

## Custom Version Format

The script generates a custom version with the format: `<version>.<yymmdd>.<git-sha>`

**Example:** `2.2.0.251121.a1b2c3d`

Where:
- `2.2.0` - Semantic version from manifest.json
- `251121` - Build timestamp (November 21, 2025)
- `a1b2c3d` - Git commit SHA (7 characters)

This custom version is stored in `popup/src/version.ts` and can be imported in the React app:

```typescript
import { VERSION, PACKAGE_VERSION, GIT_SHA } from './version';

console.log(VERSION);          // "2.2.0.251121.a1b2c3d"
console.log(PACKAGE_VERSION);  // "2.2.0"
console.log(GIT_SHA);          // "a1b2c3d"
```

## The Commit Hash Challenge

The script solves the "chicken-and-egg" problem of including a commit hash in the version file:

**The Problem:** If you include version.ts in the version bump commit, then amend it with the correct hash, the hash changes when you amend, making the hash in the file incorrect!

**The Solution:** The script creates two separate commits:

1. **Version bump commit** - Commits manifest.json and package.json with the new version
2. **Get commit hash** - Retrieves the hash of the version bump commit (this is the important hash)
3. **Generate version.ts** - Creates the version file with the correct commit hash
4. **Version file commit** - Commits version.ts in a separate commit

This way, `version.ts` contains the hash of the version bump commit (e.g., `a1b2c3d`), not its own commit hash. This is the hash you want to reference in your version string.

## Version Checker Script

To quickly check the current version:

```bash
node v.js
```

Output:
```
2.1.0
```

## After Running the Script

The script will output next steps:

```bash
📌 Next steps:
  1. Review commits: git log -2 --oneline
  2. Verify version file: cat popup/src/version.ts
  3. Update changelog: /changelog (Claude Code slash command)
  4. Build the extension: cd popup && npm run build
  5. Package extension: node pkg.js
  6. Commit changelog: git add CHANGELOG.md && git commit -m "docs: update CHANGELOG.md"
  7. Push to remote: git push && git push --tags
  8. (Optional) GitHub Release: node push-release.js "Release notes"
```

### 1. Review the Commits

```bash
git log -2 --oneline
```

You should see two commits:
- Version bump commit (manifest.json and package.json)
- Version file commit (popup/src/version.ts)

### 2. Verify the Version File

```bash
cat popup/src/version.ts
```

Check that:
- The `VERSION` contains the correct format (e.g., `2.2.0.251121.a1b2c3d`)
- The `GIT_SHA` matches the hash of the version bump commit (the first of the two commits)

### 3. Update the Changelog

Use the Claude Code `/changelog` slash command to automatically generate a changelog entry:

```bash
# In Claude Code, run:
/changelog
```

The `/changelog` command:
- Reads the current version from `manifest.json`
- Analyzes recent changes from the conversation context
- Adds a new entry to `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com) format
- Categorizes changes under Added, Changed, Fixed, Removed, etc.

### 4. Build the Extension

```bash
cd popup && npm run build && cd ..
```

This builds the React popup UI with the new version information.

### 5. Package the Extension

```bash
node pkg.js
```

This creates `out/webscribe-extension.zip` for Chrome Web Store upload.

### 6. Commit the Changelog

```bash
git add CHANGELOG.md && git commit -m "docs: update CHANGELOG.md"
```

This commits the changelog changes generated in step 3.

### 7. Push to Remote

```bash
git push && git push --tags
```

This pushes all commits (version bump, version file, and changelog) and the version tag to the remote repository.

**Important:** This step must be completed before creating a GitHub Release (step 8), because the release is associated with the git tag. If the tag doesn't exist on the remote, the release creation will fail.

### 8. (Optional) Create GitHub Release

To store the build artifact on GitHub Releases for version history and easy rollback:

```bash
node push-release.js "Release notes or changelog here"
```

**Note:** This command requires the version tag to exist on the remote repository. Always run `git push --tags` (step 7) before this step, otherwise the release will fail with a "tag not found" error.

This creates a GitHub Release with the ZIP artifact attached, making it easy to:
- Download and deploy any previous version
- Track deployment history
- Roll back without rebuilding from source
- Audit what was submitted to Chrome Web Store

## Files Updated During Release

- `manifest.json` - Chrome extension version (committed by `rls.js` in first commit)
- `popup/package.json` - Popup app version (committed by `rls.js` in first commit)
- `popup/src/version.ts` - Generated version metadata (committed by `rls.js` in second commit)
- `CHANGELOG.md` - Release notes (updated via `/changelog` command, committed manually)

## Using the Version in Popup UI

To display the version in the popup UI, import the version constants:

```typescript
import { VERSION } from './version';

function App() {
  return (
    <div>
      <h1>Documentation Crawler</h1>
      <p>Version: {VERSION}</p>
    </div>
  );
}
```
