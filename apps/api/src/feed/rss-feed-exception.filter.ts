import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

// Минимальный интерфейс ответа Fastify, нужный для этого фильтра.
// Прямой импорт из 'fastify' не используется — fastify не прямая зависимость.
interface FastifyReply {
  status(statusCode: number): this;
  header(key: string, value: string): this;
  send(payload: unknown): void;
}

/**
 * Перехватывает HTTP-исключения в feed-эндпоинте и возвращает XML-ответ
 * вместо JSON, чтобы Content-Type совпадал с телом ответа.
 */
@Catch(HttpException)
export class RssFeedExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception.message ?? 'Ошибка сервера';

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '  <channel>',
      `    <title>Ошибка ${status}</title>`,
      `    <description>${escapeXml(message)}</description>`,
      '  </channel>',
      '</rss>',
    ].join('\n');

    void reply
      .status(status)
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .send(xml);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
