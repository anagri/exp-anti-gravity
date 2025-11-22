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

## Page Objects Architecture

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

### BasePage Utilities

BasePage provides common utilities inherited by all page objects:

**Navigation & Routing:**
- `navigateTo(path)` - Navigate with basename handling
- `waitForPath(path)` - Wait for URL path
- `expectCurrentPath(pathname)` - Assert current path
- `reload()` - Page reload
- `goBack()` - Browser back navigation
- `goForward()` - Browser forward navigation

**Feature Flag Management:**
- `setFeatureFlag(flagName, enabled)` - Set feature flags via localStorage

**Element Helpers:**
- `clickTestId(testId)` - Click element by test ID
- `fillTestId(testId, value)` - Fill input by test ID
- `getTextByTestId(testId)` - Get text content by test ID
- `waitForTestId(testId, state)` - Wait for element state

```typescript
// ✅ CORRECT: Use page object methods
test.beforeEach(async ({ page }) => {
  documentsPage = new DocumentPage(page);

  // Set feature flags via page object
  await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', false);

  await documentsPage.setup(apiKey);
});

// ❌ WRONG: Direct page usage
await page.addInitScript(() => {
  localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
});
```

### Component-Based Architecture

Complex pages compose component classes following single responsibility principle:

```typescript
// Page object with components
export class ChatPage extends BasePage {
  readonly messages: MessagesComponent;
  readonly sources: SourcesComponent;
  readonly citations: CitationsComponent;
  readonly attachments: AttachmentsComponent;
  readonly modelSelector: ModelSelectorComponent;
  readonly loadingState: LoadingStateComponent;
  readonly input: ChatInputComponent;
  readonly debug: DebugComponent;
  readonly fileSelector: FileSelectorComponent;
  readonly settings: SettingsComponent;  // Shared component

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
    this.messages = new MessagesComponent(page);
    this.sources = new SourcesComponent(page);
    // ... instantiate all components
    this.settings = new SettingsComponent(page);  // Shared across pages
  }
}
```

**When to Create Components:**
1. **Logical UI Grouping** - Messages, sources, attachments are distinct UI sections
2. **Single Responsibility** - Each component handles one concern
3. **Reusability** - Multiple tests use the same interactions
4. **Complexity Threshold** - 5+ related methods warrant a component

**Component Naming:**
- Page-specific: `e2e/pages/chat/MessagesComponent.ts`
- Shared: `e2e/pages/shared/SettingsComponent.ts`
- Search: `e2e/pages/search/SearchInputComponent.ts`

**Component Structure:**
```typescript
export class MessagesComponent {
  constructor(private readonly page: Page) {}

  // Locator getters
  getAssistantAt(index: number): Locator {
    return this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(index);
  }

  // Actions
  async expectContains(index: number, text: string) {
    const content = await this.getContent(index);
    expect(content?.toLowerCase()).toContain(text.toLowerCase());
  }

  // Data extraction
  async getCitationCount(messageIndex: number): Promise<number> {
    const msg = this.getAssistantAt(messageIndex);
    return await msg.locator('[data-citation-index]').count();
  }
}
```

### Shared vs Page-Specific Components

**Shared Components** (`e2e/pages/shared/`):
- Used by multiple page objects
- Example: `SettingsComponent` (used by DocumentPage, ChatPage, WelcomePage)
- Must be stateless, no page-specific assumptions
- Import: `import { SettingsComponent } from './shared/SettingsComponent'`

**Page-Specific Components** (`e2e/pages/{pagename}/`):
- Used only by one page object
- Example: `MessagesComponent` (only ChatPage), `KnowledgeBaseComponent` (only DocumentPage)
- Can assume page context
- Import: `import { MessagesComponent } from './chat/MessagesComponent'`

### Assertion Helpers

**Use assertion helpers instead of find + throw patterns** to maintain deterministic tests without if-else/try-catch blocks.

**Pattern: Assertion Helpers Return After Asserting**

