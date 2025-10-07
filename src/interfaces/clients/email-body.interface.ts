export interface EmailBody {
  recipient: string[];
  subject: string;
  html: string;
  text?: string;
}