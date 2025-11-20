import { Page, expect } from '@playwright/test';

export class FileSelectorComponent {
  constructor(private page: Page) {}

  async expectOpen() {
    await expect(this.page.locator('[data-testid="modal-file-selector"]')).toHaveAttribute('data-state', 'open');
  }

  async expectFileVisible(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    await expect(fileItem).toBeVisible();
  }

  async expectFileIndexed(filename: string, indexed: boolean) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    const status = indexed ? 'completed' : 'pending';
    await expect(fileItem).toHaveAttribute('data-indexing-status', status);
  }

  async selectFile(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    const checkbox = fileItem.locator('[type="checkbox"]');
    await checkbox.click();
  }

  async confirmSelection() {
    await this.page.click('[data-testid="btn-confirm-file-selector"]');
  }

  async cancel() {
    await this.page.click('[data-testid="btn-cancel-file-selector"]');
  }

  async searchFiles(query: string) {
    await this.page.fill('[data-testid="input-file-search"]', query);
  }

  async clearSearch() {
    await this.page.click('[data-testid="btn-clear-search"]');
  }
}
