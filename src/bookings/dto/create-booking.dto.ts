import { IsInt, IsString, IsArray, IsDateString, IsOptional, IsIn, Min } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  @Min(1)
  attendeesCount: number;

  @IsInt()
  @Min(1)
  duration: number;

  @IsArray()
  requiredEquipment: string[];

  @IsDateString()
  preferredStart: string;

  @IsInt()
  flexibility: number;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  roomName?: string;

  @IsOptional()
  @IsString()
  ticketTitle?: string;
}
