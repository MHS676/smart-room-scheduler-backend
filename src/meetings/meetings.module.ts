import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsGateway } from './gateway/meetings.gateway';

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsGateway]
})
export class MeetingsModule { }
