import { test, expect } from '@playwright/test';
import { WelcomePage } from './pages/WelcomePage';
import { ChatPage } from './pages/ChatPage';
import { loadTestApiKey } from './utils/env';

test.describe('Chat with Real OpenAI API', () => {
  let apiKey: string;
  const baseUrl = 'http://127.0.0.1:4173';

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test('chat flow with model selection and streaming', async ({ page }) => {
    const welcomePage = new WelcomePage(page, baseUrl);
    const chatPage = new ChatPage(page, baseUrl);

    await welcomePage.navigateToWelcome();
    await welcomePage.expectWelcomePageVisible();

    await welcomePage.submitApiKey(apiKey);
    await chatPage.expectChatPageLoaded();

    await chatPage.waitForModelsLoaded();
    await chatPage.expectEmptyState();

    await chatPage.selectModel('gpt-4o-mini');
    await chatPage.expectSelectedModel('gpt-4o-mini');

    await chatPage.sendMessageAndWait('What day comes after Monday?');
    await chatPage.expectUserMessage('What day comes after Monday?');
    await chatPage.expectAssistantMessageContains('tuesday');

    await chatPage.clearChat();
    await chatPage.expectMessageNotVisible('What day comes after Monday?');
    await chatPage.expectEmptyState();
  });

  test('logout clears API key and redirects to homepage', async ({ page }) => {
    const welcomePage = new WelcomePage(page, baseUrl);
    const chatPage = new ChatPage(page, baseUrl);

    await welcomePage.navigateToWelcome();
    await welcomePage.submitApiKey(apiKey);

    await chatPage.logout();
    await welcomePage.expectAtWelcomePage();

    await chatPage.navigateTo('/chat');
    await welcomePage.expectAtWelcomePage();
    await welcomePage.expectApiKeyInputVisible();
  });
});
