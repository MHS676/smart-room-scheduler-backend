import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from '../common/dto/create-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private svc: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: CreateBookingDto, @Request() req) {
    // attach organizerId from authenticated user if not supplied
    if (!body.organizerId) body.organizerId = req.user.userId;
    return this.svc.createBooking(body);
  }
}
