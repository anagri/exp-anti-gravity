import { test, expect } from '../fixtures/globalSetup';

test.describe('Knowledge Base CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Disable indexing for faster tests
    await page.addInitScript(() => {
      localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
    });

    // Setup: Go to welcome page and enter API key
    await page.goto('/exp-anti-gravity/');
    await page.getByPlaceholder('sk-...').fill('sk-test-key-123');
    await page.getByRole('button', { name: 'Start Chatting' }).click();

    // Wait for chat page to load
    await page.waitForURL(url => url.pathname === '/exp-anti-gravity/chat');

    // Navigate to documents page (now showing KBs)
    await page.goto('/exp-anti-gravity/documents');

    // Wait for database to initialize
    await page.waitForSelector('[data-testid="page-knowledge-bases"][data-db-initialized="true"]');
  });

  test('KB CRUD workflow: create → verify → delete', async ({ page }) => {
    // Should show empty state initially
    const emptyStateMessage = page.getByText('No knowledge bases yet');
    await expect(emptyStateMessage).toBeVisible();

    // Click "Create Knowledge Base" button
    const createButton = page.getByTestId('btn-create-kb');
    await createButton.click();

    // Modal should open
    const modal = page.getByTestId('modal-create-kb');
    await expect(modal).toBeVisible();

    // Fill in KB name
    const nameInput = page.getByTestId('input-kb-name');
    await nameInput.fill('React Documentation');

    // Fill in description
    const descriptionTextarea = page.getByTestId('textarea-kb-description');
    await descriptionTextarea.fill('Official React documentation and guides');

    // Submit form
    const submitButton = page.getByTestId('btn-create-kb-submit');
    await submitButton.click();

    // Modal should close and KB should appear
    await expect(modal).not.toBeVisible();

    // KB card should be visible
    const kbCard = page.locator('[data-testid^="kb-card-"][data-kb-name="React Documentation"]');
    await expect(kbCard).toBeVisible();

    // Verify KB name is displayed
    await expect(kbCard.getByText('React Documentation')).toBeVisible();

    // Verify stats (should be 0 documents and 0 chunks initially)
    await expect(kbCard.locator('[data-doc-count="0"]')).toBeVisible();
    await expect(kbCard.locator('[data-chunk-count="0"]')).toBeVisible();

    // Get the KB ID from the card
    const kbId = await kbCard.getAttribute('data-testid');
    const kbIdExtracted = kbId?.replace('kb-card-', '');

    // Open actions menu (⋮ button)
    const moreButton = kbCard.getByRole('button', { name: '' }).last();
    await moreButton.click();

    // Click delete button
    const deleteButton = page.getByTestId(`btn-delete-kb-${kbIdExtracted}`);
    await deleteButton.click();

    // Delete confirmation modal should open
    const deleteModal = page.getByTestId('modal-delete-kb');
    await expect(deleteModal).toBeVisible();

    // Verify warning message
    await expect(deleteModal.getByText("Are you sure you want to delete")).toBeVisible();
    await expect(deleteModal.locator('[data-kb-name="React Documentation"]')).toBeVisible();

    // Confirm deletion
    const confirmButton = page.getByTestId('btn-delete-kb-confirm');
    await confirmButton.click();

    // KB should be removed
    await expect(kbCard).not.toBeVisible();

    // Empty state should show again
    await expect(emptyStateMessage).toBeVisible();
  });

  test('create multiple KBs', async ({ page }) => {
    // Create first KB
    const createButton = page.getByTestId('btn-create-kb');
    await createButton.click();

    const modal = page.getByTestId('modal-create-kb');
    await expect(modal).toBeVisible();

    const nameInput = page.getByTestId('input-kb-name');
    await nameInput.fill('KB A');

    const submitButton = page.getByTestId('btn-create-kb-submit');
    await submitButton.click();

    await expect(modal).not.toBeVisible();

    // Verify first KB
    const kbCardA = page.locator('[data-kb-name="KB A"]');
    await expect(kbCardA).toBeVisible();

    // Create second KB
    await createButton.click();
    await expect(modal).toBeVisible();

    await nameInput.fill('KB B');
    await submitButton.click();

    await expect(modal).not.toBeVisible();

    // Verify both KBs
    const kbCardB = page.locator('[data-kb-name="KB B"]');
    await expect(kbCardA).toBeVisible();
    await expect(kbCardB).toBeVisible();
  });

  test('validation: duplicate KB names', async ({ page }) => {
    // Create first KB
    const createButton = page.getByTestId('btn-create-kb');
    await createButton.click();

    const modal = page.getByTestId('modal-create-kb');
    const nameInput = page.getByTestId('input-kb-name');
    const submitButton = page.getByTestId('btn-create-kb-submit');

    await nameInput.fill('Duplicate Test');
    await submitButton.click();

    await expect(modal).not.toBeVisible();

    // Try to create second KB with same name
    await createButton.click();
    await expect(modal).toBeVisible();

    await nameInput.fill('Duplicate Test');
    await submitButton.click();

    // Should show error message
    const errorMessage = modal.getByText(/already exists/i);
    await expect(errorMessage).toBeVisible();

    // Modal should still be open
    await expect(modal).toBeVisible();
  });
});
