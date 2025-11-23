import { test } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { loadTestApiKey } from '../utils/env';

test.describe('KB Embedding Model Selection @live', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);

    // Disable indexing for this test (faster, UI-only)
    await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', false);

    await documentsPage.setup(apiKey);
  });

  test('Phase model-fetch → dropdown → text-fallback', async ({ page }) => {
    // ─────────────────────────────────────────────────────────
    // PHASE MODEL-FETCH: Refresh models and use dropdown selector
    // ─────────────────────────────────────────────────────────

    // Open create KB modal
    await page.getByTestId('btn-create-kb').click();
    const modal = page.getByTestId('modal-create-kb');
    await modal.waitFor({ state: 'visible' });

    // Initially, text input should be visible (no models loaded)
    await documentsPage.knowledgeBase.createModal.expectEmbeddingTextInputVisible();

    // Refresh models
    await documentsPage.knowledgeBase.createModal.refreshModels();

    // ─────────────────────────────────────────────────────────
    // PHASE DROPDOWN: Verify dropdown appears and can select model
    // ─────────────────────────────────────────────────────────

    // After refresh, dropdown should be visible
    await documentsPage.knowledgeBase.createModal.expectEmbeddingDropdownVisible();

    // Select a model from dropdown
    await documentsPage.knowledgeBase.createModal.selectEmbeddingModel('gpt-4o-mini');

    // Fill in name and create KB
    await page.getByTestId('input-kb-name').fill('Test KB with Dropdown');
    await page.getByTestId('btn-create-kb-submit').click();

    await modal.waitFor({ state: 'hidden' });

    // Verify KB created
    await documentsPage.expectKBVisible('Test KB with Dropdown');

    // ─────────────────────────────────────────────────────────
    // PHASE TEXT-FALLBACK: Verify text input still works when no models loaded
    // ─────────────────────────────────────────────────────────

    // Reload page to reset models state
    await documentsPage.reload();
    await documentsPage.waitForDBInitialized();

    // Create another KB using text input (without refreshing models)
    await page.getByTestId('btn-create-kb').click();
    await modal.waitFor({ state: 'visible' });

    // Text input should be visible
    await documentsPage.knowledgeBase.createModal.expectEmbeddingTextInputVisible();

    // Use traditional create method (text input)
    await page.getByTestId('input-kb-name').fill('Test KB with Text Input');
    await page.getByTestId('input-kb-embedding-model').fill('text-embedding-3-small');
    await page.getByTestId('btn-create-kb-submit').click();

    await modal.waitFor({ state: 'hidden' });

    // Verify KB created
    await documentsPage.expectKBVisible('Test KB with Text Input');

    console.log('KB model selection test completed successfully');
  });

  test('Phase edit-model-fetch → edit-dropdown', async () => {
    // Create initial KB with default settings
    await documentsPage.createKB('Test KB for Edit');
    await documentsPage.expectKBVisible('Test KB for Edit');

    // ─────────────────────────────────────────────────────────
    // PHASE EDIT-MODEL-FETCH: Open edit modal and refresh models
    // ─────────────────────────────────────────────────────────

    // Open edit modal
    await documentsPage.knowledgeBase.editModal.edit('Test KB for Edit');

    // Text input should be visible initially
    await documentsPage.knowledgeBase.editModal.expectEmbeddingTextInputVisible();

    // Refresh models
    await documentsPage.knowledgeBase.editModal.refreshModels();

    // ─────────────────────────────────────────────────────────
    // PHASE EDIT-DROPDOWN: Verify dropdown works in edit modal
    // ─────────────────────────────────────────────────────────

    // Dropdown should be visible after refresh
    await documentsPage.knowledgeBase.editModal.expectEmbeddingDropdownVisible();

    // Select different model from dropdown
    await documentsPage.knowledgeBase.editModal.selectEmbeddingModel('text-embedding-3-large');

    // Close modal without saving (testing UI only, not re-indexing)
    await documentsPage.knowledgeBase.editModal.close();

    console.log('KB edit model selection test completed successfully');
  });
});
