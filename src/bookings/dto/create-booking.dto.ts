import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsISO8601, Min } from 'class-validator';

export class CreateBookingDto {
    @IsOptional()
    @IsString()
    organizerId?: string; // will be filled from JWT if missing

    @IsArray()
    @IsOptional()
    attendees?: string[];

    @IsInt()
    @Min(5)
    duration: number; // minutes

    @IsArray()
    @IsOptional()
    requiredEquipment?: string[];

    @IsISO8601()
    preferredStart: string; // ISO

    @IsInt()
    @IsOptional()
    flexibility?: number; // minutes

    @IsOptional()
    @IsEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}
