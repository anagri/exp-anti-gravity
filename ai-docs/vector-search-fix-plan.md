# Vector Search - Fix Plan

**Priority**: Fix critical issues immediately, then iterate on quality

---

## 🔴 IMMEDIATE FIXES (Must Do Before Merge)

### Fix 1: Sources Per Message Architecture
**Why**: Citations disappear on new messages - breaks RAG transparency
**Where**: `src/hooks/useChat.ts`, `src/pages/ChatPage.tsx`

**Changes**:
```typescript
// 1. Update Message interface
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[];  // NEW
}

// 2. Store sources with message in useChat
setMessages(prev => [...prev, {
  role: 'assistant',
  content: assistantContent,
  sources: searchResults  // NEW
}]);

// 3. Render sources from message in ChatPage
{msg.role === 'assistant' && msg.sources && msg.sources.length > 0 ? (
  <SourceCitations content={msg.content} sources={msg.sources} />
) : (
  <div className="whitespace-pre-wrap">{msg.content}</div>
)}
```

**Files to Change**:
- `src/hooks/useChat.ts` - Message interface, sources storage
- `src/pages/ChatPage.tsx` - Render sources from message
- `e2e/vector-search-workflow.spec.ts` - Update assertions

**Estimate**: 2 hours
**Tests**: Verify multiple messages show citations

---

### Fix 2: Raise Similarity Threshold
**Why**: 0.3 threshold returns too many irrelevant results
**Where**: `src/workers/pglite.worker.ts:662`

**Change**:
```typescript
const similarityThreshold = params.similarityThreshold ?? 0.65
```

**Rationale**:
- OpenAI embeddings: 0.65+ = semantically related
- 0.3 = barely related (too noisy)
- Make configurable later

**Files to Change**:
- `src/workers/pglite.worker.ts` - Default threshold

**Estimate**: 10 minutes
**Tests**: Live tests should still pass

---

### Fix 3: Error Handling for Search
**Why**: Silent failures confuse users
**Where**: `src/hooks/useChat.ts:95`, `src/contexts/VectorDBContext.tsx:224`

**Change**:
```typescript
// In useChat.ts
try {
  const searchResults = await searchVectors(content, attachedDocumentIds);
  setSources(searchResults);
} catch (err) {
  console.error('[useChat] Vector search failed:', err);
  setSources([]);
  // Don't block chat, just fall back to normal mode
  if (import.meta.env.DEV) {
    setError('Document search failed, using general knowledge');
  }
}
```

**Files to Change**:
- `src/hooks/useChat.ts` - Add try/catch
- `src/contexts/VectorDBContext.tsx` - Add try/catch

**Estimate**: 30 minutes
**Tests**: Manually test with API key removal

---

### Fix 4: Add Search Loading Indicator
**Why**: User has no feedback during 1-2 second search
**Where**: `src/pages/ChatPage.tsx`

**Change**:
```tsx
const { messages, isLoading, isSearching, error, ... } = useChat({...});

// In render, before input area:
{isSearching && (
  <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
    <Search className="w-3 h-3 animate-spin" />
    Searching documents...
  </div>
)}
```

**Files to Change**:
- `src/pages/ChatPage.tsx` - Add search indicator

**Estimate**: 20 minutes
**Tests**: Visual check

---

## 🟡 NEXT SPRINT (Quality Improvements)

### Fix 5: Extract Shared Types
**Files**: Create `src/types/vector-search.ts`

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

**Update Imports**: Worker, Context, Components

**Estimate**: 30 minutes

---

### Fix 6: Memoize parseCitations
**File**: `src/components/SourceCitations.tsx`

**Change**:
```typescript
export function SourceCitations({ content, sources }: SourceCitationsProps) {
  const parsedContent = useMemo(() => parseCitations(content), [content]);
  // ...
}
```

**Estimate**: 10 minutes

---

### Fix 7: Investigate Tooltip Test
**File**: `e2e/vector-search-workflow.spec.ts:106`

**Options**:
1. Fix tooltip z-index/visibility issue
2. Change to click instead of hover
3. Remove tooltip feature entirely

**Estimate**: 2 hours investigation

---

### Fix 8: Add Component Unit Tests
**Files**: Create test files for:
- `src/components/SourceCitations.test.tsx`
- `src/components/FileSelector.test.tsx`
- `src/components/AttachmentBadges.test.tsx`

**Coverage**:
- Citation parsing with various inputs
- File filtering/sorting
- Badge rendering/removal

**Estimate**: 4-6 hours

---

## 🟢 FUTURE ENHANCEMENTS (When Time Permits)

### Enhancement 1: Configurable System Prompt
Extract to `src/config/rag-config.ts`:
```typescript
export const RAG_CONFIG = {
  systemPrompt: `You are a helpful assistant...`,
  similarityThreshold: 0.65,
  topK: 10,
  maxContextLength: 4000,
};
```

---

### Enhancement 2: Accessibility Improvements
- Focus trap in FileSelector modal
- Keyboard navigation for citations
- ARIA labels on all interactive elements
- Screen reader announcements

---

### Enhancement 3: Search Debouncing
Add debounce to FileSelector search (300ms)

---

### Enhancement 4: Citation Click Action
Make citations clickable:
- Scroll to source in footer
- Show expanded chunk preview
- Highlight corresponding source

---

### Enhancement 5: Standardize Exports
Convert all components to named exports for consistency

---

## Testing Checklist

### Before Merge:
- [ ] All unit tests pass (14/14)
- [ ] All E2E tests pass (4/4)
- [ ] All live tests pass (3/3)
- [ ] Manual test: Multiple messages show citations
- [ ] Manual test: Error handling works
- [ ] Manual test: Search indicator shows
- [ ] Manual test: Similarity threshold gives good results

### After Fixes:
- [ ] Sources persist across messages
- [ ] No silent search failures
- [ ] Loading indicator during search
- [ ] Threshold at 0.65 yields quality results

---

## Rollout Strategy

### Step 1: Apply Immediate Fixes (This Week)
Time: 3-4 hours
- Sources per message
- Raise threshold
- Error handling
- Loading indicator

### Step 2: Test Thoroughly
Time: 1-2 hours
- Run all test suites
- Manual QA session
- Check edge cases

### Step 3: Code Review
Time: 1 hour
- Review changes with team
- Get approval for architecture change

### Step 4: Merge
- Squash commits or keep history
- Update CHANGELOG
- Deploy to staging

### Step 5: Monitor
- Watch error logs
- Check similarity scores
- Gather user feedback

---

## Success Metrics

After fixes, measure:
1. **Citation persistence**: 100% of messages retain sources
2. **Search quality**: Avg similarity >0.7 for top results
3. **Error rate**: <1% search failures
4. **Performance**: P95 latency <2s
5. **User satisfaction**: No complaints about disappearing citations

---

## Notes

- **Priority**: Fix sources persistence ASAP, it's a showstopper
- **Threshold**: Test 0.65-0.7 range, find sweet spot
- **Error handling**: Don't block chat on search failure
- **Testing**: Re-run live tests carefully (costs money)

---

## Next Steps

1. Create branch: `fix/vector-search-critical-issues`
2. Apply Fix 1-4 in order
3. Run full test suite
4. Manual QA
5. Create PR
6. Review
7. Merge
8. Deploy

**Estimated total time**: 4-5 hours for immediate fixes
