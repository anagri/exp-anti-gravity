import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';

test.describe('Settings: Feature Flags & OpenAI Configuration & Search Settings', () => {
  let documentsPage: DocumentPage;

  test('Phase settings: feature-flags → openai-config → search-settings → validation → persist', async ({ page, context }) => {
    // Phase feature-flags: verify defaults and toggle
    documentsPage = new DocumentPage(page);
    await documentsPage.setup("sk-test-key-123");

    await documentsPage.openSettings();
    await expect(page.getByTestId('div-settings-modal')).toBeVisible();

    let enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(true);

    const flagRow = page.locator('[data-testid="feature-flag-FEATURE_INDEXING_ENABLED"]');
    await expect(flagRow).toHaveAttribute('data-enabled', 'true');

    await documentsPage.toggleFeatureFlag('FEATURE_INDEXING_ENABLED');
    await documentsPage.expectReloadWarning();

    enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(false);
    await expect(flagRow).toHaveAttribute('data-enabled', 'false');

    // Phase openai-config: verify OpenAI Configuration section exists
    await expect(page.getByText('OpenAI Configuration')).toBeVisible();
    await expect(page.getByTestId('input-openai-api-key')).toBeVisible();
    await expect(page.getByTestId('input-openai-base-url')).toBeVisible();
    await expect(page.getByTestId('btn-refresh-models')).toBeVisible();

    const apiKeyInput = page.getByTestId('input-openai-api-key');
    const saveButton = page.getByTestId('btn-save-api-key');
    const toggleButton = page.getByTestId('btn-toggle-api-key-visibility');

    await expect(apiKeyInput).toHaveAttribute('type', 'password');
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'text');
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    await apiKeyInput.fill('sk-test-persistent-key');
    await saveButton.click();

    const baseUrlInput = page.getByTestId('input-openai-base-url');
    await baseUrlInput.fill('https://custom.openai.proxy/v1');

    // Phase search-settings: verify hybrid search settings section exists
    await expect(page.getByText('Hybrid Search Settings')).toBeVisible();

    await expect(page.getByTestId('input-VECTOR_TOP_K')).toHaveValue('3');
    await expect(page.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue('0.3');
    await expect(page.getByTestId('input-BM25_LIMIT')).toHaveValue('10');
    // Note: HNSW settings moved to per-KB configuration (in CreateKBModal)

    // Phase validation: test input bounds validation
    await page.getByTestId('input-VECTOR_TOP_K').fill('25');
    await expect(page.getByText('Value must be between 1 and 20')).toBeVisible();

    await page.getByTestId('input-VECTOR_TOP_K').fill('5');
    await expect(page.getByText('Value must be between 1 and 20')).not.toBeVisible();

    await page.getByTestId('input-SIMILARITY_THRESHOLD').fill('1.5');
    await expect(page.getByText('Value must be between 0 and 1')).toBeVisible();

    await page.getByTestId('input-SIMILARITY_THRESHOLD').fill('0.7');
    await expect(page.getByText('Value must be between 0 and 1')).not.toBeVisible();

    await page.getByTestId('input-BM25_LIMIT').fill('15');

    await documentsPage.closeSettings();

    // Verify search settings persisted
    const topK = await page.evaluate(() => localStorage.getItem('search-setting-VECTOR_TOP_K'));
    const threshold = await page.evaluate(() => localStorage.getItem('search-setting-SIMILARITY_THRESHOLD'));
    const bm25 = await page.evaluate(() => localStorage.getItem('search-setting-BM25_LIMIT'));

    expect(topK).toBe('5');
    expect(threshold).toBe('0.7');
    expect(bm25).toBe('15');

    // Phase persist: verify all settings persist across new page
    const newPage = await context.newPage();
    await newPage.goto('/exp-anti-gravity/');
    await newPage.getByTestId('btn-welcome-settings').click();

    const newApiKeyInput = newPage.getByTestId('input-openai-api-key');
    await expect(newApiKeyInput).toHaveValue('sk-test-persistent-key');

    const newBaseUrlInput = newPage.getByTestId('input-openai-base-url');
    await expect(newBaseUrlInput).toHaveValue('https://custom.openai.proxy/v1');

    const newFlagRow = newPage.locator('[data-testid="feature-flag-FEATURE_INDEXING_ENABLED"]');
    await expect(newFlagRow).toHaveAttribute('data-enabled', 'false');

    await expect(newPage.getByTestId('input-VECTOR_TOP_K')).toHaveValue('5');
    await expect(newPage.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue('0.7');
    await expect(newPage.getByTestId('input-BM25_LIMIT')).toHaveValue('15');

    await newPage.getByTestId('btn-refresh-models').click();
    await newPage.waitForTimeout(500);

    // Test close buttons
    await newPage.getByTestId('btn-close-settings').click();
    await expect(newPage.getByTestId('div-settings-modal')).not.toBeVisible();

    // Navigate to chat and verify settings persist from both pages
    await newPage.getByTestId('inp-welcome-apikey').fill('sk-test-persistent-key');
    await newPage.getByTestId('btn-welcome-start').click();
    await expect(newPage).toHaveURL(/\/chat/);

    await newPage.getByTestId('btn-settings').click();
    await expect(newPage.getByTestId('div-settings-modal')).toBeVisible();
    await expect(newPage.getByText('OpenAI Configuration')).toBeVisible();
    await expect(newPage.getByText('Hybrid Search Settings')).toBeVisible();

    const chatBaseUrlInput = newPage.getByTestId('input-openai-base-url');
    await expect(chatBaseUrlInput).toHaveValue('https://custom.openai.proxy/v1');

    await expect(newPage.getByTestId('input-VECTOR_TOP_K')).toHaveValue('5');
    await expect(newPage.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue('0.7');

    await newPage.getByTestId('btn-close-settings-footer').click();
    await expect(newPage.getByTestId('div-settings-modal')).not.toBeVisible();

    // Test settings accessible from documents page
    await newPage.goto('/exp-anti-gravity/documents');
    await newPage.getByTestId('btn-settings').click();
    await expect(newPage.getByTestId('div-settings-modal')).toBeVisible();
    await expect(newPage.getByText('Hybrid Search Settings')).toBeVisible();

    await newPage.close();
  });
});
