import { Request } from 'express';
import { IncomingHttpHeaders } from 'node:http';
import { AuthUser } from 'src/interfaces/auth-user.interface';

export interface RequestWithUser extends Request {
    user: AuthUser;
    headers: IncomingHttpHeaders & {
      authorization?: string,
      'refresh-token'?: string,
    };
}