import { expect, test } from '@playwright/test';

import { SourcesPage } from '../pages/sources.page';

test('страница источников загружается без ошибок', async ({ page }) => {
  const sourcesPage = new SourcesPage(page);
  await sourcesPage.goto();

  // Заголовок страницы присутствует
  await expect(page.getByRole('heading', { name: 'Источники' })).toBeVisible();
  // Кнопка добавления доступна
  await expect(page.getByRole('button', { name: 'Добавить источник' })).toBeVisible();
});

test('пустое состояние отображается для нового пользователя', async ({ page }) => {
  // Зависимость: тест предполагает, что тестовый пользователь (из global.setup.ts)
  // не имеет источников. При workers: 1 порядок выполнения предсказуем, но если
  // другой тест в этой сессии добавит источник — этот тест упадёт.
  const sourcesPage = new SourcesPage(page);
  await sourcesPage.goto();

  await expect(page.getByText('Источников пока нет')).toBeVisible();
});

test('невалидный URL показывает ошибку валидации', async ({ page }) => {
  const sourcesPage = new SourcesPage(page);
  await sourcesPage.goto();

  await sourcesPage.openAddForm();
  await sourcesPage.fillUrl('not-a-valid-url');

  // Валидация в AddSourceForm срабатывает реактивно при onChange (не при submit):
  // inputError = trimmed ? getInputError(trimmed, detectedType) : null
  // submitAdd() намеренно не вызывается — это проверка inline-feedback.
  await expect(sourcesPage.inputError()).toBeVisible();
  await expect(sourcesPage.inputError()).toContainText('Введите корректный URL');
});
