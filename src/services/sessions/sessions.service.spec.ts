import { SessionsService } from './sessions.service';
import { RedisService } from 'src/common/redis/redis.service';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/entities/user.entity';

describe('SessionsService', () => {
  let service: SessionsService;
  let redisService: { raw: any };
  let userRepository: jest.Mocked<Partial<Repository<UserEntity>>>;

  beforeEach(() => {
    redisService = {
      raw: {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue('OK'),
        sMembers: jest.fn(),
        mGet: jest.fn(),
        sRem: jest.fn().mockResolvedValue(1),
        del: jest.fn().mockResolvedValue(1),
      },
    };

    userRepository = {
      find: jest.fn(),
    };

    service = new SessionsService(
      redisService as unknown as RedisService,
      userRepository as unknown as Repository<UserEntity>,
    );
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
          active: true,
          ip: '10.0.0.1',
          userAgent: 'test2',
          device: 'test2',
          created_at: '2025-01-02',
          last_refresh_at: '2025-01-02',
        }),
      ]);

      await service.refreshSessionPermissions('user-1', ['NEW_PERM_A', 'NEW_PERM_B']);

      expect(redisService.raw.set).toHaveBeenCalledTimes(2);
      expect(redisService.raw.set).toHaveBeenCalledWith(
        'auth_session:sid-1',
        expect.stringContaining('"permissions":["NEW_PERM_A","NEW_PERM_B"]'),
        { KEEPTTL: true },
      );
      expect(redisService.raw.set).toHaveBeenCalledWith(
        'auth_session:sid-2',
        expect.stringContaining('"permissions":["NEW_PERM_A","NEW_PERM_B"]'),
        { KEEPTTL: true },
      );
    });

    it('returns early when user has no active sessions', async () => {
      redisService.raw.sMembers.mockResolvedValue([]);

      await service.refreshSessionPermissions('user-1', ['PERM']);

      expect(redisService.raw.mGet).not.toHaveBeenCalled();
      expect(redisService.raw.set).not.toHaveBeenCalled();
    });

    it('cleans stale entries from the set', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-valid', 'sid-stale']);
      redisService.raw.mGet.mockResolvedValue([
        JSON.stringify({
          user_id: 'user-1',
          person_id: 'p-1',
          email: 'a@b.com',
          permissions: ['OLD'],
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

      expect(redisService.raw.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'sid-stale');
      expect(redisService.raw.set).toHaveBeenCalledTimes(1);
      expect(redisService.raw.set).toHaveBeenCalledWith(
        'auth_session:sid-valid',
        expect.stringContaining('"permissions":["NEW"]'),
        { KEEPTTL: true },
      );
    });

    it('cleans entries with unparseable JSON', async () => {
      redisService.raw.sMembers.mockResolvedValue(['sid-bad']);
      redisService.raw.mGet.mockResolvedValue(['not-valid-json']);

      await service.refreshSessionPermissions('user-1', ['PERM']);

      expect(redisService.raw.sRem).toHaveBeenCalledWith('user_sessions:user-1', 'sid-bad');
      expect(redisService.raw.set).not.toHaveBeenCalled();
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

      (userRepository.find as jest.Mock).mockResolvedValue(mockUsers);
      const refreshSpy = jest.spyOn(service, 'refreshSessionPermissions').mockResolvedValue(undefined);

      await service.refreshSessionPermissionsByRole('role-1');

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { roles: { id: 'role-1' } },
      });
      expect(refreshSpy).toHaveBeenCalledTimes(2);
      expect(refreshSpy).toHaveBeenCalledWith('user-1', ['PERM_A']);
      expect(refreshSpy).toHaveBeenCalledWith('user-2', ['PERM_A', 'PERM_B']);
    });

    it('handles no users with the given role', async () => {
      (userRepository.find as jest.Mock).mockResolvedValue([]);
      const refreshSpy = jest.spyOn(service, 'refreshSessionPermissions').mockResolvedValue(undefined);

      await service.refreshSessionPermissionsByRole('role-nonexistent');

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { roles: { id: 'role-nonexistent' } },
      });
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });
});
