import {IsArray, IsNotEmpty, IsString} from 'class-validator';

export class AssignApiPermissionDTO {
    @IsNotEmpty({ message: 'permissionIds is required' })
    @IsArray({ message: 'permissionIds must be an array' })
    @IsString({ each: true, message: 'Each permissionId must be a string' })
    permissionIds: string[];
}

export class CreateApiKeyDTO extends AssignApiPermissionDTO {
    @IsNotEmpty({ message: 'client is required' })
    @IsString({ message: 'client must be a number' })
    client: string;
}