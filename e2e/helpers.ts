import type { Page } from '@playwright/test'

/**
 * Set up API key and navigate to chat page
 */
export async function setupApiKey(page: Page, apiKey: string = 'sk-test-key-123') {
  await page.goto('/')
  await page.getByPlaceholder('sk-...').fill(apiKey)
  await page.getByRole('button', { name: 'Start Chatting' }).click()
  await page.waitForURL('/chat')
}

/**
 * Upload a document using the file input
 */
export async function uploadDocument(
  page: Page,
  filename: string,
  content: string
) {
  const mimeType = filename.endsWith('.md') ? 'text/markdown' : 'text/plain'

  await page.getByTestId('file-upload-input').setInputFiles({
    name: filename,
    mimeType,
    buffer: Buffer.from(content),
  })

  // Wait for document to appear in the list
  await page.waitForSelector(`[data-testid="document-filename"]:has-text("${filename}")`)
}

/**
 * Delete a document by finding its delete button
 */
export async function deleteDocument(page: Page, id: string) {
  await page.getByTestId(`delete-${id}`).click()

  // Click confirm dialog if present
  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  // Wait for document to be removed from the list
  await page.waitForSelector(`[data-testid="document-${id}"]`, { state: 'detached' })
}

/**
 * Get the number of documents currently displayed
 */
export async function getDocumentCount(page: Page): Promise<number> {
  const documents = await page.getByTestId('document-filename').all()
  return documents.length
}

/**
 * Wait for a specific number of documents to be displayed
 */
export async function waitForDocumentCount(page: Page, expectedCount: number) {
  await page.waitForFunction(
    (count) => {
      const documents = document.querySelectorAll('[data-testid="document-filename"]')
      return documents.length === count
    },
    expectedCount
  )
}

/**
 * Clear PGlite IndexedDB database
 */
export async function clearPGliteDB(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    console.log('[clearPGliteDB] Available databases:', databases);

    const promises = databases
      .filter(db => db.name?.includes('rag') || db.name?.includes('pglite'))
      .map(db => {
        return new Promise<void>((resolve) => {
          if (db.name) {
            console.log('[clearPGliteDB] Deleting database:', db.name);
            const request = indexedDB.deleteDatabase(db.name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          } else {
            resolve();
          }
        });
      });

    await Promise.all(promises);
  });
}

/**
 * Navigate to documents page (requires API key to be set)
 */
export async function navigateToDocuments(page: Page, apiKey: string = 'sk-test-key-123') {
  await page.goto('/')
  await page.getByPlaceholder('sk-...').fill(apiKey)
  await page.getByRole('button', { name: 'Start Chatting' }).click()
  await page.waitForURL('/chat')
  await page.goto('/documents')
  await page.waitForURL('/documents')

  await page.waitForFunction(() => {
    const container = document.querySelector('[data-db-initialized]')
    return container?.getAttribute('data-db-initialized') === 'true'
  })
}
