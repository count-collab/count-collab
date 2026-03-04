# Security & Rate Limiting Plan

## Outcome

Protect write endpoints from abuse and enforce predictable request limits under load.

## Work Packages

### 1) Input and request hardening

- [x] Validate `POST /create` payload with strict schema (title length, description length, visibility enum).
- [x] Validate `POST /c/:id` params and reject malformed UUIDs with `400`.
- [x] Add consistent error payloads for validation failures.

### 2) Rate limiting and anti-abuse

- [ ] Add IP-based rate limiting in server hooks for write routes.
- [ ] Add route-specific limits (`/create` lower threshold, `/c/:id` higher threshold).
- [ ] Return `429` with `Retry-After` and structured log metadata.
- [ ] Add basic abuse signals (rapid repeated increments per IP and counter).

### 3) CORS and transport security

- [ ] Enforce explicit `ALLOWED_ORIGINS` in production (no wildcard fallback).
- [ ] Add startup validation to fail fast when required security env vars are missing.
- [ ] Confirm TLS termination and `X-Forwarded-*` handling at edge/proxy.

## Done Criteria

- [ ] Sustained abuse traffic no longer degrades normal user write latency.
- [ ] Invalid/malicious requests are rejected early and logged with request context.
- [ ] Security settings are environment-driven and documented.
