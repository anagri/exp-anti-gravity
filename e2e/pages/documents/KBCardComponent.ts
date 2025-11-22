import { Page, expect } from '@playwright/test';

/**
 * Component for individual KB card operations (expand, collapse, visibility, stats)
 * Maps to src/pages/documents/KBCard.tsx
 */
export class KBCardComponent {
  constructor(private readonly page: Page) {}

  async expand(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });

    await this.expectExpanded(kbName, false);

    const testId = await kbCard.getAttribute('data-testid');
    const kbId = testId?.replace('kb-card-', '') || null;

    await kbCard.click();

    await this.page.waitForFunction((name) => {
      const card = document.querySelector(`[data-kb-name="${name}"]`);
      return card?.getAttribute('data-expanded') === 'true';
    }, kbName);

    await this.page.waitForURL((url) => url.searchParams.get('kb') === kbId);
  }

  async collapse(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);

    // Precondition: KB must be expanded before collapsing
    await this.expectExpanded(kbName, true);

    await kbCard.click();
    await this.page.waitForFunction(
      (name) =>
        document.querySelector(`[data-kb-name="${name}"]`)?.getAttribute('data-expanded') ===
        'false',
      kbName
    );
  }

  async expectVisible(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });
  }

  async expectNotVisible(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'hidden' });
  }

  async expectExpanded(kbName: string, expanded: boolean) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });
    await expect(kbCard).toHaveAttribute('data-expanded', expanded ? 'true' : 'false');
  }

  async expectStats(kbName: string, docCount: number, chunkCount?: number) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.locator(`[data-doc-count="${docCount}"]`).waitFor({ state: 'visible' });
    if (chunkCount !== undefined) {
      await kbCard.locator(`[data-chunk-count="${chunkCount}"]`).waitFor({ state: 'visible' });
    }
  }

  async getId(kbName: string): Promise<string> {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const kbId = await kbCard.getAttribute('data-testid');
    return kbId?.replace('kb-card-', '') || '';
  }

  async expectEmptyState() {
    const emptyStateMessage = this.page.getByText('No knowledge bases yet');
    await emptyStateMessage.waitFor({ state: 'visible' });
  }

  async expectEmptyDocumentsInKB() {
    const emptyDocsMessage = this.page.getByText('No documents in this knowledge base yet');
    await emptyDocsMessage.waitFor({ state: 'visible' });
  }
}
