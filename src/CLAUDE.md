# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React + TypeScript RAG (Retrieval-Augmented Generation) chat application with vector database (PGlite), hybrid search (vector + BM25), and OpenAI integration. Built with Vite, shadcn/ui, and Tailwind CSS v4.

## Commands

### Development
```bash
npm run dev          # Dev server at http://127.0.0.1:5173
npm run build        # TypeScript + Vite build
npm run preview      # Preview build at http://127.0.0.1:4173
npm run lint         # ESLint
```

### Testing
```bash
npm test                # Vitest unit tests
npm run test:e2e        # Playwright e2e (excludes @live tests)
npm run test:e2e:live   # Live e2e only (hits OpenAI API, costs money)
npm run test:e2e:all    # All e2e tests

# Single test
npx vitest run src/path/to/test.test.ts
npx playwright test e2e/test-file.spec.ts
```

**Test Infrastructure:**
- Unit: Vitest + jsdom, setup at `src/tests/setup.ts`, MSW at `src/tests/mocks/`
- E2E: Playwright against preview server (port 4173)
- E2E conventions: See `e2e/CLAUDE.md` for comprehensive testing philosophy

**Live Tests (@live tag):**
- Hit real OpenAI API (chat completions + embeddings), cost money
- Use Paul Graham essays from `e2e/fixtures/files/`
- Regular `test:e2e` excludes via `--grep-invert @live`

## Architecture

### Core Concepts

**Vector Database (PGlite):**
- In-browser PostgreSQL with pgvector extension
- HNSW indexing for fast approximate nearest neighbor search
- BM25 full-text search via Lunr.js
- Hybrid search combines vector similarity + BM25 ranking with reciprocal rank fusion

**State Management:**
- `ApiKeyContext`: OpenAI API key in localStorage
- `VectorDBContext`: Database state, documents, knowledge bases, indexing queue
- `useChat`: Chat history, streaming responses, RAG integration
- Feature flags & search settings in localStorage via `lib/feature-flags.ts`

**Routing:**
- `/` - WelcomePage: API key input
- `/chat` - ChatPage: Chat with RAG (protected)
- `/documents` - DocumentsPage: KB & document management (protected)
- `/search` - SearchPage: BM25 search testing (protected)

### Project Structure

**Folder Organization (Best Practices Applied):**
```
src/
├── types/               # Centralized TypeScript types
│   └── index.ts        # Document, KnowledgeBase, SearchResult, Message, etc.
├── lib/                # Pure functions & utilities
│   ├── utils.ts        # formatDate, formatFileSize, cn
│   ├── feature-flags.ts # Runtime toggles & search settings
│   ├── test-ids.ts     # Centralized test ID constants
│   ├── chunking.ts     # Document chunking (pure functions)
│   └── embeddings.ts   # OpenAI embedding utilities
├── hooks/              # Custom React hooks
│   ├── useChat.ts      # Chat state, streaming, RAG, abort controller
│   └── useDebounce.ts  # Input debouncing (300ms default)
├── contexts/           # React contexts
│   ├── ApiKeyContext.tsx
│   └── VectorDBContext.tsx
├── components/         # Shared UI components
│   ├── ui/            # shadcn/ui primitives (button, input, card, etc.)
│   ├── ErrorBoundary.tsx  # Error crash protection
│   ├── TopBar.tsx     # Shared nav bar with settings
│   └── SettingsDialog.tsx # Feature flags & OpenAI config
├── pages/             # Page components (folder structure)
│   ├── welcome/
│   │   └── index.tsx  # API key entry
│   ├── chat/
│   │   ├── index.tsx  # Chat page
│   │   ├── FileSelector.tsx
│   │   ├── AttachmentBadges.tsx
│   │   └── SourceCitations.tsx
│   ├── documents/
│   │   ├── index.tsx  # Documents page
│   │   ├── KBCard.tsx
│   │   ├── CreateKBModal.tsx
│   │   ├── DocumentCard.tsx
│   │   └── ... (all page-specific components)
│   └── SearchPage.tsx # BM25 search testing
└── tests/             # Test infrastructure
    ├── setup.ts       # Vitest + MSW config
    └── mocks/         # MSW handlers for OpenAI API
```

