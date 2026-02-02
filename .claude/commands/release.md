Automate the full release workflow: version bump, changelog, build, package, commit, push, and GitHub release.

## Arguments

- `$ARGUMENTS` (optional): Override the version type or specific version. Examples:
  - `patch`, `minor`, `major` - Use this version type
  - `4.2.0` - Use this specific version number

## Release Workflow

### Step 1: Analyze Changes and Determine Version

Analyze the current conversation context to understand what changes were made. Classify the changes:

**Version Type Rules:**
- `major` (x.0.0) - Breaking changes, major API changes, incompatible updates
  - Keywords: "BREAKING", "breaking change", "incompatible", "major rewrite"
- `minor` (0.x.0) - New features, enhancements, backwards-compatible additions
  - Keywords: "feat:", "add", "new feature", "enhancement", "new capability"
- `patch` (0.0.x) - Bug fixes, documentation, refactoring, minor improvements
  - Keywords: "fix:", "docs:", "chore:", "refactor:", "typo", "update", "improve"

**Determine the current version** by reading `manifest.json` (the `version` field).

**Calculate the next version** based on the detected change type (or use the override if provided in `$ARGUMENTS`).

### Step 2: Ask for Confirmation

Present the user with a summary using the AskUserQuestion tool:

**Include in the question:**
- Detected change type (major/minor/patch) and why
- Current version → Proposed new version
- Brief summary of changes detected from conversation

**Options:**
1. "Yes, release as [version]" (recommended)
2. "Use patch instead"
3. "Use minor instead"
4. "Use major instead"

Wait for user confirmation before proceeding. If the user selects a different version type, recalculate the version.

### Step 3: Execute Release Steps

After confirmation, execute each step in sequence:

#### 3.1 Bump Version
```bash
node rls.js <version>
```

#### 3.2 Update Changelog
Invoke the `/changelog` skill to update CHANGELOG.md based on the conversation context.

Use the Skill tool:
```
skill: "changelog"
args: "<version>"
```

#### 3.3 Build the Popup
```bash
cd popup && npm run build && cd ..
```

#### 3.4 Package for Chrome Web Store
```bash
node pkg.js
```

#### 3.5 Commit Changelog
```bash
git add --all && git commit -m "docs: update CHANGELOG.md"
```

#### 3.6 Push to Remote
```bash
git push origin master --follow-tags
```

#### 3.7 Generate Release Notes

Based on the conversation context, generate concise release notes summarizing:
- What's new or changed
- Key improvements
- Bug fixes (if any)

Format: A brief paragraph or bullet points suitable for GitHub release description.

#### 3.8 Push to GitHub Releases
```bash
node push-release.js "<release-notes>"
```

Use the generated release notes from step 3.7.

### Step 4: Completion Summary

After all steps complete, provide a summary:
- Version released (e.g., "Released v4.2.0")
- Link to GitHub release (if available from command output)
- Reminder: "Upload to Chrome Web Store: https://chrome.google.com/webstore/devconsole"

## Important Notes

- **Always ask for confirmation** before starting the release process
- **Run steps sequentially** - each step depends on the previous one
- **If any step fails**, stop and report the error to the user
- **Do not proceed to Chrome Web Store upload** - the user will do this manually
- **Release notes** should be derived from the conversation context, not generic text