Components should provide two types of methods for nullable operations:
1. **Finder methods** - Return nullable values (e.g., `findFileByName()` returns `string | null`)
2. **Assertion helpers** - Assert existence and return non-null values (e.g., `getFileByName()` returns `string`)

```typescript
// ❌ WRONG: Manual null checking in test
const fileId = await documentsPage.documentList.findFileByName(FILENAME);
if (!fileId) throw new Error('File not found');
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

// ✅ CORRECT: Use assertion helper
const fileId = await documentsPage.documentList.card.getFileByName(FILENAME);
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');
```

**Component Implementation Pattern:**

```typescript
export class DocumentCardComponent {
  // Finder method - returns nullable
  async findFileByName(filename: string): Promise<string | null> {
    const cards = await this.page.locator('[data-testid^="div-doc-item-"]').all();
    for (const card of cards) {
      const filenameLoc = card.locator('[data-testid^="span-doc-filename-"]');
      const text = await filenameLoc.textContent();
      if (text?.includes(filename)) {
        const testId = await card.getAttribute('data-testid');
        return testId?.replace('div-doc-item-', '') || null;
      }
    }
    return null;
  }

  // Assertion helper - asserts and returns non-null
  async getFileByName(filename: string): Promise<string> {
    const fileId = await this.findFileByName(filename);
    expect(fileId, `File not found: ${filename}`).toBeTruthy();
    return fileId!;
  }
}
```

**Additional Assertion Helper Examples:**

```typescript
// DebugComponent - Assert metadata exists
async expectMetadataExists(messageIndex: number): Promise<Metadata> {
  const metadata = await this.getMetadata(messageIndex);
  expect(metadata, `Message ${messageIndex} has no metadata`).not.toBeNull();
  return metadata!;
}

async expectNoMetadata(messageIndex: number): Promise<void> {
  const metadata = await this.getMetadata(messageIndex);
  expect(metadata, `Message ${messageIndex} unexpectedly has metadata`).toBeNull();
}

// SourceCitationsComponent - Assert internally instead of returning boolean
async verifyScoreOrdering(messageIndex: number, scoreType: 'fused' | 'vector' | 'bm25'): Promise<void> {
  const scores = await this.getSourceScores(messageIndex);
  const scoreArray = scoreType === 'fused' ? scores.fusedScores :
                     scoreType === 'vector' ? scores.vectorScores :
                     scores.bm25Scores;

  for (let i = 1; i < scoreArray.length; i++) {
    expect(
      scoreArray[i],
      `${scoreType} score at index ${i} (${scoreArray[i]}) is greater than previous (${scoreArray[i - 1]})`
    ).toBeLessThanOrEqual(scoreArray[i - 1]);
  }
}
```

**When to Use Assertion Helpers:**
- Replace `if (!value) throw new Error()` patterns
- Replace methods returning boolean for assertions
- Operations that should always succeed in valid test scenarios
- Provide clear error messages with context (message index, filename, etc.)

**Benefits:**
- Tests remain deterministic (no if-else/try-catch)
- Clear error messages when assertions fail
- Type safety (non-null return values)
- Reusable across multiple tests

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

**Zero `page.*` Tolerance:**
- Tests should only use `page` parameter for page object constructors
- All `page.click()`, `page.fill()`, `page.waitFor*()` calls violate encapsulation
- All `page.locator()`, `page.getByTestId()` calls belong in page objects
- Navigation: Use `pageObject.reload()` instead of `page.reload()`
- Feature flags: Use `pageObject.setFeatureFlag()` instead of `page.addInitScript()`

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

// ✅ CORRECT: Even better with component
await documentsPage.knowledgeBase.create('KB A');
```

**Backward Compatibility During Migration:**
When refactoring, keep wrapper methods temporarily:

```typescript
// DocumentPage delegates to component
async createKB(name: string, description?: string) {
  await this.knowledgeBase.create(name, description);
}

