import type { Page } from '@playwright/test';

/** Page Object для страницы / (feed / dashboard). */
export class FeedPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  /** Элемент <code> с RSS-ссылкой внутри виджета. */
  feedUrlCode() {
    return this.page.locator('code').first();
  }

  /** Кнопка копирования RSS-ссылки (aria-label меняется после копирования). */
  copyButton() {
    return this.page.getByLabel('Копировать ссылку');
  }
}
