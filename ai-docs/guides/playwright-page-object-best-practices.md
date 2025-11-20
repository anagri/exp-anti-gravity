# Playwright Page Object Model Best Practices

## Overview

This guide documents best practices for implementing the Page Object Model (POM) pattern in E2E tests for this React + TypeScript chat application.

**Purpose**: Enable reliable, maintainable E2E tests that:
- Execute deterministically without flakiness
- Survive UI refactoring through stable selectors
- Provide clear test failure diagnostics
- Scale across multi-page user flows

---

## Core Principles

### 1. Exclusive `data-testid` Selector Strategy

**Principle**: Use ONLY `data-testid` attributes for test selectors. Avoid mixing with CSS classes, IDs, role selectors, or text selectors. Only add `data-testid` attributes when required by tests - do not pre-emptively add them to components.

**Why**: Separates test concerns from styling and DOM structure. UI refactoring (class changes, layout shifts) won't break tests. Adding attributes only when needed keeps components clean and test-driven.

**Good Example**:
```typescript
// Page object with consistent testid selectors
class WelcomePage {
  selectors = {
    apiKeyInput: '[data-testid="inp-welcome-apikey"]',
    startButton: '[data-testid="btn-welcome-start"]',
  }

  async fillApiKey(key: string) {
    await this.page.fill(this.selectors.apiKeyInput, key)
  }
}
```

**Bad Example - Avoid**:
```typescript
// Mixed selector strategies - FRAGILE
await page.getByPlaceholder('sk-...').fill('key')  // placeholder text
await page.getByRole('button', { name: 'Start' }).click()  // role + text
await page.locator('.btn-primary').click()  // CSS class
```

**Implementation**: Add `data-testid` only when required by tests. Do not pre-emptively add attributes to components that aren't being tested:

```tsx
// React component with testids (only added because tesats need them)
<Input
  data-testid="inp-welcome-apikey"
  placeholder="sk-..."
  type="password"
/>
<Button data-testid="btn-welcome-start">
  Start Chatting
</Button>
```

**Naming Convention**: `{component}-{context}-{action/feature}`

Component type first enables you to immediately know what HTML element to expect, followed by location and purpose:

**Format**:
- **Component**: Element type prefix (btn, inp, select, file, div, span, etc.)
- **Context**: Page or section (welcome, chat, doc, model)
- **Action/Feature**: What it does or represents (start, send, logout, upload, delete, message, apikey)

**Component Prefixes**:
```
btn-      → button
inp-      → input (text, password)
file-     → file input
select-   → select/combobox
div-      → div container
span-     → span for text display
check-    → checkbox
radio-    → radio button
```

**Examples**:
```
btn-welcome-start           → Button on Welcome page for Start action
inp-welcome-apikey          → Input on Welcome page for API key
btn-chat-send               → Button in Chat for Send action
btn-chat-logout             → Button in Chat for Logout
btn-chat-clear              → Button in Chat for Clear action
inp-chat-message            → Input in Chat for message typing
div-chat-messages           → Div container for Chat messages
div-chat-loading            → Div for Chat loading indicator
file-doc-upload             → File input for Document upload
div-doc-item-${id}          → Div for individual Document item
span-doc-filename           → Span displaying Document filename
btn-doc-delete-${id}        → Button for Document delete (with ID)
div-doc-noitems             → Div showing "no documents" message
select-chat-model           → Select/combobox for Chat model selection
```

**Rules**:
- Use kebab-case (lowercase with hyphens)
- Component prefix makes element type immediately clear
- Be specific but concise: `btn-chat-send` not `btn-1` or `button-primary-chat-send-message`
- Context helps locate: `btn-doc-delete` tells you it's in document section
- Dynamic IDs use template format: `div-doc-item-${id}` where `${id}` is replaced at runtime
- Keep action/feature names short: `send`, `logout`, `delete`, not `send-message`, `logout-user`

---

### 2. Background Processing Signal Handling

**Principle**: Wait for semantic state completion using data attributes, not just element visibility.

**Why**: Modern SPAs have async operations (API calls, streaming). Element visibility ≠ operation complete.

**Streaming Completion Pattern**:
```typescript
// Wait for chat streaming to complete
async waitForStreamingComplete() {
  // Wait for response to appear
  await expect(this.page.locator('[data-testid="div-chat-assistant-msg"]').last())
    .toBeVisible()

  // Wait for streaming indicator to disappear
  await expect(this.page.getByText('Thinking...'))
    .not.toBeVisible()
}
```

**Data Attribute State Signals** (when needed):
```tsx
// React component with state signals
<div
  data-testid="div-chat-model-container"
  data-models-loaded={models.length > 0 ? 'true' : 'false'}
>
  <select data-testid="select-chat-model">
    {models.map(model => ...)}
  </select>
</div>
```

