# E2E Test Page Objects

This file provides guidance for working with Playwright page objects in this repository.

## Base Path Configuration

The app uses `/exp-anti-gravity` as the base path for both local development and GitHub Pages deployment. This is configured in:
- `vite.config.ts`: `base: '/exp-anti-gravity/'`
- `src/App.tsx`: `basename="/exp-anti-gravity"`

## Page Object Pattern

All page objects MUST extend `BasePage` which encapsulates basename handling. **Never** hardcode URLs or duplicate the basename.

## BasePage (e2e/pages/BasePage.ts)

```typescript
export class BasePage {
  protected readonly basename = '/exp-anti-gravity';

  async navigateTo(path: string) {
    await this.page.goto(`${this.baseUrl}${this.basename}${path}`);
  }

  async waitForPath(path: string) {
    const expectedPath = `${this.basename}${path}`;
    await this.page.waitForURL(url => url.pathname === expectedPath);
  }

  async expectCurrentPath(pathname: string) {
    const url = new URL(this.page.url());
    expect(url.pathname).toBe(`${this.basename}${pathname}`);
  }
}
```

## Creating Page Objects

```typescript
// ✅ CORRECT: Extend BasePage
export class MyPage extends BasePage {
  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  async goToSettings() {
    await this.navigateTo('/settings');     // Uses basename automatically
    await this.waitForPath('/settings');     // Uses basename automatically
  }
}

// ❌ WRONG: Don't duplicate basename
export class MyPage {
  async goToSettings() {
    await this.page.goto('/exp-anti-gravity/settings');  // DON'T DO THIS
    await this.page.waitForURL('/exp-anti-gravity/settings');  // DON'T DO THIS
  }
}
```

## Test Usage

```typescript
const myPage = new MyPage(page, 'http://127.0.0.1:4173');
await myPage.navigateTo('/about');  // Goes to /exp-anti-gravity/about
await myPage.waitForPath('/about'); // Waits for /exp-anti-gravity/about
```

## Test Best Practices

- Never use `waitForTimeout` in e2e tests
- Instead, update UI elements or attributes like `data-test-state="ready|pending|processing|busy|etc."`
- Wait for state to be ready before assertions
- Use `getByTestId` for selecting elements (better than selectors that can change)
- For tests only, use `console.log` for error scenarios
- No `if-else` in tests - tests should be deterministic
- No `try-catch` in tests - let errors throw and tests fail
