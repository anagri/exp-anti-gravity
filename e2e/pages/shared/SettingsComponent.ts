import { Page, expect } from '@playwright/test';

export class SettingsComponent {
  constructor(private readonly page: Page) {}

  // Modal operations
  async open() {
    await this.page.click('[data-testid="btn-settings"]');
    await this.page.waitForSelector('[data-testid="div-settings-modal"]', { state: 'visible' });
  }

  async close() {
    await this.page.click('[data-testid="btn-close-settings"]');
    await this.page.waitForSelector('[data-testid="div-settings-modal"]', { state: 'hidden' });
  }

  async closeViaFooter() {
    await this.page.click('[data-testid="btn-close-settings-footer"]');
    await this.page.waitForSelector('[data-testid="div-settings-modal"]', { state: 'hidden' });
  }

  async expectModalVisible() {
    await expect(this.page.getByTestId('div-settings-modal')).toBeVisible();
  }

  async expectModalNotVisible() {
    await expect(this.page.getByTestId('div-settings-modal')).not.toBeVisible();
  }

  // Feature Flags
  async getFeatureFlagValue(flagName: string): Promise<boolean> {
    const row = this.page.locator(`[data-testid="feature-flag-${flagName}"]`);
    const enabled = await row.getAttribute('data-enabled');
    return enabled === 'true';
  }

  async toggleFeatureFlag(flagName: string) {
    await this.page.click(`[data-testid="toggle-${flagName}"]`);
  }

  async expectFeatureFlagEnabled(flagName: string, enabled: boolean) {
    const row = this.page.locator(`[data-testid="feature-flag-${flagName}"]`);
    await expect(row).toHaveAttribute('data-enabled', enabled ? 'true' : 'false');
  }

  async expectReloadWarning() {
    await this.page.waitForSelector('[data-testid="reload-warning"]', { state: 'visible' });
  }

  async reloadToApplyChanges() {
    await this.page.click('[data-testid="btn-reload-now"]');
  }

  // OpenAI Configuration
  async expectOpenAIConfigSection() {
    await expect(this.page.getByText('OpenAI Configuration')).toBeVisible();
    await expect(this.page.getByTestId('input-openai-api-key')).toBeVisible();
    await expect(this.page.getByTestId('input-openai-base-url')).toBeVisible();
    await expect(this.page.getByTestId('btn-refresh-models')).toBeVisible();
  }

  async toggleApiKeyVisibility() {
    await this.page.getByTestId('btn-toggle-api-key-visibility').click();
  }

  async expectApiKeyType(type: 'password' | 'text') {
    const apiKeyInput = this.page.getByTestId('input-openai-api-key');
    await expect(apiKeyInput).toHaveAttribute('type', type);
  }

  async setApiKey(apiKey: string) {
    const apiKeyInput = this.page.getByTestId('input-openai-api-key');
    await apiKeyInput.fill(apiKey);
    await this.page.getByTestId('btn-save-api-key').click();
  }

  async expectApiKeyValue(apiKey: string) {
    const apiKeyInput = this.page.getByTestId('input-openai-api-key');
    await expect(apiKeyInput).toHaveValue(apiKey);
  }

  async setBaseUrl(baseUrl: string) {
    const baseUrlInput = this.page.getByTestId('input-openai-base-url');
    await baseUrlInput.fill(baseUrl);
  }

  async expectBaseUrlValue(baseUrl: string) {
    const baseUrlInput = this.page.getByTestId('input-openai-base-url');
    await expect(baseUrlInput).toHaveValue(baseUrl);
  }

  async refreshModels() {
    await this.page.getByTestId('btn-refresh-models').click();
    await this.page.waitForSelector('[data-testid="btn-refresh-models"][data-loading="true"]');
    await this.page.waitForSelector('[data-testid="btn-refresh-models"][data-loading="false"]');
  }

  // Search Settings
  async expectSearchSettingsSection() {
    await expect(this.page.getByText('Hybrid Search Settings')).toBeVisible();
  }

  async expectSearchSettingValue(settingName: string, value: string) {
    await expect(this.page.getByTestId(`input-${settingName}`)).toHaveValue(value);
  }

  async setSearchSetting(settingName: string, value: string) {
    await this.page.getByTestId(`input-${settingName}`).fill(value);
  }

  async expectValidationError(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectNoValidationError(message: string) {
    await expect(this.page.getByText(message)).not.toBeVisible();
  }

  // Storage verification
  async getLocalStorageValue(key: string): Promise<string | null> {
    return await this.page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
  }

  async expectLocalStorageValue(key: string, expectedValue: string) {
    const value = await this.getLocalStorageValue(key);
    expect(value).toBe(expectedValue);
  }
}
