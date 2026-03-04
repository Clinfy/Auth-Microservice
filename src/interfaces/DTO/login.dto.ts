import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDTO {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsString({ message: 'Your email must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  email: string;

  @ApiProperty({ description: 'User password', example: 'P@ssw0rd!' })
  @IsString({ message: 'Your password must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  password: string;
}

