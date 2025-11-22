import { Page, expect } from '@playwright/test';

/**
 * Component for indexing progress indicator operations
 * Maps to src/pages/documents/IndexingProgress.tsx
 */
export class IndexingProgressComponent {
  constructor(private readonly page: Page) {}

  async expectFileCount(count: number) {
    const cards = this.page.locator('[data-testid^="div-doc-item-"]');
    await expect(cards).toHaveCount(count);
  }
}
