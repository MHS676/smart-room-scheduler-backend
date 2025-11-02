import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
    const secure = process.env.EMAIL_SECURE === 'true';

    if (!host || !port) {
      this.logger.warn('EMAIL_HOST or EMAIL_PORT not configured — using JSON transport (dev fallback)');

      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.log('MailService: JSON transport active (development fallback)');
      return;
    }

    const connTimeout = process.env.EMAIL_CONN_TIMEOUT ? Number(process.env.EMAIL_CONN_TIMEOUT) : 5000;
    const greetingTimeout = process.env.EMAIL_GREETING_TIMEOUT ? Number(process.env.EMAIL_GREETING_TIMEOUT) : 5000;

    this.transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: connTimeout,
      greetingTimeout: greetingTimeout,
    });


    this.transporter.verify().then(() => {
      this.logger.log('SMTP transporter verified');
    }).catch((err) => {
      this.logger.warn(`SMTP transporter verification failed: ${err && err.message ? err.message : err}`);
    });
  }

  private wait(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    const from = process.env.FROM_EMAIL || '"Smart Room Scheduler" <no-reply@example.com>';
    const mailOpts = { from, to: options.to, subject: options.subject, html: options.html };

    const maxAttempts = 2;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        attempt++;
        const result = await this.transporter.sendMail(mailOpts);
        this.logger.debug(`Email sent to ${options.to}: ${result && (result as any).messageId}`);
        return result;
      } catch (err: any) {
        const isTimeout = err && (err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION' || err.code === 'EHOSTUNREACH');
        this.logger.warn(`Failed to send email (attempt ${attempt}/${maxAttempts}) to ${options.to}: ${err && err.message ? err.message : err}`);
        if (!isTimeout || attempt >= maxAttempts) {
          throw err;
        }
        await this.wait(500 * attempt);
      }
    }
  }
}
