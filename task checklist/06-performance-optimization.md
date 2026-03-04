# Performance Optimization Plan

## Outcome

Reduce backend and frontend latency for peak traffic while controlling cost.

## Work Packages

### 1) Data access optimization

- [ ] Cache hot public counter lists (short TTL) using Redis or edge cache.
- [ ] Cache single counter reads where consistency tolerance allows.
- [ ] Add invalidation hooks on counter creation and increment.

### 2) App runtime performance

- [ ] Profile critical endpoints (`/`, `/counters`, `/c/:id`, increment API).
- [ ] Optimize heavy DB calls and remove N+1 patterns.
- [ ] Add response compression and confirm static asset caching headers.

### 3) Capacity validation

- [ ] Define target QPS and concurrent socket baselines.
- [ ] Run load tests and compare p95/p99 before and after optimizations.
- [ ] Capture performance budget thresholds in CI/reporting.

## Done Criteria

- [ ] p95 route latency meets target under expected peak load.
- [ ] Cache hit ratio and DB load reduction are measurable.
- [ ] Performance regressions are visible before production rollout.
