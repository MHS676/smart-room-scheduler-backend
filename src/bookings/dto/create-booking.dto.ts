// src/bookings/dto/create-booking.dto.ts
import { IsInt, IsString, IsArray, IsDateString, IsOptional, IsIn, Min } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  @Min(1)
  attendeesCount: number;

  @IsInt()
  @Min(1)
  duration: number; // minutes

  @IsArray()
  requiredEquipment: string[];

  @IsDateString()
  preferredStart: string;

  @IsInt()
  flexibility: number;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsString()
  roomName: string; // frontend sends meeting room id as roomId

  @IsString()
  ticketTitle: string;
}
