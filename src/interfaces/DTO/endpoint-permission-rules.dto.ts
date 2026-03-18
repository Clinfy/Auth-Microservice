import { IsNotEmpty, IsString } from 'class-validator';
import { IsUniqueEndpointKeyName } from 'src/common/validators/unique-endpoint-key.validator';

export class CreateEndpointPermissionRulesDTO {
  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ message: 'This field must be a string' })
  @IsUniqueEndpointKeyName()
  endpoint_key_name: string;
}

export class PatchEndpointPermissionRulesDTO extends CreateEndpointPermissionRulesDTO {}
