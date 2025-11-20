import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';

test.describe('Feature Flags', () => {
  let documentsPage: DocumentPage;

  test('settings modal shows FEATURE_INDEXING_ENABLED as enabled by default', async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setup();

    await documentsPage.openSettings();

    const enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(true);

    const flagRow = page.locator('[data-testid="feature-flag-FEATURE_INDEXING_ENABLED"]');
    await expect(flagRow).toHaveAttribute('data-enabled', 'true');

    await documentsPage.closeSettings();
  });

  test('settings modal shows FEATURE_INDEXING_ENABLED as disabled when set via localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
    });

    documentsPage = new DocumentPage(page);
    await documentsPage.setup();

    await documentsPage.openSettings();

    await expect(page.locator('[data-testid="div-settings-modal"]')).toBeVisible();

    const enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(false);

    const flagRow = page.locator('[data-testid="feature-flag-FEATURE_INDEXING_ENABLED"]');
    await expect(flagRow).toHaveAttribute('data-enabled', 'false');

    await documentsPage.closeSettings();
  });

  test('user can toggle feature flag and verify persistence after reload', async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setup();

    await documentsPage.openSettings();
    let enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(true);

    const flagRow = page.locator('[data-testid="feature-flag-FEATURE_INDEXING_ENABLED"]');
    await expect(flagRow).toHaveAttribute('data-enabled', 'true');

    await documentsPage.toggleFeatureFlag('FEATURE_INDEXING_ENABLED');

    await documentsPage.expectReloadWarning();

    enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(false);
    await expect(flagRow).toHaveAttribute('data-enabled', 'false');

    await documentsPage.reloadToApplyChanges();

    await documentsPage.openSettings();
    enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(false);
    await expect(flagRow).toHaveAttribute('data-enabled', 'false');

    await documentsPage.toggleFeatureFlag('FEATURE_INDEXING_ENABLED');
    await documentsPage.expectReloadWarning();

    enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED');
    expect(enabled).toBe(true);
    await expect(flagRow).toHaveAttribute('data-enabled', 'true');

    await documentsPage.closeSettings();
  });
});
