import {BaseEntity, Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {PermissionEntity} from "./permission.entity";
import {UserEntity} from "./user.entity";

@Entity('role')
export class RoleEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({unique: true})
    name: string;

    @ManyToMany(()=> PermissionEntity, permission => permission.roles,
        {nullable: true, eager: true, onDelete: "RESTRICT", onUpdate: "CASCADE"})
    @JoinTable()
    permissions: PermissionEntity[];

    @ManyToMany(()=> UserEntity, user => user.roles)
    users: UserEntity[];
}