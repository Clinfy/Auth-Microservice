import { SessionsService } from './sessions.service';
import { RedisService } from 'src/common/redis/redis.service';
import { UserEntity } from 'src/entities/user.entity';
import { UsersRepository } from 'src/services/users/users.repository';

describe('SessionsService', () => {
  let service: SessionsService;
  let redisService: { raw: any };
  let usersRepository: jest.Mocked<Partial<UsersRepository>>;
  let multiMock: { set: jest.Mock; sRem: jest.Mock; exec: jest.Mock };

  beforeEach(() => {
    multiMock = {
      set: jest.fn().mockReturnThis(),
      sRem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    redisService = {
      raw: {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue('OK'),
        sMembers: jest.fn(),
        mGet: jest.fn(),
        sRem: jest.fn().mockResolvedValue(1),
        del: jest.fn().mockResolvedValue(1),
        multi: jest.fn().mockReturnValue(multiMock),
      },
    };

    usersRepository = {
      getAccesibleEndpointKeys: jest.fn().mockResolvedValue(['endpoint-a', 'endpoint-b']),
      findByRoleIdWithPermissions: jest.fn(),
    };

    service = new SessionsService(redisService as unknown as RedisService, usersRepository as unknown as UsersRepository);
  });

  describe('findUserSessions', () => {
    it('returns empty when no sessions exist', async () => {
      redisService.raw.sMembers.mockResolvedValue([]);

      const result = await service.findUserSessions('user-1');

      expect(result).toEqual({ sessions: [], total: 0 });
    });

    it('returns sessions and cleans stale entries', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-1', 'sid-stale']);
      redisService.raw.mGet.mockResolvedValue([
        JSON.stringify({
          user_id: 'user-1',
          person_id: 'p-1',
          email: 'a@b.com',
          permissions: [],
          endpoint_keys: [],
          active: true,
          ip: '127.0.0.1',
          userAgent: 'test',
          device: 'test',
          created_at: '2025-01-01',
          last_refresh_at: '2025-01-01',
        }),
        null,
      ]);

      const result = await service.findUserSessions('user-1');

      expect(result.total).toBe(1);
      expect(result.sessions[0].sid).toBe('sid-1');
      expect(redisService.raw.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'sid-stale');
    });
  });

  describe('deactivateSession', () => {
    it('deactivates an existing session', async () => {
      redisService.raw.get.mockResolvedValue(JSON.stringify({ user_id: 'u-1', active: true, permissions: [] }));

      const result = await service.deactivateSession('sid-1');

      expect(result).toEqual({ message: 'Session deactivated' });
      expect(redisService.raw.set).toHaveBeenCalledWith('auth_session:sid-1', expect.stringContaining('"active":false'), {
        KEEPTTL: true,
      });
    });

    it('returns not found when session missing', async () => {
      redisService.raw.get.mockResolvedValue(null);

      const result = await service.deactivateSession('missing');

      expect(result).toEqual({ message: 'Session not found' });
    });
  });

  describe('refreshSessionPermissions', () => {
    it('updates permissions in all active sessions', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-1', 'sid-2']);
      redisService.raw.mGet.mockResolvedValue([
        JSON.stringify({
          user_id: 'user-1',
          person_id: 'p-1',
          email: 'a@b.com',
          permissions: ['OLD_PERM'],
          endpoint_keys: ['old-endpoint'],
          active: true,
          ip: '127.0.0.1',
          userAgent: 'test',
          device: 'test',
          created_at: '2025-01-01',
          last_refresh_at: '2025-01-01',
        }),
        JSON.stringify({
          user_id: 'user-1',
          person_id: 'p-1',
          email: 'a@b.com',
          permissions: ['OLD_PERM'],
          endpoint_keys: ['old-endpoint'],
          active: true,
          ip: '10.0.0.1',
          userAgent: 'test2',
          device: 'test2',
          created_at: '2025-01-02',
          last_refresh_at: '2025-01-02',
        }),
      ]);

      await service.refreshSessionPermissions('user-1', ['NEW_PERM_A', 'NEW_PERM_B']);

      expect(multiMock.set).toHaveBeenCalledTimes(2);
      expect(usersRepository.getAccesibleEndpointKeys).toHaveBeenCalledWith('user-1');
      expect(multiMock.set).toHaveBeenCalledWith(
        'auth_session:sid-1',
        expect.stringContaining('"endpoint_keys":["endpoint-a","endpoint-b"]'),
        { KEEPTTL: true },
      );
      expect(multiMock.set).toHaveBeenCalledWith(
        'auth_session:sid-2',
        expect.stringContaining('"endpoint_keys":["endpoint-a","endpoint-b"]'),
        { KEEPTTL: true },
      );
      for (const [, payload] of multiMock.set.mock.calls) {
        expect(payload).toContain('"permissions":["NEW_PERM_A","NEW_PERM_B"]');
      }
    });

    it('returns early when user has no active sessions', async () => {
      redisService.raw.sMembers.mockResolvedValue([]);

      await service.refreshSessionPermissions('user-1', ['PERM']);

      expect(redisService.raw.mGet).not.toHaveBeenCalled();
      expect(usersRepository.getAccesibleEndpointKeys).not.toHaveBeenCalled();
      expect(multiMock.set).not.toHaveBeenCalled();
    });

    it('cleans stale entries from the set', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-valid', 'sid-stale']);
      redisService.raw.mGet.mockResolvedValue([
        JSON.stringify({
          user_id: 'user-1',
          person_id: 'p-1',
          email: 'a@b.com',
          permissions: ['OLD'],
          endpoint_keys: ['old-endpoint'],
          active: true,
          ip: '127.0.0.1',
          userAgent: 'test',
          device: 'test',
          created_at: '2025-01-01',
          last_refresh_at: '2025-01-01',
        }),
        null,
      ]);

      await service.refreshSessionPermissions('user-1', ['NEW']);

      expect(multiMock.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'sid-stale');
      expect(multiMock.set).toHaveBeenCalledTimes(1);
      expect(multiMock.set).toHaveBeenCalledWith(
        'auth_session:sid-valid',
        expect.stringContaining('"endpoint_keys":["endpoint-a","endpoint-b"]'),
        { KEEPTTL: true },
      );
      expect(multiMock.set.mock.calls[0][1]).toContain('"permissions":["NEW"]');
    });

    it('cleans entries with unparseable JSON', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-bad']);
      redisService.raw.mGet.mockResolvedValue(['not-valid-json']);

      await service.refreshSessionPermissions('user-1', ['PERM']);

      expect(multiMock.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'sid-bad');
      expect(multiMock.set).not.toHaveBeenCalled();
    });
  });

  describe('refreshSessionPermissionsByRole', () => {
    it('finds users with the role and delegates to refreshSessionPermissions', async () => {
      const mockUsers = [
        Object.assign(new UserEntity(), {
          id: 'user-1',
          roles: [{ id: 'role-1', permissions: [{ code: 'PERM_A' }] }],
        }),
        Object.assign(new UserEntity(), {
          id: 'user-2',
          roles: [
            { id: 'role-1', permissions: [{ code: 'PERM_A' }] },
            { id: 'role-2', permissions: [{ code: 'PERM_B' }] },
          ],
        }),
      ] as UserEntity[];

      (usersRepository.findByRoleIdWithPermissions as jest.Mock).mockResolvedValue(mockUsers);
      const refreshSpy = jest.spyOn(service, 'refreshSessionPermissions').mockResolvedValue(undefined);

      await service.refreshSessionPermissionsByRole('role-1');

      expect(usersRepository.findByRoleIdWithPermissions).toHaveBeenCalledWith('role-1');
      expect(refreshSpy).toHaveBeenCalledWith('user-1', ['PERM_A']);
      expect(refreshSpy).toHaveBeenCalledWith('user-2', ['PERM_A', 'PERM_B']);
    });

    it('handles no users with the given role', async () => {
      (usersRepository.findByRoleIdWithPermissions as jest.Mock).mockResolvedValue([]);
      const refreshSpy = jest.spyOn(service, 'refreshSessionPermissions').mockResolvedValue(undefined);

      await service.refreshSessionPermissionsByRole('role-nonexistent');

      expect(usersRepository.findByRoleIdWithPermissions).toHaveBeenCalledWith('role-nonexistent');
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });
});
