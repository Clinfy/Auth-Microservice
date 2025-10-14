import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {IsUniqueEmail} from "src/common/validators/unique-email.validator";

export class RegisterUserDTO {
    @IsString({message: 'Your email must be a string'})
    @IsNotEmpty({ message: 'This field is required'})
    @IsUniqueEmail()
    email: string;

    @IsString({message: 'Your password must be a string'})
    @IsNotEmpty({ message: 'This field is required'})
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      {message: 'Your password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character'})
    password: string;
}