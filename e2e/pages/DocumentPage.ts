import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { UploadZoneComponent } from './documents/UploadZoneComponent';
import { DocumentListComponent } from './documents/DocumentListComponent';
import { DeleteModalComponent } from './documents/DeleteModalComponent';
import { ToolbarComponent } from './documents/ToolbarComponent';
import { EmptyStateComponent } from './documents/EmptyStateComponent';

export class DocumentPage extends BasePage {
  readonly uploadZone: UploadZoneComponent;
  readonly documentList: DocumentListComponent;
  readonly deleteModal: DeleteModalComponent;
  readonly toolbar: ToolbarComponent;
  readonly emptyState: EmptyStateComponent;

  constructor(page: Page, baseUrl: string = 'http://127.0.0.1:4173') {
    super(page, baseUrl);
    this.uploadZone = new UploadZoneComponent(page);
    this.documentList = new DocumentListComponent(page);
    this.deleteModal = new DeleteModalComponent(page);
    this.toolbar = new ToolbarComponent(page);
    this.emptyState = new EmptyStateComponent(page);
  }

  async setup(apiKey: string = 'sk-test-key-123') {
    await this.navigateTo('/');
    await this.page.getByPlaceholder('sk-...').fill(apiKey);
    await this.page.getByRole('button', { name: 'Start Chatting' }).click();
    await this.waitForPath('/chat');
    await this.navigateTo('/documents');
    await this.waitForPath('/documents');

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-db-initialized]');
      return container?.getAttribute('data-db-initialized') === 'true';
    });
  }

  async navigate() {
    await this.navigateTo('/documents');
    await this.waitForPath('/documents');
  }

  async navigateToAndWait() {
    await this.navigate();
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

  async openSettings() {
    await this.page.click('[data-testid="btn-settings"]');
    await this.page.waitForSelector('[data-testid="div-settings-modal"]', { state: 'visible' });
  }

  async closeSettings() {
    await this.page.click('[data-testid="btn-close-settings"]');
    await this.page.waitForSelector('[data-testid="div-settings-modal"]', { state: 'hidden' });
  }

  async getFeatureFlagValue(flagName: string): Promise<boolean> {
    const row = this.page.locator(`[data-testid="feature-flag-${flagName}"]`);
    const enabled = await row.getAttribute('data-enabled');
    return enabled === 'true';
  }

  async toggleFeatureFlag(flagName: string) {
    await this.page.click(`[data-testid="toggle-${flagName}"]`);
  }

  async expectReloadWarning() {
    await this.page.waitForSelector('[data-testid="reload-warning"]', { state: 'visible' });
  }

  async reloadToApplyChanges() {
    await this.page.click('[data-testid="btn-reload-now"]');
    await this.waitForDBInitialized();
  }
}
