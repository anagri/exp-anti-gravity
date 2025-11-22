import { test, expect } from '../fixtures/globalSetup';
import { ChatPage } from '../pages/ChatPage';
import { DocumentPage } from '../pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { loadTestApiKey } from '../utils/env';

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

  test('Phase hybrid-search: upload → index → hybrid RAG → verify sources have fused scores', async () => {
    // Setup: Upload and index document for RAG
    await documentsPage.setup(apiKey);
    await documentsPage.createKB('Test KB');
    await documentsPage.expectKBVisible('Test KB');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('Test KB');

    await documentsPage.uploadFilesToKBAndWait('Test KB', PG_ESSAYS.EQUITY, EQUITY_FILENAME);

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
    await chatPage.messages.expectFirstAssistantVisible();
    const msgContent = await chatPage.messages.getContent(0);
    expect(msgContent).toBeTruthy();
    console.log(`Assistant response length: ${msgContent?.length} characters`);

    // Step 3: Send another query with different semantic/keyword balance
    await chatPage.sendMessage('Tell me about founder equity dilution');
    await chatPage.waitForAssistantResponse();

    const secondSourcesCount = await chatPage.getSourcesCount();
    expect(secondSourcesCount).toBeGreaterThan(0);
    console.log(`Second query returned ${secondSourcesCount} source(s)`);

    // Step 4: Verify both messages have sources (per-message sources working)
    const firstMsgSources = await chatPage.messages.getSourceCount(0);
    const secondMsgSources = await chatPage.messages.getSourceCount(1);

    expect(firstMsgSources).toBeGreaterThan(0);
    expect(secondMsgSources).toBeGreaterThan(0);
    console.log(`First message: ${firstMsgSources} sources, Second message: ${secondMsgSources} sources`);

    // Step 5: Verify total sources visible equals sum
    const totalSources = await chatPage.sourceCitations.getSourceCount();
    expect(totalSources).toBe(firstMsgSources + secondMsgSources);
    console.log(`Total sources visible: ${totalSources} (verified sum)`);

    // Step 6: Send query without attachments (should work without RAG)
    await chatPage.removeAttachment(EQUITY_FILENAME);
    await chatPage.sendMessage('What is 2 + 2?');
    await chatPage.waitForAssistantResponse();

    const thirdMsgSources = await chatPage.messages.getSourceCount(2);
    expect(thirdMsgSources).toBe(0);

    const thirdMsgContent = await chatPage.messages.getContent(2);
    expect(thirdMsgContent).toContain('4');
    console.log(`Non-RAG query answered correctly without sources`);

    // Step 7: Verify first two messages still have their sources
    const finalFirstMsgSources = await chatPage.messages.getSourceCount(0);
    const finalSecondMsgSources = await chatPage.messages.getSourceCount(1);

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
    const scoreData = await chatPage.sourceCitations.getScoreData(0, 1);

    expect(scoreData.chunkId).toBeTruthy();
    expect(scoreData.vectorScore).toBeGreaterThanOrEqual(0);
    expect(scoreData.bm25Score).toBeGreaterThanOrEqual(0);
    expect(scoreData.fusedScore).toBeGreaterThan(0);
    console.log(`Source attributes verified: chunkId=${scoreData.chunkId}, fusedScore=${scoreData.fusedScore}`);

    // Step 10: Verify fused scores are in descending order
    const scoresOrdered = await chatPage.verifyScoreOrdering(0, 'fused');
    expect(scoresOrdered).toBe(true);
    console.log(`Fused scores correctly ordered in descending order`);

    // Step 11: Verify prompt is exposed (Phase prompt-exposure)
    const firstPrompt = await chatPage.getMessagePrompt(0);
    expect(firstPrompt).not.toBeNull();
    expect(firstPrompt).toContain('[SYSTEM]');
    expect(firstPrompt).toContain('CONTEXT:');
    expect(firstPrompt).toContain(EQUITY_FILENAME);
    expect(firstPrompt).toContain('What is equity compensation in startups?');
    expect(firstPrompt).toContain('[1]'); // Citation markers in context
    console.log(`First message prompt exposed with system message and context`);

    // Step 12: Verify second prompt contains conversation history
    const secondPrompt = await chatPage.getMessagePrompt(1);
    expect(secondPrompt).not.toBeNull();
    expect(secondPrompt).toContain('What is equity compensation in startups?'); // Previous user query in history
    expect(secondPrompt).toContain('Tell me about founder equity dilution'); // Current user query
    console.log(`Second message prompt includes conversation history`);

    // Step 13: Verify non-RAG message has no prompt
    const thirdPrompt = await chatPage.getMessagePrompt(2);
    expect(thirdPrompt).toBeNull();
    console.log(`Non-RAG message correctly has no prompt`);
  });
});
