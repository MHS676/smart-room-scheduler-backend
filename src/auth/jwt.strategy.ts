import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret',
    });
  }

  // payload contains sub (userId), email, role
  async validate(payload: any) {
    // Optionally fetch latest user from DB for fresh role check
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }});
    if (!user) return null;
    // Return what should be attached to req.user
    return { userId: user.id, email: user.email, role: user.role, name: user.name };
  }
}
