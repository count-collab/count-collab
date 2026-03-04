# Observability & Monitoring Plan

## Outcome

Make incidents detectable quickly and diagnosable with minimal guesswork.

## Work Packages

### 1) Logging foundation

- [ ] Standardize JSON logs with level, timestamp, request id, route, status, and duration.
- [ ] Add correlation id propagation from request entry to DB and socket events.
- [ ] Remove raw `console.*` usage in server routes and health endpoints.

### 2) Metrics and dashboards

- [ ] Add core app metrics (request rate, error rate, latency, active sockets).
- [ ] Add DB metrics (connections, slow queries, failed queries).
- [ ] Build production dashboard with p50/p95/p99 latency and error budgets.

### 3) Alerting and incident readiness

- [ ] Configure alerts for 5xx spikes, elevated latency, DB disconnects, and socket churn.
- [ ] Add error tracking integration (e.g., Sentry) for uncaught exceptions.
- [ ] Document on-call response runbook.

## Done Criteria

- [ ] Production issues can be detected in under 5 minutes.
- [ ] Every failing request can be traced with a correlation id.
- [ ] Alert noise is acceptable and actionable.
