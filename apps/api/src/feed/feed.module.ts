import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { UsersModule } from '../users/users.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [UsersModule, ArticlesModule, PreferencesModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
