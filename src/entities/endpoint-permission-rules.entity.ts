import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from 'src/interfaces/auth-user.interface';
import { PermissionEntity } from 'src/entities/permission.entity';

export enum PermissionRuleMode {
  ANY = 'ALLOW',
  ALL = 'DENY',
  NONE = 'NONE',
}

@Unique('UQ_endpoint_permission_key_name', ['endpoint_key_name'])

@Entity('endpoint_permission_rules')
export class EndpointPermissionRulesEntity extends BaseEntity {
  @ApiProperty({ description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Endpoint key name', example: 'users.update' })
  @Column()
  endpoint_key_name: string;

  @ApiProperty({ description: 'Permission rule mode', enum: PermissionRuleMode, example: PermissionRuleMode.ANY })
  @Column({ type: 'enum', enum: PermissionRuleMode, default: PermissionRuleMode.ANY })
  mode: PermissionRuleMode;

  @ApiProperty({ description: 'Permissions assigned to the role', type: () => [PermissionEntity] })
  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, {
    nullable: true,
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinTable()
  permissions: PermissionEntity[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({ description: 'User who created this role', required: false })
  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;
}