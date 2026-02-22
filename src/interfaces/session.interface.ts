export interface Session {
  person_id: string;
  email: string;
  permissions: string[];
  active: boolean;
}