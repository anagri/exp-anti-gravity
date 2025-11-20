import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

test.describe('Indexing Workflow @live', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    // Feature toggle enabled by default (no need to disable like in documents-upload.spec.ts)
    documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey); // Use real API key for embeddings
  });

  test('Phase embeddings: upload → queue → chunk → embed → store', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for OpenAI API calls
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


    // Phase embeddings: Wait for completion and verify chunk count > 0
    await page.waitForFunction(
      ({ id }) => {
        const card = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        const status = card?.getAttribute('data-indexing-status');
        console.log('Polling status:', status);
        return status === 'completed';
      },
      { id: fileId },
      { timeout: 60000, polling: 1000 } // Longer timeout for OpenAI API calls
    );

    // Verify chunk count is > 0 (proves chunks were created and stored)
    const chunkCount = await card.getAttribute('data-chunk-count');
    expect(parseInt(chunkCount || '0')).toBeGreaterThan(0);

    // Verify final status is 'completed' (proves embeddings were generated successfully)
    const finalStatus = await card.getAttribute('data-indexing-status');
    expect(finalStatus).toBe('completed');
  });

  test('Phase persistence: indexing state survives page reload', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for OpenAI API calls

    // Phase 1: Index file successfully
    await documentsPage.expectEmptyState();
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear('078_the_equity_equation.md');

    const fileId = await documentsPage.documentList.findFileByName('078_the_equity_equation.md');
    const card = page.locator(`[data-testid="div-doc-item-${fileId}"]`);

    // Wait for completion
    await page.waitForFunction(
      ({ id }) => {
        const card = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        const status = card?.getAttribute('data-indexing-status');
        return status === 'completed';
      },
      { id: fileId },
      { timeout: 60000, polling: 1000 }
    );

    // Record pre-reload state
    const preReloadChunkCount = await card.getAttribute('data-chunk-count');
    const preReloadStatus = await card.getAttribute('data-indexing-status');

    console.log('Pre-reload state:', { status: preReloadStatus, chunkCount: preReloadChunkCount });
    expect(preReloadStatus).toBe('completed');
    expect(parseInt(preReloadChunkCount || '0')).toBeGreaterThan(0);

    // Phase 2: Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for VectorDB to reinitialize and repopulate
    await page.waitForFunction(
      () => {
        const container = document.querySelector('[data-db-initialized]');
        return container?.getAttribute('data-db-initialized') === 'true';
      },
      { timeout: 10000 }
    );

    // Verify document still visible
    await documentsPage.documentList.waitForFileToAppear('078_the_equity_equation.md');

    // Verify indexing state persists
    const reloadedCard = page.locator(`[data-testid="div-doc-item-${fileId}"]`);
    const postReloadStatus = await reloadedCard.getAttribute('data-indexing-status');
    const postReloadChunkCount = await reloadedCard.getAttribute('data-chunk-count');

    console.log('Post-reload state:', { status: postReloadStatus, chunkCount: postReloadChunkCount });

    // Assert: All indexing metadata persists
    expect(postReloadStatus).toBe('completed');
    expect(postReloadChunkCount).toBe(preReloadChunkCount);
    expect(parseInt(postReloadChunkCount || '0')).toBeGreaterThan(0);
  });
});
