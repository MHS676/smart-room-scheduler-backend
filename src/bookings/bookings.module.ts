import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { RedisModule } from '../redis/redis.module';
import { MailModule } from '../email/mail.module'; 

@Module({
  imports: [PrismaModule, EventsModule, RedisModule, MailModule], 
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService], 
})
export class BookingsModule {}
