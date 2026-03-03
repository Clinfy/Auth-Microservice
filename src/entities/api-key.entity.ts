import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {PermissionEntity} from "src/entities/permission.entity";
import { Exclude } from 'class-transformer';
import type { AuthUser } from 'src/interfaces/auth-user.interface';

@Entity('api_key')
export class ApiKeyEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Exclude()
  @Index({unique: true})
  @Column()
  key_hash: string;

  @Column()
  client: string;

  @Column({ default: true})
  active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({type: 'jsonb', nullable: true})
  created_by?: AuthUser;

  @ManyToMany(()=>PermissionEntity, permission => permission.api_keys)
  @JoinTable()
  permissions: PermissionEntity[];

  get permissionCodes(): string[] {
      return this.permissions?.map(permission => permission.code) || [];
  }
}