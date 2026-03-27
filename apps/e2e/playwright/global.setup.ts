import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('авторизация тестового пользователя', async ({ page }) => {
  const email = `e2e-${crypto.randomUUID()}@test.com`;
  const password = 'TestPassword123!';

  // Шаг 1: регистрируем пользователя через API
  // next-auth шифрует cookie, поэтому нельзя получить токен через API напрямую —
  // нужен полноценный UI-логин, чтобы next-auth установил session cookie
  const response = await fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Регистрация не удалась: ${response.status} — ${body}`);
  }

  // Шаг 2: логинимся через UI, чтобы next-auth установил session cookie
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();

  // Ждём редиректа на dashboard после успешного логина
  await page.waitForURL('/');

  // Шаг 3: сохраняем состояние (cookies + localStorage) для переиспользования в тестах
  await page.context().storageState({ path: authFile });
});
