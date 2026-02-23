export interface Session {
  id: string;
  person_id: string;
  email: string;
  permissions: string[];
  active: boolean;
}