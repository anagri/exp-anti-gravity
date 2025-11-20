import { test, expect } from '@playwright/test';
import { DocumentsPage } from './page-objects/DocumentsPage';
import { navigateToDocuments, clearPGliteDB } from '../helpers';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';

test.describe('Multi-Document Operations', () => {
  let documentsPage: DocumentsPage;

  test.beforeEach(async ({ page }) => {
    await clearPGliteDB(page);
    await navigateToDocuments(page);
    documentsPage = new DocumentsPage(page);
  });

  test('upload multiple files, search, filter, sort, delete', async () => {
    await documentsPage.uploadFiles([
      TEST_FILES.DOC_01_MD,
      TEST_FILES.DOC_02_TXT,
      TEST_FILES.DOC_03_MD,
    ]);

    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_01_MD);
    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_02_TXT);
    await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_03_MD);

    await documentsPage.expectFileCount(3);

    await documentsPage.searchFiles('test-doc-01');
    await documentsPage.expectFileCount(1);

    await documentsPage.toolbar.clearSearch();
    await documentsPage.expectFileCount(3);

    await documentsPage.filterFiles('markdown');
    await documentsPage.expectFileCount(2);

    await documentsPage.filterFiles('all');
    await documentsPage.expectFileCount(3);

    await documentsPage.sortFiles('name-asc');
    const sortedNames = await documentsPage.documentList.getFileNames();
    expect(sortedNames[0]).toContain('test-doc-01');
    expect(sortedNames[1]).toContain('test-doc-02');
    expect(sortedNames[2]).toContain('test-doc-03');

    await documentsPage.deleteFileByName(FILE_NAMES.DOC_02_TXT);
    await documentsPage.deleteModal.waitForModal();
    await documentsPage.deleteModal.confirm();
    await documentsPage.deleteModal.waitForModalToClose();

    await documentsPage.expectFileCount(2);

    const remainingNames = await documentsPage.documentList.getFileNames();
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(false);
  });
});
