import { BaseEntity, Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { RoleEntity } from "./role.entity";
import { ApiKeyEntity } from "./api-key.entity";

@Entity('permission')
export class PermissionEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @ManyToMany(() => RoleEntity, role => role.permissions)
    roles: RoleEntity[];

    @ManyToMany(() => ApiKeyEntity, apiKey => apiKey.permissions)
    api_keys: ApiKeyEntity[];
}