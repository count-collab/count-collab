# Development Guidelines

## Technology

- SvelteKit
- Postgres
- TypeScript
- socket.io
- Bun
- Docker
- GitHub Actions

## Setup

### Git Pre-commit Hook

A pre-commit hook is configured to automatically run `bun run fix` before each commit. This ensures code formatting and linting standards are enforced.

The hook is located at `.githooks/pre-commit` and is automatically configured via `core.hooksPath` in your git config. If the hook fails, the commit will be aborted and you'll need to fix the issues before trying again.

**Note:** The hook is already configured when you clone the repository. No additional setup is needed unless you're setting up on a new machine or updating the hook configuration.
