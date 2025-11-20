import { test, expect } from '@playwright/test'
import { setupApiKey, getDocumentCount } from './helpers'

test('document upload, display, and delete workflow', async ({ page }) => {
  // Step 1: Setup API key and navigate to chat
  await setupApiKey(page)

  // Step 2: Verify "No documents" message shown initially
  await expect(page.getByTestId('no-documents')).toBeVisible()
  await expect(page.getByTestId('no-documents')).toContainText('No documents')

  // Step 3: Upload test file from e2e/files
  await page.getByTestId('file-upload-input').setInputFiles('e2e/files/112_the_founder_visa.md')

  // Step 4: Wait for document to appear
  await expect(page.getByTestId('document-filename')).toContainText('112_the_founder_visa.md')

  // Step 5: Verify filename displayed correctly
  const filename = await page.getByTestId('document-filename').first().textContent()
  expect(filename).toBe('112_the_founder_visa.md')

  // Step 6: Get document ID and click delete button
  const documentDiv = page.getByTestId('document-filename').first().locator('..')
  const documentId = await documentDiv.getAttribute('data-testid')
  const id = documentId?.replace('document-', '') || ''

  // Handle confirmation dialog
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete')
    await dialog.accept()
  })

  await page.getByTestId(`delete-${id}`).click()

  // Step 7: Verify document removed from list
  await page.waitForSelector(`[data-testid="document-${id}"]`, { state: 'detached' })

  // Step 8: Verify "No documents" shown again
  await expect(page.getByTestId('no-documents')).toBeVisible()
})

test('multiple documents with persistence', async ({ page }) => {
  // Setup
  await setupApiKey(page)

  // Step 1: Upload 3 files from e2e/files with delays to ensure different timestamps
  await page.getByTestId('file-upload-input').setInputFiles('e2e/files/078_the_equity_equation.md')
  await page.waitForTimeout(100)

  await page.getByTestId('file-upload-input').setInputFiles('e2e/files/110_relentlessly_resourceful.md')
  await page.waitForTimeout(100)

  await page.getByTestId('file-upload-input').setInputFiles('e2e/files/165_the_ronco_principle.md')

  // Step 2: Verify all 3 documents visible
  const docCount1 = await getDocumentCount(page)
  expect(docCount1).toBe(3)

  await expect(page.getByTestId('document-filename').first()).toContainText('165_the_ronco_principle.md')
  await expect(page.getByTestId('document-filename').nth(1)).toContainText('110_relentlessly_resourceful.md')
  await expect(page.getByTestId('document-filename').nth(2)).toContainText('078_the_equity_equation.md')

  // Step 3: Verify ordering (newest first)
  const filenames = await page.getByTestId('document-filename').allTextContents()
  expect(filenames[0]).toBe('165_the_ronco_principle.md')
  expect(filenames[1]).toBe('110_relentlessly_resourceful.md')
  expect(filenames[2]).toBe('078_the_equity_equation.md')

  // Step 4: Reload page to test IndexedDB persistence
  await page.reload()

  // Step 5: Verify all 3 documents still visible after reload
  await page.waitForSelector('[data-testid="document-filename"]')
  const docCountAfterReload = await getDocumentCount(page)
  expect(docCountAfterReload).toBe(3)

  const filenamesAfterReload = await page.getByTestId('document-filename').allTextContents()
  expect(filenamesAfterReload).toHaveLength(3)
  expect(filenamesAfterReload).toContain('078_the_equity_equation.md')
  expect(filenamesAfterReload).toContain('110_relentlessly_resourceful.md')
  expect(filenamesAfterReload).toContain('165_the_ronco_principle.md')

  // Step 6: Delete middle document
  const doc2Div = page.getByTestId('document-filename').filter({ hasText: '110_relentlessly_resourceful.md' }).locator('..')
  const doc2Id = (await doc2Div.getAttribute('data-testid'))?.replace('document-', '') || ''

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.getByTestId(`delete-${doc2Id}`).click()
  await page.waitForSelector(`[data-testid="document-${doc2Id}"]`, { state: 'detached' })

  // Step 7: Verify only 2 documents remain
  const docCountAfterDelete = await getDocumentCount(page)
  expect(docCountAfterDelete).toBe(2)

  const remainingFilenames = await page.getByTestId('document-filename').allTextContents()
  expect(remainingFilenames).toContain('078_the_equity_equation.md')
  expect(remainingFilenames).toContain('165_the_ronco_principle.md')
  expect(remainingFilenames).not.toContain('110_relentlessly_resourceful.md')
})

test('invalid file type rejection', async ({ page }) => {
  // Setup
  await setupApiKey(page)

  // Verify no documents initially
  await expect(page.getByTestId('no-documents')).toBeVisible()

  // Attempt to upload .pdf file (invalid type)
  await page.getByTestId('file-upload-input').setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF content'),
  })

  // Wait a moment to ensure upload would have happened if valid
  await page.waitForTimeout(500)

  // Verify file not added to list
  await expect(page.getByTestId('no-documents')).toBeVisible()

  const docCount = await getDocumentCount(page)
  expect(docCount).toBe(0)
})
