import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
    constructor(private prisma: PrismaService) { }

    findAll(filter?: any) {
        return this.prisma.meetingRoom.findMany();
    }

    findById(id: string) {
        return this.prisma.meetingRoom.findUnique({ where: { id } });
    }
}
