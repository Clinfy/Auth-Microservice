import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
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
import {UserI} from "../interfaces/user.interface";
import { hashSync } from 'bcrypt';
import {RoleEntity} from "./role.entity";

@Unique('UQ_users_email',['email'])

@Entity('users')
export class UserEntity extends BaseEntity implements UserI {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable: false})
  email: string;

  @Column({nullable: false})
  password: string;

  @Column({ default: true, nullable: false})
  active: boolean;

  @Column({type: "varchar", default: null, nullable: true})
  passResetToken:string|null = null

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(()=> UserEntity, { nullable: true })
  created_by: UserEntity;

  @ManyToMany(()=> RoleEntity, role => role.users,
      {nullable: true, eager: true, onDelete: "RESTRICT", onUpdate: "CASCADE"})
  @JoinTable()
  roles: RoleEntity[];

  get permissionCodes(): string[] {
      return this.roles?.flatMap(role => role.permissions.map(permission => permission.code)) || [];
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
      if (this.password && !this.password.startsWith('$2')) {
          this.password = await hashSync(this.password,10);
      }
  }
}