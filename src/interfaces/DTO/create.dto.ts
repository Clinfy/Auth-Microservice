import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUniquePermissionCode } from 'src/common/validators/unique-permission-code.validator';
import { IsUniqueRoleName } from 'src/common/validators/unique-role-name.validator';

export class CreatePermissionDTO {
  @ApiProperty({ description: 'Unique permission code', example: 'USERS_CREATE' })
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  @IsUniquePermissionCode()
  code: string;
}

export class CreateRoleDTO {
  @ApiProperty({ description: 'Unique role name', example: 'Admin' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'This field is required' })
  @IsUniqueRoleName()
  name: string;
}
