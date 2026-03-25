/** Форматирует дату для карточки статьи: «25 мар, 14:30». */
export function formatArticleDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Возвращает относительное время: «5 мин. назад», «2 ч. назад». */
export function formatRelativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return `${days} дн. назад`;
}

/** Форматирует дату в короткий вид: «25.03.2026». */
export function formatShortDate(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU');
}
