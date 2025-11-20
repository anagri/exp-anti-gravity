import { test, expect } from '@playwright/test';
import { DocumentPage } from '../pages/DocumentPage';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';

test.describe('IndexedDB Persistence', () => {
  let documentsPage: DocumentPage;

  test('data persists across page reload', async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.clearDatabase();
    await documentsPage.setup();

    await documentsPage.expectEmptyState();

    await documentsPage.uploadFiles([
      TEST_FILES.DOC_01_MD,
      TEST_FILES.DOC_02_TXT,
      TEST_FILES.DOC_03_MD,
    ]);

    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_01_MD);
    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_02_TXT);
    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_03_MD);

    await documentsPage.expectFileCount(3);

    await page.reload();
    await documentsPage.waitForDBInitialized();

    await documentsPage.expectFileCount(3);

    const fileNamesAfterReload = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(true);
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);

    await documentsPage.deleteFileByName(FILE_NAMES.DOC_02_TXT);
    await documentsPage.deleteModal.waitForModal();
    await documentsPage.deleteModal.confirm();
    await documentsPage.deleteModal.waitForModalToClose();

    await documentsPage.expectFileCount(2);

    const fileNamesAfterDelete = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterDelete.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(fileNamesAfterDelete.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(fileNamesAfterDelete.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(false);

    await page.reload();
    await documentsPage.waitForDBInitialized();

    await documentsPage.expectFileCount(2);

    const fileNamesAfterSecondReload = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterSecondReload.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(fileNamesAfterSecondReload.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(fileNamesAfterSecondReload.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(false);
  });
});
