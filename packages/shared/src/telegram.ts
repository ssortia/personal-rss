/**
 * Приводит любой формат к чистому username без префиксов:
 * @channel → channel, t.me/channel → channel, https://t.me/channel → channel
 */
export function normalizeTelegramUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^t\.me\//i, '')
    .replace(/^@/, '');
}

/**
 * Определяет, является ли строка ссылкой или упоминанием Telegram-канала.
 * Обрабатывает форматы: @channel, t.me/channel, https://t.me/channel, http://t.me/channel.
 */
export function isTelegramInput(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.startsWith('@') ||
    v.startsWith('t.me/') ||
    v.startsWith('https://t.me/') ||
    v.startsWith('http://t.me/')
  );
}
