import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) { }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.svc.register(dto.name, dto.email, dto.password);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.svc.loginViaCredentials(dto.email, dto.password);
  }
}
