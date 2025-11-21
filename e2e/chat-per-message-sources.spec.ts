import { test, expect } from './fixtures/globalSetup';
import { ChatPage } from './pages/ChatPage';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;

test.describe('Per-Message Sources @live', () => {
  let chatPage: ChatPage;
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page, 'http://127.0.0.1:4173');
    documentsPage = new DocumentPage(page);
  });

  test('Phase per-message-sources: first message → verify sources → second message → verify both persist', async ({ page }) => {
    // Setup: Upload and index document for RAG
    await documentsPage.setup(apiKey);
    await documentsPage.expectEmptyState();
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!fileId) throw new Error('File not found after upload');

    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Navigate to chat and attach document
    await chatPage.navigate();
    await chatPage.clickAttachButton();
    await chatPage.fileSelector.expectOpen();
    await chatPage.fileSelector.selectFile(EQUITY_FILENAME);
    await chatPage.fileSelector.confirmSelection();
    await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME);

    // Step 1: Send first message with RAG
    await chatPage.sendMessage('What is equity in startups?');
    await chatPage.waitForAssistantResponse();

    // Verify first message has sources
    const firstMessageSources = await chatPage.getSourcesCount();
    expect(firstMessageSources).toBeGreaterThan(0);
    console.log(`First message has ${firstMessageSources} source(s)`);

    // Step 2: Send second message with RAG
    await chatPage.sendMessage('How does equity dilution work?');
    await chatPage.waitForAssistantResponse();

    // Verify second message has sources
    const secondMessageSources = await chatPage.getSourcesCount();
    expect(secondMessageSources).toBeGreaterThan(0);
    console.log(`Second message has ${secondMessageSources} source(s)`);

    // Step 3: Critical assertion - verify BOTH messages display sources independently
    // Get first assistant message and count its sources
    const firstAssistantMsg = page.locator('[data-testid="div-chat-assistant-msg"]').nth(0);
    const firstMsgSourceCount = await firstAssistantMsg.locator('[data-source-index]').count();
    console.log(`First assistant message has ${firstMsgSourceCount} source(s) visible`);
    expect(firstMsgSourceCount).toBeGreaterThan(0);

    // Get second assistant message and count its sources
    const secondAssistantMsg = page.locator('[data-testid="div-chat-assistant-msg"]').nth(1);
    const secondMsgSourceCount = await secondAssistantMsg.locator('[data-source-index]').count();
    console.log(`Second assistant message has ${secondMsgSourceCount} source(s) visible`);
    expect(secondMsgSourceCount).toBeGreaterThan(0);

    // Count total source elements (should be sum of both)
    const totalSourceElements = await page.locator('[data-source-index]').count();
    console.log(`Total source elements visible: ${totalSourceElements}`);
    expect(totalSourceElements).toBe(firstMsgSourceCount + secondMsgSourceCount);

    // Step 4: Verify sources are attached to their respective messages
    // Check that both assistant messages are visible
    const assistantMessages = await page.locator('[data-testid="div-chat-assistant-msg"]').count();
    expect(assistantMessages).toBe(2);
    console.log(`${assistantMessages} assistant messages visible`);

    // Step 5: Send a third message WITHOUT attachments (clear them first)
    await chatPage.removeAttachment(EQUITY_FILENAME);
    await chatPage.sendMessage('What is 2 + 2?');
    await chatPage.waitForAssistantResponse();

    // Verify third message has NO sources (no attachments)
    const thirdMessageDiv = page.locator('[data-testid="div-chat-assistant-msg"]').nth(2);
    const thirdMessageSources = await thirdMessageDiv.locator('[data-source-index]').count();
    expect(thirdMessageSources).toBe(0);
    console.log(`Third message (no attachments) has ${thirdMessageSources} sources`);

    // Step 6: Critical assertion - first two messages STILL have their sources
    const finalTotalSources = await page.locator('[data-source-index]').count();
    expect(finalTotalSources).toBe(totalSourceElements);
    console.log(`After third message, still ${finalTotalSources} total sources visible`);
  });
});
