import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PermissionEntity } from './permission.entity';
import { UserEntity } from './user.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from 'src/interfaces/auth-user.interface';

@Unique('UQ_role_name', ['name'])
@Entity('role')
export class RoleEntity extends BaseEntity {
  @ApiProperty({ description: 'Role UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Unique role name', example: 'Admin' })
  @Column()
  name: string;

  @ApiProperty({description: 'Determines if the role is restricted to certain endpoints due to security concerns', default: false})
  @Column({default: false})
  is_restricted: boolean

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({ description: 'User who created this role', required: false })
  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;

  @ApiProperty({ description: 'Permissions assigned to the role', type: () => [PermissionEntity] })
  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, {
    nullable: true,
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinTable()
  permissions: PermissionEntity[];

  @ManyToMany(() => UserEntity, (user) => user.roles)
  users: UserEntity[];
}
