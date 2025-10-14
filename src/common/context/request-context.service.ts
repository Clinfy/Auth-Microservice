import { UserEntity } from 'src/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  user: UserEntity | null;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  start<T>(user: UserEntity | null, callback: () => T): T {
    return this.asyncLocalStorage.run({ user }, callback);
  }

  setCurrentUser(user: UserEntity | null): void {
    const store = this.asyncLocalStorage.getStore();

    if (store) {
      store.user = user;
      return;
    }

    this.asyncLocalStorage.enterWith({ user });
  }

  getCurrentUser(): UserEntity | null {
    return this.asyncLocalStorage.getStore()?.user ?? null;
  }
}
