import { test, expect } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { ChatPage } from '../pages/ChatPage';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';
import { loadTestApiKey } from '../utils/env';

test.describe('KB Workflow with Indexing @live', () => {
  let documentsPage: DocumentPage;
  let chatPage: ChatPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    // Enable indexing for this test
    await page.addInitScript(() => {
      localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'true');
    });

    documentsPage = new DocumentPage(page);
    chatPage = new ChatPage(page, 'http://127.0.0.1:4173');
    await documentsPage.setup(apiKey);
  });

  test('Phase upload-index → chat-kb-filter → auto-filter → selection-summary', async ({ page }) => {
    // ─────────────────────────────────────────────────────────
    // PHASE UPLOAD-INDEX: Create KBs and Upload with Indexing
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB A');
    await documentsPage.expectKBVisible('KB A');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB A');

    await documentsPage.uploadFilesToKBAndWait('KB A', TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    // Wait for indexing to complete
    const fileAId = await documentsPage.documentList.findFileByName(FILE_NAMES.DOC_01_MD);
    if (!fileAId) throw new Error('File A not found');
    await page.waitForFunction(
      (id) => {
        const doc = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        return doc?.textContent?.includes('Indexed');
      },
      fileAId,
      { timeout: 60000 }
    );

    await documentsPage.createKB('KB B');
    await documentsPage.expectKBVisible('KB B');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB B');

    await documentsPage.uploadFilesToKBAndWait('KB B', TEST_FILES.DOC_02_TXT, FILE_NAMES.DOC_02_TXT);

    const fileBId = await documentsPage.documentList.findFileByName(FILE_NAMES.DOC_02_TXT);
    if (!fileBId) throw new Error('File B not found');
    await page.waitForFunction(
      (id) => {
        const doc = document.querySelector(`[data-testid="div-doc-item-${id}"]`);
        return doc?.textContent?.includes('Indexed');
      },
      fileBId,
      { timeout: 60000 }
    );

    console.log('Documents uploaded and indexed');

    // Get KB IDs before navigating away from documents page
    const kbAId = await documentsPage.getKBId('KB A');
    const kbBId = await documentsPage.getKBId('KB B');

    // ─────────────────────────────────────────────────────────
    // PHASE CHAT-KB-FILTER: FileSelector KB Filtering
    // ─────────────────────────────────────────────────────────
    await chatPage.navigate();
    await page.waitForSelector('[data-page-ready="true"]');
    await chatPage.clickAttachButton();
    await chatPage.fileSelector.expectOpen();

    // KB filter dropdown exists with "All" default
    await chatPage.fileSelector.expectKBFilterValue('all');
    await chatPage.fileSelector.expectFileCount(2);

    // Filter to KB A
    await chatPage.fileSelector.selectKBFilter('KB A');
    await chatPage.fileSelector.expectFileCount(1);
    await chatPage.fileSelector.expectFileVisible(FILE_NAMES.DOC_01_MD);
    await expect(page.locator(`[data-filename="${FILE_NAMES.DOC_02_TXT}"]`)).not.toBeVisible();

    // Filter to KB B
    await chatPage.fileSelector.selectKBFilter('KB B');
    await chatPage.fileSelector.expectFileCount(1);
    await chatPage.fileSelector.expectFileVisible(FILE_NAMES.DOC_02_TXT);
    await expect(page.locator(`[data-filename="${FILE_NAMES.DOC_01_MD}"]`)).not.toBeVisible();

    console.log('KB filtering works correctly');

    // ─────────────────────────────────────────────────────────
    // PHASE AUTO-FILTER: Selecting Doc Auto-Switches to its KB
    // ─────────────────────────────────────────────────────────
    await chatPage.fileSelector.selectKBFilter('All Knowledge Bases');
    await chatPage.fileSelector.expectFileCount(2);

    // Select document from KB A
    const docAItem = page.locator(`[data-filename="${FILE_NAMES.DOC_01_MD}"]`);
    await docAItem.click();
    await expect(docAItem).toHaveAttribute('data-selected', 'true');

    // Verify KB filter auto-changed to KB A
    await chatPage.fileSelector.expectKBFilterValue(kbAId);

    // Verify only KB A doc visible now
    await chatPage.fileSelector.expectFileCount(1);
    await chatPage.fileSelector.expectFileVisible(FILE_NAMES.DOC_01_MD);

    console.log('Auto-filter on selection works correctly');

    // ─────────────────────────────────────────────────────────
    // PHASE SELECTION-SUMMARY: KB Context in Summary
    // ─────────────────────────────────────────────────────────
    await chatPage.fileSelector.expectSelectionSummary('1 document selected from KB A');

    // Changing KB filter clears selection
    await chatPage.fileSelector.selectKBFilter('KB B');
    await chatPage.fileSelector.expectSelectionSummary('No documents selected');

    // Verify doc from KB B not selected
    const docBItem = page.locator(`[data-filename="${FILE_NAMES.DOC_02_TXT}"]`);
    await expect(docBItem).toHaveAttribute('data-selected', 'false');

    // Select in KB B and verify summary
    await chatPage.fileSelector.selectKBFilter('KB B');
    await docBItem.click();
    await chatPage.fileSelector.expectSelectionSummary('1 document selected from KB B');

    console.log('Selection summary shows KB context correctly');
  });
});
