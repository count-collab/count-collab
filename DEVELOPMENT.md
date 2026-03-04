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

## Database

### Database Setup

Ensure you have a PostgreSQL instance running and have set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/count_collab
```

### Database Commands

The following scripts are available for database management:

#### `bun run db:push`

Sync Drizzle schema changes to the database. Run this after editing the schema.

#### `bun run db:generate`

Generate Drizzle migrations after editing the schema.

#### `bun run db:studio`

Open Drizzle Studio to browse and manage the database via a web UI.

#### `bun run db:init`

Seed the database with 50 test counters. Useful for local development and testing the Counter Browser search functionality. All seeded counters are public and marked as auto-generated for testing.

**Usage:**

```bash
bun run db:init
```
