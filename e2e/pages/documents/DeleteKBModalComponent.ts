import { Page } from '@playwright/test';

/**
 * Component for KB deletion modal operations
 * Maps to src/pages/documents/DeleteKBModal.tsx
 */
export class DeleteKBModalComponent {
  constructor(private readonly page: Page) {}

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
}
