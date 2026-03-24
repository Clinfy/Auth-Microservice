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
import { PermissionEntity } from 'src/entities/permission.entity';
import { Exclude } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import type { AuthUser } from 'src/interfaces/auth-user.interface';

@Entity('api_key')
export class ApiKeyEntity extends BaseEntity {
  @ApiProperty({ description: 'API key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiHideProperty()
  @Exclude()
  @Index({ unique: true })
  @Column()
  key_fingerprint: string;

  @ApiProperty({ description: 'Client name', example: 'my-app' })
  @Column()
  client: string;

  @ApiProperty({ description: 'Whether the API key is active', example: true })
  @Column({ default: true })
  active: boolean;

  @ApiHideProperty()
  @Exclude()
  @CreateDateColumn()
  created_at: Date;

  @ApiHideProperty()
  @Exclude()
  @UpdateDateColumn()
  updated_at: Date;

  @ApiHideProperty()
  @Exclude()
  @Column({ type: 'jsonb', nullable: true })
  created_by?: AuthUser;

  @ApiProperty({ description: 'Permissions assigned to the API key', type: () => [PermissionEntity] })
  @ManyToMany(() => PermissionEntity, (permission) => permission.api_keys)
  @JoinTable()
  permissions: PermissionEntity[];

  get permissionCodes(): string[] {
    return this.permissions?.map((permission) => permission.code) || [];
  }
}
