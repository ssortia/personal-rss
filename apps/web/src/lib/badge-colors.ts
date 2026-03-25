/** Базовые цветовые классы для бейджей, поддерживают светлую и тёмную темы. */
export const BADGE_COLORS = {
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
} as const;

/** Цвета бейджей для типов источников. */
export const SOURCE_TYPE_COLORS: Record<string, string> = {
  rss: BADGE_COLORS.orange,
  telegram: BADGE_COLORS.blue,
};

/** Возвращает цвет бейджа в зависимости от score релевантности. */
export function getScoreColor(score: number): string {
  if (score >= 0.7) return BADGE_COLORS.green;
  if (score >= 0.4) return BADGE_COLORS.yellow;
  return 'bg-muted text-muted-foreground';
}
