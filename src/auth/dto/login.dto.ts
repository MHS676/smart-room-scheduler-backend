import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  email: string;

  @IsString()
  @MinLength(4)
  password: string;
}
