import { expect, test } from '@playwright/test';

import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';

// Все тесты этого файла запускаются в проекте chromium-no-auth (без storageState)

test('регистрация создаёт аккаунт и перенаправляет на главную', async ({ page }) => {
  const email = `e2e-reg-${crypto.randomUUID()}@test.com`;
  const password = 'TestPassword123!';

  const registerPage = new RegisterPage(page);
  await registerPage.register(email, password);

  await expect(page).toHaveURL('/');
});

test('логин с неверным паролем показывает сообщение об ошибке', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login('nonexistent@test.com', 'WrongPassword!');

  await expect(loginPage.serverError()).toBeVisible();
  await expect(loginPage.serverError()).toContainText('Неверный email или пароль');
});

test('незалогиненный пользователь перенаправляется на /login', async ({ page }) => {
  // Переходим на защищённый маршрут без авторизации
  await page.goto('/');

  await expect(page).toHaveURL('/login');
});

test('выход из аккаунта перенаправляет на /login', async ({ page }) => {
  // Сначала регистрируемся и логинимся
  const email = `e2e-logout-${crypto.randomUUID()}@test.com`;
  const password = 'TestPassword123!';

  const registerPage = new RegisterPage(page);
  await registerPage.register(email, password);
  await expect(page).toHaveURL('/');

  // Нажимаем кнопку выхода (server action через form submit)
  await page.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL('/login');
});
