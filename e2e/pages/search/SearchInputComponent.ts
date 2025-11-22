import { Page } from '@playwright/test';

export class SearchInputComponent {
  constructor(private readonly page: Page) {}

  async fillQuery(query: string) {
    await this.page.fill('[data-testid="input-search-query"]', query);
  }

  async clickSearch() {
    await this.page.click('[data-testid="button-search"]');
  }

  async waitForSearchComplete() {
    await this.page.waitForSelector('[data-testid="button-search"]:not([disabled])');
  }

  async search(query: string) {
    await this.fillQuery(query);
    await this.clickSearch();
    await this.waitForSearchComplete();
  }
}
