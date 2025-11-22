import { Page, expect } from '@playwright/test';

export class LoadingStateComponent {
  constructor(private readonly page: Page) {}

  async expectThinking() {
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).toBeVisible();
  }

  async expectNotThinking() {
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).not.toBeVisible();
  }

  async waitForThinkingToDisappear() {
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).not.toBeVisible();
  }

  async expectState(state: 'ready' | 'loading' | 'error') {
    const card = await this.page.locator('[data-test-state]');
    await expect(card).toHaveAttribute('data-test-state', state);
  }

  async expectReady() {
    await this.expectState('ready');
  }
}
