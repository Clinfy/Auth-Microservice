import {BaseEntity, Column, Entity, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {RoleEntity} from "./role.entity";

@Entity('permission')
export class PermissionEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({unique: true})
    code: string;

    @ManyToMany(() => RoleEntity, role => role.permissions)
    roles: RoleEntity[];
}