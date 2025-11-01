import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) { }

  private signToken(user: { id: string; email: string; role?: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.sign(payload);
  }

  async register(name: string, email: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new Error('User exists');
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { name, email, password: hashed } });
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, };
  }

  async validateUserByPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;

    const { password: _, ...rest } = user as any;
    return rest;
  }

  async loginViaCredentials(email: string, password: string) {
    const user = await this.validateUserByPassword(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return { access_token: this.signToken(user as any), user: { id: (user as any).id, email: (user as any).email, role: (user as any).role, name: (user as any).name } };
  }
}
