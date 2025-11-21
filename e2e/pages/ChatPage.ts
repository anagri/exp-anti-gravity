import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { FileSelectorComponent } from './chat/FileSelectorComponent';

export class ChatPage extends BasePage {
  readonly fileSelector: FileSelectorComponent;

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
    this.fileSelector = new FileSelectorComponent(page);
  }

  async waitForReady() {
    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-page-ready]');
      return container?.getAttribute('data-page-ready') === 'true';
    });
  }

  async waitForModelsLoaded() {
    await this.waitForReady();
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
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).not.toBeVisible({ timeout: 30000 });
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
    await this.waitForPath('/chat');
  }

  async logout() {
    await this.clickTestId('btn-logout');
    // Wait for welcome page to appear
    await expect(this.page.getByText('Welcome to AI Chat')).toBeVisible({ timeout: 10000 });
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

  async navigate() {
    await this.navigateTo('/chat');
    await this.expectChatPageLoaded();
  }

  async expectReady() {
    await this.expectChatState('ready');
  }

  async clickAttachButton() {
    await this.clickTestId('btn-attach-files');
  }

  async sendMessage(text: string) {
    await this.typeMessage(text);
    await this.clickSend();
  }

  async waitForAssistantResponse() {
    await expect(this.page.locator('[data-testid="div-chat-loading"]')).toBeVisible();
    await this.waitForThinkingToDisappear();
  }

  async getCitationCount(): Promise<number> {
    const citations = await this.page.locator('[data-citation-index]').count();
    return citations;
  }

  async getSourcesCount(): Promise<number> {
    const sources = await this.page.locator('[data-source-index]').count();
    return sources;
  }

  async getSourceFilenames(): Promise<string[]> {
    const sources = await this.page.locator('[data-source-filename]').all();
    const filenames = await Promise.all(
      sources.map(s => s.getAttribute('data-source-filename'))
    );
    return filenames.filter((f): f is string => f !== null);
  }

  async hoverCitation(index: number) {
    const citation = this.page.locator(`[data-citation-index="${index}"]`).first();
    await expect(citation).toBeVisible();
    await citation.hover();
  }

  async expectCitationTooltipVisible() {
    await expect(this.page.locator('[data-citation-tooltip]')).toBeVisible();
  }

  async expectAttachmentBadges(count: number) {
    const badges = await this.page.locator('[data-testid^="attachment-badge-"]').count();
    expect(badges).toBe(count);
  }

  async expectAttachmentBadgeVisible(filename: string) {
    await expect(this.page.locator(`[data-filename="${filename}"]`)).toBeVisible();
  }

  async removeAttachment(filename: string) {
    const badge = this.page.locator(`[data-filename="${filename}"]`);
    const documentId = await badge.getAttribute('data-testid');
    if (!documentId) throw new Error(`Could not find document ID for ${filename}`);
    const id = documentId.replace('attachment-badge-', '');
    await this.clickTestId(`btn-remove-attachment-${id}`);
  }

  async getMessageMetadata(messageIndex: number): Promise<{
    chunkIds: string[];
    vectorScores: number[];
    bm25Scores: number[];
    fusedScores: number[];
    vectorRanks: number[];
    bm25Ranks: number[];
    filenames: string[];
  } | null> {
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

  async getSourceScores(messageIndex: number): Promise<{
    vectorScores: number[];
    bm25Scores: number[];
    fusedScores: number[];
  }> {
    const messageDiv = this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(messageIndex);
    const sources = await messageDiv.locator('[data-source-index]').all();

    const vectorScores: number[] = [];
    const bm25Scores: number[] = [];
    const fusedScores: number[] = [];

    for (const source of sources) {
      const vectorScore = await source.getAttribute('data-vector-score');
      const bm25Score = await source.getAttribute('data-bm25-score');
      const fusedScore = await source.getAttribute('data-fused-score');

      vectorScores.push(parseFloat(vectorScore || '0'));
      bm25Scores.push(parseFloat(bm25Score || '0'));
      fusedScores.push(parseFloat(fusedScore || '0'));
    }

    return { vectorScores, bm25Scores, fusedScores };
  }

  async verifyScoreOrdering(messageIndex: number, scoreType: 'fused' | 'vector' | 'bm25'): Promise<boolean> {
    const scores = await this.getSourceScores(messageIndex);
    const scoreArray = scoreType === 'fused' ? scores.fusedScores :
                       scoreType === 'vector' ? scores.vectorScores :
                       scores.bm25Scores;

    for (let i = 1; i < scoreArray.length; i++) {
      if (scoreArray[i] > scoreArray[i - 1]) {
        return false;
      }
    }

    return true;
  }

  async getMessagePrompt(messageIndex: number): Promise<string | null> {
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
