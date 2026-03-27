import { expect, test } from '@playwright/test';

import { PreferencesPage } from '../pages/preferences.page';

test('страница настроек загружается без ошибок', async ({ page }) => {
  const prefsPage = new PreferencesPage(page);
  await prefsPage.goto();

  await expect(page.getByRole('heading', { name: 'Интересы' })).toBeVisible();
});

test('slider релевантности имеет корректные aria-атрибуты', async ({ page }) => {
  const prefsPage = new PreferencesPage(page);
  await prefsPage.goto();

  const slider = prefsPage.slider();
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuemin', '0');
  await expect(slider).toHaveAttribute('aria-valuemax', '1');
});

test('textarea интересов и счётчик символов видны', async ({ page }) => {
  const prefsPage = new PreferencesPage(page);
  await prefsPage.goto();

  await expect(prefsPage.interestsTextarea()).toBeVisible();
  await expect(prefsPage.charCounter()).toBeVisible();
});
