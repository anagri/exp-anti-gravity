import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;

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
    await documentsPage.expectEmptyState();

    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!fileId) throw new Error('File not found after upload');

    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    const preReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(preReloadChunkCount).toBeGreaterThan(0);

    await page.reload();
    await documentsPage.waitForDBInitialized();

    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const postReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(postReloadChunkCount).toBe(preReloadChunkCount);
    expect(postReloadChunkCount).toBeGreaterThan(0);
  });
});
