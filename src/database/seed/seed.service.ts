import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PermissionEntity } from 'src/entities/permission.entity';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import { RoleEntity } from 'src/entities/role.entity';
import { UserEntity, UserStatus } from 'src/entities/user.entity';
import { SEED_PERMISSIONS, SEED_EPR, SEED_ROLES, SEED_ADMIN_USER } from './seed.data';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute all seed operations within a single transaction.
   * Order: permissions → endpoint rules → roles → users
   * @throws Error if any seed operation fails (transaction rolled back)
   */
  async run(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting database seeding...');

      await this.seedPermissions(queryRunner.manager);
      await this.seedEndpointPermissionRules(queryRunner.manager);
      await this.seedRoles(queryRunner.manager);
      await this.seedUsers(queryRunner.manager);

      await queryRunner.commitTransaction();
      this.logger.log('Database seeding completed successfully!');
      this.logger.log(
        `Summary: ${SEED_PERMISSIONS.length} permissions, ${SEED_EPR.length} endpoint rules, ${SEED_ROLES.length} roles, 1 admin user`,
      );
    } catch (error) {
      this.logger.error('Seeding failed, rolling back transaction...', error);
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Seed permissions using upsert for idempotency.
   * Conflict resolution on unique 'code' column.
   */
  private async seedPermissions(manager: EntityManager): Promise<void> {
    this.logger.log('Seeding permissions...');

    await manager.upsert(PermissionEntity, SEED_PERMISSIONS, {
      conflictPaths: ['code'],
    });

    this.logger.log(`Seeded ${SEED_PERMISSIONS.length} permissions`);
  }

  /**
   * Seed endpoint permission rules with ManyToMany relation handling.
   * Two-phase: upsert base entities, then fetch and assign permission relations.
   */
  private async seedEndpointPermissionRules(manager: EntityManager): Promise<void> {
    this.logger.log('Seeding endpoint permission rules...');

    // Phase 1: Upsert all endpoint permission rules (without relations)
    const eprEntities = SEED_EPR.map((rule) => ({
      endpoint_key_name: rule.endpoint_key_name,
      enabled: rule.enabled,
    }));

    await manager.upsert(EndpointPermissionRulesEntity, eprEntities, {
      conflictPaths: ['endpoint_key_name'],
    });

    // Phase 2: Fetch each rule and assign the correct permission
    for (const rule of SEED_EPR) {
      const epr = await manager.findOne(EndpointPermissionRulesEntity, {
        where: { endpoint_key_name: rule.endpoint_key_name },
        relations: ['permissions'],
      });

      const permission = await manager.findOne(PermissionEntity, {
        where: { code: rule.permission_code },
      });

      if (epr && permission) {
        // Assign the permission (replacing any existing)
        epr.permissions = [permission];
        await manager.save(epr);
      }
    }

    this.logger.log(`Seeded ${SEED_EPR.length} endpoint permission rules`);
  }

  /**
   * Seed roles with ManyToMany permission assignment.
   * SUPER_ADMIN gets all permissions when permission_codes is empty.
   */
  private async seedRoles(manager: EntityManager): Promise<void> {
    this.logger.log('Seeding roles...');

    for (const seedRole of SEED_ROLES) {
      // Upsert the role
      await manager.upsert(RoleEntity, { name: seedRole.name }, { conflictPaths: ['name'] });

      // Fetch the role with relations
      const role = await manager.findOne(RoleEntity, {
        where: { name: seedRole.name },
        relations: ['permissions'],
      });

      if (role) {
        // Determine which permissions to assign
        let permissions: PermissionEntity[];

        if (seedRole.permission_codes.length === 0) {
          // Empty array means all permissions
          permissions = await manager.find(PermissionEntity);
        } else {
          permissions = await manager.find(PermissionEntity, {
            where: seedRole.permission_codes.map((code) => ({ code })),
          });
        }

        // Assign permissions and save to sync junction table
        role.permissions = permissions;
        await manager.save(role);
      }
    }

    this.logger.log(`Seeded ${SEED_ROLES.length} roles`);
  }

  /**
   * Seed admin user with role assignment.
   * Password will be hashed by UserEntity's @BeforeInsert hook.
   */
  private async seedUsers(manager: EntityManager): Promise<void> {
    this.logger.log('Seeding users...');

    // First check if user already exists (to handle password hashing correctly)
    const existingUser = await manager.findOne(UserEntity, {
      where: { email: SEED_ADMIN_USER.email },
    });

    if (existingUser) {
      // User exists - update without changing password (to avoid re-hashing)
      this.logger.log(`Admin user already exists, updating roles...`);

      // Fetch roles
      const roles = await manager.find(RoleEntity, {
        where: SEED_ADMIN_USER.role_names.map((name) => ({ name })),
      });

      existingUser.roles = roles;
      existingUser.status = SEED_ADMIN_USER.status as UserStatus;
      await manager.save(existingUser);
    } else {
      // Create new user - password will be hashed by entity hook
      const user = manager.create(UserEntity, {
        email: SEED_ADMIN_USER.email,
        password: SEED_ADMIN_USER.password,
        status: SEED_ADMIN_USER.status as UserStatus,
        person_id: SEED_ADMIN_USER.person_id,
      });

      // Save first to trigger password hashing
      await manager.save(user);

      // Fetch roles and assign
      const roles = await manager.find(RoleEntity, {
        where: SEED_ADMIN_USER.role_names.map((name) => ({ name })),
      });

      user.roles = roles;
      await manager.save(user);
    }

    this.logger.log('Seeded 1 admin user');
  }
}
