import { Page, expect } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page, protected baseUrl: string) {}

  async navigateTo(path: string) {
    await this.page.goto(`${this.baseUrl}${path}`);
  }

  async expectCurrentPath(pathname: string) {
    const url = new URL(this.page.url());
    expect(url.pathname).toBe(pathname);
  }

  async clickTestId(testId: string) {
    await this.page.click(`[data-testid="${testId}"]`);
  }

  async fillTestId(testId: string, value: string) {
    await this.page.fill(`[data-testid="${testId}"]`, value);
  }

  async getTextByTestId(testId: string): Promise<string | null> {
    return await this.page.textContent(`[data-testid="${testId}"]`);
  }

  async waitForTestId(testId: string, state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible') {
    await this.page.waitForSelector(`[data-testid="${testId}"]`, { state });
  }
}
