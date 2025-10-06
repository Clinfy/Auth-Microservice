import { Type } from 'class-transformer';
import {IsArray, IsInt, IsNotEmpty, IsString} from 'class-validator';

export class AssignApiPermissionDTO {
    @IsNotEmpty({ message: 'permissionIds is required' })
    @IsArray({ message: 'permissionIds must be an array' })
    @IsInt({ each: true, message: 'Each permission id must be numeric' })
    @Type(() => Number)
    permissionIds: number[];
}

export class CreateApiKeyDTO extends AssignApiPermissionDTO {
    @IsNotEmpty({ message: 'client is required' })
    @IsString({ message: 'client must be a number' })
    client: string;
}