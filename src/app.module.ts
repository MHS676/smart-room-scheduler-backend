import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventsModule } from './events/events.module';
import { BookingsService } from './bookings/bookings.service';
import { scheduleAutoRelease } from './jobs/cron.jobs';


@Module({
imports: [PrismaModule, AuthModule, RoomsModule, BookingsModule, EventsModule],
})
export class AppModule implements OnModuleInit {
constructor(private bookingsService: BookingsService) {}


async onModuleInit() {
scheduleAutoRelease(this.bookingsService);
}
}