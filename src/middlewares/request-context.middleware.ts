import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContextService } from 'src/common/context/request-context.service';
import { RequestWithUser } from 'src/interfaces/request-user';
import { NextFunction } from 'express';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: RequestWithUser, res: Response, next: NextFunction) {
    const user = req.user;

    if(user){
      this.requestContextService.start(user, next);
    } else {
      next();
    }
  }
}