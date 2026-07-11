# Contributing to ANFA WhatsApp Platform

Thank you for your interest in contributing! We welcome community contributions that align with our "Local-First" development philosophy.

## Development Philosophy
- **Absolute Data Sovereignty**: Features must never rely on external proprietary cloud services (except the official Meta API).
- **Modularity**: Ensure backend APIs, frontend components, and background workers remain loosely coupled.
- **Security-First**: Validate all inputs. Webhooks must strictly enforce HMAC-SHA256 signature verification.

## Getting Started
1. Fork the repository and clone it locally.
2. Create a new branch for your feature or bugfix.
3. Use the provided `docker-compose.yml` to spin up the local development environment.

## Code Quality Standards
- **Python (Backend)**:
  - Code must be fully asynchronous (`async`/`await`).
  - Use `httpx` for outbound requests, never blocking libraries like `requests`.
  - Type hints are mandatory.
- **TypeScript (Frontend)**:
  - Use strict typing.
  - Follow Next.js App Router conventions.
- **Database**:
  - Respect the PostgreSQL native range partitioning design when adding or modifying schemas for high-volume tables (e.g., messages).

## Submitting a Pull Request
1. Ensure your code passes all linting and test checks.
2. Provide a clear and descriptive PR title.
3. Reference any related issues.

By contributing, you agree that your contributions will be licensed under the project's GPL-3.0 license.
