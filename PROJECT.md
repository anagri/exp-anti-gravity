# PROJECT.md

Technical architecture and implementation details for the OpenAI chat application.

## Overview

React 19 + TypeScript chat app with OpenAI streaming API. ~1038 LOC across 24 files. See CLAUDE.md for commands and basic architecture.

## Technical Architecture

### State Management Pattern

**Context + Custom Hook Layer:**
- `ApiKeyContext` (contexts/ApiKeyContext.tsx:1-46): Manages API key with localStorage sync via useEffect
- `useChat` hook (hooks/useChat.ts:1-100): Encapsulates OpenAI SDK, streaming state, model management

**Key Pattern - Lazy localStorage Initialization:**
```typescript
const [apiKey, setApiKeyState] = useState<string | null>(() => {
  return localStorage.getItem('openai_api_key');  // Read once on mount
});
```
Avoids reading localStorage on every render. Both contexts use this pattern.

**One-way Sync Pattern:**
State changes trigger localStorage writes via useEffect, not vice versa. No listeners for storage events (multi-tab sync not implemented).

### Streaming Implementation

**Core Mechanism** (hooks/useChat.ts:39-81):

1. **Optimistic User Message:** Add to state immediately before API call
2. **Empty Placeholder:** Insert empty assistant message before streaming starts
3. **Chunk Accumulation:** Use local string variable to accumulate chunks
4. **Immutable Updates:** Replace last message on every chunk (causes re-render per chunk)

```typescript
let assistantContent = '';
setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  assistantContent += content;
  setMessages(prev => {
    const newMsgs = [...prev];
    newMsgs[newMsgs.length - 1] = { role: 'assistant', content: assistantContent };
    return newMsgs;
  });
}
```

**Performance Consideration:** Every chunk triggers full messages array re-render. Fine for <100 messages, could cause stuttering with larger histories. Consider memoization or virtualization if needed.

**OpenAI SDK Configuration:**
```typescript
new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true  // Required for client-side usage
})
```
Security note: Exposes API key in browser. Acceptable for personal use, production should proxy through backend.

### Route Protection

