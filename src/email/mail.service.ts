import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    await this.transporter.sendMail({
      from: process.env.FROM_EMAIL || '"Smart Room Scheduler" <no-reply@example.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
