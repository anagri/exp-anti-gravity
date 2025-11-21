import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;

test.describe('BM25 Search @live', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);
  });

  test('BM25 search returns relevant results for exact keyword match', async ({ page }) => {
    // Upload document and wait for indexing to complete
    await documentsPage.expectEmptyState();
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!fileId) throw new Error('File not found after upload');

    // Wait for indexing (embeddings + Lunr index) to complete
    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Navigate to search page (use BasePage navigateTo for basename handling)
    await documentsPage.navigateTo('/search');

    // Wait for page to load
    await page.waitForSelector('[data-testid="input-search-query"]');

    // Perform BM25 search for exact keyword "equity"
    await page.fill('[data-testid="input-search-query"]', 'equity');
    await page.click('[data-testid="button-search"]');

    // Wait for search to complete (searching state to finish)
    await page.waitForSelector('[data-testid="button-search"]:not([disabled])');

    // Assert: Results should be present
    const results = page.locator('[data-testid^="div-search-result-"]');
    const resultCount = await results.count();
    expect(resultCount).toBeGreaterThan(0);

    // Assert: First result should contain "equity" in content
    const firstResult = results.first();
    const content = await firstResult.locator('[data-testid="text-result-content"]').textContent();
    expect(content?.toLowerCase()).toContain('equity');

    // Assert: Results should have BM25 scores
    const score = await firstResult.getAttribute('data-result-score');
    expect(parseFloat(score || '0')).toBeGreaterThan(0);
  });

  test('BM25 search returns empty results for non-existent keyword', async ({ page }) => {
    // Upload document and wait for indexing
    await documentsPage.expectEmptyState();
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    const fileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!fileId) throw new Error('File not found after upload');

    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Navigate to search page (use BasePage navigateTo for basename handling)
    await documentsPage.navigateTo('/search');
    await page.waitForSelector('[data-testid="input-search-query"]');

    // Search for keyword that doesn't exist
    await page.fill('[data-testid="input-search-query"]', 'xyznonexistentkeyword123');
    await page.click('[data-testid="button-search"]');

    // Wait for empty state
    await page.waitForSelector('[data-testid="div-search-empty"]');

    // Assert: No results
    const emptyMessage = await page.locator('[data-testid="div-search-empty"]').textContent();
    expect(emptyMessage).toContain('No results found');
  });
});
