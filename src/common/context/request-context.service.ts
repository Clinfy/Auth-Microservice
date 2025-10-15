import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/entities/user.entity';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  user: UserEntity | null;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  start<T>(callback: () => T): T {
    return this.asyncLocalStorage.run({ user: null }, callback);
  }

  private getContext(): RequestContext {
    const context = this.asyncLocalStorage.getStore();
    if (!context) {
      throw new Error('RequestContext no inicializado. ¿Olvidaste el RequestContextMiddleware?');
    }
    return context;
  }

  setUser(user: UserEntity): void {
    const context = this.getContext();
    context.user = user;
  }

  getCurrentUser(): UserEntity | null {
    return this.getContext()?.user;
  }
}