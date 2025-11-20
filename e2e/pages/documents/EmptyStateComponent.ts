import { Page, expect } from '@playwright/test';

export class EmptyStateComponent {
  constructor(private page: Page) {}

  async expectVisible() {
    await expect(this.page.locator('[data-testid="div-doc-empty"]')).toBeVisible();
  }

  async expectNotVisible() {
    await expect(this.page.locator('[data-testid="div-doc-empty"]')).not.toBeVisible();
  }
}
