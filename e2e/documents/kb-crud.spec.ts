import { test, expect } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { ChatPage } from '../pages/ChatPage';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';

test.describe('Knowledge Base Workflow', () => {
  let documentsPage: DocumentPage;
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    chatPage = new ChatPage(page, 'http://127.0.0.1:4173');

    // Disable indexing for this test (faster, UI-only)
    await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', false);

    await documentsPage.setup("sk-test-key-123");
  });

  test('Phase crud → upload → filtering → persistence', async ({ page }) => {
    // ─────────────────────────────────────────────────────────
    // PHASE CRUD: Create → Verify → Multiple → Validation → Delete
    // ─────────────────────────────────────────────────────────
    await documentsPage.expectEmptyKBState();

    await documentsPage.createKB('React Docs', 'Official React documentation');
    await documentsPage.expectKBVisible('React Docs');
    await documentsPage.expectKBStats('React Docs', 0);

    await documentsPage.createKB('Vue Docs');
    await documentsPage.expectKBVisible('React Docs');
    await documentsPage.expectKBVisible('Vue Docs');

    // Validation: duplicate names
    await documentsPage.knowledgeBase.expectDuplicateError('React Docs');

    await documentsPage.deleteKB('Vue Docs');
    await documentsPage.expectKBNotVisible('Vue Docs');
    await documentsPage.expectKBVisible('React Docs');

    // ─────────────────────────────────────────────────────────
    // PHASE UPLOAD: Upload to Specific KBs
    // ─────────────────────────────────────────────────────────
    await documentsPage.createKB('KB A');
    await documentsPage.expectKBVisible('KB A');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB A');

    await documentsPage.uploadFilesToKBAndWait('KB A', TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);
    await documentsPage.expectFileCount(1);

    await documentsPage.createKB('KB B');
    await documentsPage.expectKBVisible('KB B');

    // Expand KB before upload (deterministic - KB starts collapsed)
    await documentsPage.expandKB('KB B');

    await documentsPage.uploadFilesToKBAndWait('KB B', TEST_FILES.DOC_02_TXT, FILE_NAMES.DOC_02_TXT);
    await documentsPage.expectFileCount(1);

    // Verify KB A still has 1 doc when switching back
    await documentsPage.expandKB('KB A');
    await documentsPage.expectFileCount(1);

    // Multiple files to one KB
    await documentsPage.uploadFilesToKB('KB A', [TEST_FILES.DOC_03_MD]);
    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_03_MD);
    await documentsPage.expectFileCount(2);

    // ─────────────────────────────────────────────────────────
    // PHASE FILTERING: Expansion/Collapse → URL Sync → Deep Linking
    // ─────────────────────────────────────────────────────────
    await documentsPage.expectKBExpanded('KB A', true);
    await documentsPage.collapseKB('KB A');
    await documentsPage.expectKBExpanded('KB A', false);
    await documentsPage.expectURLHasNoKBParam();

    const kbAId = await documentsPage.getKBId('KB A');
    await documentsPage.expandKB('KB A');
    await documentsPage.expectURLHasKBParam(kbAId);

    // Browser navigation
    await documentsPage.goBack();
    await documentsPage.expectKBExpanded('KB A', false);
    await documentsPage.goForward();
    await documentsPage.expectKBExpanded('KB A', true);

    // Reload persistence
    await documentsPage.reload();
    await documentsPage.waitForDBInitialized();
    await documentsPage.expectKBExpanded('KB A', true);
    await documentsPage.expectURLContains(`kb=${kbAId}`);

    // Deep linking
    await chatPage.navigate();
    await documentsPage.navigateTo(`/documents?kb=${kbAId}`);
    await documentsPage.waitForDBInitialized();
    await documentsPage.expectKBExpanded('KB A', true);

    // Switching between KBs
    const kbBId = await documentsPage.getKBId('KB B');
    await documentsPage.expandKB('KB B');
    await documentsPage.expectKBExpanded('KB B', true);
    await documentsPage.expectKBExpanded('KB A', false);
    await documentsPage.expectURLHasKBParam(kbBId);

    // Note: Chat selection phase skipped - requires indexing enabled for file selection
    console.log('KB workflow test completed successfully');
  });
});
