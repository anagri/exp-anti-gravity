import { Page, expect } from '@playwright/test';

/**
 * Component for KB creation modal operations
 * Maps to src/pages/documents/CreateKBModal.tsx
 */
export class CreateKBModalComponent {
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
