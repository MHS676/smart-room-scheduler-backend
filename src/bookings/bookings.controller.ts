import { Controller, Post, Body, UseGuards, Request, Get, Query, Param, Patch } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private svc: BookingsService) { }

  // create booking (protected)
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateBookingDto, @Request() req) {
    if (!dto.organizerId) dto.organizerId = req.user.userId;
    return this.svc.createBooking(dto);
  }

  // list bookings (protected)
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Request() req, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.listUserBookings(req.user.userId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  // calendar view for admin (role-guard optional in route)
  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  async calendar(@Query('date') date?: string) {
    const day = date ? new Date(date) : new Date();
    return this.svc.calendarView(day);
  }

  // cancel booking
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req) {
    return this.svc.cancelBooking(id, req.user.userId);
  }

  // check-in to confirm meeting started (prevents auto-release)
  @UseGuards(JwtAuthGuard)
  @Post(':id/checkin')
  async checkin(@Param('id') id: string, @Request() req) {
    return this.svc.checkIn(id, req.user.userId);
  }
}
