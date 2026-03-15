import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RoleEntity } from './role.entity';
import { ApiKeyEntity } from './api-key.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from 'src/interfaces/auth-user.interface';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';

@Unique('UQ_permission_code', ['code'])
@Entity('permission')
export class PermissionEntity extends BaseEntity {
  @ApiProperty({ description: 'Permission UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Unique permission code', example: 'USERS_CREATE' })
  @Column()
  code: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({ description: 'User who created this permission', required: false })
  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles: RoleEntity[];

  @ManyToMany(() => EndpointPermissionRulesEntity, (endpoint) => endpoint.permissions)
  endpoint_permission_rules: EndpointPermissionRulesEntity[];

  @ManyToMany(() => ApiKeyEntity, (apiKey) => apiKey.permissions)
  api_keys: ApiKeyEntity[];
}
