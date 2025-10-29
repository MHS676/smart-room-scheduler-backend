import { SetMetadata } from '@nestjs/common';
export const REDIS_LOCK_RESOURCE = 'redisLockResource';
export const RedisLock = (field: string) => SetMetadata(REDIS_LOCK_RESOURCE, field);
