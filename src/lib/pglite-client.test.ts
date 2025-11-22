import { describe, it } from 'vitest';

// Note: These tests are skipped because jsdom doesn't support Workers
// Worker functionality is tested via E2E tests instead
describe('PGlite Worker Client Singleton', () => {
  it.skip('returns same instance on multiple calls', () => {
    // Tested in E2E tests
  });

  it.skip('creates new instance after termination', () => {
    // Tested in E2E tests
  });

  it.skip('returns truthy worker client instance', () => {
    // Tested in E2E tests
  });
});
