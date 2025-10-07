import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class TemplateService {
  private cache = new Map<string, string>();

  private resolve(file: string) {
    // __dirname en runtime apunta a dist/mail
    return path.join(__dirname, 'templates', file);
  }

  async loadTemplate(file: string): Promise<string> {
    if (this.cache.has(file)) return this.cache.get(file)!;
    const full = this.resolve(file);
    const content = await fs.readFile(full, 'utf8');
    this.cache.set(file, content);
    return content;
  }

  render(template: string, data: Record<string, string | number | null | undefined>): string {
    let html = template;
    // Normaliza valores (null/undefined -> "")
    for (const [key, val] of Object.entries(data)) {
      const value = (val ?? '').toString();
      html = html.replaceAll(`%%${key}%%`, value);
    }
    return html;
  }
}