import {IsNotEmpty, IsString} from "class-validator";

export class CreatePermissionDTO {
    @IsString({message: 'El dato debe ser una cadena de texto string'})
    @IsNotEmpty({message: 'El dato no puede estar vacio'})
    code: string;
}

export class CreateRoleDTO {
    @IsString({message: 'El dato debe ser una cadena de texto string'})
    @IsNotEmpty({message: 'El dato no puede estar vacio'})
    name: string;
}