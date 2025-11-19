import { test, expect } from '@playwright/test';

test('chat flow', async ({ page }) => {
  // Setup route mocking BEFORE navigating to the app
  await page.route('https://api.openai.com/v1/models', async route => {
    await route.fulfill({
      json: {
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'gpt-4' },
          { id: 'gpt-4-turbo' },
          { id: 'text-embedding-ada-002' },
          { id: 'whisper-1' },
          { id: 'dall-e-3' },
        ],
      },
    });
  });

  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const request = route.request();
    const postData = request.postDataJSON();
    const model = postData.model || 'gpt-3.5-turbo';

    // Return streaming response
    const body = [
      `data: {"choices": [{"delta": {"content": "Hello "}}]}\n\n`,
      `data: {"choices": [{"delta": {"content": "from "}}]}\n\n`,
      `data: {"choices": [{"delta": {"content": "${model}!"}}]}\n\n`,
      'data: [DONE]\n\n'
    ].join('');

    await route.fulfill({
      contentType: 'text/event-stream',
      body: body
    });
  });

  // Setup: Login first
  await page.goto('/');
  await page.getByPlaceholder('sk-...').fill('sk-test-key');
  await page.getByRole('button', { name: 'Start Chatting' }).click();
  await expect(page).toHaveURL('/chat');

  // Wait for models to load
  await page.waitForTimeout(500);

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

  await page.getByRole('button', { name: 'Send' }).click();

  // Check user message appears
  await expect(page.getByText('Hello AI')).toBeVisible();

  // Check assistant response
  await expect(page.getByText(/Hello from gpt-3\.5-turbo/)).toBeVisible({ timeout: 10000 });

  // Select GPT-4 using the new Combobox
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'gpt-4', exact: true }).click();

  // Send another message
  await page.getByPlaceholder('Type a message...').fill('Testing GPT-4');
  await page.getByRole('button', { name: 'Send' }).click();

  // Check streaming response
  await expect(page.getByText(/Hello from gpt-4/)).toBeVisible({ timeout: 10000 });

  // Clear chat
  await page.getByRole('button', { name: 'Clear Chat' }).click();
  await expect(page.getByText('Hello AI')).not.toBeVisible();
  await expect(page.getByText('Start a conversation...')).toBeVisible();
});

test('logout clears API key and redirects to homepage', async ({ page }) => {
  // Setup: Login first
  await page.goto('/');
  await page.getByPlaceholder('sk-...').fill('sk-test-key');
  await page.getByRole('button', { name: 'Start Chatting' }).click();
  await expect(page).toHaveURL('/chat');

  // Click logout button
  await page.getByRole('button', { name: 'Logout' }).click();

  // Should redirect to homepage
  await expect(page).toHaveURL('/');

  // API key should be cleared - trying to navigate to /chat should redirect back to /
  await page.goto('/chat');
  await expect(page).toHaveURL('/');

  // Should see the welcome page with API key input
  await expect(page.getByPlaceholder('sk-...')).toBeVisible();
});

