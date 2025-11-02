# Development Roadmap

This roadmap is a recommended phased plan to bring the backend from current state to stable production deployment.

Phase 0 — Local dev and hygiene (0–2 weeks)
- Ensure `README.md` in project root contains local setup (env vars, DB, Redis).
- Add `.env.example` (if not present) with required keys: DATABASE_URL, REDIS_URL, JWT_SECRET, SMTP_*.
- Create developer run script and Docker Compose for local Postgres and Redis.
- Add linting and basic unit tests.

Phase 1 — Test, CI, and quality (2–4 weeks)
- Add Jest unit tests and integration tests for critical paths (booking creation & conflict prevention).
- Configure CI pipeline: install deps, run lint, run tests, run Prisma migrate status.
- Add code coverage and fail build on critical regressions.

Phase 2 — Staging and E2E (2–4 weeks)
- Provision staging environment (managed Postgres, Redis).
- Run full E2E tests (test/ contains e2e starter) and smoke tests on deploy.
- Instrument metrics and logging.

Phase 3 — Production rollout (2–6 weeks)
- Harden security: review auth/roles, rate limiting, CORS policies.
- Set up backups, alerting, and SLOs.
- Add migration strategy (blue/green or rolling migrations) and deploy with zero-downtime concerns.

Phase 4 — Scale & polish (ongoing)
- Horizontal scaling of WebSocket layer (Socket.IO Redis adapter or a managed ws gateway).
- Performance tuning for heavy booking loads.
- Add features: calendar integrations, resource booking policies, analytics dashboard.

Milestones & acceptance criteria
- M1 (Local dev): Developer can run app locally via Docker Compose and run tests.
- M2 (CI): PRs run tests and lint, and merge gating is enforced.
- M3 (Staging): End-to-end flows succeed in staging for 1 week.
- M4 (Production): No critical incidents for 30 days after rollout.

Notes
- Sprint planning: break roadmap items into ~1–2 week sprints depending on team size.
- Prioritize test coverage for booking conflict logic and security-critical endpoints.
