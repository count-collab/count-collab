---
description: "Stage and commit changes with a conventional commit message. Use when: committing, creating a commit, saving progress, done with changes."
agent: "agent"
argument-hint: "Optional: commit type (feat, fix, refactor, etc.) or description"
---

# Commit Changes

Stage and commit the current changes using [Conventional Commits](https://www.conventionalcommits.org).

## Procedure

### 1. Run Pre-Commit Checks

Run these checks sequentially. If any fail, fix the issues before proceeding. All lint warnings must be resolved — zero warnings allowed.

```bash
bun run test
```

```bash
bun format
```

```bash
bun fix
```

```bash
bun run lint
```

```bash
bun lint:ci
```

```bash
bun svelte-check
```

If `bun format` or `bun fix` modified files, re-run `bun run lint`, `bun lint:ci` and `bun svelte-check` to confirm everything is clean.

### 2. Review Changes

```bash
git diff --stat
git diff --staged --stat
```

Show the user a summary of changed files. If nothing is staged, stage all changes:

```bash
git add -A
```

Then confirm with the user which files to include. If some files should be excluded, unstage them.

### 3. Generate Commit Message

Follow the [commit conventions](../../AGENTS.md):

```
<type>(<scope>): <subject>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Rules:

- **type**: Infer from the changes (new feature → `feat`, bug fix → `fix`, etc.)
- **scope**: Infer from the primary area of change (e.g., `counters`, `socket`, `auth`). Omit if changes span many areas.
- **subject**: Imperative mood, lowercase, no period. Max 72 characters.

If the user provided a type or description in their prompt, use that as a starting point.

### 4. Preview and Confirm

Show the full commit message to the user before committing:

```
──────────────────────────────────
Commit Preview

  <type>(<scope>): <subject>

Files:
  - path/to/file1.ts
  - path/to/file2.svelte
──────────────────────────────────
```

Ask for confirmation before proceeding.

### 5. Commit

```bash
git commit -m "<type>(<scope>): <subject>"
```

If a multi-line body is needed (breaking changes, detailed context):

```bash
git commit -m "<type>(<scope>): <subject>" -m "<body>"
```
