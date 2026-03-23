import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface WaSenderButton {
  id: string;
  text: string; // max 20 chars
}

export interface WaSenderListRow {
  id: string;
  title: string;       // max 24 chars
  description?: string; // max 72 chars
}

export interface WaSenderListSection {
  title: string;
  rows: WaSenderListRow[];
}

@Injectable()
export class WaSenderApiService {
  private readonly logger = new Logger(WaSenderApiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = 'https://api.wasenderapi.com';
    this.apiKey = this.config.get<string>('WASENDER_API_KEY', '');
  }

  // ─── Send plain text ──────────────────────────────────────────────
  async sendText(phone: string, message: string): Promise<void> {
    await this.post('/api/send-message', { phoneNumber: phone, message });
  }

  // ─── Send up to 3 interactive buttons ────────────────────────────
  async sendButtons(
    phone: string,
    message: string,
    buttons: WaSenderButton[],
    footer?: string,
  ): Promise<void> {
    await this.post('/api/send-buttons-message', {
      phoneNumber: phone,
      message,
      footer: footer ?? '',
      buttons: buttons.slice(0, 3),
    });
  }

  // ─── Send list picker (up to 10 items) ───────────────────────────
  async sendList(
    phone: string,
    title: string,
    description: string,
    buttonText: string,
    sections: WaSenderListSection[],
  ): Promise<void> {
    await this.post('/api/send-list-message', {
      phoneNumber: phone,
      title,
      description,
      buttonText,
      sections,
    });
  }

  // ─── Internal HTTP helper ─────────────────────────────────────────
  private post(path: string, body: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.apiKey) {
        this.logger.warn('WASENDER_API_KEY not set — skipping send');
        return resolve();
      }

      const payload = JSON.stringify(body);
      const parsed = new URL(this.baseUrl + path);
      const isHttps = parsed.protocol === 'https:';
      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${this.apiKey}`,
        },
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            this.logger.error(`WaSender ${path} → ${res.statusCode}: ${data}`);
          }
          resolve();
        });
      });

      req.on('error', (err) => {
        this.logger.error(`WaSender request failed: ${err.message}`);
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }
}
