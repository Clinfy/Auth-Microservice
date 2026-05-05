import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/redis/redis.service';
import { Session, SessionWithSid } from 'src/interfaces/session.interface';
import { UsersRepository } from 'src/services/users/users.repository';

@Injectable()
export class SessionsService {
  constructor(
    private readonly redis: RedisService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async findUserSessions(userId: string): Promise<{ sessions: SessionWithSid[]; total: number }> {
    const indexKey = `user_sessions:${userId}`;

    const sids = await this.redis.raw.sMembers(indexKey);
    if (!sids.length) return { sessions: [], total: 0 };

    const sessionKeys = sids.map((sid) => `auth_session:${sid}`);
    const raws = await this.redis.raw.mGet(sessionKeys);

    const sessions: SessionWithSid[] = [];

    for (let i = 0; i < sids.length; i++) {
      const raw = raws[i];
      const sid = sids[i];

      if (!raw) {
        await this.redis.raw.sRem(indexKey, sids[i]);
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as Session;
        sessions.push({ sid, ...parsed });
      } catch {
        await this.redis.raw.sRem(indexKey, sids[i]);
      }
    }
    return { sessions, total: sessions.length };
  }

  async deactivateSession(sid: string): Promise<{ message: string }> {
    const cacheKey = `auth_session:${sid}`;
    const raw = await this.redis.raw.get(cacheKey);
    const session = raw ? (JSON.parse(raw) as Session) : null;

    if (session) {
      const deactivatedSession: Session = {
        ...session,
        active: false,
      };
      await this.redis.raw.set(cacheKey, JSON.stringify(deactivatedSession), {
        KEEPTTL: true,
      });
      return { message: 'Session deactivated' };
    } else {
      return { message: 'Session not found' };
    }
  }

  async refreshSessionPermissions(userId: string, permissions: string[]): Promise<void> {
    await this.refreshUserSessions(userId, async () => {
      const endpointKeys = await this.usersRepository.getAccesibleEndpointKeys(userId);

      return (session) => ({ ...session, permissions, endpoint_keys: endpointKeys });
    });
  }

  async refreshSessionEndpointKeys(userId: string): Promise<void> {
    await this.refreshUserSessions(userId, async () => {
      const endpointKeys = await this.usersRepository.getAccesibleEndpointKeys(userId);

      return (session) => ({ ...session, endpoint_keys: endpointKeys });
    });
  }

  async refreshAllSessionEndpointKeys(): Promise<void> {
    const userSessionIndexPrefix = 'user_sessions:';
    const userIds = new Set<string>();

    for await (const keys of this.redis.raw.scanIterator({
      MATCH: `${userSessionIndexPrefix}*`,
      COUNT: 100,
    })) {
      for (const key of keys) {
        const userId = key.slice(userSessionIndexPrefix.length);
        if (userId) userIds.add(userId);
      }
    }

    for (const userId of userIds) {
      await this.refreshSessionEndpointKeys(userId);
    }
  }

  async refreshSessionPermissionsByRole(roleId: string): Promise<void> {
    const users = await this.usersRepository.findByRoleIdWithPermissions(roleId);

    if (!users.length) return;

    for (const user of users) {
      await this.refreshSessionPermissions(user.id, user.permissionCodes);
    }
  }

  private async refreshUserSessions(
    userId: string,
    createSessionUpdater: () => Promise<(session: Session) => Session>,
  ): Promise<void> {
    const indexKey = `user_sessions:${userId}`;

    const sids = await this.redis.raw.sMembers(indexKey);
    if (!sids.length) return;

    const updateSession = await createSessionUpdater();
    const sessionKeys = sids.map((sid) => `auth_session:${sid}`);
    const raws = await this.redis.raw.mGet(sessionKeys);
    const multi = this.redis.raw.multi();

    for (let i = 0; i < sids.length; i++) {
      const raw = raws[i];
      const sid = sids[i];

      if (!raw) {
        multi.sRem(indexKey, sid);
        continue;
      }

      try {
        const parsed = JSON.parse(raw) as Session;
        const updatedSession = updateSession(parsed);
        multi.set(`auth_session:${sid}`, JSON.stringify(updatedSession), {
          KEEPTTL: true,
        });
      } catch {
        multi.sRem(indexKey, sid);
      }
    }
    await multi.exec();
  }
}
