'use client';

import { useState } from 'react';

import type { ArticleFeedItem } from '@repo/types';
import { Clock } from 'lucide-react';

interface Props {
  article: ArticleFeedItem;
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;

  const colorClass =
    score >= 0.7
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : score >= 0.4
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-muted text-muted-foreground';

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {score.toFixed(2)}
    </span>
  );
}

const SOURCE_TYPE_LABEL: Record<string, string> = {
  RSS: 'RSS',
  ATOM: 'Atom',
  TELEGRAM: 'Telegram',
};

/** Контент Telegram-поста с кнопкой «Показать полностью». */
function TelegramContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 300;
  const visible = expanded || !isLong ? content : content.slice(0, 300) + '…';

  return (
    <div className="space-y-1.5">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{visible}</p>
      {isLong && !expanded && (
        <button onClick={() => setExpanded(true)} className="text-primary text-xs hover:underline">
          Показать полностью
        </button>
      )}
    </div>
  );
}

export function ArticleCard({ article }: Props) {
  const isTelegram = article.sourceType === 'TELEGRAM';

  return (
    <div className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-sm">
      {/* Основной контент */}
      <div className="min-w-0 flex-1 space-y-1.5">
        {isTelegram ? (
          <div className="space-y-1.5">
            {article.aiTitle && <p className="font-medium leading-snug">{article.aiTitle}</p>}
            {article.content && <TelegramContent content={article.content} />}
          </div>
        ) : (
          <div className="space-y-1">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary block font-medium leading-snug transition-colors"
            >
              {article.title}
            </a>
            {article.summary && (
              <p className="text-muted-foreground line-clamp-2 text-sm">{article.summary}</p>
            )}
          </div>
        )}
      </div>

      {/* Footer: источник + тип + дата + score */}
      <div className="border-border flex items-center gap-2 border-t pt-2.5">
        <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
          {SOURCE_TYPE_LABEL[article.sourceType] ?? article.sourceType}
        </span>
        {isTelegram ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground min-w-0 flex-1 truncate text-xs transition-colors"
          >
            {article.source.title}
          </a>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {article.source.title}
          </span>
        )}
        {article.publishedAt && (
          <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
        )}
        <ScoreBadge score={article.score} />
      </div>
    </div>
  );
}
