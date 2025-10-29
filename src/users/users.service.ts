import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService { }

async purchase(userId: string) {
    const lockKey = `lock:user:${userId}`;
    const lockId = await this.lockService.acquireLock(lockKey, 3000);

    if (!lockId) {
        throw new Error('Resource busy. Try again.');
    }

    try {
        // Your protected critical logic
        return await this.prisma.order.create({
            data: { userId },
        });
    } finally {
        await this.lockService.releaseLock(lockKey, lockId);
    }
}
