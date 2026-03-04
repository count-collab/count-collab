# Infrastructure & Deployment Plan

## Outcome

Run production with predictable deploys, safe rollouts, and horizontal scaling support.

## Work Packages

### 1) Container and runtime hardening

- [ ] Set CPU and memory limits/requests for app and DB containers.
- [ ] Add graceful shutdown handling for HTTP and Socket.IO.
- [ ] Ensure health and readiness probes cover app and DB dependencies.

### 2) Deployment strategy

- [ ] Replace `latest` image strategy with immutable versioned tags.
- [ ] Implement rolling or blue/green deployment workflow.
- [ ] Add automatic rollback when health checks fail.

### 3) Edge and traffic management

- [ ] Put load balancer/reverse proxy in front of app nodes.
- [ ] Enable gzip/brotli, keep-alive tuning, and sane timeouts.
- [ ] Validate HTTPS, certificate renewal, and secure headers.

## Done Criteria

- [ ] Deployments are reproducible and rollback is one command.
- [ ] Service remains available during app updates.
- [ ] Infrastructure limits prevent noisy-neighbor failures.