async expandKB(kbName: string) {
  await this.knowledgeBase.expand(kbName);
}
```

Tests can use either:
- `documentsPage.createKB('KB A')` - Convenience wrapper
- `documentsPage.knowledgeBase.create('KB A')` - Direct component access

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
- Update component structure if UI sections change

## Refactoring Strategy

### Phase-Based Refactoring

**Phase 1: Create Components** (no test changes)
```typescript
// Create e2e/pages/documents/KnowledgeBaseComponent.ts
export class KnowledgeBaseComponent {
  constructor(private readonly page: Page) {}
  async create(name: string, description?: string) { /* ... */ }
  async expand(kbName: string) { /* ... */ }
  // Extract all KB-related logic from DocumentPage
}
```

**Phase 2: Integrate into Page Object** (backward compatible)
```typescript
// DocumentPage.ts
export class DocumentPage extends BasePage {
  readonly knowledgeBase: KnowledgeBaseComponent;

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
    this.knowledgeBase = new KnowledgeBaseComponent(page);
  }

  // Keep wrapper methods for backward compatibility
  async createKB(name: string, description?: string) {
    await this.knowledgeBase.create(name, description);
  }
}
```

**Phase 3: Update Tests** (one test at a time)
```typescript
// Before
await page.getByTestId('btn-create-kb').click();
// ... 10 lines of direct page usage

// After
await documentsPage.createKB('KB A');
// or
await documentsPage.knowledgeBase.create('KB A');
```

**Phase 4: Run Tests** (verify no regressions)
```bash
npm run test:e2e:all
```

**Phase 5: Next Test** (repeat phases 3-4)

### Refactoring Checklist

Before starting:
- ✅ Identify direct `page.*` violations in tests
- ✅ Group related violations (messages, sources, KB operations, etc.)
- ✅ Plan component structure (one component per logical group)

During refactoring:
- ✅ Create components first (no test changes)
- ✅ Integrate into page object with backward-compatible wrappers
- ✅ Update one test at a time
- ✅ Run test after each update (catch regressions immediately)
- ✅ Run full suite before committing

After refactoring:
- ✅ All tests passing
- ✅ Zero direct `page.*` usage in tests
- ✅ Logical commits (component creation → integration → test updates)

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
await documentsPage.waitForDBInitialized();
// Internally: await page.waitForSelector('[data-db-initialized="true"]');

// Upload complete
await documentsPage.uploadFilesAndWait(fileName, fileContent);
// Internally: waits for data-uploading="false"

// KB expansion
await documentsPage.expandKB('KB Name');
// Internally: waits for data-expanded="true"

// Loading states
await chatPage.loadingState.waitForThinkingToDisappear();
// Internally: waits for thinking indicator to be hidden
```

### When Adding Background Operations

Always expose completion state via data attributes:
- `data-db-initialized="true|false"`
- `data-uploading="true|false"`
- `data-indexing-status="completed|failed"` (not "processing")
- `data-loading="true|false"` for async button operations
- Use boolean flags for completion, avoid intermediate states

**Example - Add loading state to button:**
```tsx
// Component
<Button
  data-testid="btn-refresh-models"
  data-loading={isLoadingModels.toString()}
>
  Refresh Models
</Button>

// Page object method
async refreshModels() {
  await this.page.getByTestId('btn-refresh-models').click();
  await this.page.waitForSelector('[data-testid="btn-refresh-models"][data-loading="true"]');
  await this.page.waitForSelector('[data-testid="btn-refresh-models"][data-loading="false"]');
}
```

## Selectors & Assertions

**Use `data-testid`** (preferred) or semantic selectors:
```typescript
await page.getByTestId('btn-create-kb').click();
await page.getByRole('button', { name: 'Start' }).click();  // acceptable
```

**Never CSS selectors** like `.btn-primary` or generic locators.

**Assertion order:** `expect(actual).toBe(expected)` (JUnit convention)

## Test Setup

### Fixtures

```typescript
import { test, expect } from './fixtures/globalSetup';
import { TEST_FILES, FILE_NAMES } from '../fixtures/test-files';
import { PG_ESSAYS, PG_ESSAY_NAMES } from '../fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';
```

