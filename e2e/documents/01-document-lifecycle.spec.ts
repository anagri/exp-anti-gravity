import { test, expect } from '@playwright/test';
import { DocumentsPage } from './page-objects/DocumentsPage';
import { navigateToDocuments, clearPGliteDB } from '../helpers';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';

test.describe('Document Lifecycle', () => {
  let documentsPage: DocumentsPage;

  test.beforeEach(async ({ page }) => {
    await clearPGliteDB(page);
    await navigateToDocuments(page);
    documentsPage = new DocumentsPage(page);
  });

  test('upload, verify, download, delete with cancel, delete with confirm, verify empty', async ({ page }) => {
    await documentsPage.expectEmptyState();

    const downloadPromise = page.waitForEvent('download');
    await documentsPage.uploadFilesAndWait(TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    await documentsPage.expectFileCount(1);

    await documentsPage.downloadFileByName(FILE_NAMES.DOC_01_MD);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(FILE_NAMES.DOC_01_MD);

    await documentsPage.deleteFileByName(FILE_NAMES.DOC_01_MD);
    await documentsPage.deleteModal.waitForModal();
    await documentsPage.deleteModal.cancel();
    await documentsPage.deleteModal.waitForModalToClose();

    await documentsPage.expectFileCount(1);

    await documentsPage.deleteFileByName(FILE_NAMES.DOC_01_MD);
    await documentsPage.deleteModal.waitForModal();
    await documentsPage.deleteModal.confirm();
    await documentsPage.deleteModal.waitForModalToClose();

    await documentsPage.expectFileCount(0);
    await documentsPage.expectEmptyState();
  });
});
