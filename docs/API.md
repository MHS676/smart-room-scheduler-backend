# API Documentation

This file documents the public HTTP and WebSocket APIs exposed by the backend modules present in `src/`.

Authentication

- POST /auth/register
  - Description: Register a new user.
  - Body DTO: `auth/dto/register.dto.ts` (fields: name, email, password, role?)
  - Response: 201 Created { id, email, name, role }
  - Notes: Validate email uniqueness.

- POST /auth/login
  - Description: Login and receive JWT.
  - Body DTO: `auth/dto/login.dto.ts` (email, password)
  - Response: 200 { accessToken }

Users

- GET /users
  - Description: List users (admin only).
  - Guards: `roles.guard` with `Roles.ADMIN`.

- GET /users/:id
  - Description: Get user profile (self or admin).

Rooms

- GET /rooms
  - Description: List rooms with metadata (capacity, amenities).

- GET /rooms/:id
  - Description: Room details.

Bookings

- POST /bookings
  - Description: Create a booking for a room/time.
  - Body DTO: `bookings/dto/create-booking.dto.ts` (roomId, startTime, endTime, title, organizerId, attendees[])
  - Response: 201 Booking
  - Error: 409 Conflict if time slot already reserved.

- GET /bookings
  - Query params: roomId?, userId?, from?, to?
  - Description: Search or list bookings.

- PATCH /bookings/:id
  - Description: Update booking (time change, attendees).

- DELETE /bookings/:id
  - Description: Cancel booking; emits `booking.cancelled` event.

Meetings (realtime)

- WebSocket namespace: the app exposes a WebSocket gateway in `events/` and `meetings/gateway`.
- Typical events:
  - `meeting.created` -> payload: { meetingId, bookingId, roomId, startTime }
  - `meeting.updated` -> payload: { meetingId, ... }
  - `meeting.ended` -> payload: { meetingId }
  - `booking.created`, `booking.cancelled` similarly emitted.
- Authentication: Provide JWT during socket connect or via handshake query param.

Tickets

- POST /tickets
  - Description: Create support ticket for room issues.

Email / Notifications

- The server sends email notifications for confirmations and reminders via `email/mail.service.ts`.
- Consider exposing a `POST /email/test` during dev to validate SMTP config.

Errors and status codes

- 200 OK — success
- 201 Created — resource created
- 400 Bad Request — validation error
- 401 Unauthorized — missing/invalid JWT
- 403 Forbidden — role mismatch
- 404 Not Found — resource missing
- 409 Conflict — business conflict (double booking)

Examples

Create booking (curl):

  curl -X POST "https://api.example.com/bookings" \
    -H "Authorization: Bearer <JWT>" \
    -H "Content-Type: application/json" \
    -d '{"roomId":"room_123","startTime":"2025-11-03T09:00:00Z","endTime":"2025-11-03T10:00:00Z","title":"Team Sync"}'

WebSocket subscribe (JS):

  const socket = io('https://api.example.com', { auth: { token: '<JWT>' } });
  socket.on('meeting.created', (payload) => console.log(payload));

Notes

- For precise DTO/field definitions, inspect `src/**/dto/*.ts` files. This doc provides a reference; keep it synchronized with DTOs.
