import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [TicketsController],
    providers: [TicketsService, PrismaService],
    exports: [TicketsService],
})
export class TicketsModule { }
