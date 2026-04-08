import {
  AfterLoad,
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserI } from '../interfaces/user.interface';
import { hashSync } from 'bcrypt';
import { RoleEntity } from './role.entity';
import { Exclude } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from 'src/interfaces/auth-user.interface';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

@Unique('UQ_users_email', ['email'])
@Unique('UQ_users_personId', ['person_id'])
@Entity('users')
export class UserEntity extends BaseEntity implements UserI {
  @ApiProperty({ description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @Column({ nullable: false })
  email: string;

  @ApiHideProperty()
  @Exclude()
  @Column({ nullable: false })
  password: string;

  @ApiProperty({ description: 'User status', enum: UserStatus, example: UserStatus.ACTIVE })
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING, nullable: false })
  status: UserStatus;

  @ApiProperty({ description: 'Associated person ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column({ type: 'uuid', nullable: false })
  person_id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({ description: 'User who created this record', required: false })
  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;

  @ApiProperty({ description: 'Roles assigned to the user', type: () => [RoleEntity] })
  @ManyToMany(() => RoleEntity, (role) => role.users, {
    nullable: true,
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinTable()
  roles: RoleEntity[];

  get permissionCodes(): string[] {
    return this.roles?.flatMap((role) => role.permissions.map((permission) => permission.code)) || [];
  }

  private originalPassword?: string;

  @AfterLoad()
  loadOriginalPassword() {
    this.originalPassword = this.password;
  }

  @BeforeInsert()
  hasPasswordOnInsert() {
    if (this.password) {
      this.password = hashSync(this.password, 10);
    }
  }

  @BeforeUpdate()
  async hashPasswordOnUpdate() {
    if (this.password && this.password !== this.originalPassword) {
      this.password = hashSync(this.password, 10);
    }
  }
}
