// src/bookings/bookings.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    if (from && to)
      where.AND = [{ startTime: { gte: from } }, { endTime: { lte: to } }];
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
  // Create Booking (auto resolve room + ticket)
  // -----------------------------
  async createBooking(userId: string, dto: CreateBookingDto) {
    const start = new Date(dto.preferredStart);
    const end = addMinutes(start, dto.duration);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // ✅ 1. Find meeting room by name
      const room = await tx.meetingRoom.findUnique({
        where: { name: dto.roomName },
      });
      if (!room)
        throw new BadRequestException(
          `Room "${dto.roomName}" not found`,
        );

      // ✅ 2. Find ticket by title
      let ticketId: string | null = null;
      if (dto.ticketTitle) {
        const ticket = await tx.ticket.findFirst({
          where: { title: dto.ticketTitle },
        });
        if (!ticket)
          throw new BadRequestException(
            `Ticket "${dto.ticketTitle}" not found`,
          );
        ticketId = ticket.id;
      }

      // ✅ 3. Check for conflicts
      const conflict = await tx.booking.findFirst({
        where: {
          meetingRoomId: room.id,
          AND: [{ startTime: { lte: end } }, { endTime: { gte: start } }],
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });

      if (conflict) {
        // Suggest alternative rooms if conflict found
        const allRooms = await tx.meetingRoom.findMany({
          where: { capacity: { gte: dto.attendeesCount } },
        });
        const alternativeRooms = allRooms.filter(r => r.id !== room.id);

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
            availableAlternatives.push({
              id: alt.id,
              name: alt.name,
              capacity: alt.capacity,
            });
          }
        }

        if (!availableAlternatives.length) {
          throw new BadRequestException(
            'Time conflict: room already booked and no alternatives available.',
          );
        }

        return {
          message:
            'Selected room is booked. Available alternatives:',
          alternatives: availableAlternatives,
        };
      }

      // ✅ 4. Create booking and notify
      return this.createAndNotify(tx, userId, dto, start, end, room, ticketId);
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
    ticketId: string | null,
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
        ticketId: ticketId,
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

    this.events?.broadcastBookingUpdate?.({ event: 'created', booking });
    return booking;
  }

  // -----------------------------
  // Get All Bookings
  // -----------------------------
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
  // Cancel booking
  // -----------------------------
  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId)
      throw new ForbiddenException('Only organizer can cancel');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
    this.events.broadcastBookingUpdate?.({
      event: 'cancelled',
      booking: updated,
    });
    return updated;
  }

  // -----------------------------
  // Check-in
  // -----------------------------
  async checkIn(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId)
      throw new ForbiddenException('Only organizer can check-in');

    const now = new Date();
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'SCHEDULED', startTime: now },
    });
    this.events.broadcastBookingUpdate?.({
      event: 'checked-in',
      booking: updated,
    });
    return updated;
  }

  // -----------------------------
  // Release unused bookings
  // -----------------------------
  async releaseUnusedBookings() {
    const now = new Date();
    const toRelease = await this.prisma.booking.findMany({
      where: {
        status: 'SCHEDULED',
        autoReleaseAt: { lt: now },
      },
    });

    const released: any[] = [];
    for (const b of toRelease) {
      const updated = await this.prisma.booking.update({
        where: { id: b.id },
        data: { status: 'RELEASED' },
      });
      released.push(updated);
      this.events.broadcastBookingUpdate?.({
        event: 'released',
        bookingId: b.id,
      });
    }
    return { released: released.length };
  }
}
