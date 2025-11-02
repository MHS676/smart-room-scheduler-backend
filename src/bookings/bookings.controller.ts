
import { Controller, Get, Post, Body, Param, Query, Patch, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  @Get()
  async listUserBookings(@Req() req, @Query('from') from?: string, @Query('to') to?: string) {
    const userId = req.user?.userId ?? req.user?.id; // support both shapes
    return this.bookingsService.listUserBookings(userId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('calendar')
  async calendarView(@Query('day') day: string) {
    if (!day) {
      // Default to today if no date provided
      return this.bookingsService.calendarView(new Date());
    }

    const parsedDate = new Date(day);
    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid date format. Please use ISO format (YYYY-MM-DD)');
    }

    return this.bookingsService.calendarView(parsedDate);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req, @Body() dto: CreateBookingDto) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.bookingsService.createBooking(userId, dto);
  }

  @Patch(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Req() req) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.bookingsService.cancelBooking(id, userId);
  }

  @Patch(':id/checkin')
  async checkIn(@Param('id') id: string, @Req() req) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.bookingsService.checkIn(id, userId);
  }

  @Post('release-unused')
  @Roles('ADMIN', 'CEO')
  async releaseUnusedBookings() {
    return this.bookingsService.releaseUnusedBookings();
  }
}
