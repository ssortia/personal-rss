import { ApiError } from './api';

/** Возвращает читаемое сообщение для форм аутентификации. */
export function getAuthError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Пользователь с таким email уже существует';
    if (error.status === 401) return 'Неверный email или пароль';
    if (error.status === 400) return 'Проверьте введённые данные';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}

/** Возвращает читаемое сообщение для формы добавления источника. */
export function getSourceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Источник уже добавлен';
    if (error.status === 400) return 'Неверный URL или канал не найден';
  }
  return 'Произошла ошибка. Попробуйте ещё раз.';
}
