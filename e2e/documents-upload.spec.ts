import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { TEST_FILES, FILE_NAMES } from './fixtures/test-files';
import fs from 'fs';

test.describe('Document Upload & Management', () => {
  let documentsPage: DocumentPage;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
    });

    documentsPage = new DocumentPage(page);
    await documentsPage.setup();
  });

  test('comprehensive workflow: validation → lifecycle → multi-ops → persistence', async ({ page }) => {
    await documentsPage.expectEmptyState();

    await documentsPage.uploadFiles(TEST_FILES.INVALID_PDF);

    await page.waitForFunction(() => {
      const container = document.querySelector('[data-uploading]');
      return container?.getAttribute('data-uploading') === 'false';
    });

    await documentsPage.expectFileCount(0);
    await documentsPage.expectEmptyState();

    await documentsPage.uploadFilesAndWait(TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);

    await documentsPage.expectFileCount(1);
    await documentsPage.emptyState.expectNotVisible();

    const downloadPromise = page.waitForEvent('download');
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

    let remainingNames = await documentsPage.documentList.getFileNames();
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(remainingNames.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(false);

    await page.reload();
    await documentsPage.waitForDBInitialized();

    await documentsPage.expectFileCount(2);

    const fileNamesAfterReload = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(true);
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(fileNamesAfterReload.some(name => name.includes(FILE_NAMES.DOC_02_TXT))).toBe(false);

    await documentsPage.deleteFileByName(FILE_NAMES.DOC_01_MD);
    await documentsPage.deleteModal.waitForModal();
    await documentsPage.deleteModal.confirm();
    await documentsPage.deleteModal.waitForModalToClose();

    await documentsPage.expectFileCount(1);

    const fileNamesAfterDelete = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterDelete.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(fileNamesAfterDelete.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(false);

    await page.reload();
    await documentsPage.waitForDBInitialized();

    await documentsPage.expectFileCount(1);

    const fileNamesAfterSecondReload = await documentsPage.documentList.getFileNames();
    expect(fileNamesAfterSecondReload.some(name => name.includes(FILE_NAMES.DOC_03_MD))).toBe(true);
    expect(fileNamesAfterSecondReload.some(name => name.includes(FILE_NAMES.DOC_01_MD))).toBe(false);
  });
});