```typescript
// Page object waits for state
async waitForModelsLoaded() {
  await this.page.waitForFunction(() => {
    const container = document.querySelector('[data-testid="div-chat-model-container"]')
    return container?.getAttribute('data-models-loaded') === 'true'
  })
}
```

**For this project**: Focus on streaming completion and models loaded state. Avoid over-engineering with too many state attributes initially.

---

### 3. Page Object Encapsulation & Composition

**Principle**: Page objects fully encapsulate page interactions. Use composition for shared components. Never expose raw page object.

**Why**: Encapsulation enables refactoring without breaking tests. Composition enables code reuse.

**Base Page Pattern**:
```typescript
export class BasePage {
  constructor(protected page: Page, protected baseUrl: string) {}

  async navigateTo(path: string) {
    await this.page.goto(`${this.baseUrl}${path}`)
  }

  async expectCurrentPath(pathname: string) {
    const url = new URL(this.page.url())
    expect(url.pathname).toBe(pathname)
  }

  async clickTestId(testId: string) {
    await this.page.click(`[data-testid="${testId}"]`)
  }

  async fillTestId(testId: string, value: string) {
    await this.page.fill(`[data-testid="${testId}"]`, value)
  }

  async getTextByTestId(testId: string) {
    return await this.page.textContent(`[data-testid="${testId}"]`)
  }
}
```

**Component Composition**:
```typescript
// Shared component
export class DocumentManagerComponent {
  constructor(private page: Page) {}

  async uploadDocument(filepath: string) {
    await this.page.setInputFiles('[data-testid="file-doc-upload"]', filepath)
  }

  async getDocumentCount() {
    return await this.page.locator('[data-testid="span-doc-filename"]').count()
  }

  async deleteDocument(id: string) {
    this.page.on('dialog', dialog => dialog.accept())
    await this.page.click(`[data-testid="btn-doc-delete-${id}"]`)
    await this.page.waitForSelector(`[data-testid="div-doc-item-${id}"]`, { state: 'detached' })
  }
}

// Page composes component
export class ChatPage extends BasePage {
  documents: DocumentManagerComponent

  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl)
    this.documents = new DocumentManagerComponent(page)
  }

  async sendMessage(message: string) {
    await this.fillTestId('inp-chat-message', message)
    await this.clickTestId('btn-chat-send')
  }
}
```

**Usage in Tests**:
```typescript
test('upload document', async ({ page }) => {
  const chatPage = new ChatPage(page, baseUrl)

  // High-level abstraction hides complexity
  await chatPage.documents.uploadDocument('e2e/files/test.md')
  expect(await chatPage.documents.getDocumentCount()).toBe(1)
})
```

---

### 4. Deterministic Waiting Strategies

**Principle**: Separate "visible" from "ready" from "completed" states. Wait for semantic state changes.

**Why**: Element visible ≠ data loaded ≠ background processing complete.

**State Hierarchy**:
1. Element exists (in DOM)
2. Element visible (CSS display/visibility)
3. Element ready (enabled, interactive)
4. Background complete (API calls, processing done)
5. State verified (correct data populated)

**Multi-Stage Waiting**:
```typescript
async sendMessageAndWaitForResponse(message: string) {
  // Stage 1: Send message
  await this.fillTestId('inp-chat-message', message)
  await this.clickTestId('btn-chat-send')

  // Stage 2: Verify user message appears
  await expect(this.page.getByText(message)).toBeVisible()

  // Stage 3: Wait for loading indicator
  await expect(this.page.getByText('Thinking...')).toBeVisible()

  // Stage 4: Wait for response to start appearing
  await expect(this.page.locator('[data-testid="div-chat-assistant-msg"]').last())
    .toBeVisible()

  // Stage 5: Wait for streaming complete
  await expect(this.page.getByText('Thinking...')).not.toBeVisible()
}
```

**Avoid hardcoded timeouts**:
```typescript
// BAD: Hardcoded wait
await page.waitForTimeout(500)

// GOOD: Wait for semantic state
await expect(page.locator('[data-testid="select-chat-model"]')).toBeVisible()
```

---

### 5. Test Reliability: No if-else, No try-catch

**Principle**: Tests must be deterministic. No conditional logic (if-else), no error handling (try-catch). Let tests fail explicitly.

**Why**: Conditional logic hides test flakiness. Error handling masks real failures.

**Good Example**:
```typescript
test('welcome screen flow', async ({ page }) => {
  const welcomePage = new WelcomePage(page, baseUrl)

  // Deterministic flow - no conditionals
  await welcomePage.navigateTo('/')
  await welcomePage.expectWelcomePageVisible()

  await welcomePage.fillApiKey('sk-valid-key')
  await welcomePage.clickStartChat()

  await welcomePage.expectCurrentPath('/chat')

  // No if-else, no try-catch
  // If anything fails, test fails at exact point
})
```

