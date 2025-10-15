import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {PermissionEntity} from "src/entities/permission.entity";
import { UserEntity } from 'src/entities/user.entity';
import { Exclude } from 'class-transformer';

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

  @ManyToOne(()=> UserEntity, { nullable: true })
  created_by: UserEntity;

  @ManyToMany(()=>PermissionEntity, permission => permission.api_keys)
  @JoinTable()
  permissions: PermissionEntity[];

  get permissionCodes(): string[] {
      return this.permissions?.map(permission => permission.code) || [];
  }
}