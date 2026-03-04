# Database Migrations Plan

## Outcome

Ship schema changes safely with repeatable forward and rollback procedures.

## Work Packages

### 1) Migration workflow hardening

- [ ] Move from direct `db:push` in production to reviewed, versioned migration scripts.
- [ ] Require migration review checklist before merge (lock impact, index build strategy).
- [ ] Add pre-deploy migration dry-run in staging.

### 2) Zero-downtime strategy

- [ ] Use expand-and-contract migration patterns for breaking schema changes.
- [ ] Avoid blocking DDL during peak windows.
- [ ] Add migration timeout and retry policy.

### 3) Rollback and data safety

- [ ] Define rollback strategy per migration type.
- [ ] Snapshot backup before high-risk schema changes.
- [ ] Document data backfill processes and validation queries.

## Done Criteria

- [ ] All production schema changes are tracked and reversible.
- [ ] Migrations run successfully in staging before production.
- [ ] Rollback runbook is tested and current.
