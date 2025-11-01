// src/bookings/bookings.service.ts
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { RedlockService } from '../redis/redis-lock.service';
import { MailService } from '../email/mail.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Prisma } from '@prisma/client';

const BUFFER_MINUTES = 15;
const AUTO_RELEASE_MINUTES = 10;

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

// -----------------------------
// Types
// -----------------------------
type AlternativeRoom = {
  id: string;
  name: string;
  capacity: number;
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private redlock: RedlockService,
    private mailService: MailService,
  ) {}

  // -----------------------------
  // List user bookings
  // -----------------------------
  async listUserBookings(userId: string, from?: Date, to?: Date) {
    const where: any = { OR: [{ organizerId: userId }] };
    if (from && to) where.AND = [{ startTime: { gte: from } }, { endTime: { lte: to } }];
    return this.prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { meetingRoom: true, organizer: true, ticket: true },
    });
  }

  // -----------------------------
  // Calendar view grouped by room
  // -----------------------------
  async calendarView(day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: { startTime: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      include: { meetingRoom: true, organizer: true, ticket: true },
    });

    const grouped: Record<string, any[]> = {};
    for (const b of bookings) {
      const roomName = b.meetingRoom?.name || 'Unassigned';
      grouped[roomName] = grouped[roomName] || [];
      grouped[roomName].push(b);
    }
    return grouped;
  }

  // -----------------------------
  // Find optimal meeting (alternative suggestions)
  // -----------------------------
  async findOptimalMeeting(request: any) {
    const needed = request.attendeesCount || 1;
    const allRooms = await this.prisma.meetingRoom.findMany();

    const candidates = allRooms.filter(r => {
      if (r.capacity < needed) return false;
      for (const eq of (request.requiredEquipment || [])) if (!r.equipment.includes(eq)) return false;
      return true;
    });

    if (!candidates.length) return { alternativeOptions: [] };

    const pref = new Date(request.preferredStart);
    const flex = request.flexibility || 0;
    const windowStart = addMinutes(pref, -flex - request.duration - BUFFER_MINUTES - 60);
    const windowEnd = addMinutes(pref, flex + request.duration + BUFFER_MINUTES + 60);

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        OR: [
          { startTime: { gte: windowStart, lte: windowEnd } },
          { preferredStart: { gte: windowStart, lte: windowEnd } },
        ],
        status: { in: ['SCHEDULED', 'PENDING'] },
      },
    });

    const largest = candidates.reduce((a, b) => (a.capacity > b.capacity ? a : b), candidates[0]);
    const STEP = 5;
    const options: any[] = [];
    const weights = { wPriority: 10000, wUtil: 1, wCost: 50, wShift: 2 };

    function priorityScore(p: string) {
      switch (p) {
        case 'URGENT': return 1000;
        case 'HIGH': return 500;
        case 'NORMAL': return 100;
        case 'LOW': return 10;
        default: return 0;
      }
    }

    for (const room of candidates) {
      for (let delta = -flex; delta <= flex; delta += STEP) {
        const start = addMinutes(pref, delta);
        const end = addMinutes(start, request.duration);
        if (end <= new Date()) continue;

        let conflict = false;
        for (const b of existingBookings) {
          if (!b.meetingRoomId || b.meetingRoomId !== room.id) continue;
          const bookedStart = addMinutes(b.startTime || b.preferredStart, -BUFFER_MINUTES);
          const bookedEnd = addMinutes(
            b.endTime || addMinutes(b.startTime || b.preferredStart, b.duration || request.duration),
            BUFFER_MINUTES
          );
          if (overlaps(start, end, bookedStart, bookedEnd)) { conflict = true; break; }
        }
        if (conflict) continue;

        const unusedSeats = Math.max(0, room.capacity - needed);
        const minutesShifted = Math.abs(delta);
        const pScore = priorityScore(request.priority || 'NORMAL');
        const score = weights.wPriority * pScore - weights.wUtil * unusedSeats - weights.wCost * room.hourlyRate - weights.wShift * minutesShifted;
        const costOpt = Math.max(0, (largest.hourlyRate - room.hourlyRate) * (request.duration / 60));
        options.push({ room, start, end, score, costOpt });
      }
    }

    options.sort((a, b) => b.score - a.score);
    if (!options.length) {
      const fallback: any[] = [];
      for (const room of candidates) {
        const horizon = 4 * 60;
        for (let delta = 0; delta <= horizon; delta += STEP) {
          const start = addMinutes(pref, delta + flex + BUFFER_MINUTES);
          const end = addMinutes(start, request.duration);
          let conflict = false;
          for (const b of existingBookings) {
            if (!b.meetingRoomId || b.meetingRoomId !== room.id) continue;
            const bookedStart = addMinutes(b.startTime || b.preferredStart, -BUFFER_MINUTES);
            const bookedEnd = addMinutes(
              b.endTime || addMinutes(b.startTime || b.preferredStart, b.duration || request.duration),
              BUFFER_MINUTES
            );
            if (overlaps(start, end, bookedStart, bookedEnd)) { conflict = true; break; }
          }
          if (!conflict) { fallback.push({ room, start }); break; }
        }
      }
      return { alternativeOptions: fallback };
    }

    const top = options[0];
    const alt = options.slice(1, 6).map(o => ({ room: o.room, time: o.start }));
    return { recommendedRoom: top.room, suggestedTime: top.start, alternativeOptions: alt, costOptimization: top.costOpt };
  }

  // -----------------------------
  // Create booking with alternative suggestions
  // -----------------------------
  async createBooking(userId: string, dto: CreateBookingDto) {
    const start = new Date(dto.preferredStart);
    const end = addMinutes(start, dto.duration);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const room = await tx.meetingRoom.findUnique({ where: { id: dto.roomId } });
      if (!room) throw new BadRequestException('Room not found');

              let ticketId: string | null = null;
        if (dto.ticketTitle) {
            const ticket = await tx.ticket.findFirst({ where: { title: dto.ticketTitle } });
            if (ticket) ticketId = ticket.id;
        }

      const conflict = await tx.booking.findFirst({
        where: {
          meetingRoomId: dto.roomId,
          AND: [{ startTime: { lte: end } }, { endTime: { gte: start } }],
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });

      if (!conflict) {
        return this.createAndNotify(tx, userId, dto, start, end, room);
      }

      // Suggest alternatives
      const allRooms = await tx.meetingRoom.findMany({ where: { capacity: { gte: dto.attendeesCount } } });
      const alternativeRooms = allRooms.filter(r => r.id !== dto.roomId);

      const availableAlternatives: AlternativeRoom[] = [];
      for (const alt of alternativeRooms) {
        const altConflict = await tx.booking.findFirst({
          where: {
            meetingRoomId: alt.id,
            AND: [{ startTime: { lte: end } }, { endTime: { gte: start } }],
            status: { in: ['SCHEDULED', 'PENDING'] },
          },
        });
        if (!altConflict) {
          availableAlternatives.push({ id: alt.id, name: alt.name, capacity: alt.capacity });
        }
      }

      if (!availableAlternatives.length) {
        throw new BadRequestException('Time conflict: room already booked and no alternatives available.');
      }

      return { message: 'Selected room is booked. Available alternatives:', alternatives: availableAlternatives };
    });
  }

  async getAllBookings() {
    return this.prisma.booking.findMany({
      include: {
        organizer: true,
        meetingRoom: true,
        ticket: true,
      },
    });
  }

  // -----------------------------
  // Create and notify
  // -----------------------------
  private async createAndNotify(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateBookingDto,
    start: Date,
    end: Date,
    room: { id: string; name: string; hourlyRate: number },
  ) {
    const booking = await tx.booking.create({
      data: {
        organizerId: userId,
        meetingRoomId: room.id,
        attendeesCount: dto.attendeesCount,
        duration: dto.duration,
        requiredEquipment: dto.requiredEquipment,
        preferredStart: start,
        flexibility: dto.flexibility,
        priority: dto.priority,
        ticketTitle: dto.ticketTitle,
        ticketId: dto.ticketTitle,
        startTime: start,
        endTime: end,
        status: 'SCHEDULED',
        autoReleaseAt: addMinutes(start, AUTO_RELEASE_MINUTES),
        cost: room.hourlyRate * (dto.duration / 60),
      },
      include: { organizer: true, meetingRoom: true, ticket: true },
    });

    try {
      if (booking.organizer?.email) {
        await this.mailService.sendMail({
          to: booking.organizer.email,
          subject: 'Booking Confirmation — Smart Room',
          html: `<h2>Booking Created</h2>
                 <p><strong>Room:</strong> ${booking.meetingRoom?.name ?? 'Unknown'}</p>
                 <p><strong>Start:</strong> ${booking.startTime?.toISOString()}</p>
                 <p><strong>Duration:</strong> ${booking.duration} minutes</p>
                 <p><strong>Attendees:</strong> ${booking.attendeesCount}</p>
                 <p><strong>Ticket:</strong> ${booking.ticketTitle}</p>`,
        });
      }
    } catch (err) {
      console.error('Failed to send booking email', err);
    }

    this.events.broadcastBookingUpdate?.({ event: 'created', booking });
    return booking;
  }

  // -----------------------------
  // Cancel booking
  // -----------------------------
  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId) throw new ForbiddenException('Only organizer can cancel');

    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    this.events.broadcastBookingUpdate?.({ event: 'cancelled', booking: updated });
    return updated;
  }

  // -----------------------------
  // Check-in
  // -----------------------------
  async checkIn(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId) throw new ForbiddenException('Only organizer can check-in');

    const now = new Date();
    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'SCHEDULED', startTime: now } });
    this.events.broadcastBookingUpdate?.({ event: 'checked-in', booking: updated });
    return updated;
  }

  // -----------------------------
  // Release unused bookings
  // -----------------------------
  async releaseUnusedBookings() {
    const now = new Date();
    const toRelease = await this.prisma.booking.findMany({ where: { status: 'SCHEDULED', autoReleaseAt: { lt: now } } });
    const released: any[] = [];
    for (const b of toRelease) {
      const updated = await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'RELEASED' } });
      released.push(updated);
      this.events.broadcastBookingUpdate?.({ event: 'released', bookingId: b.id });
    }
    return { released: released.length };
  }
}
