import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEndpointPermissionRulesDTO {
  @IsNotEmpty({ message: 'This field is required' })
  @IsString({ message: 'This field must be a string' })
  endpoint_key_name: string;
}

export class PatchEndpointPermissionRulesDTO extends CreateEndpointPermissionRulesDTO {}
