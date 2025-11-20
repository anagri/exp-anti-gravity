import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ChatPage extends BasePage {
  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  async waitForModelsLoaded() {
    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-models-loaded]');
      return container?.getAttribute('data-models-loaded') === 'true';
    });
  }

  async selectModel(modelId: string) {
    await this.clickTestId('btn-chat-model-trigger');
    await this.clickTestId(`select-chat-model-item-${modelId}`);
  }

  async expectSelectedModel(modelId: string) {
    const button = await this.page.locator('[data-testid="btn-chat-model-trigger"]');
    await expect(button).toHaveAttribute('data-selected-model', modelId);
  }

  async typeMessage(text: string) {
    await this.fillTestId('inp-chat-message', text);
  }

  async clickSend() {
    await this.clickTestId('btn-chat-send');
  }

  async waitForThinkingToDisappear() {
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).not.toBeVisible();
  }

  async expectAssistantMessageContains(text: string) {
    const lastMessage = this.page.locator('[data-testid="div-chat-assistant-msg"]').last();
    await expect(lastMessage).toContainText(text, { ignoreCase: true });
  }

  async sendMessageAndWait(text: string) {
    await this.typeMessage(text);
    await this.clickSend();
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).toBeVisible();
    await this.waitForThinkingToDisappear();
  }

  async expectChatPageLoaded() {
    await this.page.waitForURL('/chat');
  }

  async logout() {
    await this.clickTestId('btn-chat-logout');
    await this.page.waitForURL('/');
  }

  async clearChat() {
    await this.clickTestId('btn-chat-clear');
  }

  async expectChatState(state: 'ready' | 'loading' | 'error') {
    const card = await this.page.locator('[data-test-state]');
    await expect(card).toHaveAttribute('data-test-state', state);
  }

  async expectEmptyState() {
    await expect(this.page.getByText('Start a conversation...')).toBeVisible();
  }

  async expectUserMessage(text: string) {
    const userMessage = await this.page.locator('[data-testid="div-chat-user-msg"]').first();
    await expect(userMessage).toContainText(text);
  }

  async expectMessageNotVisible(text: string) {
    await expect(this.page.getByText(text)).not.toBeVisible();
  }

}
