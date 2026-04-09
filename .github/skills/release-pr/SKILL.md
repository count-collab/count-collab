---
name: release-pr
description: "Create a release PR from develop to main. Use when: releasing to production, creating a release pull request, cutting a release, merging develop into main, preparing a release."
argument-hint: "Optional: 'create' or describe version bump intent"
---

# Release PR

Create a release pull request from `develop` to `main` with title only (no body content).

When merged, this triggers the release-please workflow (auto-versioning + changelog) and the production deployment pipeline.

## Procedure

### 1. Gather Context

```bash
# Ensure we're on develop and up to date
git checkout develop
git pull origin develop

# Get remote info
git remote get-url origin
```

Parse the remote URL to extract `owner` and `repo`:

- HTTPS: `https://github.com/<owner>/<repo>.git`
- SSH: `git@github.com:<owner>/<repo>.git`

### 2. Check for New Commits

```bash
git log origin/main..origin/develop --oneline --no-merges
```

If there are **no new commits**, inform the user and stop — there is nothing to release.

### 3. Check for Existing Release PR

Use `mcp_github_list_pull_requests` to check if a PR already exists:

- Filter by `head: count-collab:develop` and `base: main`
- If a PR exists → go to **Update Flow** (step 5)
- If no PR exists → continue to **Create Flow** (step 4)

### 4. Create Flow

Use `mcp_github_create_pull_request` with:

- `owner`, `repo` from step 1
- `title`: `chore: release develop to main`
- `head`: `develop`
- `base`: `main`
- `draft`: `false`

Report the PR URL back to the user.

### 5. Update Flow

If a release PR already exists from `develop` to `main`:

Use `mcp_github_update_pull_request` to update the title to `chore: release develop to main` and mark as ready for review if it's a draft.

Report the updated PR URL.
