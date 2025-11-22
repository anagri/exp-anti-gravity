import { Page, expect } from '@playwright/test';

export class CitationsComponent {
  constructor(private readonly page: Page) {}

  async getCount(): Promise<number> {
    return await this.page.locator('[data-citation-index]').count();
  }

  async hover(index: number) {
    const citation = this.page.locator(`[data-citation-index="${index}"]`).first();
    await expect(citation).toBeVisible();
    await citation.hover();
  }

  async expectTooltipVisible() {
    await expect(this.page.locator('[data-citation-tooltip]')).toBeVisible();
  }
}
