import { Page, expect } from '@playwright/test';

/**
 * Component for indexing status badge operations
 * Maps to src/pages/documents/IndexingStatusBadge.tsx
 */
export class IndexingStatusBadgeComponent {
  constructor(private readonly page: Page) {}

  getDocumentCard(fileId: string) {
    return this.page.locator(`[data-testid="div-doc-item-${fileId}"]`);
  }

  async waitForIndexingStatus(fileId: string, status: 'completed' | 'failed') {
    const card = this.getDocumentCard(fileId);
    await expect(card).toHaveAttribute('data-indexing-status', status);
  }

  async expectIndexingStatus(fileId: string, status: string) {
    const card = this.getDocumentCard(fileId);
    await expect(card).toHaveAttribute('data-indexing-status', status);
  }

  async waitForIndexedText(fileId: string) {
    await this.page.waitForFunction((id) => {
      const doc = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
      return doc?.textContent?.includes('Indexed');
    }, fileId);
  }
}
