# System Architecture

This document describes the high-level architecture for the Smart Room Scheduler backend located in the repository root. The application is a NestJS (TypeScript) server providing REST and WebSocket APIs, persisting data via Prisma to a relational database (Postgres), and using Redis for locking and realtime coordination.

## High-level components

- NestJS application
  - Modular structure: `auth`, `bookings`, `meetings`, `rooms`, `tickets`, `users`, `email`, `events`, `jobs`, `redis`, `prisma`
  - Controllers expose HTTP API endpoints.
  - WebSocket gateway in `events/` and `meetings/gateway` for realtime events.
  - Cron jobs in `jobs/cron.jobs.ts` for scheduled tasks (cleanups, reminders).

- Database
  - Prisma ORM (folder `prisma/`) manages schema and migrations.
  - Production DB: PostgreSQL (recommended). Prisma schema models represent Users, Rooms, Bookings, Meetings, Tickets, etc.

- Cache / Coordination
  - Redis is used for distributed locks (`redis-lock.service.ts`) and can be used for ephemeral caches, job coordination and pub/sub for events.

- Email
  - `email/mail.service.ts` handles sending notifications (e.g., booking confirmations, reminders).

- External interfaces
  - Clients call REST endpoints or open WebSocket connections to receive realtime updates (meeting start, booking changes).

## Data flow (common flows)

1. Create booking (HTTP POST /bookings)
   - Request hits `bookings.controller` -> `bookings.service`.
   - Service obtains a Redis lock (if necessary) to prevent race conditions (two simultaneous bookings for same room/time).
   - Service validates against existing bookings in DB (Prisma queries). If passes, create Booking record and related Meeting if applicable.
   - Emit a WebSocket event on `events.gateway` (or meetings gateway) to notify subscribed clients.
   - Send email confirmation via `mail.service` (async job or background task).

2. Meeting lifecycle (WebSocket)
   - Clients connect to WebSocket endpoint exposed by `meetings.gateway` / `events.gateway`.
   - Server sends events: `meeting.created`, `meeting.updated`, `meeting.ended`, `booking.cancelled`.

## Deployment considerations

- Containers: Build a Dockerfile for the NestJS app. Run migrations at startup (or as a deployment step) using Prisma CLI.
- Environment variables: keep secrets out of repo (use `.env`). Example env keys: DATABASE_URL, REDIS_URL, JWT_SECRET, MAILER_*.
- Horizontal scaling: Use Redis locks and a shared DB to allow multiple app instances. For WebSocket scaling, use a Redis adapter (Socket.IO-Redis) or an external gateway/service.
- Health checks: `/health` endpoint and readiness/liveness probes for orchestrators (K8s).

## Contracts and assumptions

- Authentication: JWT-based (`auth` module). HTTP endpoints enforce guards (`jwt-auth.guard.ts`, `roles.guard.ts`).
- Timezones: All server timestamps stored in UTC; clients specify/display local timezone.
- Idempotency: Booking endpoints should handle retries safely (idempotency key recommended).

## Non-functional requirements

- Availability: aim for 99.9% SLA for booking operations.
- Consistency: Strong consistency for bookings to prevent double-booking.
- Security: Input validation (DTOs), auth/roles, secure storage of secrets.

## Observability

- Logging (structured logs)
- Metrics (request latency, error rates, bookings/sec)
- Tracing for request flows (optional: OpenTelemetry)

## Next steps / Gaps

- Add an architecture diagram (PNG/SVG). The current repo contains the building blocks but not an image diagram; add to `docs/diagrams/`.
- Add explicit WebSocket message schema definitions in `API.md`.
