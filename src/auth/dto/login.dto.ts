import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  organizerEmail: string;

  @IsString()
  @MinLength(4)
  password: string;
}
