/**
 * Seed data constants for the Auth-Microservice.
 * These define the initial permissions, endpoint rules, roles, and admin user.
 */

// ============================================================================
// Interfaces
// ============================================================================

export interface SeedPermission {
  code: string;
}

export interface SeedEndpointPermissionRule {
  endpoint_key_name: string;
  permission_code: string;
  enabled: boolean;
}

export interface SeedRole {
  name: string;
  permission_codes: string[]; // Empty array = all permissions
}

export interface SeedUser {
  email: string;
  password: string; // Plaintext — will be hashed by entity hook
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  person_id: string;
  role_names: string[];
}

// ============================================================================
// Seed Data Constants
// ============================================================================

/**
 * 23 unique permission codes.
 * These cover all endpoints in the Auth-Microservice.
 */
export const SEED_PERMISSIONS: SeedPermission[] = [
  { code: 'ENDPOINT-PERMISSION-RULES_CREATE' },
  { code: 'ENDPOINT-PERMISSION-RULES_READ' },
  { code: 'ENDPOINT-PERMISSION-RULES_UPDATE' },
  { code: 'ENDPOINT-PERMISSION-RULES_DELETE' },
  { code: 'API_KEY_ACCESS' },
  { code: 'API_KEYS_CREATE' },
  { code: 'API_KEYS_READ' },
  { code: 'API_KEYS_DEACTIVATE' },
  { code: 'PERMISSIONS_CREATE' },
  { code: 'PERMISSIONS_READ' },
  { code: 'PERMISSIONS_UPDATE' },
  { code: 'PERMISSIONS_DELETE' },
  { code: 'ROLES_CREATE' },
  { code: 'ROLES_READ' },
  { code: 'ROLES_UPDATE' },
  { code: 'ROLES_DELETE' },
  { code: 'SESSIONS_READ' },
  { code: 'SESSIONS_DEACTIVATE' },
  { code: 'USERS_CREATE' },
  { code: 'USERS_READ' },
  { code: 'USERS_UPDATE' },
  { code: 'METRICS_READ' },
  { code: 'BASE_ACCESS' },
];

/**
 * 23 endpoint permission rules.
 * Each rule maps an endpoint_key_name to a required permission code.
 */
export const SEED_EPR: SeedEndpointPermissionRule[] = [
  {
    endpoint_key_name: 'endpoint-permission-rules.create',
    permission_code: 'ENDPOINT-PERMISSION-RULES_CREATE',
    enabled: true,
  },
  { endpoint_key_name: 'endpoint-permission-rules.find', permission_code: 'ENDPOINT-PERMISSION-RULES_READ', enabled: true },
  { endpoint_key_name: 'endpoint-permission-rules.find_api', permission_code: 'API_KEY_ACCESS', enabled: true },
  {
    endpoint_key_name: 'endpoint-permission-rules.update',
    permission_code: 'ENDPOINT-PERMISSION-RULES_UPDATE',
    enabled: true,
  },
  {
    endpoint_key_name: 'endpoint-permission-rules.delete',
    permission_code: 'ENDPOINT-PERMISSION-RULES_DELETE',
    enabled: true,
  },
  { endpoint_key_name: 'api-key.generate', permission_code: 'API_KEYS_CREATE', enabled: true },
  { endpoint_key_name: 'api-key.find', permission_code: 'API_KEYS_READ', enabled: true },
  { endpoint_key_name: 'api-key.deactivate', permission_code: 'API_KEYS_DEACTIVATE', enabled: true },
  { endpoint_key_name: 'permission.create', permission_code: 'PERMISSIONS_CREATE', enabled: true },
  { endpoint_key_name: 'permission.update', permission_code: 'PERMISSIONS_UPDATE', enabled: true },
  { endpoint_key_name: 'permission.delete', permission_code: 'PERMISSIONS_DELETE', enabled: true },
  { endpoint_key_name: 'permission.find', permission_code: 'PERMISSIONS_READ', enabled: true },
  { endpoint_key_name: 'roles.create', permission_code: 'ROLES_CREATE', enabled: true },
  { endpoint_key_name: 'roles.update', permission_code: 'ROLES_UPDATE', enabled: true },
  { endpoint_key_name: 'roles.delete', permission_code: 'ROLES_DELETE', enabled: true },
  { endpoint_key_name: 'roles.find', permission_code: 'ROLES_READ', enabled: true },
  { endpoint_key_name: 'sessions.find', permission_code: 'SESSIONS_READ', enabled: true },
  { endpoint_key_name: 'sessions.deactivate', permission_code: 'SESSIONS_DEACTIVATE', enabled: true },
  { endpoint_key_name: 'users.register', permission_code: 'USERS_CREATE', enabled: true },
  { endpoint_key_name: 'users.update', permission_code: 'USERS_UPDATE', enabled: true },
  { endpoint_key_name: 'users.find', permission_code: 'USERS_READ', enabled: true },
  { endpoint_key_name: 'users.find_api', permission_code: 'API_KEY_ACCESS', enabled: true },
  { endpoint_key_name: 'metrics.get', permission_code: 'METRICS_READ', enabled: true },
];

/**
 * Roles to seed.
 * SUPER_ADMIN has all permissions (empty array means "all").
 */
export const SEED_ROLES: SeedRole[] = [{ name: 'SUPER_ADMIN', permission_codes: [] }];

/**
 * Admin user configuration.
 * Fixed person_id UUID ensures idempotency across re-seeds.
 */
export const SEED_ADMIN_USER: SeedUser = {
  email: 'admin@admin.com',
  password: 'admin',
  status: 'ACTIVE',
  person_id: '00000000-0000-0000-0000-000000000001',
  role_names: ['SUPER_ADMIN'],
};
