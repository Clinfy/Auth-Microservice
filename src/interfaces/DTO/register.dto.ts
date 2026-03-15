import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUniqueEmail } from 'src/common/validators/unique-email.validator';
import { IsUniquePerson } from 'src/common/validators/unique-person.validator';

export class RegisterUserDTO {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsString({ message: 'Your email must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  @IsUniqueEmail()
  email: string;

  @ApiProperty({ description: 'Associated person ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('4', { message: 'person_id must be a valid UUID' })
  @IsNotEmpty({ message: 'This field is required' })
  @IsUniquePerson()
  person_id: string;
}
