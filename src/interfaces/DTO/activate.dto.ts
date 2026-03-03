import { IsNotEmpty, IsString, Matches } from 'class-validator';


export class ActivateUserDTO {
  @IsString({ message: 'Your email must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  email: string;

  @IsString({ message: 'Your password must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  password: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Your password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  new_password: string;
}