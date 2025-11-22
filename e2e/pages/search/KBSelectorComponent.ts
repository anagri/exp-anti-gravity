import { Page } from '@playwright/test';

export class KBSelectorComponent {
  constructor(private readonly page: Page) {}

  async selectKB(kbId: string) {
    await this.page.selectOption('[data-testid="select-kb-search"]', kbId);
  }
}
