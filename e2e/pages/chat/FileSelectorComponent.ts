import { Page, expect } from '@playwright/test';

export class FileSelectorComponent {
  constructor(private page: Page) {}

  async expectOpen() {
    await expect(this.page.locator('[data-testid="modal-file-selector"]')).toHaveAttribute(
      'data-state',
      'open'
    );
  }

  async expectFileVisible(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    await expect(fileItem).toBeVisible();
  }

  async expectFileNotVisible(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    await expect(fileItem).not.toBeVisible();
  }

  async expectFileIndexed(filename: string, indexed: boolean) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    const status = indexed ? 'completed' : 'pending';
    await expect(fileItem).toHaveAttribute('data-indexing-status', status);
  }

  async selectFile(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    const checkbox = fileItem.locator('[type="checkbox"]');

    // Wait for checkbox to be enabled (only completed documents are selectable)
    await expect(checkbox).toBeEnabled();

    // Ensure file starts unselected (deterministic initial state)
    await expect(fileItem).toHaveAttribute('data-selected', 'false');

    // Click to select
    await checkbox.click();

    // Wait for selection to be reflected in the UI
    await expect(fileItem).toHaveAttribute('data-selected', 'true');
  }

  async confirmSelection() {
    const confirmButton = this.page.locator('[data-testid="btn-confirm-file-selector"]');
    await confirmButton.waitFor({ state: 'visible' });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
  }

  async cancel() {
    await this.page.click('[data-testid="btn-cancel-file-selector"]');
  }

  async searchFiles(query: string) {
    await this.page.fill('[data-testid="input-file-search"]', query);
  }

  async clearSearch() {
    await this.page.click('[data-testid="btn-clear-search"]');
  }

  async selectKBFilter(kbLabel: string) {
    const kbFilter = this.page.getByTestId('select-kb-filter-fileselector');
    await kbFilter.selectOption({ label: kbLabel });
  }

  async selectKBFilterById(kbId: string) {
    const kbFilter = this.page.getByTestId('select-kb-filter-fileselector');
    await kbFilter.waitFor({ state: 'visible' });
    await kbFilter.selectOption(kbId);
  }

  async expectKBFilterValue(value: string) {
    const kbFilter = this.page.getByTestId('select-kb-filter-fileselector');
    await kbFilter.waitFor({ state: 'visible' });
    await expect(kbFilter).toHaveValue(value);
  }

  async expectFileCount(count: number) {
    const docItems = this.page.locator('[data-testid^="file-selector-item-"]');
    await expect(docItems).toHaveCount(count);
  }

  async expectSelectionSummary(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async clickFileByName(filename: string) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    await fileItem.click();
  }

  async expectFileSelection(filename: string, selected: boolean) {
    const fileItem = this.page.locator(`[data-filename="${filename}"]`);
    await expect(fileItem).toHaveAttribute('data-selected', selected.toString());
  }
}
