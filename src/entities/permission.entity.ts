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
import type { AuthUser } from 'src/interfaces/auth-user.interface';

@Unique('UQ_permission_code', ['code'])
@Entity('permission')
export class PermissionEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles: RoleEntity[];

  @ManyToMany(() => ApiKeyEntity, (apiKey) => apiKey.permissions)
  api_keys: ApiKeyEntity[];
}
