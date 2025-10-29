import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

const BUFFER_MINUTES = 15;
const AUTO_RELEASE_MINUTES = 10;

function addMinutes(d: Date, m: number) {
    return new Date(d.getTime() + m * 60000);
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService, private events: EventsGateway) { }

    // List bookings for a user or date range
    async listUserBookings(userId: string, from?: Date, to?: Date) {
        const where: any = {
            OR: [{ organizerId: userId }, { attendees: { has: userId } }]
        };
        if (from && to) {
            where.AND = [
                { startTime: { gte: from } },
                { endTime: { lte: to } }
            ];
        }
        return this.prisma.booking.findMany({ where, orderBy: { startTime: 'asc' } });
    }

    // calendar view by day: returns bookings grouped by room
    async calendarView(day: Date) {
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);

        const bookings = await this.prisma.booking.findMany({
            where: { startTime: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
            include: { room: true, organizer: true }
        });

        // group by room
        const grouped: Record<string, any[]> = {};
        for (const b of bookings) {
            const roomName = b.room?.name || 'Unassigned';
            grouped[roomName] = grouped[roomName] || [];
            grouped[roomName].push(b);
        }
        return grouped;
    }

    // findOptimalMeeting: returns recommendedRoom, suggestedTime, alternatives, costOptimization
    async findOptimalMeeting(request: any) {
        const needed = (request.attendees?.length || 0) + 1;
        const allRooms = await this.prisma.meetingRoom.findMany();
        const candidates = allRooms.filter(r => {
            if (r.capacity < needed) return false;
            for (const eq of (request.requiredEquipment || [])) {
                if (!r.equipment.includes(eq)) return false;
            }
            return true;
        });
        if (!candidates.length) return { alternativeOptions: [] };

        const pref = new Date(request.preferredStart);
        const flex = request.flexibility || 0;
        // fetch bookings that might conflict in the window
        const windowStart = addMinutes(pref, -flex - request.duration - BUFFER_MINUTES - 60);
        const windowEnd = addMinutes(pref, flex + request.duration + BUFFER_MINUTES + 60);

        const existingBookings = await this.prisma.booking.findMany({
            where: {
                OR: [
                    { startTime: { gte: windowStart, lte: windowEnd } },
                    { preferredStart: { gte: windowStart, lte: windowEnd } }
                ],
                status: { in: ['SCHEDULED', 'PENDING'] }
            }
        });

        const largest = candidates.reduce((a, b) => a.capacity > b.capacity ? a : b, candidates[0]);
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

                // check conflict using bookings for that room
                let conflict = false;
                for (const b of existingBookings) {
                    if (!b.roomId || b.roomId !== room.id) continue;
                    const bookedStart = addMinutes(b.startTime || b.preferredStart, -BUFFER_MINUTES);
                    const bookedEnd = addMinutes(b.endTime || addMinutes(b.startTime || b.preferredStart, b.duration || request.duration), BUFFER_MINUTES);
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
            // produce fallback alternatives: next available times after window
            const fallback: any[] = [];
            for (const room of candidates) {
                // scan next 4 hours in STEP
                const horizon = 4 * 60; // minutes
                for (let delta = 0; delta <= horizon; delta += STEP) {
                    const start = addMinutes(pref, delta + flex + BUFFER_MINUTES);
                    const end = addMinutes(start, request.duration);
                    let conflict = false;
                    for (const b of existingBookings) {
                        if (!b.roomId || b.roomId !== room.id) continue;
                        const bookedStart = addMinutes(b.startTime || b.preferredStart, -BUFFER_MINUTES);
                        const bookedEnd = addMinutes(b.endTime || addMinutes(b.startTime || b.preferredStart, b.duration || request.duration), BUFFER_MINUTES);
                        if (overlaps(start, end, bookedStart, bookedEnd)) { conflict = true; break; }
                    }
                    if (!conflict) { fallback.push({ room, start }); break; }
                }
            }
            return { alternativeOptions: fallback };
        }

        const top = options[0];
        const alt = options.slice(1, 6).map(o => ({ room: o.room, time: o.start }));
        return {
            recommendedRoom: top.room,
            suggestedTime: top.start,
            alternativeOptions: alt,
            costOptimization: top.costOpt
        };
    }

    // createBooking: re-check availability in a transaction, then create
    async createBooking(payload: any) {
        const decision = await this.findOptimalMeeting(payload);
        if (!decision.recommendedRoom) return { error: 'no_available_room', alternatives: decision.alternativeOptions };

        const start = decision.suggestedTime;
        const end = addMinutes(start, payload.duration);

        // transaction: verify no conflicting bookings for chosen room in this interval
        const result = await this.prisma.$transaction(async (prismaTx) => {
            // live check for conflicts on this room
            const conflicting = await prismaTx.booking.findFirst({
                where: {
                    roomId: decision.recommendedRoom.id,
                    status: { in: ['SCHEDULED', 'PENDING'] },
                    AND: [
                        { startTime: { lt: addMinutes(end, BUFFER_MINUTES) } },
                        { endTime: { gt: addMinutes(start, -BUFFER_MINUTES) } }
                    ]
                }
            });
            if (conflicting) {
                // someone else took it; abort and return null to caller
                return null;
            }

            // create booking
            const booking = await prismaTx.booking.create({
                data: {
                    organizerId: payload.organizerId,
                    attendees: payload.attendees || [],
                    duration: payload.duration,
                    requiredEquipment: payload.requiredEquipment || [],
                    preferredStart: new Date(payload.preferredStart),
                    startTime: start,
                    endTime: end,
                    flexibility: payload.flexibility || 0,
                    priority: payload.priority || 'NORMAL',
                    status: 'SCHEDULED',
                    room: { connect: { id: decision.recommendedRoom.id } },
                    cost: (decision.recommendedRoom.hourlyRate * (payload.duration / 60)),
                    autoReleaseAt: addMinutes(start, AUTO_RELEASE_MINUTES),
                }
            });

            return booking;
        });

        if (!result) {
            // conflict occurred — ask caller to re-run findOptimalMeeting to get new options
            return { error: 'conflict', message: 'Selected room was taken, retry', alternatives: [] };
        }

        // broadcast event
        this.events.broadcastBookingUpdate({ event: 'created', booking: result });
        return { booking: result, alternatives: decision.alternativeOptions, costOptimization: decision.costOptimization };
    }

    // Cancel booking: organizer or admin can cancel
    async cancelBooking(bookingId: string, userId: string) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.organizerId !== userId) {
            // Could check user role for admin; for simplicity throw Forbidden
            // In production: allow if req.user.role in ['ADMIN','CEO']
            throw new ForbiddenException('Only organizer or admin can cancel');
        }
        const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
        this.events.broadcastBookingUpdate({ event: 'cancelled', booking: updated });
        return updated;
    }

    // Check-in to prevent auto-release: set actualStart and clear autoReleaseAt
    async checkIn(bookingId: string, userId: string) {
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.organizerId !== userId && !booking.attendees.includes(userId)) {
            throw new ForbiddenException('Only organizer or attendees can check-in');
        }
        const updated = await this.prisma.booking.update({
            where: { id: bookingId },
            data: { actualStart: new Date(), autoReleaseAt: null }
        });
        this.events.broadcastBookingUpdate({ event: 'checked-in', booking: updated });
        return updated;
    }

    // auto-release job used by cron
    async releaseUnusedBookings() {
        const now = new Date();
        const toRelease = await this.prisma.booking.findMany({
            where: { status: 'SCHEDULED', autoReleaseAt: { lt: now } }
        });
        for (const b of toRelease) {
            await this.prisma.booking.update({ where: { id: b.id }, data: { status: 'RELEASED' } });
            this.events.broadcastBookingUpdate({ event: 'released', bookingId: b.id });
        }
        return { released: toRelease.length };
    }
}
