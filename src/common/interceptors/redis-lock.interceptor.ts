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
import { RedlockService } from '../../redis/redis-lock.service';

@Injectable()
export class RedisLockInterceptor implements NestInterceptor {
    constructor(private reflector: Reflector, private redlockService: RedlockService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const field = this.reflector.get<string>(REDIS_LOCK_RESOURCE, context.getHandler());
        if (!field) return next.handle();

        const req = context.switchToHttp().getRequest();
        // try body, params, query
        const key = req.body?.[field] ?? req.params?.[field] ?? req.query?.[field];
        if (!key) throw new BadRequestException(`Missing lock key field "${field}"`);

        const resource = `locks:${field}:${key}`;

        return from(this.redlockService.lock(resource, 5000)).pipe(
            switchMap(lock =>
                next.handle().pipe(
                    switchMap(async (result) => {
                        try {
                            await lock.release();
                        } catch (e) {
                            // ignore release errors
                        }
                        return result;
                    }),
                ),
            ),
        );
    }
}
