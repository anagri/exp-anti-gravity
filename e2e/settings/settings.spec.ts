import { test, expect } from '../fixtures/globalSetup';
import { DocumentPage } from '../pages/DocumentPage';
import { SettingsComponent } from '../pages/shared/SettingsComponent';

test.describe('Settings: Feature Flags & OpenAI Configuration & Search Settings', () => {
  let documentsPage: DocumentPage;

  test('Phase settings: feature-flags → openai-config → search-settings → validation → persist', async ({
    page,
    context,
  }) => {
    // Phase feature-flags: verify defaults and toggle
    documentsPage = new DocumentPage(page);
    await documentsPage.setup('sk-test-key-123');

    await documentsPage.settings.open();
    await documentsPage.settings.expectModalVisible();

    let enabled = await documentsPage.settings.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(true);

    await documentsPage.settings.expectFeatureFlagEnabled('FEATURE_INDEXING_ENABLED', true);

    await documentsPage.settings.toggleFeatureFlag('FEATURE_INDEXING_ENABLED');
    await documentsPage.settings.expectReloadWarning();

    enabled = await documentsPage.settings.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(false);
    await documentsPage.settings.expectFeatureFlagEnabled('FEATURE_INDEXING_ENABLED', false);

    // Phase openai-config: verify OpenAI Configuration section exists
    await documentsPage.settings.expectOpenAIConfigSection();

    await documentsPage.settings.expectApiKeyType('password');
    await documentsPage.settings.toggleApiKeyVisibility();
    await documentsPage.settings.expectApiKeyType('text');
    await documentsPage.settings.toggleApiKeyVisibility();
    await documentsPage.settings.expectApiKeyType('password');

    await documentsPage.settings.setApiKey('sk-test-persistent-key');
    await documentsPage.settings.setBaseUrl('https://custom.openai.proxy/v1');

    // Phase search-settings: verify hybrid search settings section exists
    await documentsPage.settings.expectSearchSettingsSection();

    await documentsPage.settings.expectSearchSettingValue('VECTOR_TOP_K', '3');
    await documentsPage.settings.expectSearchSettingValue('SIMILARITY_THRESHOLD', '0.3');
    await documentsPage.settings.expectSearchSettingValue('BM25_LIMIT', '10');
    // Note: HNSW settings moved to per-KB configuration (in CreateKBModal)

    // Phase validation: test input bounds validation
    await documentsPage.settings.setSearchSetting('VECTOR_TOP_K', '25');
    await documentsPage.settings.expectValidationError('Value must be between 1 and 20');

    await documentsPage.settings.setSearchSetting('VECTOR_TOP_K', '5');
    await documentsPage.settings.expectNoValidationError('Value must be between 1 and 20');

    await documentsPage.settings.setSearchSetting('SIMILARITY_THRESHOLD', '1.5');
    await documentsPage.settings.expectValidationError('Value must be between 0 and 1');

    await documentsPage.settings.setSearchSetting('SIMILARITY_THRESHOLD', '0.7');
    await documentsPage.settings.expectNoValidationError('Value must be between 0 and 1');

    await documentsPage.settings.setSearchSetting('BM25_LIMIT', '15');

    await documentsPage.settings.close();

    // Verify search settings persisted
    await documentsPage.settings.expectLocalStorageValue('search-setting-VECTOR_TOP_K', '5');
    await documentsPage.settings.expectLocalStorageValue(
      'search-setting-SIMILARITY_THRESHOLD',
      '0.7'
    );
    await documentsPage.settings.expectLocalStorageValue('search-setting-BM25_LIMIT', '15');

    // Phase persist: verify all settings persist across new page
    const newPage = await context.newPage();
    const newPageSettings = new SettingsComponent(newPage);

    await newPage.goto('/exp-anti-gravity/');
    await newPage.getByTestId('btn-welcome-settings').click();

    await newPageSettings.expectApiKeyValue('sk-test-persistent-key');
    await newPageSettings.expectBaseUrlValue('https://custom.openai.proxy/v1');
    await newPageSettings.expectFeatureFlagEnabled('FEATURE_INDEXING_ENABLED', false);

    await newPageSettings.expectSearchSettingValue('VECTOR_TOP_K', '5');
    await newPageSettings.expectSearchSettingValue('SIMILARITY_THRESHOLD', '0.7');
    await newPageSettings.expectSearchSettingValue('BM25_LIMIT', '15');

    await newPageSettings.refreshModels();

    // Test close buttons
    await newPageSettings.close();
    await newPageSettings.expectModalNotVisible();

    // Navigate to chat and verify settings persist from both pages
    await newPage.getByTestId('inp-welcome-apikey').fill('sk-test-persistent-key');
    await newPage.getByTestId('btn-welcome-start').click();
    await expect(newPage).toHaveURL(/\/chat/);

    await newPageSettings.open();
    await newPageSettings.expectModalVisible();
    await newPageSettings.expectOpenAIConfigSection();
    await newPageSettings.expectSearchSettingsSection();

    await newPageSettings.expectBaseUrlValue('https://custom.openai.proxy/v1');
    await newPageSettings.expectSearchSettingValue('VECTOR_TOP_K', '5');
    await newPageSettings.expectSearchSettingValue('SIMILARITY_THRESHOLD', '0.7');

    await newPageSettings.closeViaFooter();
    await newPageSettings.expectModalNotVisible();

    // Test settings accessible from documents page
    await newPage.goto('/exp-anti-gravity/documents');
    await newPageSettings.open();
    await newPageSettings.expectModalVisible();
    await newPageSettings.expectSearchSettingsSection();

    await newPage.close();
  });
});
