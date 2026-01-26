# Contributing to Webscribe

Thank you for your interest in contributing to Webscribe, a Chrome extension that captures web pages as markdown. This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please be considerate in your interactions with other contributors.

## Reporting Bugs

Found a bug? Please help us by reporting it:

1. Check [existing issues](../../issues) to avoid duplicates
2. Open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs actual behavior
   - Browser version and OS
   - Screenshots if applicable

## Suggesting Features

We welcome feature suggestions:

1. Check [existing issues](../../issues) to see if it has been proposed
2. Open a new issue with the "feature request" label
3. Describe the feature and its use case
4. Explain why it would benefit users

## Development Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- npm
- Chrome browser for testing

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd extension
   ```

2. Install dependencies for the popup UI:
   ```bash
   cd popup
   npm install
   ```

3. Build the popup:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory

### Project Structure

- `/popup` - React + TypeScript + Vite + Tailwind popup UI
- `/tests` - Test files
- Core files (background.js, content scripts) - Vanilla JavaScript

## Code Style Guidelines

### Popup UI (React/TypeScript)

- Use TypeScript strict mode
- Follow React best practices and hooks patterns
- Use Tailwind CSS for styling
- Keep components small and focused

### Core Logic (Vanilla JavaScript)

- Use JSDoc comments for type documentation
- Write service worker compatible code (no DOM APIs in background scripts)
- Keep functions pure where possible
- Document complex logic with comments

### General Guidelines

- Use meaningful variable and function names
- Keep files focused on a single responsibility
- Avoid deep nesting
- Handle errors appropriately

## Pull Request Process

1. Fork the repository and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style guidelines

3. Ensure all tests pass:
   ```bash
   npm test
   ```

4. Build the popup to verify no build errors:
   ```bash
   cd popup && npm run build
   ```

5. Commit your changes using conventional commit messages

6. Push to your fork and open a pull request

7. In your PR description:
   - Describe what changes you made and why
   - Reference any related issues
   - Include screenshots for UI changes

8. Address any feedback from reviewers

## Commit Message Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(popup): add dark mode toggle
fix(capture): handle empty page titles correctly
docs: update installation instructions
test: add unit tests for markdown converter
```

## Testing Requirements

- All new features should include tests
- Bug fixes should include a test that reproduces the issue
- Run the test suite before submitting:
  ```bash
  npm test
  ```
- Tests are located in the `/tests` directory
- Ensure existing tests continue to pass

## License

By contributing to Webscribe, you agree that your contributions will be licensed under the BSD 3-Clause License.

Copyright (c) Cloudless Consulting Pty Ltd. All rights reserved.

---

Thank you for contributing to Webscribe!
