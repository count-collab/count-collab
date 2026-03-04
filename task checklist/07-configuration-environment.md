# Configuration & Environment Plan

## Outcome

Make configuration explicit, validated, and safe across local, staging, and production.

## Work Packages

### 1) Environment contract

- [ ] Add `.env.example` with all required keys and descriptions.
- [ ] Introduce startup env validation (required keys, format checks).
- [ ] Remove insecure production fallbacks for `DATABASE_URL` and origins.

### 2) Secrets handling

- [ ] Move secrets to managed secret store or secure CI/CD secret injection.
- [ ] Define secret rotation policy and emergency revocation process.
- [ ] Ensure deployment logs never print credentials.

### 3) Environment parity

- [ ] Add staging environment with production-like topology.
- [ ] Validate deploy scripts against staging before main branch release.
- [ ] Document all env differences and justification.

## Done Criteria

- [ ] App fails fast when env is invalid instead of running partially configured.
- [ ] No production secret is hardcoded or persisted in repo artifacts.
- [ ] Staging mirrors production enough to catch config regressions.
