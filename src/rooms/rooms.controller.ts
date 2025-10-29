import { Controller, Get, Param } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
    constructor(private readonly svc: RoomsService) { }
    @Get()
    async list() {
        return this.svc.findAll();
    }
    @Get(':id')
    async get(@Param('id') id: string) {
        return this.svc.findById(id);
    }
}
