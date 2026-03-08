import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionDTO {
  @ApiProperty({
    description: 'Array of permission IDs to assign',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ each: true, message: 'Each permissionId must be a string' })
  @IsArray({ message: 'This field must be an array' })
  permissionsIds: string[];
}

export class AssignRoleDTO {
  @ApiProperty({
    description: 'Array of role IDs to assign',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ each: true, message: 'Each roleId must be a string' })
  @IsArray({ message: 'This field must be an array' })
  rolesIds: string[];
}

