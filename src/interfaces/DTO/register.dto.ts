import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUniqueEmail } from 'src/common/validators/unique-email.validator';

export class RegisterUserDTO {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsString({ message: 'Your email must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  @IsUniqueEmail()
  email: string;

  @ApiProperty({
    description: 'User password (min 8 chars, uppercase, lowercase, number, special char)',
    example: 'P@ssw0rd!',
  })
  @IsString({ message: 'Your password must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Your password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty({ description: 'Associated person ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString({ message: 'Your personId must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  person_id: string;
}

