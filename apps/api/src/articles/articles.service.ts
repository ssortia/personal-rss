import { Injectable } from '@nestjs/common';
import type { FeedPage } from '@repo/shared';

import { ArticlesRepository } from './articles.repository';

@Injectable()
export class ArticlesService {
  constructor(private readonly articlesRepository: ArticlesRepository) {}

  getFeed(userId: string, threshold: number, cursor?: string, limit?: number): Promise<FeedPage> {
    return this.articlesRepository.getFeed(userId, threshold, cursor, limit);
  }
}
