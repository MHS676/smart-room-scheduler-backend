# Risk Assessment & Mitigation

This document lists major risks to the system and recommended mitigations.

1) Double-booking due to race conditions
- Likelihood: Medium
- Impact: High
- Mitigation: Use DB transactions plus Redis per-room distributed locks (code already includes `redis-lock.service.ts` and an interceptor). Add automated tests that simulate concurrent booking attempts.

2) Data loss / corruption
- Likelihood: Low
- Impact: High
- Mitigation: Regular DB backups, test restores, migrate via Prisma Migrate with careful review, use migration testing in staging.

3) Unauthorized access / broken auth
- Likelihood: Low–Medium
- Impact: High
- Mitigation: Use JWT with strong secrets, rotate keys, enforce RBAC using `roles.guard.ts`, add unit/integration tests for auth boundaries, use rate-limiting.

4) Email delivery failures
- Likelihood: Medium
- Impact: Medium
- Mitigation: Use reliable SMTP provider, add retry logic and dead-letter queue for failed messages, surface notifications in admin UI.

5) WebSocket scaling / lost events
- Likelihood: Medium
- Impact: Medium
- Mitigation: Use Redis pub/sub or adapter for Socket.IO to scale across instances. Consider durable eventing for critical notifications (persist events).

6) Secrets leakage
- Likelihood: Low–Medium
- Impact: High
- Mitigation: Store secrets in environment/secret manager, never commit `.env` files, use CI secret stores.

7) Long-running cron tasks causing contention
- Likelihood: Low–Medium
- Impact: Medium
- Mitigation: Ensure cron jobs use locks, schedule off-peak, and have timeouts.

8) Performance under peak load
- Likelihood: Medium
- Impact: Medium–High
- Mitigation: Load test booking flow, add DB indexes, cache read-mostly endpoints, and profile slow queries.

Residual risks and monitoring
- Add logging, alerts for high error rates, and SLOs to detect and respond to incidents quickly.
