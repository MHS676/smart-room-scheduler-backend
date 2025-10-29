import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('users')
export class UsersController {
    constructor(private svc: UsersService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('CEO')
    @Post()
    async create(@Body() body: any) {
        return this.svc.createUser(body.name, body.email, body.password, body.role);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async list() {
        return this.svc.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async get(@Param('id') id: string) {
        return this.svc.findById(id);
    }
}
