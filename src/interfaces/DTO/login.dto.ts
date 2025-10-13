import {IsNotEmpty, IsString} from "class-validator";

export class LoginDTO {
    @IsString({message: 'Your email must be a string'})
    @IsNotEmpty({message: 'This field is required'})
    email: string;

    @IsString({message: 'Your password must be a string'})
    @IsNotEmpty({message: 'This field is required'})
    password: string;
}