### Test Organization

**Feature-Based Structure:**
```
e2e/
├── chat/              # Chat page tests
│   ├── auth.spec.ts
│   ├── hybrid-search.spec.ts
│   ├── kb-file-selector.spec.ts
│   └── rag-multi-file.spec.ts
├── documents/         # Documents page tests
│   ├── bm25-search.spec.ts
│   ├── file-upload.spec.ts
│   ├── indexing.spec.ts
│   └── kb-crud.spec.ts
├── settings/          # Settings tests
│   └── settings.spec.ts
└── pages/             # Page objects
    ├── BasePage.ts
    ├── ChatPage.ts
    ├── DocumentPage.ts
    ├── SearchPage.ts
    ├── chat/          # Chat components
    ├── documents/     # Documents components
    ├── search/        # Search components
    └── shared/        # Shared components
```

### Live Tests

Tag with `@live` (hits real OpenAI API, costs money):
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
- To avoid automatic trigger, use `FEATURE_INDEXING_ENABLED` feature flag:
  - `false` - Disable automatic indexing (use for file upload tests only)
  - `true` - Enable automatic indexing (use for indexing and RAG flow tests)
  - Default: `true` if not set
- Test targets in `package.json`:
  - `npm run test:e2e` - Run non-live tests only (--grep-invert @live)
  - `npm run test:e2e:live` - Run live tests only (--grep @live)
  - `npm run test:e2e:all` - Run all tests
- For single test debug/fix: `npx playwright test e2e/test-file.spec.ts` (no grep flags)

### Feature Flags

**✅ CORRECT: Use page object method**
```typescript
test.beforeEach(async ({ page }) => {
  documentsPage = new DocumentPage(page);

  // Disable indexing for this test (faster, UI-only)
  await documentsPage.setFeatureFlag('FEATURE_INDEXING_ENABLED', false);

  await documentsPage.setup(apiKey);
});
```

**❌ WRONG: Direct page usage**
```typescript
await page.addInitScript(() => {
  localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false');
});
```

### Separate Test Files for Different Setups

When features require different configurations, create separate test files:
- `kb-crud.spec.ts`: Tests with indexing disabled (faster, UI-only)
- `indexing.spec.ts`: Tests with indexing enabled (requires API, slower)

## Common Workflow Patterns

### KB Management

```typescript
await documentsPage.createKB('KB Name', 'Description');
await documentsPage.expectKBVisible('KB Name');
await documentsPage.expandKB('KB Name');
await documentsPage.uploadFilesToKB('KB Name', [TEST_FILES.DOC_01_MD]);
await documentsPage.expectKBStats('KB Name', 1);
```

### Upload & Index

```typescript
await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
await documentsPage.documentList.waitForFileToAppear(FILENAME);
const fileId = await documentsPage.documentList.findFileByName(FILENAME);
await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');
```

### Chat with RAG

```typescript
await chatPage.clickAttachButton();
await chatPage.fileSelector.expectOpen();
await chatPage.fileSelector.selectFile(FILENAME);
await chatPage.fileSelector.confirmSelection();
await chatPage.expectAttachmentBadges(1);
await chatPage.sendMessage('query');
await chatPage.waitForAssistantResponse();

// Verify sources
await chatPage.sources.expectCount(3);
await chatPage.sources.expectScoreOrdering(0, 'fused');
```

### Persistence

**✅ CORRECT: Use page object reload**
```typescript
const preReload = await documentsPage.documentList.getChunkCount(fileId);
await documentsPage.reload();
await documentsPage.waitForDBInitialized();
const postReload = await documentsPage.documentList.getChunkCount(fileId);
expect(postReload).toBe(preReload);
```

**❌ WRONG: Direct page reload**
```typescript
await page.reload();
```

### Search

