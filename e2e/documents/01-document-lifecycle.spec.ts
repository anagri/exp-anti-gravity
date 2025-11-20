import { test, expect } from '@playwright/test';
import { DocumentsPage } from './page-objects/DocumentsPage';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';
import fs from 'fs';

test.describe('Document Lifecycle', () => {
  let documentsPage: DocumentsPage;

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsPage(page);
    await documentsPage.clearDatabase();
    await documentsPage.setup();
  });

  test('upload, verify, download with content check, delete with cancel, delete with confirm, verify empty', async ({ page }) => {
    await documentsPage.expectEmptyState();

    const downloadPromise = page.waitForEvent('download');
    await documentsPage.uploadFilesAndWait(TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    await documentsPage.expectFileCount(1);

    await documentsPage.downloadFileByName(FILE_NAMES.DOC_01_MD);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(FILE_NAMES.DOC_01_MD);

    const originalContent = fs.readFileSync(TEST_FILES.DOC_01_MD, 'utf-8');
    const downloadedPath = await download.path();
    const downloadedContent = downloadedPath ? fs.readFileSync(downloadedPath, 'utf-8') : '';
    expect(downloadedContent).toBe(originalContent);

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
