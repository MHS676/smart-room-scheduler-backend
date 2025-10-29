import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  organizerEmail: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsEnum(['EMPLOYEE','CEO'], { message: 'Role must be EMPLOYEE or CEO' })
  role: 'EMPLOYEE' | 'CEO';
}
