import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class ForgotPasswordDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDTO {
  @IsNotEmpty()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {message: 'Your password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character'})
  password: string;
}