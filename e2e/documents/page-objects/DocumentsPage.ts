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

  async clearDatabase() {
    await this.page.goto('/');
    await this.page.evaluate(async () => {
      const databases = await indexedDB.databases();
      console.log('[clearPGliteDB] Available databases:', databases);

      const promises = databases
        .filter(db => db.name?.includes('rag') || db.name?.includes('pglite'))
        .map(db => {
          return new Promise<void>((resolve) => {
            if (db.name) {
              console.log('[clearPGliteDB] Deleting database:', db.name);
              const request = indexedDB.deleteDatabase(db.name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            } else {
              resolve();
            }
          });
        });

      await Promise.all(promises);
    });
  }

  async setup(apiKey: string = 'sk-test-key-123') {
    await this.page.goto('/');
    await this.page.getByPlaceholder('sk-...').fill(apiKey);
    await this.page.getByRole('button', { name: 'Start Chatting' }).click();
    await this.page.waitForURL('/chat');
    await this.page.goto('/documents');
    await this.page.waitForURL('/documents');

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-db-initialized]');
      return container?.getAttribute('data-db-initialized') === 'true';
    });
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
