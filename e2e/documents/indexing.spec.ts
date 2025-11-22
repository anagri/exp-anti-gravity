import { test, expect } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { loadTestApiKey } from '../utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;
const TEST_KB_NAME = 'Indexing Test KB';

test.describe('Indexing Workflow @live', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);
  });

  test('Phase embeddings: upload → queue → chunk → embed → store → persist after reload', async ({ page }) => {
    await documentsPage.expectEmptyKBState();

    await documentsPage.createKB(TEST_KB_NAME);
    await documentsPage.expectKBVisible(TEST_KB_NAME);

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB(TEST_KB_NAME);

    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.EQUITY, EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.card.getFileByName(EQUITY_FILENAME);

    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    const preReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(preReloadChunkCount).toBeGreaterThan(0);

    await documentsPage.reload();
    await documentsPage.waitForDBInitialized();
    // KB auto-expands from URL (?kb={id}) after reload, no need to expand manually

    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const postReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(postReloadChunkCount).toBe(preReloadChunkCount);
    expect(postReloadChunkCount).toBeGreaterThan(0);
  });
});
