import { Request } from 'express';
import { ApiKeyEntity } from 'src/entities/api-key.entity';

export interface RequestWithApiKey extends Request {
    apiKey: ApiKeyEntity;
}