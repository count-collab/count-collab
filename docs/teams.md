# Teams

## Overview

A team is a group of users that **owns** counters and dashboards. Instead of sharing every counter individually, you move counters and dashboards into a team and every team member gets access according to their team role.

A counter or dashboard belongs to **at most one team**. Teams are private: only members (and platform admins) can see a team page.

## Data Model

### Team

| Field         | Type                                         | Notes                                     |
| ------------- | -------------------------------------------- | ----------------------------------------- |
| `id`          | UUID                                         | Primary key                               |
| `name`        | text                                         | Required, 1–50 chars                      |
| `description` | text                                         | Optional, max 500 chars                   |
| `joinToken`   | text (unique)                                | `null` = join link disabled               |
| `joinRole`    | `"viewer"` \| `"incrementer"` \| `"editor"` | Role granted by the join link             |
| `createdBy`   | FK → users                                   | On delete: set null                       |
| `createdAt`   | timestamp with timezone                      |                                           |
| `updatedAt`   | timestamp with timezone                      |                                           |

### Team Members / Team Invitations

`team_members` (`teamId`, `userId`, `role`, `joinedAt`) and `team_invitations` (`teamId`, `userId`, `invitedBy`, `role`, `createdAt`). Both are unique on (`teamId`, `userId`) and cascade on team/user deletion.

### Ownership columns

`counters.teamId` and `dashboards.teamId` (nullable FK → teams, `ON DELETE RESTRICT`). When `teamId` is set, the team owns the resource and `ownerId` only records who created it — the creator has **no** owner privileges unless they also hold a team role.

## Roles

Team roles, lowest to highest: `viewer` < `incrementer` < `editor` < `admin` < `owner`. A team can have multiple owners and must always keep at least one.

### Team-level permissions

| Action                                             | Viewer | Incrementer | Editor | Admin | Owner |
| -------------------------------------------------- | ------ | ----------- | ------ | ----- | ----- |
| See team, its counters and dashboards              | ✓      | ✓           | ✓      | ✓     | ✓     |
| Increment team counters                            | ✗      | ✓           | ✓      | ✓     | ✓     |
| Edit team counters/dashboards, create / move in    | ✗      | ✗           | ✓      | ✓     | ✓     |
| Delete team resources, move out, edit team details | ✗      | ✗           | ✗      | ✓     | ✓     |
| Invite / remove / change members (up to admin)     | ✗      | ✗           | ✗      | ✓     | ✓     |
| Manage join link                                   | ✗      | ✗           | ✗      | ✓     | ✓     |
| Grant / revoke owner, delete team                  | ✗      | ✗           | ✗      | ✗     | ✓     |

### Mapping to resource roles

| Team role     | Counter role  | Dashboard role |
| ------------- | ------------- | -------------- |
| `viewer`      | `viewer`      | `viewer`       |
| `incrementer` | `incrementer` | `viewer`       |
| `editor`      | `editor`      | `editor`       |
| `admin`       | `admin`       | `admin`        |
| `owner`       | `admin`       | `admin`        |

The effective role on a resource is the **higher** of the direct member role (`counter_members` / `dashboard_members`) and the mapped team role. Direct members ("outside collaborators") are still allowed on team resources. Roles only add — they never restrict.

Resolution lives in `getCounterAccess()` (`src/lib/server/authorize.ts`) and `getDashboardAccess()` (`src/lib/server/dashboard-authorize.ts`).

## Joining a Team

- **Invitations** — admins invite by username. The invite appears on `/invitations` and must be accepted.
- **Join link** — `/t/[id]/join?token=…`. Admins can enable, disable and reset it, and choose the role it grants (max `editor`). Joining never changes the role of an existing member. Resetting invalidates the old link.

## Moving Resources

| Move              | Requirement                                                     | Result                                |
| ----------------- | --------------------------------------------------------------- | ------------------------------------- |
| Personal → team   | Personal owner **and** team role ≥ editor                       | `teamId` set, `ownerId` kept          |
| Team → personal   | Team role ≥ admin                                               | `teamId = null`, `ownerId` = actor    |
| Team → team       | Admin+ in source team **and** editor+ in target team            | `teamId` changed                      |

When moving a dashboard into a team, the dialog offers to move the counters on it that you personally own in the same transaction. Counters on a dashboard keep their own permissions (see [dashboards.md](dashboards.md)).

Counters and dashboards can also be created directly in a team from `/create` (team role ≥ editor).

## Deletion

- **Delete team** (owner only) permanently deletes the team **and all of its counters and dashboards**. The team name must be typed to confirm.
- **Last owner** — the last owner cannot leave or be demoted.
- **Account deletion** — if a user is the **sole owner** of a team, deleting their account deletes that team and all its resources. The delete-account dialog (and the admin delete-user dialog) lists affected teams.
- Team counters are never picked up by inactive-counter auto-cleanup, and a creator deleting their account does not delete team counters they created.

## Platform Admins

- `team:edit_any` — view and manage any team (acts as owner).
- `team:delete_any` — delete any team.
- `/admin/teams` lists all teams with member/resource counts.
- Team creation is rate limited via `teamCreationLimitAuth` / `teamCreationWindowAuth` in `/admin/settings`.

Run `bun run db:seed-roles` after deploying to add the new permissions.

## Real-time Updates

| Event                     | Payload                          | Trigger                                                        |
| ------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `team:membership-changed` | `{ userId, teamId, reason }`     | Joined, removed, role changed, team updated or deleted         |
| `invitation:created`      | `{ type: "team", ... }`          | Team invitation sent                                           |

Clients re-run their loads (`invalidateAll`) on `team:membership-changed`; users on a team page they lost access to are redirected to `/my/teams`.

## Routes

| Route              | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `/my/teams`        | Your teams, create team                                   |
| `/t/[id]/[[slug]]` | Team page (Counters / Dashboards / Members / Settings)    |
| `/t/[id]/join`     | Join via link                                             |
| `/admin/teams`     | Platform admin team list                                  |

## API Endpoints

| Method                 | Endpoint                         | Description                          |
| ---------------------- | -------------------------------- | ------------------------------------ |
| `GET` / `POST`         | `/api/teams`                     | List own teams / create team         |
| `GET` / `PATCH` / `DELETE` | `/api/teams/[id]`            | Get / update / delete (`confirmName`) |
| `POST` / `PATCH` / `DELETE` | `/api/teams/[id]/join-link` | Enable+reset / set role / disable    |
| `POST`                 | `/api/teams/[id]/join`           | Join with token                      |
| `GET` / `POST`         | `/t/[id]/members`                | List members / invite                |
| `PATCH` / `DELETE`     | `/t/[id]/members/[userId]`       | Change role / remove or leave        |
| `PATCH` / `DELETE`     | `/t/[id]/invitations/[userId]`   | Change invite role / cancel invite   |
| `POST` / `DELETE`      | `/api/invitations/team/[teamId]` | Accept / decline invitation          |
| `POST`                 | `/api/counters/[id]/transfer`    | Move counter (`{ teamId \| null }`)  |
| `POST`                 | `/api/dashboards/[id]/transfer`  | Move dashboard (`{ teamId, counterIds }`) |