**Bad Example - Avoid**:
```typescript
test('welcome flow with conditional logic', async ({ page }) => {
  // BAD: if-else in test
  if (await page.getByText('Welcome').isVisible()) {
    await page.getByRole('button', { name: 'Start' }).click()
  }

  // BAD: try-catch hiding failures
  try {
    await page.goto('/chat')
  } catch (error) {
    await page.goto('/')  // Retry masks real issue
  }
})
```

**Exception**: `page.on('dialog')` for dialogs is acceptable in page objects:
```typescript
async deleteDocument(id: string) {
  this.page.on('dialog', dialog => dialog.accept())  // OK: handling browser dialog
  await this.clickTestId(`btn-doc-delete-${id}`)
}
```

---

### 6. Component Abstraction & Code Reuse

**Principle**: Extract shared UI components into reusable classes. Use composition to combine into pages.

**Why**: Reduces duplication, improves maintainability, creates clear abstraction layers.

**Component Hierarchy**:
```
BasePage (framework utilities)
    ├─ Navigation helpers
    ├─ URL verification
    └─ TestID helpers

Component Classes (reusable UI patterns)
    ├─ DocumentManagerComponent
    ├─ ModelSelectorComponent
    └─ ChatAreaComponent

Page Classes (compose components)
    ├─ WelcomePage
    └─ ChatPage (uses DocumentManager + ChatArea)
```

**Benefits**:
- **DRY Principle**: Logic written once, used across tests
- **Consistency**: Same interactions in different contexts
- **Testability**: Can test components in isolation
- **Maintainability**: UI changes update in one place

---

## Project Structure

```
e2e/
├─ pages/
│  ├─ BasePage.ts                    # Navigation, URL, testid helpers
│  ├─ WelcomePage.ts                 # API key input, validation
│  ├─ ChatPage.ts                    # Compose components
│  └─ components/
│     ├─ DocumentManagerComponent.ts # File upload + document list
│     ├─ ChatAreaComponent.ts        # Messages, input, send
│     └─ ModelSelectorComponent.ts   # Model selection (future)
├─ welcome.spec.ts                   # Use WelcomePage
├─ chat.spec.ts                      # Use ChatPage + components
└─ documents.spec.ts                 # Use ChatPage + DocumentManager
```

---

## Implementation Checklist

### React Component Development
- [ ] Add `data-testid` only to elements required by tests (not pre-emptively)
- [ ] Use semantic testid names following `{component}-{context}-{action/feature}` convention (`btn-chat-send` not `button1`)
- [ ] Add data attributes for background state only when needed by tests (`data-models-loaded`)

### Page Object Development
- [ ] Extend `BasePage` for common utilities
- [ ] Use composition for shared UI components
- [ ] Define selectors as object with semantic names
- [ ] Use exclusive `data-testid` selector strategy
- [ ] Encapsulate all page interactions (no leaky abstractions)
- [ ] Provide explicit methods for actions and verifications

### Test Development
- [ ] No if-else conditional logic in tests
- [ ] No try-catch error handling in tests
- [ ] Deterministic flow: action → verification → action
- [ ] Explicit assertions at each step
- [ ] Use page object methods exclusively (no direct page access)
- [ ] Clear test failure points (no silent fallbacks)

---

## Simplified Anti-Patterns for This Project

### 1. Mixed Selector Strategies
```typescript
// DON'T: Mix role, placeholder, class selectors
await page.getByPlaceholder('sk-...').fill('key')
await page.getByRole('button', { name: 'Start' }).click()

// DO: Exclusive testid
await page.fill('[data-testid="inp-welcome-apikey"]', 'key')
await page.click('[data-testid="btn-welcome-start"]')
```

### 2. Hardcoded Timeouts
```typescript
// DON'T: Hardcoded wait
await page.waitForTimeout(500)

// DO: Wait for semantic state
await expect(page.locator('[data-testid="select-chat-model"]')).toBeVisible()
```

### 3. Boolean Checks in Tests
```typescript
// DON'T: Boolean checks lead to if-else
if (await page.locator('.message').isVisible()) {
  // conditional logic
}

// DO: Explicit expectations
await expect(page.locator('[data-testid="div-chat-message"]')).toBeVisible()
```

---

## Summary

**Key Patterns for This Project**:
1. **Exclusive `data-testid` Selectors**: Never use role/placeholder/text selectors
2. **Streaming Completion**: Wait for "Thinking..." to disappear, not hardcoded timeouts
3. **Component Composition**: DocumentManager, ChatArea as reusable components
4. **Deterministic Tests**: No if-else, no try-catch in test logic
5. **BasePage Helpers**: Centralize navigation, URL checks, testid utilities

**What We're NOT Doing** (to keep it simple):
- Complex toast handling (app uses simple `alert()`)
- OAuth flows (simple localStorage API key)
- Extensive retry logic (route mocking makes tests deterministic)
- Over-engineered state signals (only where needed for streaming/async)

**Philosophy**: Start simple, add complexity only when tests show flakiness. The patterns here prevent flakiness proactively while keeping implementation lean for a small project.
