import { Page, expect } from '@playwright/test';

export class ChatInputComponent {
  constructor(private readonly page: Page) {}

  async typeMessage(text: string) {
    await this.page.getByTestId('inp-chat-message').fill(text);
  }

  async clickSend() {
    await this.page.getByTestId('btn-chat-send').click();
  }

  async sendMessage(text: string) {
    await this.typeMessage(text);
    await this.clickSend();
  }

  async sendMessageAndWait(text: string) {
    await this.typeMessage(text);
    await this.clickSend();
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).not.toBeVisible();
  }

  async clickAttach() {
    await this.page.getByTestId('btn-attach-files').click();
  }

  async expectEmptyState() {
    await expect(this.page.getByText('Start a conversation...')).toBeVisible();
  }
}
