import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { FileSelectorComponent } from './chat/FileSelectorComponent';
import { MessagesComponent } from './chat/MessagesComponent';
import { SourcesComponent } from './chat/SourcesComponent';
import { CitationsComponent } from './chat/CitationsComponent';
import { AttachmentsComponent } from './chat/AttachmentsComponent';
import { ModelSelectorComponent } from './chat/ModelSelectorComponent';
import { LoadingStateComponent } from './chat/LoadingStateComponent';
import { ChatInputComponent } from './chat/ChatInputComponent';
import { DebugComponent } from './chat/DebugComponent';
import { SettingsComponent } from './shared/SettingsComponent';

export class ChatPage extends BasePage {
  readonly fileSelector: FileSelectorComponent;
  readonly messages: MessagesComponent;
  readonly sources: SourcesComponent;
  readonly citations: CitationsComponent;
  readonly attachments: AttachmentsComponent;
  readonly modelSelector: ModelSelectorComponent;
  readonly loadingState: LoadingStateComponent;
  readonly input: ChatInputComponent;
  readonly debug: DebugComponent;
  readonly settings: SettingsComponent;

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
    this.fileSelector = new FileSelectorComponent(page);
    this.messages = new MessagesComponent(page);
    this.sources = new SourcesComponent(page);
    this.citations = new CitationsComponent(page);
    this.attachments = new AttachmentsComponent(page);
    this.modelSelector = new ModelSelectorComponent(page);
    this.loadingState = new LoadingStateComponent(page);
    this.input = new ChatInputComponent(page);
    this.debug = new DebugComponent(page);
    this.settings = new SettingsComponent(page);
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
    await this.modelSelector.select(modelId);
  }

  async expectSelectedModel(modelId: string) {
    await this.modelSelector.expectSelected(modelId);
  }

  async typeMessage(text: string) {
    await this.input.typeMessage(text);
  }

  async clickSend() {
    await this.input.clickSend();
  }

  async waitForThinkingToDisappear() {
    await this.loadingState.waitForThinkingToDisappear();
  }

  async expectAssistantMessageContains(text: string) {
    await this.messages.expectAssistantContains(text);
  }

  async sendMessageAndWait(text: string) {
    await this.input.sendMessageAndWait(text);
  }

  async expectChatPageLoaded() {
    await this.waitForPath('/chat');
  }

  async logout() {
    await this.clickTestId('btn-logout');
    await expect(this.page.getByText('Welcome to AI Chat')).toBeVisible();
  }

  async clearChat() {
    await this.clickTestId('btn-chat-clear');
  }

  async expectChatState(state: 'ready' | 'loading' | 'error') {
    await this.loadingState.expectState(state);
  }

  async expectEmptyState() {
    await this.input.expectEmptyState();
  }

  async expectUserMessage(text: string) {
    await this.messages.expectUserContains(text);
  }

  async expectMessageNotVisible(text: string) {
    await this.messages.expectNotVisible(text);
  }

  async navigate() {
    await this.navigateTo('/chat');
    await this.expectChatPageLoaded();
  }

  async expectReady() {
    await this.loadingState.expectReady();
  }

  async clickAttachButton() {
    await this.input.clickAttach();
  }

  async sendMessage(text: string) {
    await this.input.sendMessage(text);
  }

  async waitForAssistantResponse() {
    await this.loadingState.expectThinking();
    await this.loadingState.waitForThinkingToDisappear();
  }

  async getCitationCount(): Promise<number> {
    return await this.citations.getCount();
  }

  async getSourcesCount(): Promise<number> {
    return await this.sources.getCount();
  }

  async getSourceFilenames(): Promise<string[]> {
    return await this.sources.getSourceFilenames();
  }

  async hoverCitation(index: number) {
    await this.citations.hover(index);
  }

  async expectCitationTooltipVisible() {
    await this.citations.expectTooltipVisible();
  }

  async expectAttachmentBadges(count: number) {
    await this.attachments.expectBadges(count);
  }

  async expectAttachmentBadgeVisible(filename: string) {
    await this.attachments.expectBadgeVisible(filename);
  }

  async removeAttachment(filename: string) {
    await this.attachments.remove(filename);
  }

  async getMessageMetadata(messageIndex: number) {
    return await this.debug.getMetadata(messageIndex);
  }

  async getSourceScores(messageIndex: number) {
    return await this.sources.getSourceScores(messageIndex);
  }

  async verifyScoreOrdering(messageIndex: number, scoreType: 'fused' | 'vector' | 'bm25'): Promise<boolean> {
    return await this.sources.verifyScoreOrdering(messageIndex, scoreType);
  }

  async getMessagePrompt(messageIndex: number): Promise<string | null> {
    return await this.debug.getPrompt(messageIndex);
  }

}
