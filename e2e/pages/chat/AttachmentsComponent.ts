import { Page, expect } from '@playwright/test';

export class AttachmentsComponent {
  constructor(private readonly page: Page) {}

  async expectBadges(count: number) {
    const badges = await this.page.locator('[data-testid^="attachment-badge-"]').count();
    expect(badges).toBe(count);
  }

  async expectBadgeVisible(filename: string) {
    await expect(this.page.locator(`[data-filename="${filename}"]`)).toBeVisible();
  }

  async expectBadgeNotVisible(filename: string) {
    await expect(this.page.locator(`[data-filename="${filename}"]`)).not.toBeVisible();
  }

  async remove(filename: string) {
    const badge = this.page.locator(`[data-filename="${filename}"]`);
    const documentId = await badge.getAttribute('data-testid');
    if (!documentId) throw new Error(`Could not find document ID for ${filename}`);
    const id = documentId.replace('attachment-badge-', '');
    await this.page.getByTestId(`btn-remove-attachment-${id}`).click();
  }

  async getCount(): Promise<number> {
    return await this.page.locator('[data-testid^="attachment-badge-"]').count();
  }
}
