import type { Page } from '@playwright/test';

/** Page Object для страницы /preferences. */
export class PreferencesPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/preferences');
  }

  /** Slider релевантности (role="slider", min=0, max=1). */
  slider() {
    return this.page.getByRole('slider');
  }

  /** Textarea описания интересов. */
  interestsTextarea() {
    return this.page.getByRole('textbox');
  }

  /** Счётчик символов «N / 2000». */
  charCounter() {
    return this.page.locator('p').filter({ hasText: '/ 2000' });
  }
}
