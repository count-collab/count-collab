# Dashboards

## Overview

A dashboard is a user-created grid that groups counters for organized viewing and interaction. Dashboards are independent entities with their own visibility, sharing, and role system — but **counter-level permissions always take precedence** over dashboard-level roles.

Users can create dashboards publicly or privately, invite collaborators, and follow public dashboards. Counters on a dashboard can be incremented directly without opening them individually.

## Data Model

### Dashboard

| Field            | Type                                             | Notes                                 |
| ---------------- | ------------------------------------------------ | ------------------------------------- |
| `id`             | UUID                                             | Primary key                           |
| `title`          | text                                             | Required                              |
| `description`    | text                                             | Optional                              |
| `visibilityMode` | `"public"` \| `"public_readonly"` \| `"private"` | Same modes as counters                |
| `shareToken`     | text (unique)                                    | Auto-generated for private dashboards |
| `ownerId`        | FK → users                                       | On delete: set null                   |
| `createdAt`      | timestamp with timezone                          |                                       |
| `updatedAt`      | timestamp with timezone                          |                                       |

### Dashboard Items (counter placements)

| Field         | Type            | Notes                                         |
| ------------- | --------------- | --------------------------------------------- |
| `id`          | serial          | Primary key                                   |
| `dashboardId` | FK → dashboards | On delete: cascade                            |
| `counterId`   | FK → counters   | On delete: cascade (leaves empty gap in grid) |
| `positionX`   | integer (0–4)   | Column index                                  |
| `positionY`   | integer (≥ 0)   | Row index                                     |
| `sizeColumns` | integer (1–5)   | Width in columns                              |
| `sizeRows`    | integer (1–4)   | Height in rows (max configurable in future)   |

The same counter can appear multiple times on the same dashboard (no unique constraint on dashboardId + counterId).

### Dashboard Members

| Field         | Type                                  | Notes                 |
| ------------- | ------------------------------------- | --------------------- |
| `id`          | serial                                | Primary key           |
| `dashboardId` | FK → dashboards                       | On delete: cascade    |
| `userId`      | FK → users                            | On delete: cascade    |
| `role`        | `"viewer"` \| `"editor"` \| `"admin"` | No `incrementer` role |
| `invitedAt`   | timestamp with timezone               |                       |

Unique constraint on (`dashboardId`, `userId`).

## Permissions

### Dashboard Roles

| Action                                     | Owner | Admin | Editor | Viewer |
| ------------------------------------------ | ----- | ----- | ------ | ------ |
| View dashboard                             | ✓     | ✓     | ✓      | ✓      |
| Edit title / description                   | ✓     | ✓     | ✓      | ✗      |
| Edit layout (move / resize / add / remove) | ✓     | ✓     | ✓      | ✗      |
| Delete dashboard                           | ✓     | ✓     | ✗      | ✗      |
| Invite members / change visibility         | ✓     | ✓     | ✗      | ✗      |

### Counter Permissions on Dashboards

Dashboard roles **do not** affect how a user interacts with individual counters. The counter's own permission model always applies:

| User's counter access       | What they see on the dashboard                     |
| --------------------------- | -------------------------------------------------- |
| Can view + increment        | Full counter card with increment/decrement buttons |
| Can view only               | Full counter card, no action buttons               |
| No access (private counter) | Gray placeholder with dashed border, no details    |

Editors can move or remove any counter from the dashboard, even one they can't view. However, they cannot add back a counter they don't have permission to see.

A user can add a counter to a dashboard as long as they can **view** that counter (public, public_readonly, or invited members of private counters).

## Visibility & Sharing

Dashboards use the same three visibility modes as counters:

- **`public`** — Anyone can view and follow the dashboard
- **`public_readonly`** — Anyone can view, only invited members can edit layout
- **`private`** — Only accessible via share token link or membership

### Following

- Users can **follow** a public dashboard, which adds them as a `viewer`
- **Unfollowing** removes the viewer membership
- Followed dashboards appear in "My Dashboards"

### Share Tokens

Private dashboards get an auto-generated share token. The dashboard is accessible via `/d/[id]?token=[token]`.

## Grid Layout

### Desktop

- **5-column grid**
- Counter cards sized from **1×1** to **5×4** (columns × rows)
- Gaps are allowed — no auto-packing
- Empty cells have a **dashed border** and display an **"add counter" button on hover** (visible to editors and admins only)

### Mobile

