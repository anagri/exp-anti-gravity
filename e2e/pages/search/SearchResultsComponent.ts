import { Page, Locator, expect } from '@playwright/test';

export class SearchResultsComponent {
  constructor(private readonly page: Page) {}

  getResults(): Locator {
    return this.page.locator('[data-testid^="div-search-result-"]');
  }

  getFirstResult(): Locator {
    return this.getResults().first();
  }

  async getResultCount(): Promise<number> {
    return await this.getResults().count();
  }

  async expectResultCount(count: number) {
    await expect(this.getResults()).toHaveCount(count);
  }

  async expectResultsGreaterThan(count: number) {
    const resultCount = await this.getResultCount();
    expect(resultCount).toBeGreaterThan(count);
  }

  async getFirstResultContent(): Promise<string | null> {
    const content = await this.getFirstResult()
      .locator('[data-testid="text-result-content"]')
      .textContent();
    return content;
  }

  async expectFirstResultContains(text: string) {
    const content = await this.getFirstResultContent();
    expect(content?.toLowerCase()).toContain(text.toLowerCase());
  }

  async getFirstResultScore(): Promise<number> {
    const score = await this.getFirstResult().getAttribute('data-result-score');
    return parseFloat(score || '0');
  }

  async expectFirstResultScoreGreaterThan(minScore: number) {
    const score = await this.getFirstResultScore();
    expect(score).toBeGreaterThan(minScore);
  }

  async expectEmptyState() {
    await this.page.waitForSelector('[data-testid="div-search-empty"]');
  }

  async expectEmptyMessage(message: string) {
    await this.expectEmptyState();
    const emptyMessage = await this.page.locator('[data-testid="div-search-empty"]').textContent();
    expect(emptyMessage).toContain(message);
  }
}
