import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Один воркер — одна тестовая БД, параллельность отключена
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // 1 retry в CI — защита от единичных сетевых флаков (webServer startup race).
  // Не 2+, чтобы не скрывать системно нестабильные тесты.
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Шаг 1: глобальный setup — регистрация + логин через UI → сохраняет storageState
    {
      name: 'setup',
      testDir: './playwright',
      testMatch: /global\.setup\.ts/,
    },
    // Основные тесты (с авторизацией через storageState)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      // auth.spec.ts запускается отдельным проектом без авторизации
      testIgnore: /auth\.spec\.ts/,
    },
    // Тесты авторизации (без storageState)
    {
      name: 'chromium-no-auth',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /auth\.spec\.ts/,
    },
  ],
  // Playwright сам поднимает серверы перед тестами
  webServer: [
    {
      command: 'pnpm --filter @repo/api start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @repo/web start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
