import { Request } from 'express';
import { UserEntity } from 'src/entities/user.entity';

export interface RequestWithUser extends Request {
    user: UserEntity;
}