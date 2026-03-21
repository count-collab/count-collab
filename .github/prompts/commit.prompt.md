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

### 2. Identify and Stage Chat Changes

Use the `get_changed_files` tool to retrieve the list of files modified during this chat session. This ensures only the changes made in the current conversation are committed, avoiding accidental inclusion of unrelated work.

1. **Get chat-changed files:** Call `get_changed_files` to get the files you touched in this session.
2. **Cross-reference with git status:** Run `git status --short` to see the full working tree state. Identify which of the chat-changed files have actual uncommitted modifications (modified, added, or deleted).
3. **Stage only chat-changed files:**

```bash
git add <file1> <file2> ...
```

Only stage the files returned by `get_changed_files` that also appear in `git status`. Do **not** use `git add -A` — that risks staging unrelated changes from outside this session.

4. **Show the user a summary** of what will be staged vs. what is being left out. If there are unstaged files from outside this chat, mention them so the user is aware.
5. **Confirm with the user** which files to include. If some files should be excluded, unstage them with `git restore --staged <file>`.

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
