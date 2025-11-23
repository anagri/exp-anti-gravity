import { Page, expect } from '@playwright/test';

export interface KBConfig {
  embeddingModel?: string;
  embeddingDimensions?: number;
  hnswM?: number;
  hnswEfConstruction?: number;
}

/**
 * Component for KB creation modal operations
 * Maps to src/pages/documents/CreateKBModal.tsx
 */
export class CreateKBModalComponent {
  constructor(private readonly page: Page) {}

  async create(name: string, description?: string, config?: KBConfig) {
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

    if (config) {
      if (config.embeddingModel !== undefined) {
        // Check if dropdown selector exists (models loaded) or fallback to text input
        const dropdown = this.page.getByTestId('select-embedding-model');
        const textInput = this.page.getByTestId('input-kb-embedding-model');

        const isDropdownVisible = await dropdown.isVisible().catch(() => false);
        if (isDropdownVisible) {
          await this.selectEmbeddingModel(config.embeddingModel);
        } else {
          const isTextInputVisible = await textInput.isVisible().catch(() => false);
          if (isTextInputVisible) {
            await textInput.fill(config.embeddingModel);
          }
        }
      }
      if (config.embeddingDimensions !== undefined) {
        await this.page
          .getByTestId('input-kb-embedding-dimensions')
          .fill(String(config.embeddingDimensions));
      }
      if (config.hnswM !== undefined) {
        await this.page.getByTestId('input-kb-hnsw-m').fill(String(config.hnswM));
      }
      if (config.hnswEfConstruction !== undefined) {
        await this.page
          .getByTestId('input-kb-hnsw-ef-construction')
          .fill(String(config.hnswEfConstruction));
      }
    }

    const submitButton = this.page.getByTestId('btn-create-kb-submit');
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await modal.waitFor({ state: 'hidden' });

    const kbCard = this.page.locator(`[data-kb-name="${name}"]`);
    await kbCard.waitFor({ state: 'visible' });
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

  async expectDuplicateError(name: string) {
    await this.page.getByTestId('btn-create-kb').click();
    const modal = this.page.getByTestId('modal-create-kb');
    await modal.waitFor({ state: 'visible' });
    await this.page.getByTestId('input-kb-name').fill(name);
    await this.page.getByTestId('btn-create-kb-submit').click();

    await expect(modal.getByText(/already exists/i)).toBeVisible();

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden' });
  }
}
