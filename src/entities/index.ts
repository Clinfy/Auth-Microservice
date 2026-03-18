import { UserEntity } from './user.entity';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';
import { ApiKeyEntity } from './api-key.entity';
import { OutboxEntity } from 'src/entities/outbox.entity';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';

export const entities = [
  UserEntity,
  RoleEntity,
  PermissionEntity,
  ApiKeyEntity,
  OutboxEntity,
  EndpointPermissionRulesEntity,
];