**Key Architectural Decisions:**
1. **Page-specific components colocated** - Each page has folder with its components
2. **Centralized types** - `src/types/index.ts` eliminates duplication
3. **Pure function extraction** - Chunking, embeddings in `lib/` (testable, reusable)
4. **Test IDs as constants** - `src/lib/test-ids.ts` for E2E stability
5. **Path alias @/** - Always use instead of relative imports

### Import Conventions

**Always use @/ path alias:**
```typescript
// ✅ CORRECT
import { formatDate } from '@/lib/utils'
import { Document } from '@/types'
import { useChat } from '@/hooks/useChat'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ❌ WRONG - Never use relative imports
import { formatDate } from '../../lib/utils'
```

**Exception:** Within same folder, relative imports OK:
```typescript
// In src/pages/documents/KBCard.tsx
import IndexingStatusBadge from './IndexingStatusBadge'  // OK - same folder
```

## Code Style & Best Practices

### React Patterns

**Component Structure:**
- Functional components with hooks
- Props interfaces defined inline or in `types/index.ts`
- Export default for page components, named exports for utilities
- Use `forwardRef` when exposing refs to parent

**State Management:**
- Local state with `useState` for UI-only state
- Context for global state (API key, DB, feature flags)
- Custom hooks for complex logic (useChat, useDebounce)
- Avoid prop drilling - use context or composition

**Error Handling:**
- `ErrorBoundary` wraps all routes in App.tsx
- Use `toast.error()` for user-facing errors (not `alert()`)
- Use `toast.success()` for positive feedback
- Let errors bubble to ErrorBoundary for crashes

**Side Effects:**
- Use `useEffect` with proper dependencies
- Cleanup functions for subscriptions, timers, listeners
- Abort controllers for cancelable async operations (see `useChat`)

### TypeScript

**Import types from centralized location:**
```typescript
import type { Document, KnowledgeBase, SearchResult, Message } from '@/types'
```

**Type safety:**
- Use interfaces for object shapes (avoid `type` for consistency)
- Avoid `any` - use `unknown` if type truly unknown
- Use const assertions for literal types: `as const`
- Generic components properly typed: `<T,>` syntax in TSX

**Naming:**
- Interfaces: PascalCase (Document, SearchResult)
- Types: PascalCase (FilterType, SortBy)
- Enums: PascalCase (avoid - use union types instead)
- Constants: UPPER_SNAKE_CASE for test IDs

### Styling

**Tailwind CSS v4:**
- Theme colors as CSS custom properties in `src/index.css`
- NO `@apply` directives (removed for v4 compatibility)
- Use `cn()` utility for conditional classes: `cn('base', condition && 'extra')`
- Prefer Tailwind classes over inline styles

**Component Styling:**
```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  error && 'error-classes'
)} />
```

### Testing

**Test ID Conventions:**
```typescript
// Use centralized constants
import { CHAT_PAGE, DOC_CARD } from '@/lib/test-ids'

<button data-testid={CHAT_PAGE.BTN_SEND}>Send</button>
<div data-testid={DOC_CARD.card(doc.id)}>...</div>

// Pattern: <element-type>-<component>-<action>
// - btn-submit-form
// - input-search-query
// - modal-delete-kb
// - div-error-message
```

**Test assertions (JUnit convention):**
```typescript
// ✅ CORRECT: expect(actual).toBe(expected)
expect(result).toBe(expectedValue)

// ❌ WRONG
expect(expectedValue).toBe(result)
```

**Deterministic tests:**
- NO `if-else` - tests follow single path
- NO `try-catch` - let errors throw
- NO fallback logic - fix root cause
- Use `console.log` for debugging only

**State-based waiting:**
```typescript
// Add data attributes for background operations
<div data-uploading={isUploading.toString()}>
<div data-indexing-status={status}>
<button data-loading={isLoading.toString()}>

// Wait for completion states (not intermediate states)
await page.waitForSelector('[data-uploading="false"]')
```

## Feature Flags & Settings

### Feature Flags

Runtime toggles for enabling/disabling features via Settings UI.

**Usage:**
```typescript
import { isFeatureEnabled, setFeatureFlag, FEATURES } from '@/lib/feature-flags'

if (isFeatureEnabled(FEATURES.INDEXING_ENABLED)) {
  // Feature logic
}

setFeatureFlag(FEATURES.INDEXING_ENABLED, false)
```

**Storage:** localStorage key `feature-flag-{NAME}`, values `"true"/"false"` (strings)
**Changes:** Require page reload to take effect
**Defaults:** Enabled unless explicitly set to `"false"`

**Available Flags:**
- `FEATURE_INDEXING_ENABLED`: Document indexing & embeddings (default: true)

**Test Strategy:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false')
  })
})
```

### Search Settings

User-configurable hybrid search parameters.

**Available Settings:**
- `VECTOR_TOP_K` (default: 3, range: 1-20): Vector results count
- `SIMILARITY_THRESHOLD` (default: 0.3, range: 0-1): Cosine similarity cutoff
- `BM25_LIMIT` (default: 10, range: 1-50): BM25 results count
- `HNSW_M` (default: 16, range: 4-64): HNSW connections (requires re-index)
- `HNSW_EF_CONSTRUCTION` (default: 64, range: 16-256): HNSW candidate list (requires re-index)

**Usage:**
```typescript
import { getSearchSetting, setSearchSetting } from '@/lib/feature-flags'

const topK = getSearchSetting('VECTOR_TOP_K') // returns number
setSearchSetting('VECTOR_TOP_K', 5) // dispatches searchSettingChanged event
```

**Storage:** localStorage key `search-setting-{NAME}`, numeric strings
**Changes:** Basic settings apply immediately, HNSW requires reload + re-index

## UI Components

### TopBar Component

Shared navigation bar used across all protected pages.

**Features:**
- Page title & icon
- Navigation links (Chat | Documents)
- Settings cog button (opens SettingsDialog)
- Logout button
- Children slot for page-specific actions

**Usage:**
```typescript
<TopBar title="AI Chat" icon={<Bot className="w-6 h-6" />}>
  <Button onClick={clearChat}>Clear Chat</Button>
</TopBar>
```

### ErrorBoundary

Class component that catches React errors and displays fallback UI.

**Features:**
- Catches unhandled errors in component tree
- Shows detailed error message with stack trace
- "Try Again" button to reset error state
- "Reload Page" button for persistent errors

**Usage:**
```typescript
// Wrap routes in App.tsx
<ErrorBoundary>
  <ProtectedRoute>
    <ChatPage />
  </ProtectedRoute>
</ErrorBoundary>
```

### Toast Notifications

Uses `sonner` library for user notifications.

**Usage:**
```typescript
import { toast } from 'sonner'

toast.success('File uploaded successfully')
toast.error('Failed to connect to database')
toast.promise(asyncOperation, {
  loading: 'Processing...',
  success: 'Done!',
  error: 'Failed'
})
```

**DO NOT use `alert()` or `confirm()`** - always use toast

## Security & Performance

### XSS Protection

**Always sanitize HTML before rendering:**
```typescript
import DOMPurify from 'dompurify'

// When using dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />

// Better: Avoid dangerouslySetInnerHTML when possible
```

### Input Debouncing

**Use `useDebounce` hook for search inputs:**
```typescript
import { useDebounce } from '@/hooks/useDebounce'

const [query, setQuery] = useState('')
const debouncedQuery = useDebounce(query, 300)

useEffect(() => {
  if (debouncedQuery) {
    performSearch(debouncedQuery)
  }
}, [debouncedQuery])
```

### Abort Controllers

**Cancel ongoing async operations:**
```typescript
// In useChat hook
const abortControllerRef = useRef<AbortController | null>(null)

const sendMessage = async (content: string) => {
  // Cancel previous request
  abortControllerRef.current?.abort()

  // Create new controller
  const abortController = new AbortController()
  abortControllerRef.current = abortController

  try {
    await openai.chat.completions.create({
      // ...options
    }, { signal: abortController.signal })
  } catch (error) {
    if (error.name === 'AbortError') {
      // Request was cancelled
    }
  }
}

// Cleanup
useEffect(() => {
  return () => abortControllerRef.current?.abort()
}, [])
```

## Vector Database (PGlite)

### Architecture

**In-browser PostgreSQL with pgvector:**
- Client-side vector database (no backend required)
- HNSW indexing for approximate nearest neighbor search
- Hybrid search: vector similarity + BM25 full-text
- Reciprocal rank fusion combines rankings

### Schema

**Knowledge Bases:**
```sql
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL,
  hnsw_m INTEGER DEFAULT 16,
  hnsw_ef_construction INTEGER DEFAULT 64
)
```

**Documents:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  knowledge_base_id UUID REFERENCES knowledge_bases(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  indexed_at TIMESTAMPTZ,
  indexing_status TEXT,
  chunk_count INTEGER,
  file_size INTEGER,
  mime_type TEXT
)
```

**Chunks:**
```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  content TEXT NOT NULL,
  heading TEXT,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),  -- pgvector type
  start_offset INTEGER,
  end_offset INTEGER
)

CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
```

### Hybrid Search

**Combines vector similarity + BM25:**
1. Vector search: cosine similarity on embeddings
2. BM25 search: Lunr.js full-text search
3. Reciprocal rank fusion: combines rankings
4. Configurable via search settings

**Implementation:**
```typescript
const results = await searchHybrid(
  query,
  knowledgeBaseId,
  attachedDocumentIds
)
// Returns SearchResult[] with fusedScore, vectorScore, bm25Score
```

## Chunking Strategy

**Markdown-aware chunking:**
- Splits on headings (`#`, `##`, etc.) to preserve context
- Falls back to sentence boundaries for long sections
- Target chunk size: ~500 tokens (configurable)
- Includes heading in chunk metadata for context

**Implementation:**
```typescript
import { chunkDocument } from '@/lib/chunking'

const chunks = chunkDocument(content, {
  filename,
  mimeType: 'text/markdown',
  targetChunkSize: 500
})
// Returns Chunk[] with heading, content, offsets
```

## Common Patterns

### Creating a New Page

1. Create folder: `src/pages/my-page/`
2. Add `index.tsx` as main page component
3. Add page-specific components in same folder
4. Use `@/` imports for shared components/utils
5. Wrap in `ErrorBoundary` in App.tsx routing
6. Add to navigation in TopBar if needed

### Adding a Feature Flag

1. Add to `FEATURES` constant in `lib/feature-flags.ts`
2. Add default value in `getAllFeatureFlags()`
3. Check flag: `isFeatureEnabled(FEATURES.MY_FLAG)`
4. Add toggle in SettingsDialog.tsx
5. Document in CLAUDE.md

### Adding a Search Setting

1. Add to `SearchSettings` type in `lib/feature-flags.ts`
2. Add default + validation in `getSearchSetting()`
3. Use: `getSearchSetting('MY_SETTING')`
4. Add input in SettingsDialog.tsx
5. Dispatch `searchSettingChanged` event if live update needed

### Creating a Custom Hook

1. Create file in `src/hooks/`
2. Use TypeScript generics if reusable: `<T,>`
3. Return object with clear API: `{ data, loading, error, actions }`
4. Add cleanup for side effects
5. Export as named export

### Extracting Duplicate Code

1. Identify pattern repeated 3+ times
2. Extract to `lib/utils.ts` for pure functions
3. Extract to custom hook for stateful logic
4. Export as named export
5. Update all usages to import

## Troubleshooting

### Tests Failing

1. Check test setup at `src/tests/setup.ts`
2. Verify MSW handlers at `src/tests/mocks/handlers.ts`
3. Check data-testid constants match UI
4. Run single test to isolate: `npx vitest run path/to/test.ts`
5. Check for missing cleanup in useEffect

### Build Errors

1. Check TypeScript errors: `tsc --noEmit`
2. Verify all @/ imports resolve (check `vite.config.ts` alias)
3. Check for unused imports (ESLint will catch)
4. Verify types imported from `@/types`

### E2E Tests Flaky

1. Add data attributes for state: `data-loading`, `data-status`
2. Use state-based waiting (not timeouts)
3. Check page object encapsulation (no direct `page.*`)
4. See `e2e/CLAUDE.md` for comprehensive debugging

### Database Initialization Failed

1. Check browser console for PGlite errors
2. Verify pgvector extension loaded
3. Check HNSW parameters (M: 4-64, ef_construction: 16-256)
4. IndexedDB may be full - clear browser data

## Development Guidelines

**File Organization:**
- Page-specific: colocate in page folder
- Reusable: extract to `components/` or `lib/`
- Types: centralize in `types/index.ts`
- Test IDs: centralize in `lib/test-ids.ts`

**Naming:**
- Files: PascalCase for components, camelCase for utilities
- Components: PascalCase
- Hooks: camelCase starting with `use`
- Utils: camelCase

**Git Commits:**
- Format: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore
- Include test results in commit message
- Reference issue numbers when applicable

**Code Review:**
- All tests must pass (unit + e2e)
- No direct `page.*` in E2E tests
- Use @/ imports consistently
- Types from centralized location
- Toast not alert()
- DOMPurify for HTML

**Performance:**
- Debounce search inputs
- Use abort controllers for async ops
- Lazy load heavy components if needed
- Monitor bundle size (currently has warnings)
