'use client';

import { useState } from 'react';

import type { ArticleFeedItem } from '@repo/types';

interface Props {
  article: ArticleFeedItem;
}

/** Порог длины контента Telegram-поста, после которого показываем кнопку «Показать полностью». */
const TELEGRAM_PREVIEW_LENGTH = 300;

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;

  const label = score.toFixed(2);
  const colorClass =
    score >= 0.7
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : score >= 0.4
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-muted text-muted-foreground';

  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>{label}</span>;
}

function TelegramContent({ content, url }: { content: string; url: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > TELEGRAM_PREVIEW_LENGTH;
  const displayed = isLong && !expanded ? content.slice(0, TELEGRAM_PREVIEW_LENGTH) + '…' : content;

  return (
    <div className="space-y-1">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{displayed}</p>
      <div className="flex items-center gap-3">
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {expanded ? 'Свернуть' : 'Показать полностью'}
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          Открыть в Telegram →
        </a>
      </div>
    </div>
  );
}

export function ArticleCard({ article }: Props) {
  const isTelegram = article.sourceType === 'TELEGRAM';

  return (
    <article className="border-b py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          {isTelegram ? (
            // Для Telegram: title — это обрезанный контент, показываем только полный текст
            article.content && <TelegramContent content={article.content} url={article.url} />
          ) : (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary line-clamp-2 block font-medium leading-snug transition-colors"
            >
              {article.title}
            </a>
          )}

          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="truncate">{article.source.title}</span>
            {article.publishedAt && (
              <>
                <span>·</span>
                <span className="shrink-0">{formatDate(article.publishedAt)}</span>
              </>
            )}
          </div>
        </div>
        <ScoreBadge score={article.score} />
      </div>
    </article>
  );
}
