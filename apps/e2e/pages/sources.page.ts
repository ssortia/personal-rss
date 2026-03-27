import type { Page } from '@playwright/test';

/** Page Object для страницы /sources. */
export class SourcesPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/sources');
  }

  /** Открывает встроенную форму добавления источника. */
  async openAddForm() {
    await this.page.getByRole('button', { name: 'Добавить источник' }).click();
  }

  async fillUrl(url: string) {
    await this.page.getByPlaceholder('https://example.com/feed.xml или @channel').fill(url);
  }

  async submitAdd() {
    await this.page.getByRole('button', { name: 'Добавить' }).click();
  }

  /** Открывает форму, вводит URL и нажимает «Добавить». */
  async addSource(url: string) {
    await this.openAddForm();
    await this.fillUrl(url);
    await this.submitAdd();
  }

  inputError() {
    return this.page.locator('p.text-destructive');
  }
}