**Simple Redirect Guard** (App.tsx:7-13):
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApiKey();
  if (!apiKey) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```
Uses `replace` to prevent back-button navigation to protected route. Renders nothing during redirect (children unmount immediately).

### Component Architecture

**ModelSelector** (components/ModelSelector.tsx:1-78):
- Searchable combobox using Radix Popover + cmdk
- Returns `null` if models array empty (defensive rendering)
- Fixed 200px width prevents layout shift
- Auto-closes on selection
- No loading state while fetching models

**ChatPage Auto-scroll** (pages/ChatPage.tsx:25-29):
```typescript
useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [messages]);
```
Issue: Scrolls to bottom even if user manually scrolled up to read history. Better approach: only auto-scroll if user already near bottom.

**Message Rendering** (pages/ChatPage.tsx:82-103):
- Uses array index as key (potential issue if messages reordered/removed)
- Icons conditionally placed (Bot left, User right)
- `whitespace-pre-wrap` preserves formatting
- Max width 80% prevents full-width messages

## Type System

### Core Interfaces

**Message** (hooks/useChat.ts:4-7):
```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system';  // 'system' supported but unused
  content: string;
}
```

**ApiKeyContextType** (contexts/ApiKeyContext.tsx:3-7):
- `setApiKey` takes non-null string (better than `setApiKey(null)`)
- Separate `clearApiKey()` for deletion

**Component Props:**
- UI components extend `React.*HTMLAttributes<HTMLElement>` for prop passthrough
- Use `VariantProps<typeof buttonVariants>` (CVA) for type-safe variants
- forwardRef properly typed: `React.forwardRef<HTMLButtonElement, ButtonProps>`

### TypeScript Config

**Strict Mode Enabled** (tsconfig.json:20-23):
- Forces null checks on `apiKey` usage
- Catches unused locals/parameters
- No implicit any
- Project references for separate Node config (vite.config.ts)

## Testing Architecture

### MSW Configuration

**Setup** (test/setup.ts:1-13):
- Server starts before all tests, closes after
- `resetHandlers()` after each for isolation
- `{ onUnhandledRequest: 'bypass' }` allows non-mocked requests (permissive)

**Streaming Mock** (mocks/handlers.ts:19-55):
Properly simulates SSE format:
```typescript
const body = [
  `data: {"choices": [{"delta": {"content": "Hello "}}]}\n\n`,
  `data: {"choices": [{"delta": {"content": "from "}}]}\n\n`,
  `data: {"choices": [{"delta": {"content": "${model}!"}}]}\n\n`,
  'data: [DONE]\n\n'
].join('');
```
- 100ms delay per chunk simulates real streaming
- Echoes model name in response for verification
- Handles both streaming and non-streaming modes

### E2E Testing

**Playwright Network Mocking** (e2e/chat.spec.ts:4-37):
Mocks at network level (more realistic than MSW for e2e):
```typescript
await page.route('https://api.openai.com/v1/chat/completions', async route => {
  const postData = route.request().postDataJSON();
  const model = postData.model || 'gpt-3.5-turbo';
  // Returns SSE stream
});
```

**Test Patterns:**
- Uses `data-testid` selectors (not implemented yet - could be added)
- Brittle wait: `waitForTimeout(500)` for model loading (e2e/chat.spec.ts:46)
- Better: wait for specific element visibility

**Coverage Gaps:**
- No unit tests for ModelSelector, ChatPage, WelcomePage
- No tests for error scenarios (invalid API key, network failures)
- No tests for localStorage quota exceeded

## Edge Cases & Issues

### Known Issues

1. **Silent Model Fetch Failure** (hooks/useChat.ts:34-36):
   - Fails silently with console.error
   - ModelSelector returns null (disappears from UI)
   - User has no indication models didn't load

2. **Generic Error Messages** (hooks/useChat.ts:77):
   - Doesn't differentiate: network failure, auth error, rate limit, invalid model
   - All show: "Failed to send message. Please check your API key."

3. **No Stream Interruption Handling:**
   - If stream fails mid-response, partial message stays in state
   - No retry mechanism
   - No timeout for infinite streams

4. **localStorage Assumptions:**
   - No quota exceeded handling (`setItem` can throw)
   - Assumes localStorage always available (fails in private browsing)

5. **Model Selection Validation:**
   - Selected model not validated against available models
   - If saved model removed from API, requests will fail
   - Default fallback: 'gpt-3.5-turbo' (hooks/useChat.ts:15)

6. **Input Validation** (pages/WelcomePage.tsx:16):
   - Only checks `startsWith('sk-')`
   - No length/format validation
   - Uses `alert()` for errors (blocks UI, poor UX)

7. **No Error Boundary:**
   - Unexpected OpenAI SDK errors during streaming will unmount entire app
   - Should wrap ChatPage in error boundary

8. **Auto-scroll Annoyance:**
   - Scrolls to bottom even when user reading history
   - No detection of user scroll position
   - No "scroll to bottom" button

### Missing Features

- Retry logic for failed requests
- Conversation persistence (localStorage or backend)
- Message editing/regeneration
- Copy message content
- Stop generation button
- Token/cost tracking
- Multi-tab sync (storage events)
- Markdown rendering in messages
- Code syntax highlighting
- Message timestamps

## Build Configuration

### Vite + TypeScript

**Single Config** (vite.config.ts:1-26):
- Vitest configuration embedded (no separate vitest.config.ts)
- Path alias: `@/` → `./src/`
- Tailwind v4 Vite plugin
- TypeScript reference types for Vitest

**TypeScript Project References:**
- Main config (tsconfig.json) for app code
- Node config (tsconfig.node.json) for vite.config.ts
- Allows different module resolution strategies

### Tailwind v4 Migration

**Breaking Changes Applied:**
- No `@apply` directives (removed from codebase)
- Uses `@import "tailwindcss"` instead of separate directives
- Theme entirely in CSS custom properties (index.css:4-47)
- Dark mode ready: `.dark` class overrides all color variables

**Color System:**
```css
--primary: 222.2 47.4% 11.2%;  /* HSL values without hsl() */
```
Applied in Tailwind config:
```js
primary: { DEFAULT: "hsl(var(--primary))" }  /* hsl() wrapper added */
```

## Dependencies

### Key Libraries

**React Ecosystem:**
- React 19.2.0 (using StrictMode, not using new hooks yet)
- React Router 7.9.6 (using v6 API only)

**UI:**
- Radix UI primitives (Dialog unused, Popover in ModelSelector)
- cmdk 1.1.1 (command palette for model search)
- lucide-react (icons)
- CVA (class-variance-authority) for type-safe variants

**OpenAI:**
- openai 6.9.1 (official SDK with streaming support)

**Styling:**
- Tailwind CSS 4.1.17 (latest v4)
- clsx + tailwind-merge for class merging utility

**Testing:**
- Vitest 4.0.10 (Vite-native runner)
- Testing Library 16.3.0 (React 19 compatible)
- MSW 2.12.2 (v2 API: `http` not `rest`)
- Playwright 1.56.1

### Unused Dependencies

- `@radix-ui/react-dialog` imported but never used
- MSW browser worker setup exists but not used in dev mode (per recent commit)

## Interesting Implementation Details

### SSE Format

OpenAI SDK abstracts parsing, but format is:
```
data: {"choices": [{"delta": {"content": "chunk"}}]}\n\n
data: [DONE]\n\n
```

Each chunk: JSON prefixed with `data: `, suffixed with `\n\n`

### Component Composition Pattern

shadcn/ui pattern - composable pieces:
```tsx
<Card>
  <CardHeader>
    <CardTitle />
    <CardDescription />
  </CardHeader>
  <CardContent />
  <CardFooter />
