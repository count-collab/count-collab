# Production Features & Resilience Plan

## Outcome

Introduce controls that reduce blast radius and keep core functionality available during partial outages.

## Work Packages

### 1) Feature control plane

- [ ] Add feature flags for risky rollouts (new socket behavior, cache strategies).
- [ ] Add per-environment flag configuration and safe defaults.
- [ ] Add emergency kill switch for non-critical features.

### 2) Graceful degradation

- [ ] Define fallback behavior when realtime layer is unavailable (polling mode).
- [ ] Define fallback behavior when DB is degraded (read-only mode where possible).
- [ ] Add user-facing service status messaging for degraded modes.

### 3) Failure containment

- [ ] Add circuit breaker and retry budget around critical external dependencies.
- [ ] Add request-level timeout policies to avoid thread/event-loop exhaustion.
- [ ] Add idempotency safeguards for increment retries.

## Done Criteria

- [ ] High-risk features can be disabled instantly without redeploy.
- [ ] Core read/write paths remain available during partial subsystem failures.
- [ ] Recovery behavior is tested and documented.
