# AGENTS.md

## Project Overview

Count Collab is a lightweight, shareable counter app. Create a counter, send the link, and let anyone increment it in real time.

### Tech Stack

- SvelteKit 2 + Svelte 5
- Vite 5
- TypeScript
- Tailwind CSS
- Drizzle ORM (Postgres)
- Socket.IO (realtime updates)
- Bun (runtime & package manager)
- Docker (deployment)

## Setup

### Installation

Install dependencies using Bun (requires TLS certificate bypass for package downloads):

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 bun install
```

For adding new packages:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 bun add <package-name>
```

### Running Development Server

Start the development server:

```bash
bun run dev
```

The app will be available at `http://localhost:5173`

### Database Configuration

Create a `.env` file to configure the database connection:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/count_collab
```

## Git Workflow

### Commit Messages

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org) standard:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, missing semicolons, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Code change that improves performance
- `test`: Adding or updating tests
- `chore`: Changes to build process, dependencies, or tooling

**Examples:**

- `feat(counters): add counter increment validation`
- `fix(socket): resolve realtime update sync issue`
- `docs: update setup instructions`
- `test(counters): add unit tests for counter logic`

### Branch Naming

Use the following branch naming convention:

```
<type>/<short-description>
```

**Types:**

- `feat/` - new features
- `fix/` - bug fixes
- `docs/` - documentation
- `refactor/` - code refactoring
- `test/` - adding/updating tests
- `chore/` - maintenance tasks

**Examples:**

- `feat/counter-validation`
- `fix/socket-reconnection`
- `docs/setup-guide`
- `refactor/extract-counter-logic`
- `test/counter-increments`

## When implementing features

Add or update tests for the code you change, even if nobody asked.

## Building and Testing before committing

1. Fix any test or type errors until the whole suite is green.

```bash
bun test
```

2. Format code

```bash
bun format
bun fix
```

3. Lint

```bash
bun lint
```

4. Svelte check

```bash
bun check
```
