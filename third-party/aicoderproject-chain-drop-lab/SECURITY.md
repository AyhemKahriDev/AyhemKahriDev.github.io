# Security Policy

## Supported Versions

We actively support and patch the latest version of **chain-drop-lab**.

| Version | Supported          |
| ------- | ------------------ |
| >= 1.0.0| :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please **do not open a public issue**. Instead, follow the process below:

1. Draft a detailed explanation of the vulnerability, including steps to reproduce.
2. Send an email to the project maintainer or submit a private vulnerability report via GitHub if enabled.
3. We will acknowledge your report within 48 hours and coordinate a fix.

### Scope & Constraints
- This game runs entirely in the client's browser (HTML5 Canvas + Web Audio API + LocalStorage).
- No API keys, credentials, backend databases, or external communication services are utilized.
- All scores are stored locally in the browser's `localStorage` and no data is transmitted.
