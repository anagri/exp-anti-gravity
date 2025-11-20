import { test } from '@playwright/test';
import { DocumentPage } from '../pages/DocumentPage';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';

test.describe('File Validation', () => {
  let documentsPage: DocumentPage;

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.clearDatabase();
    await documentsPage.setup();
  });

  test('reject invalid file types, accept valid types', async ({ page }) => {
    await documentsPage.uploadFiles(TEST_FILES.INVALID_PDF);

    await page.waitForTimeout(500);

    await documentsPage.expectFileCount(0);
    await documentsPage.expectEmptyState();

    await documentsPage.uploadFilesAndWait(TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    await documentsPage.expectFileCount(1);
    await documentsPage.emptyState.expectNotVisible();
  });
});
