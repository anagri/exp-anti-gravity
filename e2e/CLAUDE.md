# E2E Testing Guide

## Core Principles

1. **Prefer Fewer Tests**: Combine steps that align naturally. Search existing tests before creating new files. Add phases to existing tests when possible.
2. **Phase-Based**: Use kebab-case identifiers and arrow notation: `Phase validation → lifecycle → persistence`
3. **Page Objects Only**: Never direct `page.*` calls in tests. Extend `BasePage` for all page objects. Encapsulate all interactions in page object methods.
4. **Deterministic Tests**:
   - **NO `if-else` statements** - Tests should follow a single, predictable path
   - **NO `try-catch` blocks** - Let errors throw and tests fail with clear stack traces
   - **NO fallback logic** - Don't work around flaky conditions, fix the root cause
   - **NO arbitrary timeouts** - Use state-based waiting with data attributes
   - Use `console.log` for debugging only
5. **Final States Only**: Test completion states, not intermediate states (timing issues).
6. **Preserve Coverage**: When refactoring/consolidating tests, ensure no test scenarios are lost. If feature requires different setup (e.g., indexing enabled vs disabled), create separate test files. When uncertain, ask user before removing coverage.
7. **Stop and Ask**: If unable to fix test due to application bugs or missing functionality, stop implementation and present issue to user for direction. Do NOT skip tests or remove coverage without approval.

## Phase Structure

```typescript
// Inline arrow notation
test('Phase validation → lifecycle → persistence', async ({ page }) => {
  // Phase validation: ...
  // Phase lifecycle: ...
  // Phase persistence: reload and verify
});

// Complex workflows use separators
// ─────────────────────────────────────────────────────────
// PHASE 1: Upload & Index
// ─────────────────────────────────────────────────────────
```

## Page Objects

### Must Extend BasePage

All page objects extend `BasePage` (handles `/exp-anti-gravity` basename automatically).

```typescript
// ✅ Test usage
const documentsPage = new DocumentPage(page);
await documentsPage.setup();
await documentsPage.navigateTo('/documents');  // basename added automatically

// ❌ Never hardcode URLs
await page.goto('/exp-anti-gravity/documents');
```

### Encapsulation Rules

**Never use `page.*` directly in tests** - all interactions must go through page objects:

```typescript
// ❌ WRONG: Direct page usage in test
test('upload file', async ({ page }) => {
  const uploadInput = page.locator('[data-testid="file-upload-input"]');
  await uploadInput.setInputFiles(TEST_FILES.DOC_01_MD);
  await page.waitForFunction(() => {
    const container = document.querySelector('[data-uploading]');
    return container?.getAttribute('data-uploading') === 'false';
  });
  await page.waitForSelector(`text=${FILE_NAMES.DOC_01_MD}`, { timeout: 10000 });
});

// ✅ CORRECT: Encapsulated in page object
test('upload file', async ({ page }) => {
  await documentsPage.uploadFilesToKBAndWait('KB A', TEST_FILES.DOC_01_MD, FILE_NAMES.DOC_01_MD);
});
```

### Extract Repeated Patterns

**Group find → action → wait patterns** into single methods:

```typescript
// ❌ WRONG: Repeated pattern in test
await page.getByTestId('btn-create-kb').click();
const modal = page.getByTestId('modal-create-kb');
await modal.waitFor({ state: 'visible' });
await page.getByTestId('input-kb-name').fill('KB A');
await page.getByTestId('btn-create-kb-submit').click();
await modal.waitFor({ state: 'hidden' });

// ✅ CORRECT: Single method encapsulates entire flow
await documentsPage.createKB('KB A');
```

### No Inline Timeouts

**Use framework default timeouts** - don't specify timeout parameter:

```typescript
// ❌ WRONG: Inline timeout
await page.waitForSelector(`text=${EQUITY_FILENAME}`, { timeout: 10000 });
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed', 120000);

// ✅ CORRECT: Use framework defaults
await page.waitForSelector(`text=${EQUITY_FILENAME}`);
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');
```

**Configure timeouts globally** in `playwright.config.ts` if needed.

### Keep in Sync with UI

When UI changes, update page objects:
- Remove methods for removed elements
- Add methods for new elements
- Update selectors when testids change

### Component Pattern

Complex pages compose component classes:
```
DocumentPage extends BasePage
  ├── uploadZone: UploadZoneComponent
  ├── documentList: DocumentListComponent
  └── deleteModal: DeleteModalComponent
```

## State-Based Waiting

**Never use `waitForTimeout`**. Always add UI data attributes for background operations.

### Test Final States Only

```typescript
// ❌ WRONG: Intermediate state timing issues
await page.waitForSelector('[data-indexing-status="processing"]');

// ✅ CORRECT: Test final state only
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');
```

