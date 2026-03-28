import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { getEnv } from '../../config/env';

/**
 * Проверяет заголовок X-Internal-Token для защиты внутренних эндпоинтов.
 * Используется для эндпоинтов, вызываемых только сервером Next.js, не браузером.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const token = request.headers['x-internal-token'];
    const { INTERNAL_API_SECRET } = getEnv();

    if (typeof token !== 'string' || token !== INTERNAL_API_SECRET) {
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
