import { Page, Locator, expect } from '@playwright/test';

export class MessagesComponent {
  constructor(private readonly page: Page) {}

  getAssistantAt(index: number): Locator {
    return this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(index);
  }

  getUserAt(index: number): Locator {
    return this.page.locator('[data-testid="div-chat-user-msg"]').nth(index);
  }

  getFirstAssistant(): Locator {
    return this.page.locator('[data-testid="div-chat-assistant-msg"]').first();
  }

  getLastAssistant(): Locator {
    return this.page.locator('[data-testid="div-chat-assistant-msg"]').last();
  }

  async getCount(): Promise<number> {
    return await this.page.locator('[data-testid="div-chat-assistant-msg"]').count();
  }

  async getContent(index: number): Promise<string | null> {
    const message = this.getAssistantAt(index);
    return await message.textContent();
  }

  async expectContains(index: number, text: string) {
    const message = this.getAssistantAt(index);
    await expect(message).toContainText(text, { ignoreCase: true });
  }

  async expectUserContains(text: string) {
    const userMessage = this.getUserAt(0);
    await expect(userMessage).toContainText(text);
  }

  async expectAssistantContains(text: string) {
    const lastMessage = this.getLastAssistant();
    await expect(lastMessage).toContainText(text, { ignoreCase: true });
  }

  async expectNotVisible(text: string) {
    await expect(this.page.getByText(text)).not.toBeVisible();
  }

  async expectFirstAssistantVisible() {
    await expect(this.getFirstAssistant()).toBeVisible();
  }

  async getCitationCount(messageIndex: number): Promise<number> {
    const message = this.getAssistantAt(messageIndex);
    return await message.locator('[data-citation-index]').count();
  }

  async getSourceCount(messageIndex: number): Promise<number> {
    const message = this.getAssistantAt(messageIndex);
    return await message.locator('[data-source-index]').count();
  }
}
