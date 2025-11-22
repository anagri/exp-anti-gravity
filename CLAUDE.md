# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React + TypeScript chat application using OpenAI API with streaming chat completions, built with Vite. Uses shadcn/ui components with Tailwind CSS v4.

## Architecture

### State Management
- **ApiKeyContext** (`src/contexts/ApiKeyContext.tsx`): Manages OpenAI API key in localStorage
- **useChat** hook (`src/hooks/useChat.ts`): Handles chat state, OpenAI streaming API calls, model selection

### Routing
- `/` - WelcomePage: API key input
- `/chat` - ChatPage: Protected route, requires API key to access

### Key Technical Details
- OpenAI SDK configured with `dangerouslyAllowBrowser: true` for client-side usage
- Streaming responses handled via OpenAI's streaming API
- Model selection persisted in localStorage
- MSW (Mock Service Worker) used for testing API calls (`src/mocks/`)

## Commands

### Development
```bash
npm run dev          # Start dev server at http://127.0.0.1:5173
npm run build        # TypeScript compilation + Vite build
npm run preview      # Preview production build at http://127.0.0.1:4173
npm run lint         # ESLint with TypeScript
```

### Testing
```bash
npm test             # Run Vitest unit tests
npm run test:e2e     # Run Playwright e2e tests (excludes @live tagged tests)
npm run test:e2e:live # Run live e2e tests only (hits real OpenAI API, costs money)
```

**Live Tests:**
- Tests tagged with `@live` hit real OpenAI API and cost money
- Regular `test:e2e` excludes these via `--grep-invert @live`
- Use `test:e2e:live` to run only live tests via `--grep @live`
- Live tests use Paul Graham essays from `e2e/fixtures/files/`
- Example: `test.describe('Indexing Workflow @live', () => { ... })`

#### Running Single Tests
```bash
npx vitest run src/path/to/test.test.ts        # Single unit test file
npx playwright test e2e/welcome.spec.ts         # Single e2e test file
```

### Test Configuration
- **Vitest**: Uses jsdom environment, setup at `src/test/setup.ts` with MSW server
- **Playwright**: Runs against preview server (port 4173), tests in `e2e/` directory
  - **E2E Testing Conventions**: See `e2e/CLAUDE.md` for comprehensive testing philosophy and patterns
- **MSW Handlers**: Mock OpenAI API endpoints at `src/mocks/handlers.ts`

## UI Components

Uses shadcn/ui component pattern with path alias `@/` -> `./src/`:
- Components in `src/components/ui/`
- Tailwind CSS variables defined in `src/index.css` using CSS custom properties
- Styling uses `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge)

## Styling System

Using Tailwind CSS v4 with Vite plugin:
- Theme colors defined as CSS custom properties (HSL values)
- No `@apply` directives (removed for v4 compatibility)
- CSS theme configuration in `src/index.css`

## Feature Toggles

Runtime feature toggles allow users to enable/disable features through the Settings UI.

### `FEATURE_INDEXING_ENABLED`
Runtime toggle for document indexing functionality (for future implementation).

**Behavior:**
- **Enabled** (default): When not set OR not explicitly set to "false" in localStorage
- **Disabled**: When explicitly set to "false" in localStorage
- **Changes:** Require page reload to take effect

**Storage:**
- localStorage key: `feature-flag-FEATURE_INDEXING_ENABLED`
- Value: `"true"` or `"false"` (string)

**Usage in Code:**
```typescript
import { isFeatureEnabled, setFeatureFlag, FEATURES } from '@/lib/feature-flags'

// Read toggle state
if (isFeatureEnabled(FEATURES.INDEXING_ENABLED)) {
  // Indexing logic here
}

// Write toggle state
setFeatureFlag(FEATURES.INDEXING_ENABLED, false) // disable
```

**Settings UI:**
- Access via Settings cog icon in both Chat and Documents page headers (shared TopBar component)
- Interactive toggles allow users to enable/disable features
- Warning shown when changes pending for feature flags
- "Reload Now" button to apply feature flag changes immediately

**Test Strategy:**
Use `page.addInitScript()` to set toggle state before app loads:
```typescript
test.beforeEach(async ({ page }) => {
  // Disable indexing in tests
  await page.addInitScript(() => {
    localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false')
  })
  // ... setup
})
```
## Hybrid Search Settings

User-configurable search parameters stored in localStorage using feature-flags pattern.

### `SEARCH_SETTINGS`
Runtime configurable parameters for vector and BM25 hybrid search.

**Available Settings:**
- `VECTOR_TOP_K` (default: 3): Number of vector search results to return (range: 1-20)
- `SIMILARITY_THRESHOLD` (default: 0.3): Cosine similarity cutoff for vector results (range: 0-1)
- `BM25_LIMIT` (default: 10): Number of BM25 full-text search results (range: 1-50)
- `HNSW_M` (default: 16): HNSW index max connections per layer - requires re-index (range: 4-64)
- `HNSW_EF_CONSTRUCTION` (default: 64): HNSW dynamic candidate list size - requires re-index (range: 16-256)

**Storage:**
- localStorage keys: `search-setting-{SETTING_NAME}`
- Values: numeric strings (e.g., `"3"`, `"0.7"`)
- Changes to basic settings (topK, threshold, BM25 limit) apply immediately on next search
- Changes to HNSW index parameters require page reload and document re-indexing

**Usage in Code:**
```typescript
import { getSearchSetting, setSearchSetting, SEARCH_SETTINGS } from '@/lib/feature-flags'

// Read setting
const topK = getSearchSetting('VECTOR_TOP_K') // returns number

// Write setting
setSearchSetting('VECTOR_TOP_K', 5) // dispatches searchSettingChanged event
```

**Settings UI:**
- Access via Settings cog icon (same as feature flags)
- Number inputs with validation for min/max bounds
- Separate sections: "Hybrid Search Settings" (basic) and "Advanced Settings" (HNSW)
- Warning shown for HNSW parameter changes
- No reload required for basic settings (apply immediately)

**Test Strategy:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('search-setting-VECTOR_TOP_K', '5')
    localStorage.setItem('search-setting-SIMILARITY_THRESHOLD', '0.7')
  })
})
```

## UI Components

### TopBar Component
Shared navigation bar component used across Chat and Documents pages.

**Location:** `src/components/TopBar.tsx`

**Features:**
- Page title and icon
- Navigation links (Chat | Documents)
- Settings cog button (opens SettingsDialog)
- Logout button
- Children slot for page-specific actions (e.g., Clear Chat button)

**Usage:**
```typescript
<TopBar title="AI Chat" icon={<Bot className="w-6 h-6" />}>
  <Button onClick={clearChat}>Clear Chat</Button>
</TopBar>
```

### Model Selector Location
- **Chat Page**: Model selector positioned **below** the chat input area with "Model:" label
- Previously in header, moved to improve UX and make space for settings
