# Vector Search Implementation - Critical Review

**Review Date**: 2025-11-21
**Commits Reviewed**: a5cdc87..1a32c2d (7 commits)
**Lines Changed**: +1060, -63

---

## Executive Summary

Implementation complete, all tests passing (14 unit, 4 E2E, 3 live). Core functionality works but has **critical architectural issues** with citation persistence and **several quality/UX problems** requiring fixes before production.

**Severity Levels**:

- 🔴 **CRITICAL**: Breaks core functionality, must fix
- 🟡 **HIGH**: Impacts UX significantly, should fix soon
- 🟢 **MEDIUM**: Quality/maintainability, fix when time permits
- ⚪ **LOW**: Nice-to-have, optional

---

## 🔴 CRITICAL ISSUES

### 1. Sources Only Persist for Last Message

**File**: `src/pages/ChatPage.tsx:127`
**Problem**: Citations disappear from previous messages when new message sent

```tsx
{
  msg.role === 'assistant' && sources.length > 0 && idx === messages.length - 1 ? (
    <SourceCitations content={msg.content} sources={sources} />
  ) : (
    <div className="whitespace-pre-wrap">{msg.content}</div>
  );
}
```

**Root Cause**: Sources stored as global state, not per-message
**Impact**: User loses all previous citations, breaking RAG transparency
**Fix**: Store sources in Message object:

```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[]; // Add this
}
```

**Estimated Effort**: 2-3 hours (update useChat, ChatPage, tests)

---

### 2. Similarity Threshold Too Low (0.3)

**File**: `src/workers/pglite.worker.ts:662`
**Problem**: Threshold lowered from 0.7 → 0.3 to make tests pass

```typescript
const similarityThreshold = params.similarityThreshold ?? 0.3;
```

**Root Cause**: Test expectations too strict, workaround added
**Impact**: Returns many irrelevant results, pollutes citations
**Fix**:

1. Raise threshold back to 0.6-0.7
2. Make threshold configurable via UI
3. Log similarity scores in DEV mode
4. Update tests with realistic expectations

**Estimated Effort**: 1-2 hours

---

## 🟡 HIGH PRIORITY ISSUES

### 3. No Loading Indicator During Vector Search

**File**: `src/pages/ChatPage.tsx`
**Problem**: `isSearching` state exists but unused, user has no feedback
**Impact**: Appears frozen during search (can take 1-2 seconds)
**Fix**: Show spinner/badge during search

```tsx
{
  isSearching && (
    <div className="text-xs text-gray-500">
      <Search className="w-3 h-3 animate-spin inline mr-1" />
      Searching documents...
    </div>
  );
}
```

**Estimated Effort**: 30 minutes

---

### 4. No Error Handling for Search Failures

**Files**: `src/hooks/useChat.ts:95`, `src/contexts/VectorDBContext.tsx:224`
**Problem**: Search errors swallowed silently

```typescript
const searchResults = await searchVectors(content, attachedDocumentIds);
// No try/catch!
```

**Impact**: Silent failures, user thinks search worked
**Fix**: Add try/catch and display error message

```typescript
try {
  const searchResults = await searchVectors(content, attachedDocumentIds);
  setSources(searchResults);
} catch (err) {
  console.error('[useChat] Vector search failed:', err);
  setSources([]);
  setError('Failed to search documents. Using general knowledge.');
}
```

**Estimated Effort**: 1 hour

---

### 5. Type Duplication (SearchResult)

**Files**: 3 locations

- `src/workers/pglite.worker.ts:632`
- `src/contexts/VectorDBContext.tsx:37`
- Types not shared

**Problem**: Same interface defined twice, easy to drift
**Fix**: Extract to `src/types/vector-search.ts`:

```typescript
export interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  heading: string | null;
  content: string;
  chunkIndex: number;
  similarity: number;
}

export interface SearchParams {
  query: string;
  documentIds: string[];
  topK?: number;
  similarityThreshold?: number;
}
```

**Estimated Effort**: 30 minutes

---

### 6. Tooltip Hover Test Skipped

**File**: `e2e/vector-search-workflow.spec.ts:106-108`

