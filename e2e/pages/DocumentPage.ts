import { expect, Page } from '@playwright/test';
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

  // KB-aware operations
  async createKB(name: string, description?: string) {
    const createButton = this.page.getByTestId('btn-create-kb');
    await createButton.click();

    const modal = this.page.getByTestId('modal-create-kb');
    await modal.waitFor({ state: 'visible' });

    const nameInput = this.page.getByTestId('input-kb-name');
    await nameInput.fill(name);

    if (description) {
      const descriptionTextarea = this.page.getByTestId('textarea-kb-description');
      await descriptionTextarea.fill(description);
    }

    const submitButton = this.page.getByTestId('btn-create-kb-submit');
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await modal.waitFor({ state: 'hidden' });

    const kbCard = this.page.locator(`[data-kb-name="${name}"]`);
    await kbCard.waitFor({ state: 'visible' });
  }

  async expandKB(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });

    // Ensure KB starts collapsed (deterministic initial state)
    await this.expectKbExpanded(kbName, false);

    // Get KB ID for URL verification
    const testId = await kbCard.getAttribute('data-testid');
    const kbId = testId?.replace('kb-card-', '') || null;

    // Click to expand
    await kbCard.click();

    // Wait for expansion to complete
    await this.page.waitForFunction(
      (name) => {
        const card = document.querySelector(`[data-kb-name="${name}"]`);
        return card?.getAttribute('data-expanded') === 'true';
      },
      kbName
    );

    // Verify URL updated with KB query param
    await this.page.waitForURL(url => url.searchParams.get('kb') === kbId);
  }

  async expectKbExpanded(kbName: string, expanded: boolean) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await expect(kbCard).toHaveAttribute('data-expanded', expanded ? 'true' : 'false');
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
    const emptyStateMessage = this.page.getByText('No knowledge bases yet');
    await emptyStateMessage.waitFor({ state: 'visible' });
  }

  async expectEmptyDocumentsInKB() {
    const emptyDocsMessage = this.page.getByText('No documents in this knowledge base yet');
    await emptyDocsMessage.waitFor({ state: 'visible' });
  }

  async expectKBVisible(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });
  }

  async expectKBNotVisible(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'hidden' });
  }

  async expectKBStats(kbName: string, docCount: number, chunkCount?: number) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.locator(`[data-doc-count="${docCount}"]`).waitFor({ state: 'visible' });
    if (chunkCount !== undefined) {
      await kbCard.locator(`[data-chunk-count="${chunkCount}"]`).waitFor({ state: 'visible' });
    }
  }

  async deleteKB(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const kbId = (await kbCard.getAttribute('data-testid'))?.replace('kb-card-', '');

    const moreButton = kbCard.getByRole('button', { name: '' }).last();
    await moreButton.click();

    const deleteButton = this.page.getByTestId(`btn-delete-kb-${kbId}`);
    await deleteButton.click();

    const deleteModal = this.page.getByTestId('modal-delete-kb');
    await deleteModal.waitFor({ state: 'visible' });

    const confirmButton = this.page.getByTestId('btn-delete-kb-confirm');
    await confirmButton.click();

    await deleteModal.waitFor({ state: 'hidden' });
    await kbCard.waitFor({ state: 'hidden' });
  }

  async collapseKB(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const isExpanded = await kbCard.getAttribute('data-expanded');

    if (isExpanded === 'true') {
      await kbCard.click();
      await this.page.waitForFunction(
        (name) => document.querySelector(`[data-kb-name="${name}"]`)?.getAttribute('data-expanded') === 'false',
        kbName
      );
    }
  }

  async expectKBExpanded(kbName: string, expanded: boolean) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });
    await expect(kbCard).toHaveAttribute('data-expanded', expanded ? 'true' : 'false');
  }

  async getKBId(kbName: string): Promise<string> {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const kbId = await kbCard.getAttribute('data-testid');
    return kbId?.replace('kb-card-', '') || '';
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
