import { test, expect } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { ChatPage } from '../pages/ChatPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { loadTestApiKey } from '../utils/env';

const STARTUP_FILENAME = PG_ESSAY_NAMES.STARTUP;
const INEQUALITY_FILENAME = PG_ESSAY_NAMES.INEQUALITY;
const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;
const TEST_KB_NAME = 'RAG Workflow Test KB';

test.describe('Vector Search & RAG Workflow @live', () => {
  let documentsPage: DocumentPage;
  let chatPage: ChatPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    chatPage = new ChatPage(page, 'http://127.0.0.1:4173');
    await documentsPage.setup(apiKey);
  });

  test('RAG workflow: upload → index → attach → search → cite → selective attachment', async ({ page }) => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Upload & Index Three Essays
    // ─────────────────────────────────────────────────────────
    await documentsPage.expectEmptyKBState();

    // Create KB for document upload
    await documentsPage.createKB(TEST_KB_NAME);
    await documentsPage.expectKBVisible(TEST_KB_NAME);

    // Expand KB once before uploads (deterministic - KB starts collapsed)
    await documentsPage.expandKB(TEST_KB_NAME);

    // Upload 3 files to expanded KB: startup (large), inequality, equity
    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.STARTUP, STARTUP_FILENAME);
    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.INEQUALITY, INEQUALITY_FILENAME);
    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.EQUITY, EQUITY_FILENAME);

    // Get file IDs
    const startupFileId = await documentsPage.documentList.findFileByName(STARTUP_FILENAME);
    const inequalityFileId = await documentsPage.documentList.findFileByName(INEQUALITY_FILENAME);
    const equityFileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);

    if (!startupFileId) throw new Error('Startup file not found');
    if (!inequalityFileId) throw new Error('Inequality file not found');
    if (!equityFileId) throw new Error('Equity file not found');

    // Wait for all files to complete indexing
    await documentsPage.documentList.waitForIndexingStatus(startupFileId, 'completed');
    await documentsPage.documentList.waitForIndexingStatus(inequalityFileId, 'completed');
    await documentsPage.documentList.waitForIndexingStatus(equityFileId, 'completed');

    // Verify chunk counts > 0
    const startupChunkCount = await documentsPage.documentList.getChunkCount(startupFileId);
    const inequalityChunkCount = await documentsPage.documentList.getChunkCount(inequalityFileId);
    const equityChunkCount = await documentsPage.documentList.getChunkCount(equityFileId);
    expect(startupChunkCount).toBeGreaterThan(0);
    expect(inequalityChunkCount).toBeGreaterThan(0);
    expect(equityChunkCount).toBeGreaterThan(0);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Navigate to Chat & Attach 2 Files (not startup)
    // ─────────────────────────────────────────────────────────
    await chatPage.navigate();
    await chatPage.expectReady();

    // Click attach button
    await chatPage.clickAttachButton();

    // File selector modal should open
    await chatPage.fileSelector.expectOpen();

    // Verify all 3 files appear in selector
    await chatPage.fileSelector.expectFileVisible(STARTUP_FILENAME);
    await chatPage.fileSelector.expectFileVisible(INEQUALITY_FILENAME);
    await chatPage.fileSelector.expectFileVisible(EQUITY_FILENAME);

    // Verify all files have "completed" status (indexed)
    await chatPage.fileSelector.expectFileIndexed(STARTUP_FILENAME, true);
    await chatPage.fileSelector.expectFileIndexed(INEQUALITY_FILENAME, true);
    await chatPage.fileSelector.expectFileIndexed(EQUITY_FILENAME, true);

    // Select only 2 smaller files (inequality and equity, NOT startup)
    await chatPage.fileSelector.selectFile(INEQUALITY_FILENAME);
    await chatPage.fileSelector.selectFile(EQUITY_FILENAME);

    // Confirm selection
    await chatPage.fileSelector.confirmSelection();

    // Verify attachment badges appear (count=2)
    await chatPage.expectAttachmentBadges(2);
    await chatPage.expectAttachmentBadgeVisible(INEQUALITY_FILENAME);
    await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME);

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Submit RAG Query
    // ─────────────────────────────────────────────────────────
    const ragQuery = 'What does Paul Graham say about economic inequality and startup equity?';
    await chatPage.sendMessage(ragQuery);

    // Wait for response to complete
    await chatPage.waitForAssistantResponse();

    // Verify response contains citations
    const citationCount = await chatPage.getCitationCount();
    expect(citationCount).toBeGreaterThanOrEqual(1);

    // ─────────────────────────────────────────────────────────
    // PHASE 4: Verify Citations & Sources
    // ─────────────────────────────────────────────────────────
    // Verify sources displayed in footer
    const sourcesCount = await chatPage.getSourcesCount();
    expect(sourcesCount).toBeGreaterThanOrEqual(1);
    expect(sourcesCount).toBeLessThanOrEqual(10);

    // Hover over first citation to see tooltip (temporarily skipped)
    // await chatPage.hoverCitation(1);
    // await chatPage.expectCitationTooltipVisible();

    // ─────────────────────────────────────────────────────────
    // PHASE 5: Test Selective Attachment
    // ─────────────────────────────────────────────────────────
    // Remove equity file
    await chatPage.removeAttachment(EQUITY_FILENAME);

    // Verify only 1 badge remains
    await chatPage.expectAttachmentBadges(1);
    await chatPage.expectAttachmentBadgeVisible(INEQUALITY_FILENAME);

    // Submit query with only inequality file attached
    const selectiveQuery = 'What does Paul Graham say about economic inequality?';
    await chatPage.sendMessage(selectiveQuery);
    await chatPage.waitForAssistantResponse();

    // Verify citations still work
    const selectiveCitationCount = await chatPage.getCitationCount();
    expect(selectiveCitationCount).toBeGreaterThanOrEqual(1);

    // ─────────────────────────────────────────────────────────
    // PHASE 6: Test Normal Chat (No Citations)
    // ─────────────────────────────────────────────────────────
    // Remove all attachments
    await chatPage.removeAttachment(INEQUALITY_FILENAME);
    await chatPage.expectAttachmentBadges(0);

    // Submit normal chat query
    const normalQuery = 'What is 2 + 2?';
    await chatPage.sendMessage(normalQuery);
    await chatPage.waitForAssistantResponse();

    // Verify NO citations in the last message (normal chat without attachments)
    // Note: Previous messages will still have their citations (per-message sources)
    const lastAssistantMsg = page.locator('[data-testid="div-chat-assistant-msg"]').last();
    const lastMsgCitations = await lastAssistantMsg.locator('[data-citation-index]').count();
    expect(lastMsgCitations).toBe(0);

    // Verify NO sources footer in the last message
    const lastMsgSources = await lastAssistantMsg.locator('[data-source-index]').count();
    expect(lastMsgSources).toBe(0);
  });
});