```typescript
// Hover over first citation to see tooltip (temporarily skipped)
// await chatPage.hoverCitation(1);
// await chatPage.expectCitationTooltipVisible();
```

**Problem**: Unclear if real bug or test flakiness
**Impact**: Tooltip might be broken in production
**Fix**:

1. Investigate why tooltip not visible in test
2. Check z-index conflicts with other UI
3. Ensure tooltip renders in test environment
4. Re-enable test or remove hover feature

**Estimated Effort**: 2 hours investigation

---

## 🟢 MEDIUM PRIORITY ISSUES

### 7. parseCitations Recreated Every Render

**File**: `src/components/SourceCitations.tsx:8`
**Problem**: Function defined in component body, not memoized
**Impact**: Performance hit on re-renders
**Fix**:

```typescript
const parsedContent = useMemo(() => parseCitations(content), [content]);
```

**Estimated Effort**: 15 minutes

---

### 8. No Unit Tests for New Components

**Missing Tests**:

- `SourceCitations.tsx` - citation parsing, rendering
- `FileSelector.tsx` - search, selection logic
- `AttachmentBadges.tsx` - display, removal

**Impact**: Regression risk, harder to refactor
**Fix**: Add Vitest component tests
**Estimated Effort**: 4-6 hours

---

### 9. DEV Console Logs Not Cleaned Up

**Files**: Multiple

- `src/hooks/useChat.ts:100`
- `src/workers/pglite.worker.ts:705`

**Problem**: Logging in production-like code
**Fix**: All wrapped in `import.meta.env.DEV` (actually okay)
**Note**: False alarm, properly guarded

---

### 10. Inconsistent Export Styles

**Observations**:

- `FileSelector`: default export
- `SourceCitations`: named export
- `AttachmentBadges`: default export

**Problem**: Inconsistent conventions
**Fix**: Standardize on named exports for all components

```typescript
export function FileSelector({ ... }) { ... }
export function AttachmentBadges({ ... }) { ... }
```

**Estimated Effort**: 30 minutes

---

### 11. Accessibility Issues

**Citations**:

- No keyboard navigation to citation markers
- No ARIA labels on citation badges
- Tooltip only on hover (no focus state)

**FileSelector Modal**:

- No focus trap
- Escape key not handled
- No focus return on close

**AttachmentBadges**:

- Remove button needs better keyboard support

**Fix**: Add ARIA attributes, keyboard handlers
**Estimated Effort**: 3-4 hours

---

### 12. No Search Debouncing in FileSelector

**File**: `src/components/FileSelector.tsx:100`

```typescript
onChange={(e) => setSearchQuery(e.target.value)}
```

**Problem**: Filters on every keystroke
**Impact**: Could be slow with 100s of files
**Fix**: Add debounce (lodash or custom hook)
**Estimated Effort**: 30 minutes

---

## ⚪ LOW PRIORITY ISSUES

### 13. Hardcoded System Prompt

**File**: `src/hooks/useChat.ts:105-117`
**Problem**: RAG system prompt not configurable
**Impact**: Can't customize AI behavior per use case
**Fix**: Extract to constant, make configurable via props
**Estimated Effort**: 1 hour

---

### 14. No Validation of DocumentIds

**File**: `src/workers/pglite.worker.ts:657`

```typescript
if (!params.documentIds || params.documentIds.length === 0) {
  return [];
}
```

**Problem**: Doesn't validate UUIDs
**Impact**: Could send malformed IDs to SQL (SQL injection risk low)
**Fix**: Validate UUIDs before query
**Estimated Effort**: 30 minutes

---

### 15. Arbitrary Filename Truncation

**File**: `src/components/AttachmentBadges.tsx:22`

```typescript
doc.filename.length > 20 ? doc.filename.substring(0, 17) + '...' : doc.filename;
```

**Problem**: Fixed 20 char limit not responsive
**Impact**: Truncates too early on large screens
**Fix**: Use CSS truncation with max-width
**Estimated Effort**: 15 minutes

---

### 16. Missing JSDoc Comments

**All new files lack JSDoc**

