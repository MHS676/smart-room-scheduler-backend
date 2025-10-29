import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedlockService } from './redlock.service';

@Global()
@Module({
    providers: [
        {
            provide: 'REDIS',
            useFactory: () => new Redis(process.env.REDIS_URL),
        },
        RedlockService,
    ],
    exports: ['REDIS', RedlockService],
})
export class RedisModule { }
