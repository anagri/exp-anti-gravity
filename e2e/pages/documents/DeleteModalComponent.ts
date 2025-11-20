import { Page, expect } from '@playwright/test';

export class DeleteModalComponent {
  constructor(private page: Page) {}

  async waitForModal() {
    await expect(this.page.locator('[data-testid="div-delete-modal"]')).toBeVisible();
  }

  async waitForModalToClose() {
    await expect(this.page.locator('[data-testid="div-delete-modal"]')).not.toBeVisible();
  }

  async confirm() {
    await this.page.click('[data-testid="btn-delete-confirm"]');
  }

  async cancel() {
    await this.page.click('[data-testid="btn-delete-cancel"]');
  }
}
