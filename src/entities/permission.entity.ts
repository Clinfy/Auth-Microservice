import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RoleEntity } from "./role.entity";
import { ApiKeyEntity } from "./api-key.entity";
import { UserEntity } from 'src/entities/user.entity';

@Unique('UQ_permission_code',['code'])

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

  @ManyToOne(()=> UserEntity, { nullable: true })
  created_by: UserEntity;

  @ManyToMany(() => RoleEntity, role => role.permissions)
  roles: RoleEntity[];

  @ManyToMany(() => ApiKeyEntity, apiKey => apiKey.permissions)
  api_keys: ApiKeyEntity[];
}