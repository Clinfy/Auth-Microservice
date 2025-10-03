import {IsNotEmpty, IsString} from "class-validator";

export class RegisterUserDTO {
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}