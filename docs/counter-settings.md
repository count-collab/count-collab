# Counter Settings Rework

## Settings Overlay

Replaces the current edit modal with a full-page overlay covering the entire counter page.

- **Layout:** full-width overlay, sections listed vertically (not stepped)
- **Animation:** fade in
- **Close:** X icon in top-right corner + Escape key (no backdrop click dismiss)
- **Save:** explicit "Save" button at the bottom
- **Style:** matches the creation wizard card aesthetic (card selections, hover states, Tailwind styling)

### Sections (top to bottom)

1. **Name & Description** — text inputs, wizard-style layout
2. **Visibility** — card selection (Public / Public read-only / Private), same card style as creation wizard
3. **Counter Mode** — card selection (Increment only / Decrement only / Both), same card style
4. **Cooldown** — toggle switch + slider (see below)
5. **Goals** — toggle switch + goals table (see below)
6. **Scoreboard** — toggle switch only (see below)

## Cooldown Configuration

- Toggle switch "Counter cooldown" (on/off)
  - If off: no counter-specific cooldown, only the global cooldown applies
  - If on: slider in 1-second steps
    - Minimum: 1s
    - Maximum: 60s
    - Default: 5s
- **Enforcement:** the stricter (higher) value always wins between per-counter and global cooldown
- **Exemptions:** counter-specific cooldown does NOT apply to counter owners and editors
  - Global cooldown applies to everyone except Count Collab site admins

## Counter Goals

### Configuration (in settings overlay)

- Toggle switch "Enable counter goals" (on/off)
- Goals table with inline editing:
  - Fields per goal: `amount` (integer) + `description` (short text)
  - Add goal button at the bottom of the table
  - Edit and delete per row
- Goals are sorted by amount (low to high)
- Both negative and positive goals can exist (matching the counter type)

### Display (on counter page)

- **Desktop (xl: breakpoint+):** sidebar on the right side of the counter, doesn't take up too much space
- **Mobile:** small floating bar under the counter title & description, collapsible
- **Goal reached animation:** big fireworks animation that displays for 1 hour after the goal is reached

## Scoreboard

### Configuration (in settings overlay)

- Toggle switch "Show scoreboard" (on/off)

### Display (on counter page)

- Ranked list of users by all-time action count on this counter
- Ignores all anonymous actions
- **Desktop:** same sidebar as goals (goals on top, scoreboard below)
- **Mobile:** collapsible section under the goals bar
- **Visibility:** top 5 entries visible by default, expandable to 10, scrollable past 10

## Global Settings Panel in Admin Panel

> **Access: site admins only** (same guard as the rest of the admin panel — this is critical)

- New "Settings" tab in the admin panel navigation

### Counter & Dashboard Creation Rate Limit

- Two sliders per setting: number of allowed creations + time period (in seconds)
- Separate settings for:
  - **Authenticated users**
  - **Unauthenticated users**

### Global Minimum Increment/Decrement Rate Limit

- The fallback rate limit when no per-counter cooldown is configured
- Separate values for:
  - **Authenticated users**
  - **Unauthenticated users**
- Configured in milliseconds

### Storage

- Single-row `globalSettings` table in the database
- Allows admins to change settings at runtime without redeploying
