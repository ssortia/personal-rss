import type { Page } from '@playwright/test';

/** Page Object для страницы /login. */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/login');
    // Ждём полной гидрации React в production-сборке
    await this.page.waitForLoadState('networkidle');
  }

  async fill(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Пароль').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Войти' }).click();
  }

  /** Выполняет логин и ждёт редиректа. */
  async login(email: string, password: string) {
    await this.goto();
    await this.fill(email, password);
    await this.submit();
  }

  serverError() {
    return this.page.locator('p.text-destructive');
  }
}
