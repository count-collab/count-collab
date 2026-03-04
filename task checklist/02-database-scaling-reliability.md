# Database Scaling & Reliability Plan

## Outcome

Ensure the database layer remains stable under high concurrency and recoverable during failures.

## Work Packages

### 1) Connection management

- [ ] Add connection pooling strategy (PgBouncer or managed pooling).
- [ ] Tune `postgres` client options (`max`, idle timeout, connect timeout).
- [ ] Add startup diagnostics for pool saturation risk.

### 2) Query and schema performance

- [ ] Add indexes for hot paths:
  - [ ] `counters(is_public, count desc, updated_at desc)`
  - [ ] `counter_history(counter_id, changed_at desc)`
- [ ] Add query timing logs for slow operations.
- [ ] Define and monitor DB SLOs (p95/p99 for reads/writes).

### 3) Resilience and recovery

- [ ] Define automated backup policy (daily full + WAL/point-in-time where possible).
- [ ] Test restore runbook in staging.
- [ ] Add alerting for connection failures, replication lag, and disk usage.

## Done Criteria

- [ ] DB handles expected peak concurrency without exhausting connections.
- [ ] Restore drill passes with documented recovery time objective.
- [ ] Indexes and query plans are validated for production load profile.
