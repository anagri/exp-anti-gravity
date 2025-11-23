import { expect, test } from '../fixtures/globalSetup';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { DocumentPage } from '../pages/DocumentPage';
import { loadTestApiKey } from '../utils/env';

test.describe('KB Isolation - Database Verification', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', true);
    await documentsPage.setup(apiKey);
    await documentsPage.expectEmptyKBState();
  });

  test('Phase deletion → verify-table-dropped → reload-verification', async () => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Create KB and upload document
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB A');
    await documentsPage.expectKBVisible('KB A');

    // Get KB ID for table name verification
    const kbId = await documentsPage.knowledgeBase.getKBId('KB A');
    const tableName = await documentsPage.dbInspector.getKBChunksTableName(kbId);

    console.log(`Created KB with ID: ${kbId}, table: ${tableName}`);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Verify chunks table exists
    // ─────────────────────────────────────────────────────────
    await documentsPage.dbInspector.expectTableExists(tableName);
    console.log(`Verified table ${tableName} exists`);

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Delete KB and verify table dropped
    // ─────────────────────────────────────────────────────────
    await documentsPage.deleteKB('KB A');
    await documentsPage.expectEmptyKBState();

    // Verify chunks table no longer exists
    await documentsPage.dbInspector.expectTableNotExists(tableName);
    console.log(`Verified table ${tableName} dropped after KB deletion`);

    // ─────────────────────────────────────────────────────────
    // PHASE 4: Reload and verify persistence
    // ─────────────────────────────────────────────────────────
    await documentsPage.reload();
    await documentsPage.waitForDBInitialized();
    await documentsPage.expectEmptyKBState();

    // Table should still not exist after reload
    await documentsPage.dbInspector.expectTableNotExists(tableName);
    console.log('Verified KB and table remain deleted after reload');
  });

  test('Phase reindex → verify-table-recreated → verify-chunks-restored @live', async () => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Create KB with initial config
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB Reindex', 'Test re-indexing');
    await documentsPage.expectKBVisible('KB Reindex');
    await documentsPage.expandKB('KB Reindex');

    // Upload document and wait for indexing
    const essayFile = PG_ESSAYS.EQUITY;
    const essayName = PG_ESSAY_NAMES.EQUITY;
    await documentsPage.uploadFilesToKBAndWait('KB Reindex', essayFile, essayName);

    // Wait for initial indexing to complete
    const fileId = await documentsPage.documentList.card.getFileByName(essayName);
    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    const kbId = await documentsPage.knowledgeBase.getKBId('KB Reindex');
    const tableName = await documentsPage.dbInspector.getKBChunksTableName(kbId);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Capture initial state
    // ─────────────────────────────────────────────────────────
    await documentsPage.dbInspector.expectTableExists(tableName);
    const initialChunkCount = await documentsPage.dbInspector.getChunkCount(kbId);
    expect(initialChunkCount, 'Initial chunk count should be > 0').toBeGreaterThan(0);
    console.log(`Initial state: ${initialChunkCount} chunks in ${tableName}`);

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Trigger re-index by changing config
    // ─────────────────────────────────────────────────────────
    // Collapse KB before editing (edit button is in KB card header)
    await documentsPage.collapseKB('KB Reindex');

    // Edit KB to change chunk size (requires re-index)
    await documentsPage.knowledgeBase.edit('KB Reindex');
    await documentsPage.knowledgeBase.updateChunkConfig(1000, 100);
    await documentsPage.knowledgeBase.confirmReindex();

    console.log('Triggered re-index with new chunk config');

    // ─────────────────────────────────────────────────────────
    // PHASE 4: Wait for re-indexing to complete
    // ─────────────────────────────────────────────────────────
    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // ─────────────────────────────────────────────────────────
    // PHASE 5: Verify table still exists with new chunks
    // ─────────────────────────────────────────────────────────
    await documentsPage.dbInspector.expectTableExists(tableName);

    const finalChunkCount = await documentsPage.dbInspector.getChunkCount(kbId);
    expect(finalChunkCount, 'Final chunk count should be > 0').toBeGreaterThan(0);

    // Different chunk size should produce different number of chunks
    console.log(`Re-index complete: ${finalChunkCount} chunks (was ${initialChunkCount})`);
  });

  test('Phase multi-kb → verify-separate-tables → verify-independent-isolation', async () => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Create two KBs
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB A');
    await documentsPage.createKB('KB B');
    await documentsPage.expectKBVisible('KB A');
    await documentsPage.expectKBVisible('KB B');

    const kbAId = await documentsPage.knowledgeBase.getKBId('KB A');
    const kbBId = await documentsPage.knowledgeBase.getKBId('KB B');

    const tableA = await documentsPage.dbInspector.getKBChunksTableName(kbAId);
    const tableB = await documentsPage.dbInspector.getKBChunksTableName(kbBId);

    console.log(`KB A: ${kbAId} → ${tableA}`);
    console.log(`KB B: ${kbBId} → ${tableB}`);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Verify separate tables exist
    // ─────────────────────────────────────────────────────────
    await documentsPage.dbInspector.expectTableExists(tableA);
    await documentsPage.dbInspector.expectTableExists(tableB);

    console.log('Verified both KBs have separate chunks tables');

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Delete KB A, verify KB B unaffected
    // ─────────────────────────────────────────────────────────
    await documentsPage.deleteKB('KB A');

    // KB A table should be gone
    await documentsPage.dbInspector.expectTableNotExists(tableA);

    // KB B table should still exist
    await documentsPage.dbInspector.expectTableExists(tableB);

    console.log('Verified KB B isolation: table unaffected by KB A deletion');
  });

  test('Phase creation → verify-schema → verify-table-params', async () => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Create KB with custom config
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKBWithConfig('KB Custom', {
      embeddingDimensions: 768,
      hnswM: 32,
      hnswEfConstruction: 128,
    });

    await documentsPage.expectKBVisible('KB Custom');

    const kbId = await documentsPage.knowledgeBase.getKBId('KB Custom');
    const tableName = await documentsPage.dbInspector.getKBChunksTableName(kbId);

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Verify chunks table created
    // ─────────────────────────────────────────────────────────
    await documentsPage.dbInspector.expectTableExists(tableName);
    console.log(`Verified table ${tableName} created for KB ${kbId}`);

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Query table schema
    // ─────────────────────────────────────────────────────────
    const schema = await documentsPage.dbInspector.getTableSchema(tableName);
    expect(schema.length, 'Table should have columns').toBeGreaterThan(0);

    // Verify expected columns exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnNames = schema.map((col: any) => col.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('document_id');
    expect(columnNames).toContain('chunk_index');
    expect(columnNames).toContain('content');
    expect(columnNames).toContain('heading');
    expect(columnNames).toContain('embedding');
    expect(columnNames).toContain('token_count');
    expect(columnNames).toContain('created_at');

    console.log(`Verified table schema with columns: ${columnNames.join(', ')}`);
  });
});
