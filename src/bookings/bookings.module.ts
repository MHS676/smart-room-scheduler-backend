import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [PrismaModule, EventsModule],
    providers: [BookingsService],
    controllers: [BookingsController],
    exports: [BookingsService],
})
export class BookingsModule { }
