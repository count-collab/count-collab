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

### Reverse proxy / environment

Rate limiting keys on `event.getClientAddress()`; raw `X-Forwarded-For` is never read by app code. adapter-node resolves the address from the socket unless told which proxy headers to trust, so behind a proxy configure:

| Variable          | Why                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`          | Public URL (e.g. `https://example.com`). Used for the CSRF origin check and URL building. Required in production.                         |
| `PROTOCOL_HEADER` | Optional. Header with the original protocol (e.g. `x-forwarded-proto`) when `ORIGIN` is not set.                                          |
| `HOST_HEADER`     | Optional. Header with the original host (e.g. `x-forwarded-host`) when `ORIGIN` is not set.                                               |
| `ADDRESS_HEADER`  | Header the proxy sets with the client IP (e.g. `x-forwarded-for`). Without it every user behind the proxy shares one rate-limit bucket.   |
| `XFF_DEPTH`       | Number of trusted proxies in front of the app when `ADDRESS_HEADER` is `x-forwarded-for`. The address is taken that many hops from the right, so spoofed left-hand entries are ignored. |

Only set `ADDRESS_HEADER` if the app is reachable exclusively through a proxy that overwrites or appends that header; otherwise clients can spoof it. The deploy action writes `ORIGIN` and, via the optional `address-header` / `xff-depth` inputs, `ADDRESS_HEADER` and `XFF_DEPTH`.

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

## Releasing

Releases are managed by [release-please](https://github.com/googleapis/release-please). It uses conventional commit messages to determine version bumps and generate changelogs automatically.

### How It Works

1. **Develop as normal** — merge feature branches into `develop` using conventional commits (`feat:`, `fix:`, etc.)
2. **Merge `develop` → `main`** — create and merge a PR from `develop` into `main`
3. **Release PR is created** — release-please automatically opens (or updates) a Release PR on `main` with the computed version bump and changelog
4. **Merge the Release PR** — this triggers release-please to:
   - Bump the version in `package.json`
   - Generate/update `CHANGELOG.md`
   - Create a GitHub Release with a git tag (e.g. `v0.2.0`)
5. **Sync back** — the existing `sync-main-to-develop` workflow merges the version bump back to `develop`

### Version Bump Rules

| Commit Type                   | Example                         | Bump (pre-1.0) | Bump (post-1.0) |
| ----------------------------- | ------------------------------- | -------------- | --------------- |
| `fix:`                        | `fix(api): handle null counter` | patch          | patch           |
| `feat:`                       | `feat(counters): add sorting`   | patch          | minor           |
| `feat!:` or `BREAKING CHANGE` | `feat!: redesign API`           | minor          | major           |

### Configuration Files

| File                            | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `release-please-config.json`    | Release type and changelog settings    |
| `.release-please-manifest.json` | Tracks the current released version    |
| `.github/workflows/release.yml` | GitHub Action that runs release-please |

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
