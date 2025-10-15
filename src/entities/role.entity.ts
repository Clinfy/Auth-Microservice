import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(()=> UserEntity, { nullable: true })
  created_by: UserEntity;

  @ManyToMany(()=> PermissionEntity, permission => permission.roles,
      {nullable: true, eager: true, onDelete: "RESTRICT", onUpdate: "CASCADE"})
  @JoinTable()
  permissions: PermissionEntity[];

  @ManyToMany(()=> UserEntity, user => user.roles)
  users: UserEntity[];
}