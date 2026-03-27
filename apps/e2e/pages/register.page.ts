import type { Page } from '@playwright/test';

/** Page Object для страницы /register. */
export class RegisterPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/register');
    // Ждём полной гидрации React в production-сборке
    await this.page.waitForLoadState('networkidle');
  }

  async fill(email: string, password: string) {
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Пароль').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  }

  /** Выполняет регистрацию через форму. */
  async register(email: string, password: string) {
    await this.goto();
    await this.fill(email, password);
    await this.submit();
  }

  serverError() {
    return this.page.locator('p.text-destructive');
  }
}
