import { Module, OnModuleInit } from '@nestjs/common';
import { BookingsService } from './bookings/bookings.service';
import { scheduleAutoRelease } from './jobs/cron.jobs';

@Module({ ...})
export class AppModule implements OnModuleInit {
    constructor(private bookingsService: BookingsService) { }
    onModuleInit() { scheduleAutoRelease(this.bookingsService); }
}
