import { Request } from 'express';
import { UserEntity } from 'src/entities/user.entity';
import { IncomingHttpHeaders } from 'node:http';

export interface RequestWithUser extends Request {
    user: UserEntity;
    headers: IncomingHttpHeaders & {
      authorization?: string,
      'refresh-token'?: string,
    };
}