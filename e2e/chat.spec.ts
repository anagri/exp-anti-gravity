import { test, expect } from '@playwright/test';

test('chat flow', async ({ page }) => {
  // Setup: Login first
  await page.goto('/');
  await page.getByPlaceholder('sk-...').fill('sk-test-key');
  await page.getByRole('button', { name: 'Start Chatting' }).click();
  await expect(page).toHaveURL('/chat');

  // Check initial state
  await expect(page.getByText('Start a conversation...')).toBeVisible();
  await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

  // Type message
  await page.getByPlaceholder('Type a message...').fill('Hello AI');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();

  // Send message
  // Note: Since we are mocking OpenAI in unit tests but not here, this will likely fail or error if we don't mock the network request.
  // For E2E, we should mock the OpenAI API response to avoid using real quota and ensure determinism.

  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const json = {
      choices: [{
        message: { role: 'assistant', content: 'Hello! How can I help you today?' }
      }]
    };
    await route.fulfill({ json });
  });

  await page.getByRole('button', { name: 'Send' }).click();

  // Check user message appears
  await expect(page.getByText('Hello AI')).toBeVisible();

  // Check loading state (might be too fast to catch, but we can try)
  // await expect(page.getByText('Thinking...')).toBeVisible();

  // Check assistant response
  await expect(page.getByText('Hello! How can I help you today?')).toBeVisible();

  // Clear chat
  await page.getByRole('button', { name: 'Clear Chat' }).click();
  await expect(page.getByText('Hello AI')).not.toBeVisible();
  await expect(page.getByText('Start a conversation...')).toBeVisible();
});
