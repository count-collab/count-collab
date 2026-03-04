# Real-Time Scaling Plan

## Outcome

Deliver low-latency updates without broadcasting unnecessary events to all clients.

## Work Packages

### 1) Scoped event delivery

- [ ] Move from global broadcast to counter-specific rooms.
- [ ] On page load, subscribe clients only to the active counter room.
- [ ] Emit updates only to impacted room members.

### 2) Multi-instance readiness

- [ ] Add Socket.IO adapter for distributed nodes (Redis adapter).
- [ ] Verify event propagation across multiple app instances.
- [ ] Add sticky session strategy at load balancer (if required by transport).

### 3) Reliability controls

- [ ] Add reconnect/backoff behavior validation on client side.
- [ ] Add heartbeat and disconnect metrics.
- [ ] Add per-event payload size checks.

## Done Criteria

- [ ] Event fan-out scales with interested users, not total connected users.
- [ ] Realtime updates remain consistent across horizontally scaled instances.
- [ ] Socket metrics are visible and alertable.
