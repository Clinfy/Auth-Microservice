import { UserEntity } from 'src/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  user: UserEntity;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>()

  start<T>(user: UserEntity, callback: () => T): T  {
    return this.asyncLocalStorage.run({ user }, callback)
  }

  getCurrentUser(): UserEntity | undefined {
    return this.asyncLocalStorage.getStore()?.user
  }
}