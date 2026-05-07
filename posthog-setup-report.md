<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this SvelteKit project. Here is a summary of all changes made:

- **`svelte.config.js`** — Added `paths.relative: false` (required for session replay to work correctly with SSR).
- **`src/lib/server/posthog.ts`** — Created a server-side PostHog singleton using `posthog-node`.
- **`src/hooks.client.ts`** — Created client-side PostHog initialization with `posthog-js`, including automatic exception capture via `handleError`.
- **`src/hooks.server.ts`** — Added a PostHog reverse proxy (`/ingest` → `eu.i.posthog.com`) to bypass ad blockers, and server-side error tracking via `handleError`.
- **`src/routes/(app)/setup/+page.server.ts`** — Added server-side `user_signed_up` event (fires after a new user successfully chooses their username).
- **`src/routes/(app)/login/+page.svelte`** — Added `user_signed_in` event when a user clicks any OAuth provider button.
- **`src/routes/(app)/create/+page.svelte`** — Added `counter_created` and `dashboard_created` events on successful creation.
- **`src/routes/(app)/c/[id]/[[slug]]/+page.svelte`** — Added `counter_incremented`, `counter_followed`, `counter_unfollowed`, and `counter_deleted` events.
- **`src/routes/(app)/d/[id]/+page.svelte`** — Added `dashboard_followed`, `dashboard_unfollowed`, and `dashboard_deleted` events.
- **`src/routes/(app)/invitations/+page.svelte`** — Added `invitation_accepted` and `invitation_declined` events.

| Event                  | Description                                                      | File                                            |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `user_signed_up`       | User completed signup by choosing a username after OAuth login   | `src/routes/(app)/setup/+page.server.ts`        |
| `user_signed_in`       | User clicked a sign-in provider button (Google, Discord, Twitch) | `src/routes/(app)/login/+page.svelte`           |
| `counter_created`      | User successfully created a new counter                          | `src/routes/(app)/create/+page.svelte`          |
| `dashboard_created`    | User successfully created a new dashboard                        | `src/routes/(app)/create/+page.svelte`          |
| `counter_incremented`  | User incremented or decremented a counter value                  | `src/routes/(app)/c/[id]/[[slug]]/+page.svelte` |
| `counter_followed`     | User followed a counter to receive updates                       | `src/routes/(app)/c/[id]/[[slug]]/+page.svelte` |
| `counter_unfollowed`   | User unfollowed a counter                                        | `src/routes/(app)/c/[id]/[[slug]]/+page.svelte` |
| `counter_deleted`      | User permanently deleted a counter they own                      | `src/routes/(app)/c/[id]/[[slug]]/+page.svelte` |
| `dashboard_followed`   | User followed a dashboard to receive updates                     | `src/routes/(app)/d/[id]/+page.svelte`          |
| `dashboard_unfollowed` | User unfollowed a dashboard                                      | `src/routes/(app)/d/[id]/+page.svelte`          |
| `dashboard_deleted`    | User permanently deleted a dashboard they own                    | `src/routes/(app)/d/[id]/+page.svelte`          |
| `invitation_accepted`  | User accepted an invitation to join a counter or dashboard       | `src/routes/(app)/invitations/+page.svelte`     |
| `invitation_declined`  | User declined an invitation to join a counter or dashboard       | `src/routes/(app)/invitations/+page.svelte`     |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- 📊 [Analytics basics dashboard](https://eu.posthog.com/project/174330/dashboard/666905)
- 📈 [Sign-ups over time](https://eu.posthog.com/project/174330/insights/KaABKHTs)
- 🔐 [Sign-in provider breakdown](https://eu.posthog.com/project/174330/insights/YMbIIIfR)
- 🔁 [New user activation funnel](https://eu.posthog.com/project/174330/insights/JKIna9aU)
- ➕ [Counter increments over time](https://eu.posthog.com/project/174330/insights/sXDojIrr)
- 📬 [Invitation acceptance rate](https://eu.posthog.com/project/174330/insights/upDYwOo5)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
