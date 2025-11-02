import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { RedlockService } from '../redis/redis-lock.service';
import { MailService } from '../email/mail.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Prisma, Priority as PrismaPriority } from '@prisma/client';

const BUFFER_MINUTES = 15;
const AUTO_RELEASE_MINUTES = 10;

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}


function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date, buffer = BUFFER_MINUTES) {
  const aStartB = addMinutes(aStart, -buffer);
  const aEndB = addMinutes(aEnd, buffer);
  const bStartB = addMinutes(bStart, -buffer);
  const bEndB = addMinutes(bEnd, buffer);
  return aStartB < bEndB && bStartB < aEndB;
}

type AlternativeRoom = { id: string; name: string; capacity: number };

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private redlock: RedlockService,
    private mailService: MailService,
  ) { }


  private async resolveRoom(tx: Prisma.TransactionClient, dto: CreateBookingDto) {
    if (dto.roomId) {
      return tx.meetingRoom.findUnique({ where: { id: dto.roomId } });
    }
    if ((dto as any).roomName) {
      return tx.meetingRoom.findFirst({ where: { name: (dto as any).roomName } });
    }
    return null;
  }


  async listUserBookings(userId: string, from?: Date, to?: Date) {
    const where: any = { organizerId: userId };
    if (from) where.startTime = { gte: from };
    if (to) where.endTime = { lte: to };

    return this.prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { meetingRoom: true, organizer: true, ticket: true },
    });
  }


  async calendarView(day: Date) {
    // Ensure we have a valid date
    if (!(day instanceof Date) || isNaN(day.getTime())) {
      throw new BadRequestException('Invalid date provided to calendar view');
    }

    // Create start of day (midnight)
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);

    // Create end of day (next day midnight)
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: { startTime: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      include: { meetingRoom: true, organizer: true, ticket: true },
      orderBy: { startTime: 'asc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const b of bookings) {
      const roomName = (b.meetingRoom && b.meetingRoom.name) || 'Unassigned';
      grouped[roomName] = grouped[roomName] || [];
      grouped[roomName].push(b);
    }
    return grouped;
  }


  async findOptimalMeeting(request: any) {
    const needed = request.attendeesCount || 1;
    const allRooms = await this.prisma.meetingRoom.findMany();

    const candidates = allRooms.filter((r) => {
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
        OR: [{ startTime: { gte: windowStart, lte: windowEnd } }, { preferredStart: { gte: windowStart, lte: windowEnd } }],
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
          if (!b.startTime || !b.endTime) continue;
          const bookedStart = addMinutes(b.startTime, -BUFFER_MINUTES);
          const bookedEnd = addMinutes(b.endTime, BUFFER_MINUTES);
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
            if (!b.startTime || !b.endTime) continue;
            const bookedStart = addMinutes(b.startTime, -BUFFER_MINUTES);
            const bookedEnd = addMinutes(b.endTime, BUFFER_MINUTES);
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


  async createBooking(userId: string, dto: CreateBookingDto) {
    const start = new Date(dto.preferredStart);
    const end = addMinutes(start, dto.duration);


    const room = await this.resolveRoom(this.prisma, dto as any);
    if (!room) throw new BadRequestException('Room not found');


    let ticketId: string | null = null;
    if (dto.ticketTitle) {
      const ticket = await this.prisma.ticket.findFirst({ where: { title: dto.ticketTitle } });
      if (!ticket) throw new BadRequestException(`Ticket '${dto.ticketTitle}' not found`);
      ticketId = ticket.id;
    }


    const result = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          meetingRoomId: room.id,
          AND: [{ startTime: { lte: end } }, { endTime: { gte: start } }],
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });

      if (conflict) return null;

      const booking = await tx.booking.create({
        data: {
          organizerId: userId,
          meetingRoomId: room.id,
          ticketId,
          attendeesCount: dto.attendeesCount,
          duration: dto.duration,
          requiredEquipment: dto.requiredEquipment || [],
          preferredStart: start,
          flexibility: dto.flexibility,
          priority: dto.priority as PrismaPriority,
          ticketTitle: dto.ticketTitle ?? '',
          cost: room.hourlyRate * (dto.duration / 60),
          startTime: start,
          endTime: end,
          autoReleaseAt: addMinutes(start, AUTO_RELEASE_MINUTES),
          status: 'SCHEDULED',
        },
        include: { organizer: true, meetingRoom: true, ticket: true },
      });

      return booking;
    });

    if (result) {
      try {
        const organizerEmail = result.organizer?.email;
        if (organizerEmail) {
          await this.mailService.sendMail({
            to: organizerEmail,
            subject: 'Booking Confirmation — Smart Room',
            html: `<h2>Booking Created</h2>
                 <p><strong>Room:</strong> ${result.meetingRoom?.name ?? 'Unknown'}</p>
                 <p><strong>Start:</strong> ${result.startTime?.toISOString()}</p>
                 <p><strong>Duration:</strong> ${result.duration} minutes</p>
                 <p><strong>Attendees:</strong> ${result.attendeesCount}</p>
                 <p><strong>Ticket:</strong> ${result.ticket?.title ?? result.ticketTitle}</p>`,
          });
        }
      } catch (err) {
        console.error('Failed to send booking email', err);
      }

      this.events.broadcastBookingUpdate?.({ event: 'created', booking: result });
      return result;
    }

    const allRooms = await this.prisma.meetingRoom.findMany({
      where: { capacity: { gte: dto.attendeesCount } },
    });
    const alternativeRooms = allRooms.filter((r) => r.id !== room.id);

    const availableAlternatives: AlternativeRoom[] = [];
    for (const alt of alternativeRooms) {
      const altBooking = await this.prisma.booking.findFirst({
        where: {
          meetingRoomId: alt.id,
          AND: [{ startTime: { lte: end } }, { endTime: { gte: start } }],
          status: { in: ['SCHEDULED', 'PENDING'] },
        },
      });
      if (!altBooking) availableAlternatives.push({ id: alt.id, name: alt.name, capacity: alt.capacity });
    }

    if (!availableAlternatives.length) {
      throw new BadRequestException('Time conflict: room already booked and no alternatives available.');
    }

    return {
      message: 'Selected room is booked. Available alternatives:',
      alternatives: availableAlternatives,
    };
  }


  async getAllBookings() {
    return this.prisma.booking.findMany({
      include: { organizer: true, meetingRoom: true, ticket: true },
      orderBy: { startTime: 'desc' },
    });
  }


  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId) throw new ForbiddenException('Only organizer can cancel');

    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    this.events.broadcastBookingUpdate?.({ event: 'cancelled', booking: updated });
    return updated;
  }


  async checkIn(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.organizerId !== userId) throw new ForbiddenException('Only organizer can check-in');

    const now = new Date();
    const data: any = { startTime: now };
    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data });
    this.events.broadcastBookingUpdate?.({ event: 'checked-in', booking: updated });
    return updated;
  }


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
