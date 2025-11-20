import { test as base } from '@playwright/test';

export const test = base.extend<{ globalSetup: void }>({
  globalSetup: [
    async ({ page }, use) => {
      await page.goto('/');

      await page.evaluate(async () => {
        localStorage.clear();

        const databases = await indexedDB.databases();
        console.log('[globalSetup] Available databases:', databases);

        const promises = databases
          .filter(db => db.name?.includes('rag') || db.name?.includes('pglite'))
          .map(db => {
            return new Promise<void>((resolve) => {
              if (db.name) {
                console.log('[globalSetup] Deleting database:', db.name);
                const request = indexedDB.deleteDatabase(db.name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              } else {
                resolve();
              }
            });
          });

        await Promise.all(promises);
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
