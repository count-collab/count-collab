# Security & Rate Limiting Plan

## Outcome

Protect write endpoints from abuse and enforce predictable request limits under load.

## Work Packages

### 1) Input and request hardening

- [x] Validate `POST /create` payload with strict schema (title length, description length, visibility enum).
- [x] Validate `POST /c/:id` params and reject malformed UUIDs with `400`.
- [x] Add consistent error payloads for validation failures.

### 2) Rate limiting and anti-abuse

- [x] Add IP-based rate limiting in server hooks for write routes.
- [x] Add route-specific limits (`/create` lower threshold, `/c/:id` higher threshold).
- [x] Return `429` with `Retry-After` and structured log metadata.

### 3) CORS and transport security

- [x] Enforce explicit `ALLOWED_ORIGINS` in production (no wildcard fallback).
- [x] Add startup validation to fail fast when required security env vars are missing.
- [x] Confirm TLS termination and `X-Forwarded-*` handling at edge/proxy.

## Done Criteria

- [x] Sustained abuse traffic no longer degrades normal user write latency.
- [x] Invalid/malicious requests are rejected early and logged with request context.
- [x] Security settings are environment-driven and documented.
