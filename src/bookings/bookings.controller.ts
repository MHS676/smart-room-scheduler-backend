import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  // ------------------------------
  // List all bookings of a user
  // GET /bookings?from=2025-10-29&to=2025-10-30
  @Get()
  async listUserBookings(@Req() req, @Query('from') from?: string, @Query('to') to?: string) {
    return this.bookingsService.listUserBookings(req.user.id, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  // ------------------------------
  // Calendar view grouped by room
  // GET /bookings/calendar?day=2025-10-29
  @Get('calendar')
  async calendarView(@Query('day') day: string) {
    return this.bookingsService.calendarView(new Date(day));
  }

  // ------------------------------
  // Create a booking
  // POST /bookings
  @Post()
  async createBooking(@Req() req, @Body() payload: any) {
    payload.organizerId = req.user.id; // MUST exist
    return this.bookingsService.createBooking(payload);
  }


  // ------------------------------
  // Cancel a booking
  // PATCH /bookings/:id/cancel
  @Patch(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Req() req) {
    return this.bookingsService.cancelBooking(id, req.user.id);
  }

  // ------------------------------
  // Check-in for a booking
  // PATCH /bookings/:id/checkin
  @Patch(':id/checkin')
  async checkIn(@Param('id') id: string, @Req() req) {
    return this.bookingsService.checkIn(id, req.user.id);
  }

  // ------------------------------
  // Release unused bookings (optional, can be cron job)
  // POST /bookings/release-unused
  @Post('release-unused')
  @Roles('ADMIN', 'CEO') // Only admin or CEO can trigger manually
  async releaseUnusedBookings() {
    return this.bookingsService.releaseUnusedBookings();
  }
}
