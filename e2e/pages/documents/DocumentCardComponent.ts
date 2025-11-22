import { Page, expect } from '@playwright/test';

/**
 * Component for individual document card operations
 * Maps to src/pages/documents/DocumentCard.tsx
 */
export class DocumentCardComponent {
  constructor(private readonly page: Page) {}

  getCard(fileId: string) {
    return this.page.locator(`[data-testid="div-doc-item-${fileId}"]`);
  }

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
    expect(fileId, `File not found: ${filename}`).toBeTruthy();

    await this.page.click(`[data-testid="btn-doc-delete-${fileId}"]`);
  }

  async downloadFileByName(filename: string) {
    const fileId = await this.findFileByName(filename);
    expect(fileId, `File not found: ${filename}`).toBeTruthy();

    await this.page.click(`[data-testid="btn-doc-download-${fileId}"]`);
  }

  async getFileNames(): Promise<string[]> {
    const filenames = await this.page.locator('[data-testid^="span-doc-filename-"]').allTextContents();
    return filenames;
  }

  async getChunkCount(fileId: string): Promise<number> {
    const card = this.getCard(fileId);
    const chunkCountStr = await card.getAttribute('data-chunk-count');
    expect(chunkCountStr, `Chunk count attribute missing for file ${fileId}`).toBeTruthy();

    const chunkCount = parseInt(chunkCountStr!, 10);
    expect(chunkCount, `Invalid chunk count for file ${fileId}: ${chunkCountStr}`).not.toBeNaN();

    return chunkCount;
  }

  // Assertion helper - throws if file not found
  async getFileByName(filename: string): Promise<string> {
    const fileId = await this.findFileByName(filename);
    expect(fileId, `File not found: ${filename}`).toBeTruthy();
    return fileId!;
  }
}
