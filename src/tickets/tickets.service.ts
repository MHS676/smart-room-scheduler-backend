import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class TicketsService {
    constructor(private prisma: PrismaService) { }

    create(dto: CreateTicketDto) {
        return this.prisma.ticket.create({ data: dto });
    }

    findAll() {
        return this.prisma.ticket.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id } });
        if (!ticket) throw new NotFoundException('Ticket not found');
        return ticket;
    }

    async update(id: string, dto: UpdateTicketDto) {
        await this.findOne(id);
        return this.prisma.ticket.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.ticket.delete({ where: { id } });
    }
}
