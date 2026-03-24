import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface TelegramPost {
  guid: string;
  title: string;
  url: string;
  content: string | null;
  publishedAt: Date | null;
}

export interface TelegramChannelData {
  title: string;
  description: string | null;
  posts: TelegramPost[];
}

@Injectable()
export class TelegramGate {
  private readonly logger = new Logger(TelegramGate.name);

  /**
   * Загружает публичный Telegram-канал через веб-превью t.me/s/{username}.
   * Возвращает null если канал приватный, не найден или не содержит постов.
   */
  async fetchChannel(username: string): Promise<TelegramChannelData | null> {
    const url = `https://t.me/s/${username}`;

    let html: string;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CurioBot/1.0)' },
      });
      if (!res.ok) {
        this.logger.warn(`Telegram fetch failed for @${username}: HTTP ${res.status}`);
        return null;
      }
      html = await res.text();
    } catch (err) {
      this.logger.warn(`Telegram fetch error for @${username}: ${String(err)}`);
      return null;
    }

    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ??
      $('.tgme_channel_info_header_title').text().trim();

    // Если заголовок не найден — канал приватный или не существует
    if (!title) return null;

    const description = $('meta[property="og:description"]').attr('content') ?? null;

    const posts: TelegramPost[] = [];

    // data-post находится на .tgme_widget_message, а не на .tgme_widget_message_wrap
    $('.tgme_widget_message[data-post]').each((_, el) => {
      const dataPost = $(el).attr('data-post');
      if (!dataPost) return;

      const textEl = $(el).find('.tgme_widget_message_text');
      const content = textEl.text().trim() || null;

      // Посты без текста (только медиа) пропускаем — нечего оценивать AI
      if (!content) return;

      const title = content.slice(0, 100);
      const postUrl = `https://t.me/${dataPost}`;

      const datetimeAttr = $(el).find('time[datetime]').attr('datetime');
      const publishedAt = datetimeAttr ? new Date(datetimeAttr) : null;

      posts.push({ guid: dataPost, title, url: postUrl, content, publishedAt });
    });

    return { title, description, posts };
  }
}
