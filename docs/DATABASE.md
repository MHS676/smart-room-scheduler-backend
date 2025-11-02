# Database Design (Prisma + Postgres)

This document summarizes the recommended data model. The repository contains `prisma/schema.prisma` — review it for the canonical schema. The examples below are a compatible representation to help understand relationships and queries.

## Core models (conceptual)

- User
  - id: UUID (PK)
  - name
  - email (unique)
  - passwordHash
  - role (enum: ADMIN, USER)
  - createdAt, updatedAt

- Room
  - id: UUID (PK)
  - name
  - capacity
  - location
  - amenities (json or separate table)
  - createdAt, updatedAt

- Booking
  - id: UUID (PK)
  - roomId -> Room.id (FK)
  - organizerId -> User.id (FK)
  - startTime (timestamp with tz)
  - endTime (timestamp with tz)
  - title, description
  - status (enum: CONFIRMED, CANCELLED)
  - createdAt, updatedAt
  - indexes: (roomId, startTime, endTime) to accelerate conflict checks

- Meeting
  - id: UUID
  - bookingId -> Booking.id (FK) (one-to-one or optional)
  - externalMeetingUrl (nullable)
  - joinCode
  - state (SCHEDULED, ACTIVE, ENDED)

- Ticket
  - id: UUID
  - createdBy -> User.id
  - roomId -> Room.id (nullable)
  - title, description, status

## Example Prisma model (abridged)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  bookings  Booking[]
  createdAt DateTime @default(now())
}

model Room {
  id        String   @id @default(uuid())
  name      String
  capacity  Int
  bookings  Booking[]
}

model Booking {
  id         String   @id @default(uuid())
  room       Room     @relation(fields: [roomId], references: [id])
  roomId     String
  organizer  User     @relation(fields: [organizerId], references: [id])
  organizerId String
  startTime  DateTime
  endTime    DateTime
  status     BookingStatus @default(CONFIRMED)
  createdAt  DateTime @default(now())
}
```

## Preventing double-bookings

- Use a DB transaction to check for overlapping bookings then insert.
- Use a Redis-based distributed lock per-room (e.g., `lock:room:<roomId>`) to avoid race conditions across app instances. The repo already contains `redis-lock.service.ts` and `redis-lock.interceptor`.

## Indexes & performance

- Index frequent query patterns: (roomId, startTime), (organizerId, startTime), createdAt.
- Partitioning or sharding generally unnecessary initially; focus on query tuning.

## Migrations

- Use Prisma Migrate. Migrations are in `prisma/migrations/` in repo.
- Run `npx prisma migrate deploy` in CI/CD to apply migrations to the target DB.

## Backups & retention

- Regular DB backups (daily full, hourly incremental for high-traffic systems).
- Retain audit logs for booking changes for at least 90 days (policy can vary).

## Sample queries

- Check for overlapping booking (Postgres):

  SELECT 1 FROM "Booking" WHERE "roomId" = $1 AND NOT ("endTime" <= $2 OR "startTime" >= $3) LIMIT 1;

- Find upcoming bookings for a room:

  SELECT * FROM "Booking" WHERE "roomId" = $1 AND "startTime" >= now() ORDER BY "startTime";

## Next steps

- Produce an ER diagram (draw.io / Mermaid) from actual `prisma/schema.prisma`.
- Add explicit migration & seed docs (repo has `prisma/seed.ts`) to `docs/`.
