import { test, expect } from '@playwright/test';

test('welcome screen flow', async ({ page }) => {
  await page.goto('/');

  // Check for welcome message
  await expect(page.getByText('Welcome to AI Chat')).toBeVisible();

  // Try to submit without key
  await page.getByRole('button', { name: 'Start Chatting' }).click();
  // Browser validation prevents submission, but we can't easily test that without custom logic or checking :invalid state.
  // Instead, let's check that we are still on the same page (or URL hasn't changed to /chat)
  await expect(page).toHaveURL('/');

  // Enter invalid key
  await page.getByPlaceholder('sk-...').fill('invalid-key');
  await page.getByRole('button', { name: 'Start Chatting' }).click();
  // Should verify alert or just that we didn't navigate.
  // Since we used window.alert, Playwright auto-dismisses it.
  await expect(page).toHaveURL('/');

  // Enter valid key
  await page.getByPlaceholder('sk-...').fill('sk-valid-key-123');
  await page.getByRole('button', { name: 'Start Chatting' }).click();

  // Should navigate to chat
  await expect(page).toHaveURL('/chat');
  await expect(page.getByText('AI Chat')).toBeVisible();

  // Check persistence
  await page.reload();
  await expect(page).toHaveURL('/chat');
  await expect(page.getByText('AI Chat')).toBeVisible();

  // Logout
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL('/');
});
