import { Page, expect } from '@playwright/test';

export class BasePage {
  protected readonly basename = '/exp-anti-gravity';

  constructor(protected page: Page, protected baseUrl: string) {}

  async navigateTo(path: string) {
    await this.page.goto(`${this.baseUrl}${this.basename}${path}`);
  }

  async waitForPath(path: string) {
    const expectedPath = path === '/' ? this.basename : `${this.basename}${path}`;
    await this.page.waitForURL(url => url.pathname === expectedPath);
  }

  async expectCurrentPath(pathname: string) {
    const url = new URL(this.page.url());
    const expectedPath = pathname === '/' ? this.basename : `${this.basename}${pathname}`;
    expect(url.pathname).toBe(expectedPath);
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

  // Feature flag management
  async setFeatureFlag(flagName: string, enabled: boolean) {
    await this.page.addInitScript((flag, value) => {
      localStorage.setItem(`feature-flag-${flag}`, value.toString());
    }, flagName, enabled);
  }

  // Page navigation helpers
  async reload() {
    await this.page.reload();
  }

  async goBack() {
    await this.page.goBack();
  }

  async goForward() {
    await this.page.goForward();
  }
}
