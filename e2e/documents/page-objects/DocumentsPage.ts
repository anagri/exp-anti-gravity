import { Page, expect } from '@playwright/test';
import { UploadZoneComponent } from './UploadZoneComponent';
import { DocumentListComponent } from './DocumentListComponent';
import { DeleteModalComponent } from './DeleteModalComponent';
import { ToolbarComponent } from './ToolbarComponent';
import { EmptyStateComponent } from './EmptyStateComponent';

export class DocumentsPage {
  readonly uploadZone: UploadZoneComponent;
  readonly documentList: DocumentListComponent;
  readonly deleteModal: DeleteModalComponent;
  readonly toolbar: ToolbarComponent;
  readonly emptyState: EmptyStateComponent;

  constructor(private page: Page) {
    this.uploadZone = new UploadZoneComponent(page);
    this.documentList = new DocumentListComponent(page);
    this.deleteModal = new DeleteModalComponent(page);
    this.toolbar = new ToolbarComponent(page);
    this.emptyState = new EmptyStateComponent(page);
  }

  async navigateTo() {
    await this.page.goto('/documents');
    await this.page.waitForURL('/documents');
  }

  async navigateToAndWait() {
    await this.navigateTo();
    await this.waitForDBInitialized();
  }

  async waitForDBInitialized() {
    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-db-initialized]');
      return container?.getAttribute('data-db-initialized') === 'true';
    });
  }

  async uploadFiles(filePaths: string | string[]) {
    await this.uploadZone.uploadFiles(filePaths);

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-uploading]');
      return container?.getAttribute('data-uploading') === 'false';
    });
  }

  async uploadFilesAndWait(filePath: string, filename: string) {
    await this.uploadZone.uploadFiles(filePath);

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-uploading]');
      return container?.getAttribute('data-uploading') === 'false';
    });

    await this.documentList.waitForFileToAppear(filename);
  }

  async expectFileCount(count: number) {
    await this.documentList.expectFileCount(count);
  }

  async deleteFileByName(filename: string) {
    await this.documentList.deleteFileByName(filename);
  }

  async downloadFileByName(filename: string) {
    await this.documentList.downloadFileByName(filename);
  }

  async searchFiles(query: string) {
    await this.toolbar.search(query);
  }

  async sortFiles(sortOption: string) {
    await this.toolbar.sort(sortOption);
  }

  async filterFiles(filterOption: string) {
    await this.toolbar.filter(filterOption);
  }

  async expectEmptyState() {
    await this.emptyState.expectVisible();
  }
}
