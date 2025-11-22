import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { UploadZoneComponent } from './documents/UploadZoneComponent';
import { DocumentListComponent } from './documents/DocumentListComponent';
import { DeleteModalComponent } from './documents/DeleteModalComponent';
import { ToolbarComponent } from './documents/ToolbarComponent';
import { EmptyStateComponent } from './documents/EmptyStateComponent';
import { KnowledgeBaseComponent } from './documents/KnowledgeBaseComponent';
import { SettingsComponent } from './shared/SettingsComponent';

export class DocumentPage extends BasePage {
  readonly uploadZone: UploadZoneComponent;
  readonly documentList: DocumentListComponent;
  readonly deleteModal: DeleteModalComponent;
  readonly toolbar: ToolbarComponent;
  readonly emptyState: EmptyStateComponent;
  readonly knowledgeBase: KnowledgeBaseComponent;
  readonly settings: SettingsComponent;

  constructor(page: Page, baseUrl: string = 'http://127.0.0.1:4173') {
    super(page, baseUrl);
    this.uploadZone = new UploadZoneComponent(page);
    this.documentList = new DocumentListComponent(page);
    this.deleteModal = new DeleteModalComponent(page);
    this.toolbar = new ToolbarComponent(page);
    this.emptyState = new EmptyStateComponent(page);
    this.knowledgeBase = new KnowledgeBaseComponent(page);
    this.settings = new SettingsComponent(page);
  }

  async setup(apiKey: string) {
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

  // KB-aware operations (delegated to knowledgeBase component)
  async createKB(name: string, description?: string) {
    await this.knowledgeBase.create(name, description);
  }

  async expandKB(kbName: string) {
    await this.knowledgeBase.expand(kbName);
  }

  async expectKbExpanded(kbName: string, expanded: boolean) {
    await this.knowledgeBase.expectExpanded(kbName, expanded);
  }

  async uploadFilesToKB(kbName: string, filePaths: string | string[]) {
    await this.uploadZone.uploadFiles(filePaths);

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-uploading]');
      return container?.getAttribute('data-uploading') === 'false';
    });
  }

  async uploadFilesToKBAndWait(kbName: string, filePath: string, filename: string) {
    // Assert KB is expanded (deterministic - will fail if not in expected state)
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await expect(kbCard).toHaveAttribute('data-expanded', 'true');

    await this.uploadZone.uploadFiles(filePath);

    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-uploading]');
      return container?.getAttribute('data-uploading') === 'false';
    });

    await this.documentList.waitForFileToAppear(filename);
  }

  async expectEmptyKBState() {
    await this.knowledgeBase.expectEmptyState();
  }

  async expectEmptyDocumentsInKB() {
    await this.knowledgeBase.expectEmptyDocumentsInKB();
  }

  async expectKBVisible(kbName: string) {
    await this.knowledgeBase.expectVisible(kbName);
  }

  async expectKBNotVisible(kbName: string) {
    await this.knowledgeBase.expectNotVisible(kbName);
  }

  async expectKBStats(kbName: string, docCount: number, chunkCount?: number) {
    await this.knowledgeBase.expectStats(kbName, docCount, chunkCount);
  }

  async deleteKB(kbName: string) {
    await this.knowledgeBase.delete(kbName);
  }

  async collapseKB(kbName: string) {
    await this.knowledgeBase.collapse(kbName);
  }

  async expectKBExpanded(kbName: string, expanded: boolean) {
    await this.knowledgeBase.expectExpanded(kbName, expanded);
  }

  async getKBId(kbName: string): Promise<string> {
    return await this.knowledgeBase.getId(kbName);
  }

  // URL validation helpers
  async expectURLHasKBParam(kbId: string) {
    await this.page.waitForURL((url) => url.searchParams.get('kb') === kbId);
  }

  async expectURLHasNoKBParam() {
    await this.page.waitForURL((url) => !url.searchParams.has('kb'));
  }

  async expectURLContains(substring: string) {
    expect(this.page.url()).toContain(substring);
  }

  // Settings operations (delegated to settings component)
  async openSettings() {
    await this.settings.open();
  }

  async closeSettings() {
    await this.settings.close();
  }

  async getFeatureFlagValue(flagName: string): Promise<boolean> {
    return await this.settings.getFeatureFlagValue(flagName);
  }

  async toggleFeatureFlag(flagName: string) {
    await this.settings.toggleFeatureFlag(flagName);
  }

  async expectReloadWarning() {
    await this.settings.expectReloadWarning();
  }

  async reloadToApplyChanges() {
    await this.settings.reloadToApplyChanges();
    await this.waitForDBInitialized();
  }
}
