import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignApiPermissionDTO {
  @ApiProperty({
    description: 'Array of permission IDs to assign to the API key',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsNotEmpty({ message: 'permissionIds is required' })
  @IsArray({ message: 'permissionIds must be an array' })
  @IsString({ each: true, message: 'Each permissionId must be a string' })
  permissionIds: string[];
}

export class CreateApiKeyDTO extends AssignApiPermissionDTO {
  @ApiProperty({ description: 'Client name for the API key', example: 'my-app' })
  @IsNotEmpty({ message: 'client is required' })
  @IsString({ message: 'client must be a number' })
  client: string;
}

