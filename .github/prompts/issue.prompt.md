---
description: "Create, list, update, or connect GitHub issues. Use when: tracking feature requests, reporting bugs, listing priorities, linking related issues, or managing sub-issues."
agent: "agent"
argument-hint: "Action + details, e.g. 'create bug: login fails on mobile' or 'list high priority' or 'connect #5 as sub-issue of #2'"
---

# GitHub Issue Management

Manage issues for the **count-collab/count-collab** repository.

## Determine the Action

Parse the user's request to identify one of these actions:

| Action      | Trigger keywords                                              |
| ----------- | ------------------------------------------------------------- |
| **create**  | create, new, add, report, file, open, track                   |
| **list**    | list, show, find, search, important, priority, open, overview |
| **update**  | update, edit, change, close, reopen, relabel, rename          |
| **connect** | connect, link, relate, parent, child, sub-issue, depends on   |

If the action is ambiguous, ask the user to clarify.

---

## 1. Create an Issue

### Classify the issue type

Infer from context:

| Type            | Default labels  |
| --------------- | --------------- |
| Bug / Defect    | `bug`           |
| Feature request | `enhancement`   |
| Task / Chore    | `chore`         |
| Documentation   | `documentation` |

### Determine priority

If the user specifies or implies priority, add one of:

- `priority:critical` — System down, data loss, security vulnerability
- `priority:high` — Blocks core functionality, no workaround
- `priority:medium` — Important but has workaround (default if unspecified)
- `priority:low` — Nice to have, cosmetic, minor improvement

### Compose the issue

**Title** — Concise, imperative mood, lowercase (like a conventional commit subject). Prefix with area if clear, e.g. `auth: session expires too quickly`.

**Body** — Use the appropriate template:

#### Bug template

```markdown
## Description

<Clear summary of the bug>

## Steps to Reproduce

1. <Step 1>
2. <Step 2>
3. <Step 3>

## Expected Behavior

<What should happen>

## Actual Behavior

<What actually happens>

## Environment

- Browser / OS: <if relevant>
- Deployment: <local / production>

## Additional Context

<Screenshots, logs, related issues>
```

#### Feature request template

```markdown
## Problem

<What problem does this solve? Why is it needed?>

## Proposed Solution

<Describe the desired behavior or approach>

## Acceptance Criteria

- [ ] <Criterion 1>
- [ ] <Criterion 2>
- [ ] <Criterion 3>

## Alternatives Considered

<Any other approaches considered and why they were rejected>

## Additional Context

<Mockups, references, related issues>
```

#### Task / Chore template

```markdown
## Description

<What needs to be done>

## Tasks

- [ ] <Task 1>
- [ ] <Task 2>

## Additional Context

<Any relevant context>
```

### Preview and confirm

Show the user a preview before creating:

```
──────────────────────────────────
Issue Preview

  Title: <title>
  Labels: <label1>, <label2>

  <body summary — first 3 lines>
──────────────────────────────────
```

Ask for confirmation. Then create with `mcp_github_issue_write` (method: `create`).

After creation, display the issue number and URL.

---

## 2. List Issues

Use `mcp_github_list_issues` or `mcp_github_search_issues` depending on the query.

### Common list queries

| User says          | Action                                                      |
| ------------------ | ----------------------------------------------------------- |
| "most important"   | Filter by `priority:critical` + `priority:high`, state OPEN |
| "all open"         | State OPEN, ordered by CREATED_AT DESC                      |
| "bugs"             | Filter by label `bug`, state OPEN                           |
| "features"         | Filter by label `enhancement`, state OPEN                   |
| "recently updated" | State OPEN, ordered by UPDATED_AT DESC                      |

### Output format

Present results as a numbered table:

```
# | Title                          | Labels                    | Updated
--|--------------------------------|---------------------------|----------
1 | auth: session expires          | bug, priority:high        | 2d ago
2 | add counter sharing            | enhancement, priority:med | 5d ago
```

If there are more results, mention pagination and ask if the user wants to see more.

---

## 3. Update an Issue

Use `mcp_github_issue_write` (method: `update`) or `mcp_github_add_issue_comment`.

Supported updates:

- **Title**: Change the issue title
- **Labels**: Add or remove labels
- **State**: Close (with reason: `completed`, `not_planned`, or `duplicate`) or reopen
- **Body**: Edit the issue description
- **Comment**: Add a comment with progress or discussion

When closing as duplicate, use the `duplicate_of` parameter to link to the original issue.

Always confirm the change with the user before applying it. Show what will change.

---

## 4. Connect Issues

Two connection methods are available:

### Sub-issues (parent/child hierarchy)

Use `mcp_github_sub_issue_write` to create parent-child relationships:

- **Add sub-issue**: method `add` — makes one issue a child of another
- **Remove sub-issue**: method `remove` — detaches a child from its parent
- **Reorder sub-issues**: method `reprioritize` — change the order within a parent

When connecting, first read both issues with `mcp_github_issue_read` to confirm they exist and show the user what will be linked.

### Cross-references (mention in body/comment)

Add a comment on an issue referencing related issues:

```markdown
Related to #<number> — <brief reason for the connection>
```

Or for dependency relationships:

```markdown
Blocked by #<number>
Depends on #<number>
```

Use `mcp_github_add_issue_comment` to add the reference.

Always confirm the connection with the user before applying.

---

## General Rules

- **Repository**: Always use `owner: "count-collab"`, `repo: "count-collab"`.
- **Labels**: Infer sensible defaults but let the user override.
- **No assignee** unless the user explicitly asks for one.
- **Confirm** before any write operation (create, update, connect).
- If a label doesn't exist yet, mention it to the user — they may need to create it in the repo settings first.