</Card>
```

Each piece independently styled, allows flexible layouts. See WelcomePage and ChatPage for usage.

### localStorage Keys

Two separate keys:
- `openai_api_key` - Credentials
- `openai_selected_model` - User preference

Allows clearing API key without losing model preference.

### CSS Variable Architecture

All theme colors in CSS custom properties enables:
- Runtime theme switching (no rebuild)
- Dark mode via single `.dark` class
- No Tailwind config changes for theme updates

### React Router v7 Features (Unused)

App uses only v6 API. v7 features available but not implemented:
- Data loaders/actions
- Deferred data
- Optimistic UI (new `useOptimistic`)
- Form actions

Upgrade path available if backend integration added.

### No State Management Library

Pure React Context + hooks sufficient for:
- Single context (ApiKey)
- Single custom hook (useChat)
- ~100 lines total state management

Redux/Zustand unnecessary for this scope.

## Future Considerations

### Performance Optimizations

1. **Memoize Message Components:** Prevent re-renders during streaming
2. **Virtualize Long Histories:** Use react-window for 100+ messages
3. **Debounce Streaming Updates:** Batch chunks (e.g., every 50ms)
4. **Code Splitting:** Lazy load ChatPage (only after auth)

### UX Improvements

1. **Smart Auto-scroll:** Only scroll if near bottom
2. **Message Actions:** Copy, edit, regenerate buttons
3. **Toast Notifications:** Replace `alert()` calls
4. **Inline Error Display:** Per-message error state
5. **Loading States:** Model fetch, initial message send
6. **Stop Generation:** Cancel ongoing streams

### Architecture Enhancements

1. **Error Boundary:** Wrap ChatPage
2. **Retry Logic:** Exponential backoff for failures
3. **Message IDs:** UUID keys instead of array index
4. **Conversation Persistence:** localStorage or backend
5. **Multi-tab Sync:** Listen to storage events
6. **Proper Validation:** OpenAI key format, model availability

### Testing Expansion

1. **Component Tests:** ModelSelector, ChatPage, WelcomePage
2. **Error Scenarios:** Network failures, auth errors, rate limits
3. **Edge Cases:** Empty responses, malformed SSE, stream interruption
4. **Accessibility:** ARIA labels, keyboard navigation
5. **Replace Brittle Waits:** Use `waitFor` instead of `waitForTimeout`
