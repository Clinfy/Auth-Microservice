import {
    BaseEntity,
    BeforeInsert,
    BeforeUpdate,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn, Unique
} from "typeorm";
import {UserI} from "../interfaces/user.interface";
import { hashSync } from 'bcrypt';
import {RoleEntity} from "./role.entity";

@Unique('UQ_users_email',['email'])

@Entity('users')
export class UserEntity extends BaseEntity implements UserI {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({nullable: false})
    email: string;

    @Column({nullable: false})
    password: string;

    @Column({ default: true, nullable: false})
    active: boolean;

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