```typescript
await searchPage.navigateAndWaitForReady();
await searchPage.kbSelector.selectKB(kbId);
await searchPage.input.search('equity');
await searchPage.results.expectResultsGreaterThan(0);
await searchPage.results.expectFirstResultContains('equity');
await searchPage.results.expectFirstResultScoreGreaterThan(0);
```

### Settings

```typescript
await documentsPage.settings.open();
await documentsPage.settings.expectModalVisible();
await documentsPage.settings.toggleFeatureFlag('FEATURE_INDEXING_ENABLED');
await documentsPage.settings.expectReloadWarning();
await documentsPage.settings.setSearchSetting('VECTOR_TOP_K', '5');
await documentsPage.settings.close();
```

## Quick Reference

### Test Organization
- Search existing tests before creating new files, add phases to existing tests when possible
- Feature-based folders: `e2e/chat/`, `e2e/documents/`, `e2e/settings/`
- **Preserve coverage**: Don't remove test scenarios when refactoring; if unsure, ask user
- **Stop and ask**: If unable to fix due to app bugs, stop and ask user - don't skip/remove tests
- Separate test files for different setups (indexing on/off, @live vs mocked)

### Page Objects
- **All page objects**: Never direct `page.*` in tests, encapsulate all interactions
- **Component-based**: Break complex pages into focused components
- **Shared components**: Use `e2e/pages/shared/` for cross-page components
- **BasePage utilities**: Use `setFeatureFlag()`, `reload()`, `goBack()`, `goForward()`
- Keep page objects synced with UI (remove old, add new elements)

### Best Practices
- **Group patterns**: Extract repeated find → action → wait into single methods
- **No inline timeouts**: Use framework defaults, configure globally if needed
- **Zero page.* in tests**: All interactions through page objects
- Phase naming: kebab-case with → notation (`validation → lifecycle → persistence`)
- State waiting: use data attributes, never `waitForTimeout`, test final states only
- Always add UI indicators for background ops (`data-loading`, `data-indexing-status`)
- Selectors: prefer `data-testid`, never CSS selectors
- **Deterministic**: NO if-else, NO try-catch, NO fallback logic, NO arbitrary timeouts
- Tag `@live` for tests hitting real APIs
- Assertion order: `expect(actual).toBe(expected)`

### Refactoring
- Phase-based: components → integration → tests → verify
- One test at a time with immediate verification
- Backward-compatible wrappers during migration
- Run full suite before committing
- Logical commits: separate component creation, integration, and test updates

## E2E/App Consistency Guidelines

**Maintain alignment between E2E page objects and app components:**

**Component Naming:**
- E2E components add `Component` suffix: `{AppComponentName}Component.ts`
- Example: `AttachmentBadges.tsx` → `AttachmentBadgesComponent.ts`
- Composite components describe aggregated functionality clearly

**Structure Alignment:**
- Mirror app page folder structure where logical
- Page-specific: `e2e/pages/{page}/ComponentName.ts`
- Shared: `e2e/pages/shared/` maps to `src/components/`

**Granularity Principles:**
- Follow app component granularity (fine-grained preferred)
- May compose sub-components for complex UI sections
- Use composition over large monolithic components
- Document aggregation in comments when combining multiple app components

**Component Mapping:**
- Add mapping comment: `// Maps to src/pages/[path]/Component.tsx`
- Maintain 1:1 relationships where possible
- Document aggregations clearly (e.g., DocumentListComponent composes Card + StatusBadge + Progress)

**When App Changes:**
- New app component extracted → create matching E2E component
- App component split → split E2E component to match
- App component merged → merge E2E components
- Add backward-compatible wrapper methods in parent page object during transition

**Composition Pattern:**
```typescript
export class CompositeComponent {
  readonly subComponent1: SubComponent1;
  readonly subComponent2: SubComponent2;

  constructor(page: Page) {
    this.subComponent1 = new SubComponent1(page);
    this.subComponent2 = new SubComponent2(page);
  }

  // Backward-compatible wrappers
  async delegatedMethod() {
    await this.subComponent1.method();
  }
}
```
