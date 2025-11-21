import { test, expect } from '@playwright/test'

test.describe('Search Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('openai_api_key', 'test-api-key')
      localStorage.removeItem('search-setting-VECTOR_TOP_K')
      localStorage.removeItem('search-setting-SIMILARITY_THRESHOLD')
      localStorage.removeItem('search-setting-BM25_LIMIT')
    })

    await page.goto('/exp-anti-gravity/chat')
  })

  test('settings accessible from chat page', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await expect(page.getByTestId('div-settings-modal')).toBeVisible()
    await expect(page.getByText('Hybrid Search Settings')).toBeVisible()
  })

  test('settings accessible from documents page', async ({ page }) => {
    await page.goto('/exp-anti-gravity/documents')
    await page.getByTestId('btn-settings').click()

    await expect(page.getByTestId('div-settings-modal')).toBeVisible()
    await expect(page.getByText('Hybrid Search Settings')).toBeVisible()
  })

  test('displays default search setting values', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await expect(page.getByTestId('input-VECTOR_TOP_K')).toHaveValue('3')
    await expect(page.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue('0.3')
    await expect(page.getByTestId('input-BM25_LIMIT')).toHaveValue('10')
    await expect(page.getByTestId('input-HNSW_M')).toHaveValue('16')
    await expect(page.getByTestId('input-HNSW_EF_CONSTRUCTION')).toHaveValue('64')
  })

  test('updates and persists search settings', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await page.getByTestId('input-VECTOR_TOP_K').fill('5')
    await page.getByTestId('input-SIMILARITY_THRESHOLD').fill('0.7')
    await page.getByTestId('input-BM25_LIMIT').fill('15')

    await page.getByTestId('btn-close-settings').click()

    const topK = await page.evaluate(() => localStorage.getItem('search-setting-VECTOR_TOP_K'))
    const threshold = await page.evaluate(() =>
      localStorage.getItem('search-setting-SIMILARITY_THRESHOLD')
    )
    const bm25 = await page.evaluate(() => localStorage.getItem('search-setting-BM25_LIMIT'))

    expect(topK).toBe('5')
    expect(threshold).toBe('0.7')
    expect(bm25).toBe('15')
  })

  test('settings persist across page reloads', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('search-setting-VECTOR_TOP_K', '7')
      localStorage.setItem('search-setting-SIMILARITY_THRESHOLD', '0.8')
    })

    await page.reload()
    await page.getByTestId('btn-settings').click()

    await expect(page.getByTestId('input-VECTOR_TOP_K')).toHaveValue('7')
    await expect(page.getByTestId('input-SIMILARITY_THRESHOLD')).toHaveValue('0.8')
  })

  test('validates input bounds for vector top k', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await page.getByTestId('input-VECTOR_TOP_K').fill('25')

    await expect(page.getByText('Value must be between 1 and 20')).toBeVisible()
  })

  test('validates input bounds for similarity threshold', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await page.getByTestId('input-SIMILARITY_THRESHOLD').fill('1.5')

    await expect(page.getByText('Value must be between 0 and 1')).toBeVisible()
  })

  test('shows warning for HNSW parameter changes', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await expect(
      page.getByText(/Changes to HNSW index parameters require page reload/)
    ).toBeVisible()
  })

  test('feature flags and search settings in same dialog', async ({ page }) => {
    await page.getByTestId('btn-settings').click()

    await expect(page.getByText('Feature Flags')).toBeVisible()
    await expect(page.getByText('Hybrid Search Settings')).toBeVisible()
    await expect(page.getByText('Advanced Settings')).toBeVisible()
  })

  test('can close settings dialog with X button', async ({ page }) => {
    await page.getByTestId('btn-settings').click()
    await expect(page.getByTestId('div-settings-modal')).toBeVisible()

    await page.getByTestId('btn-close-settings').click()
    await expect(page.getByTestId('div-settings-modal')).not.toBeVisible()
  })

  test('can close settings dialog with footer close button', async ({ page }) => {
    await page.getByTestId('btn-settings').click()
    await expect(page.getByTestId('div-settings-modal')).toBeVisible()

    await page.getByTestId('btn-close-settings-footer').click()
    await expect(page.getByTestId('div-settings-modal')).not.toBeVisible()
  })
})
