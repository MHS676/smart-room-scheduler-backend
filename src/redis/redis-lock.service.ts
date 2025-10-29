import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisLockService {
    constructor(@Inject('REDIS') private readonly redis: Redis) { }

    async acquireLock(key: string, ttl = 5000): Promise<string | null> {
        const lockId = randomUUID();
        const result = await this.redis.set(key, lockId, 'NX', 'PX', ttl);
        return result === 'OK' ? lockId : null;
    }

    async releaseLock(key: string, lockId: string) {
        const storedId = await this.redis.get(key);
        if (storedId === lockId) {
            await this.redis.del(key);
        }
    }
}
