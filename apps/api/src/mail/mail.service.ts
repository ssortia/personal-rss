import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

import { getEnv } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private createTransport() {
    const env = getEnv();
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const env = getEnv();
    const url = `${env.APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

    try {
      await this.createTransport().sendMail({
        from: env.SMTP_FROM,
        to,
        subject: 'Сброс пароля — Curio',
        html: `
          <p>Вы запросили сброс пароля для аккаунта Curio.</p>
          <p><a href="${url}">Сбросить пароль</a></p>
          <p>Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
        `,
      });
    } catch (err) {
      // Логируем ошибку, но не прокидываем её клиенту — он не должен знать о сбое
      this.logger.error({ err }, `Не удалось отправить письмо на ${to}`);
    }
  }
}
