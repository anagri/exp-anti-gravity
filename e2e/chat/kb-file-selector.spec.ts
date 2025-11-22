import { test } from '../fixtures/globalSetup';
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
    documentsPage = new DocumentPage(page);
    chatPage = new ChatPage(page, 'http://127.0.0.1:4173');

    // Enable indexing for this test
    await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', true);

    await documentsPage.setup(apiKey);
  });

  test('Phase upload-index → chat-kb-filter → auto-filter → selection-summary', async () => {
    // ─────────────────────────────────────────────────────────
    // PHASE UPLOAD-INDEX: Create KBs and Upload with Indexing
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB A');
    await documentsPage.expectKBVisible('KB A');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB A');

    await documentsPage.uploadFilesToKBAndWait('KB A', TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    // Wait for indexing to complete
    const fileAId = await documentsPage.documentList.card.getFileByName(FILE_NAMES.DOC_01_MD);
    await documentsPage.documentList.waitForIndexedText(fileAId);

    await documentsPage.createKB('KB B');
    await documentsPage.expectKBVisible('KB B');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB B');

    await documentsPage.uploadFilesToKBAndWait(
      'KB B',
      TEST_FILES.DOC_02_TXT,
      FILE_NAMES.DOC_02_TXT
    );

    const fileBId = await documentsPage.documentList.card.getFileByName(FILE_NAMES.DOC_02_TXT);
    await documentsPage.documentList.waitForIndexedText(fileBId);

    console.log('Documents uploaded and indexed');

    // Get KB IDs before navigating away from documents page
    const kbAId = await documentsPage.getKBId('KB A');

    // ─────────────────────────────────────────────────────────
    // PHASE CHAT-KB-FILTER: FileSelector KB Filtering
    // ─────────────────────────────────────────────────────────
    await chatPage.navigate();
    await chatPage.waitForReady();
    await chatPage.clickAttachButton();
    await chatPage.fileSelector.expectOpen();

    // KB filter dropdown exists with "All" default
    await chatPage.fileSelector.expectKBFilterValue('all');
    await chatPage.fileSelector.expectFileCount(2);

    // Filter to KB A
    await chatPage.fileSelector.selectKBFilter('KB A');
    await chatPage.fileSelector.expectFileCount(1);
    await chatPage.fileSelector.expectFileVisible(FILE_NAMES.DOC_01_MD);
    await chatPage.fileSelector.expectFileNotVisible(FILE_NAMES.DOC_02_TXT);

    // Filter to KB B
    await chatPage.fileSelector.selectKBFilter('KB B');
    await chatPage.fileSelector.expectFileCount(1);
    await chatPage.fileSelector.expectFileVisible(FILE_NAMES.DOC_02_TXT);
    await chatPage.fileSelector.expectFileNotVisible(FILE_NAMES.DOC_01_MD);

    console.log('KB filtering works correctly');

    // ─────────────────────────────────────────────────────────
    // PHASE AUTO-FILTER: Selecting Doc Auto-Switches to its KB
    // ─────────────────────────────────────────────────────────
    await chatPage.fileSelector.selectKBFilter('All Knowledge Bases');
    await chatPage.fileSelector.expectFileCount(2);

    // Select document from KB A
    await chatPage.fileSelector.clickFileByName(FILE_NAMES.DOC_01_MD);
    await chatPage.fileSelector.expectFileSelection(FILE_NAMES.DOC_01_MD, true);

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
    await chatPage.fileSelector.expectFileSelection(FILE_NAMES.DOC_02_TXT, false);

    // Select in KB B and verify summary
    await chatPage.fileSelector.selectKBFilter('KB B');
    await chatPage.fileSelector.clickFileByName(FILE_NAMES.DOC_02_TXT);
    await chatPage.fileSelector.expectSelectionSummary('1 document selected from KB B');

    console.log('Selection summary shows KB context correctly');
  });
});
