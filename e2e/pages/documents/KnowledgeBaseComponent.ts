import { Page } from '@playwright/test';
import { KBCardComponent } from './KBCardComponent';
import { CreateKBModalComponent } from './CreateKBModalComponent';
import { DeleteKBModalComponent } from './DeleteKBModalComponent';

/**
 * Composite component for all KB operations
 * Delegates to: KBCardComponent, CreateKBModalComponent, DeleteKBModalComponent
 */
export class KnowledgeBaseComponent {
  readonly card: KBCardComponent;
  readonly createModal: CreateKBModalComponent;
  readonly deleteModal: DeleteKBModalComponent;

  constructor(private readonly page: Page) {
    this.card = new KBCardComponent(page);
    this.createModal = new CreateKBModalComponent(page);
    this.deleteModal = new DeleteKBModalComponent(page);
  }

  // Backward-compatible wrapper methods delegate to sub-components

  async create(name: string, description?: string) {
    await this.createModal.create(name, description);
  }

  async expand(kbName: string) {
    await this.card.expand(kbName);
  }

  async collapse(kbName: string) {
    await this.card.collapse(kbName);
  }

  async delete(kbName: string) {
    await this.deleteModal.delete(kbName);
  }

  async expectVisible(kbName: string) {
    await this.card.expectVisible(kbName);
  }

  async expectNotVisible(kbName: string) {
    await this.card.expectNotVisible(kbName);
  }

  async expectExpanded(kbName: string, expanded: boolean) {
    await this.card.expectExpanded(kbName, expanded);
  }

  async expectStats(kbName: string, docCount: number, chunkCount?: number) {
    await this.card.expectStats(kbName, docCount, chunkCount);
  }

  async expectEmptyState() {
    await this.card.expectEmptyState();
  }

  async expectEmptyDocumentsInKB() {
    await this.card.expectEmptyDocumentsInKB();
  }

  async getId(kbName: string): Promise<string> {
    return await this.card.getId(kbName);
  }

  async expectDuplicateError(name: string) {
    await this.createModal.expectDuplicateError(name);
  }
}
