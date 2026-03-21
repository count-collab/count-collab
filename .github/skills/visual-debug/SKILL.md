---
description: "Use Playwright MCP tools to visually debug the running app — navigate pages, take screenshots, inspect DOM, check console errors, and trace network requests. Invoke when asked to 'check what a page looks like', 'debug a UI issue', 'take a screenshot', or 'inspect elements'."
---

# Visual Debugging with Playwright MCP

This skill teaches agents how to use the Playwright MCP browser tools for interactive visual debugging of the Count Collab app.

## Prerequisites

- The Playwright MCP server must be configured in `.vscode/mcp.json` (already done)
- Chromium browser binaries must be installed: `bun run playwright:install`
- The agent must have `playwright/*` in its `tools:` list

## Ensuring the Dev Server is Running

Before navigating, verify the dev server is available. If navigation fails with a connection error:

```
# Start the dev server as a background process
bun run dev
```

Wait for the `ready in Xms` output before trying to navigate again.

**Base URLs:**

- Development: `http://localhost:5173`
- Production preview: `http://localhost:3000`

## Tool Reference

### Navigation

| Tool                    | Purpose            | Example                          |
| ----------------------- | ------------------ | -------------------------------- |
| `browser_navigate`      | Go to a URL        | `http://localhost:5173/counters` |
| `browser_navigate_back` | Go back in history | After clicking a link            |
| `browser_tabs`          | List open tabs     | Check which pages are open       |

### Inspection

| Tool                       | Purpose                                         | When to Use                                |
| -------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `browser_snapshot`         | Accessibility tree (DOM structure, text, roles) | **Primary tool** — structured page content |
| `browser_take_screenshot`  | Visual screenshot                               | Layout, styling, visual rendering issues   |
| `browser_console_messages` | JS console output (errors, warnings, logs)      | Something is broken or not loading         |
| `browser_network_requests` | HTTP requests and responses                     | Data not loading, API errors               |

### Interaction

| Tool                    | Purpose                | Reference Elements By             |
| ----------------------- | ---------------------- | --------------------------------- |
| `browser_click`         | Click an element       | Accessibility label from snapshot |
| `browser_fill_form`     | Fill text inputs       | Field label or placeholder        |
| `browser_select_option` | Choose dropdown option | Select label + option value       |
| `browser_press_key`     | Keyboard input         | Key name (Enter, Escape, Tab)     |
| `browser_hover`         | Hover over element     | Accessibility label               |
| `browser_drag`          | Drag and drop          | Source and target elements        |
| `browser_file_upload`   | Upload a file          | File input element                |

### Advanced

| Tool                    | Purpose                              |
| ----------------------- | ------------------------------------ |
| `browser_evaluate`      | Run JavaScript in the page context   |
| `browser_run_code`      | Run Playwright code snippets         |
| `browser_wait_for`      | Wait for element or condition        |
| `browser_handle_dialog` | Accept/dismiss alert/confirm dialogs |
| `browser_resize`        | Change viewport size                 |
| `browser_close`         | Close the browser                    |

## Debugging Recipes

### Recipe: Visual Page Check

```
1. browser_navigate → http://localhost:5173/page
2. browser_take_screenshot → see what it looks like
3. browser_snapshot → get structured DOM content
```

### Recipe: Form Flow

```
1. browser_navigate → http://localhost:5173/create
2. browser_snapshot → find form fields
3. browser_fill_form → fill in the title field
4. browser_click → click the submit button
5. browser_snapshot → check the result page
6. browser_network_requests → verify the API call succeeded
```

### Recipe: Error Diagnosis

```
1. browser_navigate → the problematic page
2. browser_console_messages → check for JS errors
3. browser_network_requests → check for failed API calls
4. browser_snapshot → see what rendered (or didn't)
```

### Recipe: Responsive Design Check

```
1. browser_navigate → the page to check
2. browser_take_screenshot → desktop view
3. browser_resize → 375x812 (iPhone viewport)
4. browser_take_screenshot → mobile view
5. browser_resize → 768x1024 (tablet viewport)
6. browser_take_screenshot → tablet view
```

### Recipe: Multi-Step User Flow

```
1. browser_navigate → http://localhost:5173/
2. browser_click → "Create Counter" link
3. browser_fill_form → counter title
4. browser_click → "Create" button
5. browser_wait_for → redirect to /c/[id]
6. browser_snapshot → verify counter page content
```

## App Routes Reference

| Route          | Description                    | Auth Required               |
| -------------- | ------------------------------ | --------------------------- |
| `/`            | Landing page                   | No                          |
| `/create`      | Create a new counter           | No                          |
| `/counters`    | Browse public counters         | No                          |
| `/c/[id]`      | Individual counter (real-time) | No (public) / Yes (private) |
| `/my-counters` | User's own counters            | Yes                         |
| `/login`       | Login page                     | No                          |
| `/admin`       | Admin dashboard                | Yes (admin)                 |
| `/setup`       | Username setup                 | Yes                         |

## Tips

- **Start with `browser_snapshot`** — it's faster than screenshots and gives you structured data about what's on the page
- **Use screenshots for visual issues** — layout problems, wrong colors, overlapping elements
- **Check console first when something is broken** — most rendering issues produce JS errors
- **Use network requests when data is missing** — look for 4xx/5xx responses or failed fetches
- **Reference elements by their accessibility label** from `browser_snapshot` when clicking or interacting
- **Start the dev server if navigation fails** — run `bun run dev` as a background process
