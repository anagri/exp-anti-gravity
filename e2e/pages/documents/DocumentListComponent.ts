import { Page } from '@playwright/test';
import { DocumentCardComponent } from './DocumentCardComponent';
import { IndexingStatusBadgeComponent } from './IndexingStatusBadgeComponent';
import { IndexingProgressComponent } from './IndexingProgressComponent';

/**
 * Composite component for document list operations
 * Delegates to: DocumentCardComponent, IndexingStatusBadgeComponent, IndexingProgressComponent
 */
export class DocumentListComponent {
  readonly card: DocumentCardComponent;
  readonly statusBadge: IndexingStatusBadgeComponent;
  readonly progress: IndexingProgressComponent;

  constructor(private page: Page) {
    this.card = new DocumentCardComponent(page);
    this.statusBadge = new IndexingStatusBadgeComponent(page);
    this.progress = new IndexingProgressComponent(page);
  }

  // Backward-compatible wrapper methods delegate to sub-components

  async findFileByName(filename: string): Promise<string | null> {
    return await this.card.findFileByName(filename);
  }

  async waitForFileToAppear(filename: string) {
    await this.card.waitForFileToAppear(filename);
  }

  async deleteFileByName(filename: string) {
    await this.card.deleteFileByName(filename);
  }

  async downloadFileByName(filename: string) {
    await this.card.downloadFileByName(filename);
  }

  async expectFileCount(count: number) {
    await this.progress.expectFileCount(count);
  }

  async getFileNames(): Promise<string[]> {
    return await this.card.getFileNames();
  }

  getDocumentCard(fileId: string) {
    return this.card.getCard(fileId);
  }

  async waitForIndexingStatus(fileId: string, status: 'completed' | 'failed') {
    await this.statusBadge.waitForIndexingStatus(fileId, status);
  }

  async expectIndexingStatus(fileId: string, status: string) {
    await this.statusBadge.expectIndexingStatus(fileId, status);
  }

  async getChunkCount(fileId: string): Promise<number> {
    return await this.card.getChunkCount(fileId);
  }

  async waitForIndexedText(fileId: string) {
    await this.statusBadge.waitForIndexedText(fileId);
  }
}