**Impact**: Harder to understand/maintain
**Fix**: Add JSDoc to public functions
**Estimated Effort**: 2 hours

---

### 17. Modal Closes Without Confirmation

**File**: `src/components/FileSelector.tsx:72`

```typescript
onClick = { onClose }; // Backdrop click
```

**Problem**: Clicking outside modal loses selection
**Impact**: Frustrating if user accidentally clicks
**Fix**: Show confirmation if selection changed
**Estimated Effort**: 1 hour

---

## Test Coverage Gaps

### Missing Tests:

1. ✅ **E2E for full RAG workflow** - EXISTS (vector-search-workflow.spec.ts)
2. ❌ **Unit tests for SourceCitations component**
3. ❌ **Unit tests for FileSelector component**
4. ❌ **Unit tests for AttachmentBadges component**
5. ❌ **Unit tests for citation parsing logic**
6. ❌ **Unit tests for formatContext helper**
7. ⚠️ **Hover tooltip test** - SKIPPED

**Estimated Effort**: 6-8 hours for full coverage

---

## Architecture Recommendations

### 1. Message-Scoped Sources

**Current**: Sources at hook level (global)
**Proposed**: Sources per message

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[];
  timestamp?: string;
}
```

### 2. Shared Type Definitions

**Create**: `src/types/vector-search.ts`
**Export**: SearchResult, SearchParams
**Import**: Worker, Context, Components

### 3. Citation Service Layer

**Extract**: Citation logic to service

```typescript
// src/services/citation-service.ts
export class CitationService {
  parseCitations(content: string): CitationPart[];
  formatContext(results: SearchResult[]): string;
  validateCitations(content: string, sources: SearchResult[]): boolean;
}
```

### 4. Configuration Object

**Create**: `src/config/rag-config.ts`

```typescript
export const RAG_CONFIG = {
  similarityThreshold: 0.7,
  topK: 10,
  systemPrompt: '...',
  maxContextLength: 4000,
};
```

---

## Performance Optimizations

1. **Memoize parseCitations**: Use useMemo
2. **Debounce FileSelector search**: Prevent excessive filtering
3. **Lazy load SourceCitations**: Only render when visible
4. **Virtual scrolling**: For large file lists in FileSelector
5. **Cache embeddings**: Avoid re-embedding same query

---

## Security Considerations

1. **Content sanitization**: Escape special chars in context
2. **Rate limiting**: Limit vector search API calls
3. **Input validation**: Validate documentIds as UUIDs
4. **Error messages**: Don't leak internal details
5. **XSS prevention**: Ensure citation content safe to render

---

## Rollout Plan

### Phase 1: Critical Fixes (Week 1)

- [ ] Fix sources persistence per-message
- [ ] Raise similarity threshold to 0.6-0.7
- [ ] Add error handling for search failures
- [ ] Add loading indicator for vector search

### Phase 2: Quality Improvements (Week 2)

- [ ] Extract shared types
- [ ] Add unit tests for components
- [ ] Fix tooltip test or remove feature
- [ ] Improve accessibility

### Phase 3: Enhancements (Week 3)

- [ ] Make system prompt configurable
- [ ] Add search debouncing
- [ ] Improve citation UX (click to scroll)
- [ ] Add keyboard navigation

### Phase 4: Polish (Week 4)

- [ ] Add JSDoc comments
- [ ] Refactor to citation service
- [ ] Performance optimizations
- [ ] Security hardening

---

## Metrics to Track

1. **Search quality**: Average similarity of returned results
2. **Performance**: P95 latency of vector search
3. **Usage**: % of queries using RAG vs normal chat
4. **Errors**: Vector search failure rate
5. **UX**: User clicks on citations (if implemented)

---

## Conclusion

**Overall Quality**: 7/10
**Production Readiness**: 6/10
**Test Coverage**: 6/10
**Documentation**: 4/10
**Accessibility**: 3/10

**Recommendation**: Address critical issues (sources persistence, similarity threshold) before wider rollout. High-priority issues should be fixed within 2 weeks. Medium/low issues can follow in subsequent sprints.

**Estimated Total Effort**: 20-30 hours for all fixes