- **Single column**, all items rendered as **1×1**
- Order: row by row, left to right from the desktop grid layout

### Drag & Drop

- Only available to editors and admins
- Moving a card onto another card **swaps** their positions
- Moving a card to an empty cell places it there

### Counter Deletion

When a counter is deleted from the system, its dashboard item entry is cascade-deleted, leaving an empty gap in the grid.

## Real-time Updates

### Socket.IO Events

Dashboard-level room: `dashboard:{id}`

| Event                    | Payload                                              | Trigger                        |
| ------------------------ | ---------------------------------------------------- | ------------------------------ |
| `dashboard:created`      | `{ dashboardId }`                                    | New dashboard created          |
| `dashboard:updated`      | `{ dashboardId, title?, description?, visibility? }` | Dashboard metadata changed     |
| `dashboard:item-added`   | `{ dashboardId, item }`                              | Counter added to dashboard     |
| `dashboard:item-removed` | `{ dashboardId, itemId }`                            | Counter removed from dashboard |

Counter value updates within a dashboard use the existing global `counter:updated` event — same pattern as the browse and landing pages.

Layout edits by one editor/admin are propagated to all connected viewers in real-time.

## Routes

| Route         | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `/d/[id]`     | Dashboard detail / view page                                     |
| `/dashboards` | Browse public dashboards (search by title, sort by member count) |

### Navigation

- New **"Dashboards"** entry in the top navigation bar
- `/dashboards` shows a **"My Dashboards"** section at the top for logged-in users (owned + followed)
- `/my-counters` also displays owned and followed dashboards in a separate section

## API Endpoints

### Dashboard CRUD

| Method   | Endpoint               | Description      |
| -------- | ---------------------- | ---------------- |
| `POST`   | `/api/dashboards`      | Create dashboard |
| `GET`    | `/api/dashboards/[id]` | Get dashboard    |
| `PATCH`  | `/api/dashboards/[id]` | Update dashboard |
| `DELETE` | `/api/dashboards/[id]` | Delete dashboard |

### Dashboard Items

| Method   | Endpoint                     | Description              |
| -------- | ---------------------------- | ------------------------ |
| `POST`   | `/api/dashboards/[id]/items` | Add counter to dashboard |
| `PATCH`  | `/api/dashboards/[id]/items` | Move / resize item       |
| `DELETE` | `/api/dashboards/[id]/items` | Remove item              |

### Dashboard Members

| Method | Endpoint          | Description   |
| ------ | ----------------- | ------------- |
| `GET`  | `/d/[id]/members` | List members  |
| `POST` | `/d/[id]/members` | Invite member |

## Implementation Phases

### Phase 1: Database & Schema

- Add enums: `dashboardVisibilityMode`, `dashboardMemberRole`
- Create tables: `dashboards`, `dashboardItems`, `dashboardMembers`
- Define Drizzle relations
- Generate and apply migration

### Phase 2: Server Logic

- `src/lib/server/dashboards.ts` — CRUD: create, get, update, delete, list public, list user dashboards
- `src/lib/server/dashboard-items.ts` — Add, remove, move, resize counter placements
- `src/lib/server/dashboard-members.ts` — Invite, update role, remove, get members
- `src/lib/server/dashboard-authorize.ts` — Permission checks
- Validation schemas in `src/lib/utils/validation.ts`

### Phase 3: API Routes

- Dashboard CRUD endpoints
- Dashboard item management endpoints
- Dashboard member endpoints (mirroring counter member pattern)

### Phase 4: Real-time

- Socket.IO events and emitters for dashboard changes
- Client-side store in `src/lib/stores/dashboards.ts`

### Phase 5: UI — Dashboard Detail Page

- `/d/[id]` route with server load and permission checks
- Grid component with CSS grid layout
- Counter cards with action buttons or gray placeholders
- Drag & drop for layout editing
- Add counter modal, edit/delete modal, share modal, member management

### Phase 6: UI — Browse & Navigation

- `/dashboards` browse page with search and pagination
- "My Dashboards" section for logged-in users
- Navigation update in layout
- Dashboard section on `/my-counters`
- Dashboard card component for listings

### Phase 7: Auth & Permissions Integration

- Follow / unfollow actions
- Counter-level permission checks when rendering dashboard items
- Share token access for private dashboards

### Phase 8: Testing

- Unit tests for all server logic
- E2E tests for dashboard flows

### Dependency Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 + Phase 6 → Phase 7 → Phase 8
```
