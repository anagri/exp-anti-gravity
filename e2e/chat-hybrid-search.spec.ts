import { test, expect } from './fixtures/globalSetup';
import { ChatPage } from './pages/ChatPage';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;

test.describe('Hybrid Search @live', () => {
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

  test('Phase hybrid-search: upload → index → hybrid RAG → verify sources have fused scores', async ({ page }) => {
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

    // Step 1: Send query that has both semantic and keyword aspects
    // "equity compensation" should match:
    // - Vector: passages about stock options, ownership stakes (semantic)
    // - BM25: exact mentions of "equity" and related terms (keyword)
    await chatPage.sendMessage('What is equity compensation in startups?');
    await chatPage.waitForAssistantResponse();

    // Verify message has sources (from hybrid search)
    const sourcesCount = await chatPage.getSourcesCount();
    expect(sourcesCount).toBeGreaterThan(0);
    console.log(`Hybrid search returned ${sourcesCount} source(s)`);

    // Step 2: Verify assistant message exists and has content
    const firstAssistantMsg = page.locator('[data-testid="div-chat-assistant-msg"]').first();
    await expect(firstAssistantMsg).toBeVisible();
    const msgContent = await firstAssistantMsg.textContent();
    expect(msgContent).toBeTruthy();
    console.log(`Assistant response length: ${msgContent?.length} characters`);

    // Step 3: Send another query with different semantic/keyword balance
    await chatPage.sendMessage('Tell me about founder equity dilution');
    await chatPage.waitForAssistantResponse();

    const secondSourcesCount = await chatPage.getSourcesCount();
    expect(secondSourcesCount).toBeGreaterThan(0);
    console.log(`Second query returned ${secondSourcesCount} source(s)`);

    // Step 4: Verify both messages have sources (per-message sources working)
    const firstMsgSources = await page.locator('[data-testid="div-chat-assistant-msg"]').nth(0).locator('[data-source-index]').count();
    const secondMsgSources = await page.locator('[data-testid="div-chat-assistant-msg"]').nth(1).locator('[data-source-index]').count();

    expect(firstMsgSources).toBeGreaterThan(0);
    expect(secondMsgSources).toBeGreaterThan(0);
    console.log(`First message: ${firstMsgSources} sources, Second message: ${secondMsgSources} sources`);

    // Step 5: Verify total sources visible equals sum
    const totalSources = await page.locator('[data-source-index]').count();
    expect(totalSources).toBe(firstMsgSources + secondMsgSources);
    console.log(`Total sources visible: ${totalSources} (verified sum)`);

    // Step 6: Send query without attachments (should work without RAG)
    await chatPage.removeAttachment(EQUITY_FILENAME);
    await chatPage.sendMessage('What is 2 + 2?');
    await chatPage.waitForAssistantResponse();

    const thirdAssistantMsg = page.locator('[data-testid="div-chat-assistant-msg"]').nth(2);
    const thirdMsgSources = await thirdAssistantMsg.locator('[data-source-index]').count();
    expect(thirdMsgSources).toBe(0);

    const thirdMsgContent = await thirdAssistantMsg.textContent();
    expect(thirdMsgContent).toContain('4');
    console.log(`Non-RAG query answered correctly without sources`);

    // Step 7: Verify first two messages still have their sources
    const finalFirstMsgSources = await page.locator('[data-testid="div-chat-assistant-msg"]').nth(0).locator('[data-source-index]').count();
    const finalSecondMsgSources = await page.locator('[data-testid="div-chat-assistant-msg"]').nth(1).locator('[data-source-index]').count();

    expect(finalFirstMsgSources).toBe(firstMsgSources);
    expect(finalSecondMsgSources).toBe(secondMsgSources);
    console.log(`Historical sources preserved after non-RAG query`);

    // Step 8: Verify metadata is exposed (Phase test-metadata)
    const firstMetadata = await chatPage.getMessageMetadata(0);
    expect(firstMetadata).not.toBeNull();
    expect(firstMetadata?.chunkIds.length).toBe(firstMsgSources);
    expect(firstMetadata?.vectorScores.length).toBe(firstMsgSources);
    expect(firstMetadata?.bm25Scores.length).toBe(firstMsgSources);
    expect(firstMetadata?.fusedScores.length).toBe(firstMsgSources);
    console.log(`First message metadata: ${firstMetadata?.chunkIds.length} chunks with scores`);

    // Step 9: Verify data attributes on sources
    const firstMsgDiv = page.locator('[data-testid="div-chat-assistant-msg"]').nth(0);
    const firstSource = firstMsgDiv.locator('[data-source-index="1"]');

    const chunkId = await firstSource.getAttribute('data-chunk-id');
    const vectorScore = await firstSource.getAttribute('data-vector-score');
    const bm25Score = await firstSource.getAttribute('data-bm25-score');
    const fusedScore = await firstSource.getAttribute('data-fused-score');

    expect(chunkId).toBeTruthy();
    expect(parseFloat(vectorScore || '0')).toBeGreaterThanOrEqual(0);
    expect(parseFloat(bm25Score || '0')).toBeGreaterThanOrEqual(0);
    expect(parseFloat(fusedScore || '0')).toBeGreaterThan(0);
    console.log(`Source attributes verified: chunkId=${chunkId}, fusedScore=${fusedScore}`);

    // Step 10: Verify fused scores are in descending order
    const scoresOrdered = await chatPage.verifyScoreOrdering(0, 'fused');
    expect(scoresOrdered).toBe(true);
    console.log(`Fused scores correctly ordered in descending order`);
  });
});
