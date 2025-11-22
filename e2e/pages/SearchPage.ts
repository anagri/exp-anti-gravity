import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { SearchInputComponent } from './search/SearchInputComponent';
import { SearchResultsComponent } from './search/SearchResultsComponent';
import { KBSelectorComponent } from './search/KBSelectorComponent';

export class SearchPage extends BasePage {
  readonly input: SearchInputComponent;
  readonly results: SearchResultsComponent;
  readonly kbSelector: KBSelectorComponent;

  constructor(page: Page, baseUrl: string = 'http://127.0.0.1:4173') {
    super(page, baseUrl);
    this.input = new SearchInputComponent(page);
    this.results = new SearchResultsComponent(page);
    this.kbSelector = new KBSelectorComponent(page);
  }

  async navigate() {
    await this.navigateTo('/search');
    await this.waitForPath('/search');
  }

  async waitForReady() {
    await this.page.waitForSelector('[data-testid="input-search-query"]');
    await this.waitForLunrReady();
  }

  async waitForLunrReady() {
    await this.page.waitForFunction(() =>
      document.querySelector('[data-lunr-ready="true"]') !== null
    );
  }

  async navigateAndWaitForReady() {
    await this.navigate();
    await this.waitForReady();
  }
}
