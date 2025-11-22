import { Page } from '@playwright/test';

interface Metadata {
  chunkIds: string[];
  vectorScores: number[];
  bm25Scores: number[];
  fusedScores: number[];
  vectorRanks: number[];
  bm25Ranks: number[];
  filenames: string[];
}

export class DebugComponent {
  constructor(private readonly page: Page) {}

  async getMetadata(messageIndex: number): Promise<Metadata | null> {
    const messageDiv = this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(messageIndex);
    const metadataDiv = messageDiv.locator('[data-test-metadata]');
    const metadataCount = await metadataDiv.count();

    if (metadataCount === 0) {
      return null;
    }

    const metadataText = await metadataDiv.textContent();
    if (!metadataText) {
      return null;
    }

    return JSON.parse(metadataText);
  }

  async getPrompt(messageIndex: number): Promise<string | null> {
    const messageDiv = this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(messageIndex);
    const promptPre = messageDiv.locator('[data-test-prompt]');
    const promptCount = await promptPre.count();

    if (promptCount === 0) {
      return null;
    }

    const promptText = await promptPre.textContent();
    return promptText;
  }
}
