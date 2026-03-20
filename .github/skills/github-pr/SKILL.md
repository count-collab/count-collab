---
name: github-pr
description: "Create or update GitHub pull requests for the current branch. Use when: opening a PR, updating PR title/body/status, converting draft to ready, pushing and creating PR. Handles draft vs ready, conventional commit titles, and body generation from commits."
argument-hint: "Optional: 'create', 'update', or describe what to change"
---

# GitHub Pull Request Management

Create and update GitHub PRs for the currently checked out branch.

## Procedure

### 1. Gather Context

Run these terminal commands to collect branch and repo info:

```bash
# Current branch
git branch --show-current

# Remote repo (extract owner/repo from origin URL)
git remote get-url origin
```

Parse the remote URL to extract `owner` and `repo`:
- HTTPS: `https://github.com/<owner>/<repo>.git` → owner, repo
- SSH: `git@github.com:<owner>/<repo>.git` → owner, repo

### 2. Determine Target Branch

Ask the user which branch to target:

> Target branch: **main** (default) or **develop**?

If the user doesn't specify, default to `main`.

### 3. Gather Commits

Get the commits that differ from the target branch:

```bash
git log origin/<target-branch>..HEAD --oneline --no-merges
```

### 4. Check for Existing PR

Use `mcp_github_list_pull_requests` to check if a PR already exists for the current branch against the target:
- Filter by `head` matching the current branch name
- If a PR exists → go to **Update PR** flow (step 7)
- If no PR exists → go to **Create PR** flow (step 5)

### 5. Create PR Flow

#### 5a. Push the Branch

If the branch has unpushed commits, push first:

```bash
git push -u origin <branch-name>
```

#### 5b. Ask: Draft or Ready?

Ask the user:

> Should this PR be a **draft** or **ready for review**?

#### 5c. Generate PR Title

Derive the title from the branch name using conventional commit format:
- `feat/add-user-auth` → `feat: add user auth`
- `fix/socket-reconnection` → `fix: socket reconnection`
- `refactor/extract-counter-logic` → `refactor: extract counter logic`

Pattern: take the branch prefix as the type, replace hyphens with spaces in the description.

If the branch name doesn't follow `type/description` pattern, ask the user for the PR title.

#### 5d. Generate PR Body

Build the body from the commits gathered in step 3:

```markdown
## Changes

- <commit message 1>
- <commit message 2>
- ...
```

#### 5e. Preview the PR

Show the full PR preview to the user **before** creating it:

```
──────────────────────────────────
PR Preview
──────────────────────────────────
Title:  <generated title>
Base:   <target-branch>
Head:   <current-branch>
Status: <draft / ready for review>

Body:
<generated body>
──────────────────────────────────
```

Ask the user to confirm:

> Does this look good? Should I create this PR on GitHub?

Allow the user to request changes to the title, body, or status before proceeding.

#### 5f. Create the PR

Only after user confirmation, use `mcp_github_create_pull_request` with:
- `owner`, `repo` from step 1
- `title` from step 5c
- `body` from step 5d
- `head`: current branch name
- `base`: target branch from step 2
- `draft`: based on user's choice in step 5b

Report the PR URL back to the user.

### 6. Update PR Flow

#### 6a. Show Current PR State

Fetch the existing PR details using `mcp_github_pull_request_read` and display:
- Title
- Status (draft/ready)
- Body (summary)
- Target branch

#### 6b. Ask What to Update

Ask the user what they want to change:
- **Title**: Update the PR title
- **Body**: Regenerate or edit the body (e.g., append new commits)
- **Status**: Convert draft → ready for review (or vice versa)
- **Push commits**: Push latest commits and optionally update the body

#### 6c. Push if Needed

If there are unpushed commits:

```bash
git push
```

#### 6d. Preview Changes

Show the updated PR preview (same format as step 5e) and ask for confirmation before applying.

#### 6e. Apply Updates

Only after user confirmation, use `mcp_github_update_pull_request` with only the fields that changed.

Report the updated PR URL back to the user.
