import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class AssignPermissionDTO {
    @IsNotEmpty({ message: 'This field is required'})
    @IsString({ each: true, message: 'Each permissionId must be a string' })
    @IsArray({ message: 'This field must be an array'})
    permissionIds: string[];
}

export class AssignRoleDTO {
    @IsNotEmpty({ message: 'This field is required'})
    @IsString({ each: true, message: 'Each roleId must be a string' })
    @IsArray({ message: 'This field must be an array'})
    rolesIds: string[];
}