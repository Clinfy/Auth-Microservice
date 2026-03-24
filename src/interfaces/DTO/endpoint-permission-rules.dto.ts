import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsUniqueEndpointKeyName } from 'src/common/validators/unique-endpoint-key.validator';

export class CreateEndpointPermissionRulesDTO {
  @ApiProperty({
    description: 'Unique endpoint key name that identifies the protected endpoint',
    example: 'users.update',
  })
  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ message: 'This field must be a string' })
  @IsUniqueEndpointKeyName()
  endpoint_key_name: string;
}

export class PatchEndpointPermissionRulesDTO extends CreateEndpointPermissionRulesDTO {}
