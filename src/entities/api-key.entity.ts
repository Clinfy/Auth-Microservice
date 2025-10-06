import {BaseEntity, Column, Entity, Index, JoinTable, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {PermissionEntity} from "src/entities/permission.entity";

@Entity('api_key')
export class ApiKeyEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({unique: true})
    @Column()
    key_hash: string;

    @Column()
    client: string;

    @Column({ default: true})
    active: boolean;

    @ManyToMany(()=>PermissionEntity, permission => permission.api_keys)
    @JoinTable()
    permissions: PermissionEntity[];

    get permissionCodes(): string[] {
        return this.permissions?.map(permission => permission.code) || [];
    }
}