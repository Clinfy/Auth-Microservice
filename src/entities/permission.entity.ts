import {
  BaseEntity,
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { RoleEntity } from "./role.entity";
import { ApiKeyEntity } from "./api-key.entity";

@Unique('UQ_permission_code',['code'])

@Entity('permission')
export class PermissionEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    code: string;

    @ManyToMany(() => RoleEntity, role => role.permissions)
    roles: RoleEntity[];

    @ManyToMany(() => ApiKeyEntity, apiKey => apiKey.permissions)
    api_keys: ApiKeyEntity[];
}