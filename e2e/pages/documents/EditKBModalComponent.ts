import { Page, expect } from '@playwright/test';

/**
 * Component for KB edit modal operations
 * Maps to src/pages/documents/EditKBModal.tsx
 */
export class EditKBModalComponent {
  constructor(private readonly page: Page) {}

  async edit(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });

    const testId = await kbCard.getAttribute('data-testid');
    const kbId = testId?.replace('kb-card-', '') || '';

    // Open KB menu
    const menuButton = this.page.getByTestId(`btn-kb-menu-${kbId}`);
    await menuButton.click();

    // Click edit button in menu
    const editButton = this.page.getByTestId(`btn-edit-kb-${kbId}`);
    await editButton.click();

    const modal = this.page.getByTestId('modal-edit-kb');
    await modal.waitFor({ state: 'visible' });
  }

  async updateChunkConfig(maxTokens: number, overlapTokens: number) {
    const modal = this.page.getByTestId('modal-edit-kb');
    await modal.waitFor({ state: 'visible' });

    await this.page.getByTestId('input-kb-chunk-max-tokens').fill(String(maxTokens));
    await this.page.getByTestId('input-kb-chunk-overlap-tokens').fill(String(overlapTokens));

    await this.page.getByTestId('btn-update-kb-submit').click();
  }

  async confirmReindex() {
    // Wait for re-index warning dialog
    const reindexDialog = this.page.getByTestId('dialog-reindex-warning');
    await reindexDialog.waitFor({ state: 'visible' });

    // Confirm re-index
    await this.page.getByTestId('btn-confirm-reindex').click();

    // Wait for dialog to close
    await reindexDialog.waitFor({ state: 'hidden' });
  }

  async cancelReindex() {
    const reindexDialog = this.page.getByTestId('dialog-reindex-warning');
    await reindexDialog.waitFor({ state: 'visible' });

    await this.page.getByTestId('btn-cancel-reindex').click();
    await reindexDialog.waitFor({ state: 'hidden' });
  }

  async refreshModels() {
    const button = this.page.getByTestId('btn-refresh-embedding-models');
    await button.waitFor({ state: 'visible', timeout: 10000 });
    await button.scrollIntoViewIfNeeded();
    await button.click();

    // Wait for loading to start
    await this.page.waitForSelector(
      '[data-testid="btn-refresh-embedding-models"][data-loading="true"]',
      { timeout: 5000 }
    );

    // Wait for loading to finish
    await this.page.waitForSelector(
      '[data-testid="btn-refresh-embedding-models"][data-loading="false"]'
    );
  }

  async selectEmbeddingModel(modelName: string) {
    const combobox = this.page.getByTestId('select-embedding-model');
    await combobox.click();

    // Type to search for model
    await this.page.keyboard.type(modelName);

    // Select the model from dropdown using exact match via testid
    const option = this.page.getByTestId(`select-embedding-model-item-${modelName}`);
    await option.click();
  }

  async expectEmbeddingDropdownVisible() {
    const dropdown = this.page.getByTestId('select-embedding-model');
    await expect(dropdown).toBeVisible();
  }

  async expectEmbeddingTextInputVisible() {
    const textInput = this.page.getByTestId('input-kb-embedding-model');
    await expect(textInput).toBeVisible();
  }

  async close() {
    const modal = this.page.getByTestId('modal-edit-kb');
    await modal.getByRole('button', { name: 'Close' }).click();
    await modal.waitFor({ state: 'hidden' });
  }
}
