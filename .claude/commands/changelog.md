Update or create the CHANGELOG.md file based on the current conversation.

## Arguments

- `$ARGUMENTS` (optional): The version number to use for the changelog entry (e.g., `2.21.0`). If not provided, the version will be read from project files.

## Steps to Follow

1. **Determine the version** to use:
   - If a version argument was provided (`$ARGUMENTS` is not empty), use that version
   - Otherwise, read the current version from either:
     - `manifest.json` (main extension version)
     - `popup/package.json` (popup package version)
     - Use whichever file exists or has the version

2. **Analyze the conversation** to understand what changes were made:
   - New features added
   - Bugs fixed
   - Changes to existing functionality
   - Breaking changes
   - Documentation updates
   - Other improvements

3. **Update or create CHANGELOG.md**:
   - If CHANGELOG.md doesn't exist, create it with proper format
   - Add a new entry at the top for the determined version with:
     - Version number and today's date
     - Summary of changes based on conversation context
     - Categorized changes under these sections (only include sections with actual changes):
       - **Added** - New features
       - **Changed** - Changes to existing functionality
       - **Fixed** - Bug fixes
       - **Removed** - Removed features
       - **Security** - Security fixes
   - Follow [Keep a Changelog](https://keepachangelog.com) format
   - Keep the existing CHANGELOG entries below the new one

**Important**:
- DO NOT modify any version numbers in any files
- DO NOT create any git commits
- ONLY update CHANGELOG.md
- Show the CHANGELOG entry that was added
- If no meaningful changes were made in the conversation, inform the user instead of creating an empty entry
