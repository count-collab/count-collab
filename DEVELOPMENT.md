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

A pre-commit hook is configured to automatically run `bun run fix` and `bun run lint` before each commit. This ensures code formatting and linting standards are enforced. If `bun run lint` fails, the commit is aborted and you must fix lint issues first.

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

## Visual Debugging with Copilot

GitHub Copilot can navigate your running local app, take screenshots, inspect DOM elements, and check console/network errors using the Playwright MCP server configured in `.vscode/mcp.json`.

### Setup

Install Chromium browser binaries (one-time):

```bash
bun run playwright:install
```

### Usage

Start the dev server, then ask Copilot to inspect pages:

- "Navigate to the counter page and take a screenshot"
- "Check the create form for accessibility issues"
- "What errors are showing in the console on /counters?"
- "Click through the counter creation flow and verify it works"

### Agents with Browser Access

| Agent       | Purpose                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `debug`     | Interactive visual debugging — navigate, screenshot, inspect, diagnose |
| `developer` | Can browse the app during feature implementation                       |
| `ui`        | Can verify component rendering visually                                |
| `e2e-test`  | Writes and runs automated Playwright tests                             |

Use the `debug` agent (`@debug`) for focused visual debugging sessions.
