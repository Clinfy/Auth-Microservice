import {
  BaseEntity,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {PermissionEntity} from "./permission.entity";
import {UserEntity} from "./user.entity";

@Unique('UQ_role_name',['name'])

@Entity('role')
export class RoleEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({unique: true})
    name: string;

    @ManyToMany(()=> PermissionEntity, permission => permission.roles,
        {nullable: true, eager: true, onDelete: "RESTRICT", onUpdate: "CASCADE"})
    @JoinTable()
    permissions: PermissionEntity[];

    @ManyToMany(()=> UserEntity, user => user.roles)
    users: UserEntity[];
}