import {IsNotEmpty, IsString} from "class-validator";
import { IsUniquePermissionCode } from 'src/common/validators/unique-permission-code.validator';
import { IsUniqueRoleName } from 'src/common/validators/unique-role-name.validator';

export class CreatePermissionDTO {
    @IsString({message: 'Code must be a string'})
    @IsNotEmpty({message: 'This field is required'})
    @IsUniquePermissionCode()
    code: string;
}

export class CreateRoleDTO {
    @IsString({message: 'Name must be a string'})
    @IsNotEmpty({message: 'This field is required'})
    @IsUniqueRoleName()
    name: string;
}