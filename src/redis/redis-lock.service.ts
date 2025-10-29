import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redlock from 'redlock';
import Redis from 'ioredis';

@Injectable()
export class RedlockService implements OnModuleDestroy {
    private redlock: Redlock;
    constructor(@Inject('REDIS') private redis: Redis) {
        this.redlock = new Redlock(
            [redis],
            {
                retryCount: 6,
                retryDelay: 200,
                retryJitter: 100,
            },
        );
    }

    async lock(resource: string, ttl = 5000) {
        return this.redlock.acquire([resource], ttl);
    }

    async onModuleDestroy() {
        try {
            await this.redis.quit();
        } catch (e) { }
    }
}
