async purchaseTicket(userId: string, ticketId: string) {
    const resourceKey = `ticket:${ticketId}`;

    const lock = await this.redlockService.lock(resourceKey, 3000);

    try {
        return await this.prisma.$transaction(async tx => {
            const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });

            if (!ticket || ticket.remaining <= 0) {
                throw new Error('Sold Out');
            }

            await tx.ticket.update({
                where: { id: ticketId },
                data: { remaining: ticket.remaining - 1 },
            });

            return await tx.order.create({
                data: { userId, ticketId },
            });
        });
    } finally {
        await lock.release();
    }
}
