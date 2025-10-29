import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private svc: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    // returns token + user
    return this.svc.register(body.name, body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.svc.loginViaCredentials(body.email, body.password);
  }

  // optional: endpoint using passport local strategy
  // @UseGuards(LocalAuthGuard)
  // @Post('login')
  // async loginLocal(@Request() req) {
  //   return this.svc.loginWithUser(req.user);
  // }
}
