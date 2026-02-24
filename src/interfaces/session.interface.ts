export interface Session {
  user_id: string;
  person_id: string;
  email: string;
  permissions: string[];
  active: boolean;
  ip: string;
  userAgent: string;
  device: string;
  created_at: string;
  last_refresh_at: string;
}

export interface SessionWithSid extends Session {
  sid: string;
}