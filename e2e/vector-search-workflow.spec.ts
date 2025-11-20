import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { ChatPage } from './pages/ChatPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;
const INEQUALITY_FILENAME = PG_ESSAY_NAMES.INEQUALITY;

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
    // PHASE 1: Upload & Index Two Essays
    // ─────────────────────────────────────────────────────────
    await documentsPage.expectEmptyState();

    // Upload 078_the_equity_equation.md
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);
    const equityFileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!equityFileId) throw new Error('Equity file not found after upload');

    // Upload 049_inequality_and_risk.md
    await documentsPage.uploadFiles(PG_ESSAYS.INEQUALITY);
    await documentsPage.documentList.waitForFileToAppear(INEQUALITY_FILENAME);
    const inequalityFileId = await documentsPage.documentList.findFileByName(INEQUALITY_FILENAME);
    if (!inequalityFileId) throw new Error('Inequality file not found after upload');

    // Wait for both files to complete indexing
    await documentsPage.documentList.waitForIndexingStatus(equityFileId, 'completed');
    await documentsPage.documentList.waitForIndexingStatus(inequalityFileId, 'completed');

    // Verify chunk counts > 0
    const equityChunkCount = await documentsPage.documentList.getChunkCount(equityFileId);
    const inequalityChunkCount = await documentsPage.documentList.getChunkCount(inequalityFileId);
    expect(equityChunkCount).toBeGreaterThan(0);
    expect(inequalityChunkCount).toBeGreaterThan(0);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Navigate to Chat & Attach Files
    // ─────────────────────────────────────────────────────────
    await chatPage.navigate();
    await chatPage.expectReady();

    // Click attach button
    await chatPage.clickAttachButton();

    // File selector modal should open
    await chatPage.fileSelector.expectOpen();

    // Verify both files appear in selector
    await chatPage.fileSelector.expectFileVisible(EQUITY_FILENAME);
    await chatPage.fileSelector.expectFileVisible(INEQUALITY_FILENAME);

    // Verify both files have "completed" status (indexed)
    await chatPage.fileSelector.expectFileIndexed(EQUITY_FILENAME, true);
    await chatPage.fileSelector.expectFileIndexed(INEQUALITY_FILENAME, true);

    // Select both files
    await chatPage.fileSelector.selectFile(EQUITY_FILENAME);
    await chatPage.fileSelector.selectFile(INEQUALITY_FILENAME);

    // Confirm selection
    await chatPage.fileSelector.confirmSelection();

    // Verify attachment badges appear (count=2)
    await chatPage.expectAttachmentBadges(2);
    await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME);
    await chatPage.expectAttachmentBadgeVisible(INEQUALITY_FILENAME);

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Submit RAG Query
    // ─────────────────────────────────────────────────────────
    const ragQuery = 'What does Paul Graham say about equity and risk?';
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

    // Verify NO citations in normal chat
    const normalCitationCount = await chatPage.getCitationCount();
    expect(normalCitationCount).toBe(0);

    // Verify NO sources footer
    const normalSourcesCount = await chatPage.getSourcesCount();
    expect(normalSourcesCount).toBe(0);
  });
});
