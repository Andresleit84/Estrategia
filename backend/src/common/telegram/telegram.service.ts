import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly chatId: string;

  constructor(private readonly config: ConfigService) {
    this.token  = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.chatId = this.config.get<string>('TELEGRAM_CHAT_ID')   ?? '';
  }

  get isConfigured(): boolean {
    return !!(this.token && this.chatId);
  }

  /** Escape HTML entities for Telegram HTML parse mode */
  static esc(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Progress bar — value 0-100, e.g. bar(70) → ▓▓▓▓▓▓▓░░░ */
  static bar(value: number, width = 10): string {
    const filled = Math.min(Math.round((Math.max(0, Math.min(100, value)) / 100) * width), width);
    return '▓'.repeat(filled) + '░'.repeat(width - filled);
  }

  /** Send to global chat or to a specific per-org chat_id */
  async send(html: string, overrideChatId?: string): Promise<void> {
    const target = overrideChatId?.trim() || this.chatId;
    if (!this.token || !target) return;
    const chunks: string[] = [];
    for (let i = 0; i < html.length; i += 4000) chunks.push(html.slice(i, i + 4000));
    for (const chunk of chunks) {
      await this.post({ chat_id: target, text: chunk, parse_mode: 'HTML' });
    }
  }

  private post(body: Record<string, unknown>): Promise<void> {
    return new Promise((resolve) => {
      const data = JSON.stringify(body);
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${this.token}/sendMessage`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        },
        (res) => { res.resume(); res.on('end', resolve); },
      );
      req.on('error', (err) => { this.logger.error(`Telegram error: ${err.message}`); resolve(); });
      req.write(data);
      req.end();
    });
  }
}
