import { JwtPayload } from 'jsonwebtoken';

export interface Payload extends JwtPayload {
    email: string;
    exp: number;
    sid: string;
}

export interface RefreshPasswordRedisPayload {
  id: string;
}