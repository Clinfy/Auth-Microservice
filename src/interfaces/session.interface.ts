export interface Session {
  user_id: string;
  person_id: string;
  email: string;
  permissions: string[];
  active: boolean;
}

export interface SessionWithSid extends Session {
  sid: string;
}