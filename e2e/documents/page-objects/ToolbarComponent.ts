import { Page } from '@playwright/test';

export class ToolbarComponent {
  constructor(private page: Page) {}

  async search(query: string) {
    await this.page.fill('[data-testid="inp-doc-search"]', query);
  }

  async clearSearch() {
    await this.page.click('[data-testid="btn-doc-search-clear"]');
  }

  async sort(optionValue: string) {
    await this.page.selectOption('[data-testid="select-doc-sort"]', optionValue);
  }

  async filter(optionValue: string) {
    await this.page.selectOption('[data-testid="select-doc-filter"]', optionValue);
  }
}
