import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  // Register a new user (hash password)
  async register(name: string, email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email }});
    if (existing) throw new Error('User already exists');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, password: hashed }
    });
    const token = this.signToken(user);
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, access_token: token };
  }

  // Validate email + password for login
  async validateUserByPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email }});
    if (!user || !user.password) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
    // remove password before returning
    const { password: _, ...rest } = user as any;
    return rest;
  }

  // login by user object (after local strategy) OR by credentials
  async loginWithUser(user: any) {
    const u = await this.prisma.user.findUnique({ where: { id: user.userId || user.id }});
    if (!u) throw new UnauthorizedException();
    return { access_token: this.signToken(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }

  async loginViaCredentials(email: string, password: string) {
    const user = await this.validateUserByPassword(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const token = this.signToken(user as any);
    return { access_token: token, user: { id: (user as any).id, email: (user as any).email, role: (user as any).role, name: (user as any).name } };
  }

  private signToken(user: { id: string; email: string; role?: string; name?: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.sign(payload);
  }
}
