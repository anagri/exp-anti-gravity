import { test } from '../fixtures/globalSetup';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { DocumentPage } from '../pages/DocumentPage';
import { SearchPage } from '../pages/SearchPage';
import { loadTestApiKey } from '../utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;
const TEST_KB_NAME = 'BM25 Search Test KB';

test.describe('BM25 Search @live', () => {
  let documentsPage: DocumentPage;
  let searchPage: SearchPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    searchPage = new SearchPage(page, 'http://127.0.0.1:4173');
    await documentsPage.setup(apiKey);
  });

  test('BM25 search returns relevant results for exact keyword match', async () => {
    // Upload document and wait for indexing to complete
    await documentsPage.expectEmptyKBState();

    await documentsPage.createKB(TEST_KB_NAME);
    await documentsPage.expectKBVisible(TEST_KB_NAME);

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB(TEST_KB_NAME);

    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.EQUITY, EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.card.getFileByName(EQUITY_FILENAME);

    // Wait for indexing (embeddings + Lunr index) to complete
    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Get KB ID before navigating away from documents page
    const kbId = await documentsPage.getKBId(TEST_KB_NAME);

    // Navigate to search page
    await searchPage.navigateAndWaitForReady();

    // Select KB from dropdown
    await searchPage.kbSelector.selectKB(kbId);

    // Perform BM25 search for exact keyword "equity"
    await searchPage.input.search('equity');

    // Assert: Results should be present
    await searchPage.results.expectResultsGreaterThan(0);

    // Assert: First result should contain "equity" in content
    await searchPage.results.expectFirstResultContains('equity');

    // Assert: Results should have BM25 scores
    await searchPage.results.expectFirstResultScoreGreaterThan(0);
  });

  test('BM25 search returns empty results for non-existent keyword', async () => {
    // Upload document and wait for indexing
    await documentsPage.expectEmptyKBState();

    await documentsPage.createKB(TEST_KB_NAME);
    await documentsPage.expectKBVisible(TEST_KB_NAME);

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB(TEST_KB_NAME);

    await documentsPage.uploadFilesToKBAndWait(TEST_KB_NAME, PG_ESSAYS.EQUITY, EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.card.getFileByName(EQUITY_FILENAME);

    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Get KB ID before navigating away from documents page
    const kbId = await documentsPage.getKBId(TEST_KB_NAME);

    // Navigate to search page
    await searchPage.navigateAndWaitForReady();

    // Select KB from dropdown
    await searchPage.kbSelector.selectKB(kbId);

    // Search for keyword that doesn't exist
    await searchPage.input.search('xyznonexistentkeyword123');

    // Assert: No results
    await searchPage.results.expectEmptyMessage('No results found');
  });
});
