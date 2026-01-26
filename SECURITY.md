# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | Yes                |
| < 4.0   | No                 |

Only the latest version of Webscribe receives security updates. We recommend always using the most recent release available from the Chrome Web Store.

## Reporting a Vulnerability

We take the security of Webscribe seriously. If you discover a security vulnerability, please report it responsibly through our private disclosure process.

**Do not report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to: **nic@bobninja.com**

Subject line: `[SECURITY] Webscribe - Brief description`

### What to Include

Please provide the following information in your report:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected version(s)
- Potential impact assessment
- Any proof-of-concept code or screenshots (if applicable)
- Your suggested fix (optional)

### Response Timeline

| Action                          | Timeframe        |
| ------------------------------- | ---------------- |
| Acknowledgment of report        | Within 48 hours  |
| Initial assessment              | Within 7 days    |
| Status update                   | Within 14 days   |
| Resolution (if confirmed)       | Within 30-90 days depending on complexity |

We will keep you informed throughout the process and coordinate disclosure timing with you.

## Security Considerations

### Permissions Explained

Webscribe requires certain browser permissions to function. Here is why each permission is necessary:

| Permission      | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `debugger`      | Required to capture network traffic and page resources during recording |
| `<all_urls>`    | Enables capturing content from any website the user chooses to record   |
| `scripting`     | Allows injection of capture scripts into target pages                   |
| `tabs`          | Needed to access tab information and manage recording sessions          |
| `storage`       | Stores extension settings and session data locally                      |

### Data Handling

- **Local storage only**: All captured data is stored locally in your browser using IndexedDB
- **No external servers**: Webscribe does not transmit your data to any external servers
- **No analytics**: We do not collect usage data or telemetry
- **User-controlled**: You have full control over what content is captured and can delete data at any time

## What is NOT a Security Issue

The following are expected behaviors and do not constitute security vulnerabilities:

- **Website content being captured**: This is the intended functionality of the extension when the user initiates a capture session
- **Debugger attachment warnings**: Chrome displays these warnings by design when any extension uses the debugger API
- **Access to page content**: The extension requires this access to perform its core capture functionality
- **Local data persistence**: Captured data remains in IndexedDB until the user explicitly deletes it

## Contact

For security-related inquiries:
- Email: nic@bobninja.com

For general support or feature requests, please use the standard issue tracker.

---

Copyright 2024-2025 Cloudless Consulting Pty Ltd. All rights reserved.
