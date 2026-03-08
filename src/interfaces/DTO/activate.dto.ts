import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class ActivateUserDTO {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsString({ message: 'Your email must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  email: string;

  @ApiProperty({ description: 'Current temporary password', example: 'TempPass1!' })
  @IsString({ message: 'Your password must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  password: string;

  @ApiProperty({
    description: 'New password (min 8 chars, uppercase, lowercase, number, special char)',
    example: 'N3wP@ssw0rd!',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Your password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  new_password: string;
}