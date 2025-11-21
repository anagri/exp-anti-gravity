import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class WelcomePage extends BasePage {
  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  async navigateToWelcome() {
    await this.navigateTo('/');
  }

  async fillApiKey(apiKey: string) {
    await this.fillTestId('inp-welcome-apikey', apiKey);
  }

  async clickStartChat() {
    await this.clickTestId('btn-welcome-start');
  }

  async submitApiKey(apiKey: string) {
    await this.fillApiKey(apiKey);
    await this.clickStartChat();
    await this.waitForPath('/chat');
  }

  async expectWelcomePageVisible() {
    await expect(this.page.getByText('Welcome to AI Chat')).toBeVisible();
  }

  async expectApiKeyInputVisible() {
    await expect(this.page.locator('[data-testid="inp-welcome-apikey"]')).toBeVisible();
  }

  async expectAtWelcomePage() {
    await this.waitForPath('/');
  }
}
