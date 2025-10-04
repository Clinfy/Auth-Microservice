import {IsNotEmpty, IsString} from "class-validator";
import {IsUniqueEmail} from "src/common/validators/unique-email.validator";

export class RegisterUserDTO {
    @IsString()
    @IsNotEmpty()
    @IsUniqueEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}