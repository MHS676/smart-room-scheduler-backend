import { SetMetadata } from '@nestjs/common';

export const REDIS_LOCK_KEY = 'redisLockKey';

export const RedisLock = (resource: string) =>
    SetMetadata(REDIS_LOCK_KEY, resource);
