import { IsOptional, IsEnum } from 'class-validator';
export class UpdateBookingDto {
    @IsOptional() @IsEnum(['CANCELLED', 'RELEASED', 'COMPLETED', 'NO_SHOW']) status?: string;
}
