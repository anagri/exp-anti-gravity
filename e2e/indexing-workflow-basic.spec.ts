import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS } from './fixtures/pg-essays';

test.describe('Indexing Workflow @live', () => {
  let documentsPage: DocumentPage;

  test.beforeEach(async ({ page }) => {
    // Feature toggle enabled by default (no need to disable like in documents-upload.spec.ts)
    documentsPage = new DocumentPage(page);
    await documentsPage.setup();
  });

  test('Phase chunking: upload → queue → chunk → store', async ({ page }) => {
    // Ensure we start with empty state
    await documentsPage.expectEmptyState();

    // Upload shortest PG essay
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear('078_the_equity_equation.md');

    // Phase db-schema: Verify queue entry created (status = pending)
    const fileId = await documentsPage.documentList.findFileByName('078_the_equity_equation.md');
    expect(fileId).toBeTruthy();

    const card = page.locator(`[data-testid="div-doc-item-${fileId}"]`);

    // Wait for initial status (might be pending or already processing)
    await page.waitForFunction(
      ({ id }) => {
        const card = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        const status = card?.getAttribute('data-indexing-status');
        return status === 'pending' || status === 'processing' || status === 'completed';
      },
      { id: fileId },
      { timeout: 5000 }
    );


    // Phase chunking: Wait for completion and verify chunk count > 0
    await page.waitForFunction(
      ({ id }) => {
        const card = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        const status = card?.getAttribute('data-indexing-status');
        console.log('Polling status:', status);
        return status === 'completed';
      },
      { id: fileId },
      { timeout: 30000, polling: 1000 }
    );

    // Verify chunk count is > 0
    const chunkCount = await card.getAttribute('data-chunk-count');
    expect(parseInt(chunkCount || '0')).toBeGreaterThan(0);
  });
});
