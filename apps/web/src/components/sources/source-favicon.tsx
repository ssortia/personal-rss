'use client';

import { useState } from 'react';

import { Globe } from 'lucide-react';

interface SourceFaviconProps {
  url: string;
  type: 'RSS' | 'ATOM' | 'TELEGRAM';
  imageUrl?: string | null;
  size?: number;
}

/** Иконка Telegram (официальный логотип в виде SVG). */
function TelegramIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#29B6F6" />
      <path
        d="M5.2 11.7l13-5c.6-.2 1.1.1 1 .8l-2.2 10.4c-.2.7-.6.9-1.2.6l-3.3-2.4-1.6 1.5c-.2.2-.4.3-.7.3l.3-3.1 6.3-5.7c.3-.3 0-.4-.4-.2L7.5 13.5 5.2 12.7c-.7-.2-.7-.7 0-1z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Показывает иконку источника:
 * - Telegram → фирменная иконка
 * - RSS → favicon сайта через Google favicon service, с fallback на Globe
 */
export function SourceFavicon({ url, type, imageUrl, size = 20 }: SourceFaviconProps) {
  const [error, setError] = useState(false);

  if (type === 'TELEGRAM') {
    if (imageUrl && !error) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-full object-cover"
          onError={() => setError(true)}
        />
      );
    }
    return <TelegramIcon size={size} />;
  }

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    // невалидный URL → покажем fallback
  }

  if (!domain || error) {
    return <Globe size={size} className="text-muted-foreground" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      onError={() => setError(true)}
    />
  );
}
