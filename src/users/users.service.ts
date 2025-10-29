import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findById(id: string) {
        return this.prisma.user.findUnique({ where: { id } });
    }

    async findAll() {
        return this.prisma.user.findMany();
    }

    async createUser(name: string, email: string, password?: string, role: string = 'EMPLOYEE') {
        const data: any = { name, email, role };
        if (password) data.password = await bcrypt.hash(password, 10);
        return this.prisma.user.create({ data });
    }
}
