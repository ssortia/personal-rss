/** Лимит статей по умолчанию при выборке неоценённых и последних статей источника. */
export const FEED_DEFAULT_LIMIT = 50;

/** Длина превью контента для промпта AI-оценки (в символах). */
export const SCORING_CONTENT_PREVIEW_LENGTH = 500;

/** Максимальное число токенов на одну статью при AI-оценке батча. */
export const SCORING_TOKENS_PER_ARTICLE = 150;

/** TTL токена сброса пароля (1 час в миллисекундах). */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
