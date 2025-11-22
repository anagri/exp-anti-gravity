import { Page, expect } from '@playwright/test';

export class ModelSelectorComponent {
  constructor(private readonly page: Page) {}

  async select(modelId: string) {
    await this.page.getByTestId('btn-chat-model-trigger').click();
    await this.page.getByTestId(`select-chat-model-item-${modelId}`).click();
  }

  async expectSelected(modelId: string) {
    const button = await this.page.locator('[data-testid="btn-chat-model-trigger"]');
    await expect(button).toHaveAttribute('data-selected-model', modelId);
  }

  async getSelected(): Promise<string | null> {
    const button = this.page.locator('[data-testid="btn-chat-model-trigger"]');
    return await button.getAttribute('data-selected-model');
  }
}
