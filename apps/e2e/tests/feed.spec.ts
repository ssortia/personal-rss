import { expect, test } from '@playwright/test';

import { FeedPage } from '../pages/feed.page';

test('страница фида загружается без ошибок', async ({ page }) => {
  const feedPage = new FeedPage(page);
  await feedPage.goto();

  await expect(page.getByRole('heading', { name: 'Фид' })).toBeVisible();
});

test('виджет RSS-ссылки отображается на странице', async ({ page }) => {
  const feedPage = new FeedPage(page);
  await feedPage.goto();

  // RSS URL отображается в элементе <code>
  await expect(feedPage.feedUrlCode()).toBeVisible();
});

test('кнопка копирования RSS-ссылки доступна', async ({ page }) => {
  const feedPage = new FeedPage(page);
  await feedPage.goto();

  await expect(feedPage.copyButton()).toBeVisible();
});
