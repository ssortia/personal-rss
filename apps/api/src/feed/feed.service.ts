import { Injectable, NotFoundException } from '@nestjs/common';

import { ArticlesRepository } from '../articles/articles.repository';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { UsersService } from '../users/users.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly usersService: UsersService,
    private readonly articlesRepository: ArticlesRepository,
    private readonly preferencesRepository: PreferencesRepository,
  ) {}

  async getToken(userId: string): Promise<{ token: string }> {
    const token = await this.usersService.getFeedToken(userId);
    return { token };
  }

  async resetToken(userId: string): Promise<{ token: string }> {
    const token = await this.usersService.resetFeedToken(userId);
    return { token };
  }

  /** Строит RSS 2.0 XML для публичного доступа по токену. */
  async getRssFeed(token: string): Promise<string> {
    const user = await this.usersService.findByFeedToken(token);
    if (!user) throw new NotFoundException('Фид не найден');

    const { relevanceThreshold } = await this.preferencesRepository.getSettings(user.id);
    const { items } = await this.articlesRepository.getFeed(
      user.id,
      relevanceThreshold,
      undefined,
      50,
    );

    const itemsXml = items
      .map((item) => {
        const pubDate = item.publishedAt ? new Date(item.publishedAt).toUTCString() : '';
        return [
          '    <item>',
          `      <title><![CDATA[${item.title}]]></title>`,
          `      <link>${escapeXml(item.url)}</link>`,
          `      <guid>${escapeXml(item.url)}</guid>`,
          pubDate ? `      <pubDate>${pubDate}</pubDate>` : '',
          `      <source url="${escapeXml(item.url)}">${escapeXml(item.source.title)}</source>`,
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '  <channel>',
      `    <title><![CDATA[Curio — персональный фид ${user.email}]]></title>`,
      '    <description>Персональные новости с AI-фильтрацией</description>',
      itemsXml,
      '  </channel>',
      '</rss>',
    ].join('\n');
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
