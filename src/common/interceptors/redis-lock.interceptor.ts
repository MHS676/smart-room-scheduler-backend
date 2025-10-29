import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { REDIS_LOCK_RESOURCE } from '../decorators/redis-lock.decorator';
import { RedlockService } from '../../redis/redlock.service';

@Injectable()
export class RedisLockInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly redlockService: RedlockService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const field = this.reflector.get<string>(
            REDIS_LOCK_RESOURCE,
            context.getHandler(),
        );

        if (!field) {
            return next.handle(); // no lock needed
        }

        const request = context.switchToHttp().getRequest();
        const key =
            request.body?.[field] ||
            request.params?.[field] ||
            request.query?.[field];

        if (!key) {
            throw new BadRequestException(
                `Locking failed: Missing required field "${field}"`,
            );
        }

        const lockKey = `lock:${field}:${key}`;

        return from(this.redlockService.lock(lockKey, 3000)).pipe(
            switchMap(lock =>
                next.handle().pipe(
                    switchMap(async result => {
                        await lock.release();
                        return result;
                    }),
                ),
            ),
        );
    }
}