### Common Patterns

```typescript
// DB initialized
await page.waitForSelector('[data-db-initialized="true"]');

// Upload complete
await page.waitForFunction(() =>
  document.querySelector('[data-uploading]')?.getAttribute('data-uploading') === 'false'
);

// KB expansion
await page.waitForFunction((name) =>
  document.querySelector(`[data-kb-name="${name}"]`)?.getAttribute('data-expanded') === 'true',
  'KB Name'
);
```

### When Adding Background Operations

Always expose completion state via data attributes:
- `data-db-initialized="true|false"`
- `data-uploading="true|false"`
- `data-indexing-status="completed|failed"` (not "processing")
- Use boolean flags for completion, avoid intermediate states

## Selectors & Assertions

**Use `data-testid`** (preferred) or semantic selectors:
```typescript
await page.getByTestId('btn-create-kb').click();
await page.getByRole('button', { name: 'Start' }).click();  // acceptable
```

**Never CSS selectors** like `.btn-primary` or generic locators.

**Assertion order:** `expect(actual).toBe(expected)` (JUnit convention)

## Test Setup

**Fixtures:**
```typescript
import { test, expect } from './fixtures/globalSetup';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';
```

**Live Tests:** Tag with `@live` (hits real OpenAI API, costs money):
```typescript
test.describe('Indexing Workflow @live', () => {
  test.beforeAll(() => { apiKey = loadTestApiKey(); });
  // ...
});
```

**About @live Tests:**
- `@live` tests hit real OpenAI APIs (chat completions + embeddings) and cost money
- Tests without `@live` tag do not hit OpenAI APIs
- Embedding pipeline automatically triggers when uploading files
- To avoid automatic trigger, use `feature-flag-FEATURE_INDEXING_ENABLED` setting:
  - `false` - Disable automatic indexing (use for file upload tests only)
  - `true` - Enable automatic indexing (use for indexing and RAG flow tests)
  - Default: `true` if not set
- Test targets in `package.json`:
  - `npm run test:e2e` - Run non-live tests only (--grep-invert @live)
  - `npm run test:e2e:live` - Run live tests only (--grep @live)
  - `npm run test:e2e:all` - Run all tests
- For single test debug/fix: `npx playwright test e2e/test-file.spec.ts` (no grep flags)

**Feature Flags:** Set in `beforeEach` via `addInitScript`:
```typescript
await page.addInitScript(() => {
  localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
});
```

**Separate Test Files for Different Setups:**
When features require different configurations, create separate test files:
- `kb-workflow.spec.ts`: Tests with indexing disabled (faster, UI-only)
- `kb-workflow-live.spec.ts`: Tests with indexing enabled (requires API, slower)

## Common Workflow Patterns

**KB Management:**
```typescript
await documentsPage.createKB('KB Name', 'Description');
await documentsPage.expandKB('KB Name');
await documentsPage.uploadFilesToKB('KB Name', [TEST_FILES.DOC_01_MD]);
```

**Upload & Index:**
```typescript
await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
await documentsPage.documentList.waitForFileToAppear(FILENAME);
const fileId = await documentsPage.documentList.findFileByName(FILENAME);
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');
```

**Chat with RAG:**
```typescript
await chatPage.clickAttachButton();
await chatPage.fileSelector.selectFile(FILENAME);
await chatPage.fileSelector.confirmSelection();
await chatPage.sendMessage('query');
await chatPage.waitForAssistantResponse();
```

**Persistence:**
```typescript
const preReload = await documentsPage.getSomeState();
await page.reload();
await documentsPage.waitForDBInitialized();
const postReload = await documentsPage.getSomeState();
expect(postReload).toBe(preReload);
```

## Quick Reference

- Search existing tests before creating new files, add phases to existing tests when possible
- **Preserve coverage**: Don't remove test scenarios when refactoring; if unsure, ask user
- **Stop and ask**: If unable to fix due to app bugs, stop and ask user - don't skip/remove tests
- Separate test files for different setups (indexing on/off, @live vs mocked)
- Keep page objects synced with UI (remove old, add new elements)
- **All page objects**: Never direct `page.*` in tests, encapsulate all interactions
- **Group patterns**: Extract repeated find → action → wait into single methods
- **No inline timeouts**: Use framework defaults, configure globally if needed
- Phase naming: kebab-case with → notation (`validation → lifecycle → persistence`)
- State waiting: use data attributes, never `waitForTimeout`, test final states only
- Always add UI indicators for background ops
- Selectors: prefer `data-testid`, never CSS selectors
- **Deterministic**: NO if-else, NO try-catch, NO fallback logic, NO arbitrary timeouts
- Tag `@live` for tests hitting real APIs
