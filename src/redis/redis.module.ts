import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedlockService } from './redis-lock.service';

@Global()
@Module({
    providers: [
        {
            provide: 'REDIS',
            useFactory: () => {
                const url = process.env.REDIS_URL;
                if (!url) throw new Error('REDIS_URL not set');
                return new Redis(url);
            },
        },
        RedlockService,
    ],
    exports: ['REDIS', RedlockService],
})
export class RedisModule { }
