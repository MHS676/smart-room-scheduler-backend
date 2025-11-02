# Technologies Used

This project uses the following core technologies. Rationale is provided for maintainers and future contributors.

- Node.js + TypeScript
  - Rationale: Strong typing with TypeScript, large ecosystem.

- NestJS
  - Rationale: Structured framework oriented around modules/controllers/providers. Good for large backends and teams.
  - Files: `src/app.module.ts`, feature modules under `src/`.

- Prisma (ORM)
  - Rationale: Type-safe DB access and migrations. Schema is in `prisma/schema.prisma` with migrations in `prisma/migrations/`.

- PostgreSQL
  - Rationale: Reliable relational DB with good transactional support (important for booking consistency).

- Redis
  - Rationale: Distributed locking (prevent double-booking), caching, and pub/sub for realtime coordination.
  - Files: `src/redis/redis-lock.service.ts`, `src/redis/redis.module.ts`.

- WebSockets (NestJS Gateway / Socket.IO)
  - Rationale: Realtime notifications for meetings/booking events. Gateways are in `src/events` and `src/meetings/gateway`.

- Email (nodemailer or similar)
  - Rationale: Send confirmations and reminders. Implemented in `src/email/mail.service.ts`.

- Job Scheduler / Cron
  - Rationale: Periodic work (reminders, cleanup). Implemented in `src/jobs/cron.jobs.ts`.

- Testing: Jest
  - Rationale: Unit and integration tests. See `test/` and `src/*/*.spec.ts` files.

- Dev tooling
  - ESLint + prettier (project contains `eslint.config.mjs`), tsconfig, and recommended CI setup for lint/test.

Optional / future tech
- Observability: OpenTelemetry, Prometheus + Grafana.
- Messaging: Kafka for high-volume eventing if system grows.
- Third-party calendar sync (Google/Outlook) for calendar integrations.
