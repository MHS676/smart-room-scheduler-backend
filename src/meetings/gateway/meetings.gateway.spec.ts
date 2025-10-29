import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsGateway } from './meetings.gateway';

describe('MeetingsGateway', () => {
  let gateway: MeetingsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MeetingsGateway],
    }).compile();

    gateway = module.get<MeetingsGateway>(MeetingsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
