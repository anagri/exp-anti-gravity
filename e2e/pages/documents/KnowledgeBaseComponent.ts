import { Page, expect } from '@playwright/test';

export class KnowledgeBaseComponent {
  constructor(private readonly page: Page) {}

  async create(name: string, description?: string) {
    const createButton = this.page.getByTestId('btn-create-kb');
    await createButton.click();

    const modal = this.page.getByTestId('modal-create-kb');
    await modal.waitFor({ state: 'visible' });

    const nameInput = this.page.getByTestId('input-kb-name');
    await nameInput.fill(name);

    if (description) {
      const descriptionTextarea = this.page.getByTestId('textarea-kb-description');
      await descriptionTextarea.fill(description);
    }

    const submitButton = this.page.getByTestId('btn-create-kb-submit');
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    await modal.waitFor({ state: 'hidden' });

    const kbCard = this.page.locator(`[data-kb-name="${name}"]`);
    await kbCard.waitFor({ state: 'visible' });
  }

  async expand(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    await kbCard.waitFor({ state: 'visible' });

    await this.expectExpanded(kbName, false);

    const testId = await kbCard.getAttribute('data-testid');
    const kbId = testId?.replace('kb-card-', '') || null;

    await kbCard.click();

    await this.page.waitForFunction(
      (name) => {
        const card = document.querySelector(`[data-kb-name="${name}"]`);
        return card?.getAttribute('data-expanded') === 'true';
      },
      kbName
    );

    await this.page.waitForURL(url => url.searchParams.get('kb') === kbId);
  }

  async collapse(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const isExpanded = await kbCard.getAttribute('data-expanded');

    if (isExpanded === 'true') {
      await kbCard.click();
      await this.page.waitForFunction(
        (name) => document.querySelector(`[data-kb-name="${name}"]`)?.getAttribute('data-expanded') === 'false',
        kbName
      );
    }
  }

  async delete(kbName: string) {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const kbId = (await kbCard.getAttribute('data-testid'))?.replace('kb-card-', '');

    const moreButton = kbCard.getByRole('button', { name: '' }).last();
    await moreButton.click();

    const deleteButton = this.page.getByTestId(`btn-delete-kb-${kbId}`);
    await deleteButton.click();

    const deleteModal = this.page.getByTestId('modal-delete-kb');
    await deleteModal.waitFor({ state: 'visible' });

    const confirmButton = this.page.getByTestId('btn-delete-kb-confirm');
    await confirmButton.click();

    await deleteModal.waitFor({ state: 'hidden' });
    await kbCard.waitFor({ state: 'hidden' });
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

  async expectEmptyState() {
    const emptyStateMessage = this.page.getByText('No knowledge bases yet');
    await emptyStateMessage.waitFor({ state: 'visible' });
  }

  async expectEmptyDocumentsInKB() {
    const emptyDocsMessage = this.page.getByText('No documents in this knowledge base yet');
    await emptyDocsMessage.waitFor({ state: 'visible' });
  }

  async getId(kbName: string): Promise<string> {
    const kbCard = this.page.locator(`[data-kb-name="${kbName}"]`);
    const kbId = await kbCard.getAttribute('data-testid');
    return kbId?.replace('kb-card-', '') || '';
  }

  async expectDuplicateError(name: string) {
    await this.page.getByTestId('btn-create-kb').click();
    const modal = this.page.getByTestId('modal-create-kb');
    await modal.waitFor({ state: 'visible' });
    await this.page.getByTestId('input-kb-name').fill(name);
    await this.page.getByTestId('btn-create-kb-submit').click();

    await expect(modal.getByText(/already exists/i)).toBeVisible();

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await modal.waitFor({ state: 'hidden' });
  }
}
