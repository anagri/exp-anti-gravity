import { Page, expect } from '@playwright/test';

export class DocumentListComponent {
  constructor(private page: Page) {}

  async findFileByName(filename: string): Promise<string | null> {
    const cards = await this.page.locator('[data-testid^="div-doc-item-"]').all();

    for (const card of cards) {
      const filenameLoc = card.locator('[data-testid^="span-doc-filename-"]');
      const text = await filenameLoc.textContent();

      if (text?.includes(filename)) {
        const testId = await card.getAttribute('data-testid');
        return testId?.replace('div-doc-item-', '') || null;
      }
    }

    return null;
  }

  async waitForFileToAppear(filename: string) {
    await this.page.waitForFunction(
      (name) => {
        const filenames = document.querySelectorAll('[data-testid^="span-doc-filename-"]');
        return Array.from(filenames).some(el => el.textContent?.includes(name));
      },
      filename
    );
  }

  async deleteFileByName(filename: string) {
    const fileId = await this.findFileByName(filename);

    if (!fileId) {
      throw new Error(`File not found: ${filename}`);
    }

    await this.page.click(`[data-testid="btn-doc-delete-${fileId}"]`);
  }

  async downloadFileByName(filename: string) {
    const fileId = await this.findFileByName(filename);

    if (!fileId) {
      throw new Error(`File not found: ${filename}`);
    }

    await this.page.click(`[data-testid="btn-doc-download-${fileId}"]`);
  }

  async expectFileCount(count: number) {
    const cards = this.page.locator('[data-testid^="div-doc-item-"]');
    await expect(cards).toHaveCount(count);
  }

  async getFileNames(): Promise<string[]> {
    const filenames = await this.page.locator('[data-testid^="span-doc-filename-"]').allTextContents();
    return filenames;
  }

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

  async getChunkCount(fileId: string): Promise<number> {
    const card = this.getDocumentCard(fileId);
    const chunkCountStr = await card.getAttribute('data-chunk-count');
    const chunkCount = parseInt(chunkCountStr || '0', 10);

    if (isNaN(chunkCount)) {
      throw new Error(`Invalid chunk count for file ${fileId}: ${chunkCountStr}`);
    }

    return chunkCount;
  }
}
