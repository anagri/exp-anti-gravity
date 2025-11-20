import { Page } from '@playwright/test';

export class UploadZoneComponent {
  constructor(private page: Page) {}

  async uploadFiles(filePaths: string | string[]) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    await this.page.setInputFiles('[data-testid="file-upload-input"]', paths);
  }

  async browseFiles(filePaths: string | string[]) {
    await this.page.click('[data-testid="btn-upload-browse"]');
    await this.uploadFiles(filePaths);
  }
}
