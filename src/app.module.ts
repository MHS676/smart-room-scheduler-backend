import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventsModule } from './events/events.module';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { RedisLockInterceptor } from './common/interceptors/redis-lock.interceptor';
import { RolesGuard } from './common/guards/roles.guard';
import { scheduleAutoRelease } from '../src/jobs/cron.jobs';
import { BookingsService } from './bookings/bookings.service';

@Module({
    imports: [PrismaModule, RedisModule, AuthModule, BookingsModule, EventsModule],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: RedisLockInterceptor,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AppModule implements OnModuleInit {
    constructor(private readonly bookingsService: BookingsService) { }
    onModuleInit() {
        scheduleAutoRelease(this.bookingsService);
    }
}
