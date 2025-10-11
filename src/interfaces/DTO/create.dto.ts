import {IsNotEmpty, IsString} from "class-validator";
import { IsUniquePermissionCode } from 'src/common/validators/unique-permission-code.validator';

export class CreatePermissionDTO {
    @IsString({message: 'El dato debe ser una cadena de texto string'})
    @IsNotEmpty({message: 'El dato no puede estar vacio'})
    @IsUniquePermissionCode()
    code: string;
}

export class CreateRoleDTO {
    @IsString({message: 'El dato debe ser una cadena de texto string'})
    @IsNotEmpty({message: 'El dato no puede estar vacio'})
    name: string;
}