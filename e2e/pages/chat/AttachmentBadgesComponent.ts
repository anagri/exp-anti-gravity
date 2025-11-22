import { Page, expect } from '@playwright/test';

export class AttachmentBadgesComponent {
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

    // Precondition: Badge must be visible before removing
    await expect(badge).toBeVisible();

    const documentId = await badge.getAttribute('data-testid');
    expect(documentId, `Could not find document ID for ${filename}`).toBeTruthy();
    const id = documentId!.replace('attachment-badge-', '');
    await this.page.getByTestId(`btn-remove-attachment-${id}`).click();
  }

  async getCount(): Promise<number> {
    return await this.page.locator('[data-testid^="attachment-badge-"]').count();
  }
}
