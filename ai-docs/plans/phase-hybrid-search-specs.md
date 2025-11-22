# Phase hybrid-search: Implementation Specifications

**Status:** Planning - Incremental TDD approach
**Dependencies:** Phase indexing-pipeline ✅ COMPLETE
**Goal:** Client-side hybrid search (BM25 + semantic) using Lunr.js + PGLite + pgvector with OpenAI embeddings

---

## 🎯 Incremental TDD Approach

**Why Hybrid Search:**

- **BM25 (Lunr.js)**: Precise keyword matching, exact terms, acronyms
- **Semantic (pgvector)**: Conceptual similarity, meaning-based retrieval
- **RRF Fusion**: Combines both for optimal relevance

**Key Principles:**

1. **Real API Testing** - OpenAI embeddings API (no Transformers.js)
2. **Test Isolation** - Each phase independently testable
3. **Incremental Tests** - Tests pass at phase completion
4. **Progressive Enhancement** - Build on existing indexing pipeline

**Implementation Order:**

1. **Phase lunr-foundation** - Lunr.js integration, indexing, basic search (BM25-only)
2. **Phase lunr-persistence** - IndexedDB serialization, load/save index
3. **Phase rrf-fusion** - Combine Lunr + pgvector results with RRF
4. **Phase search-ui** - Search interface, result display, hybrid/BM25/semantic toggle
5. **Phase performance** - Pre-building indexes, Web Workers optimization
6. **Phase search-quality** - Tokenization tuning, stemming customization

---

## Overview

Implement client-side hybrid search combining:

- **Lunr.js** for BM25 keyword search (browser-compatible, 8KB gzipped)
- **PGLite + pgvector** for semantic vector search (already implemented)
- **Reciprocal Rank Fusion (RRF)** for result fusion
- **OpenAI embeddings** for vector generation (existing integration)

**Key Components:**

1. Lunr.js index builder (indexes document chunks as they're created)
2. IndexedDB persistence for Lunr index
3. RRF fusion layer (TypeScript implementation)
4. Search UI with mode toggle (hybrid/BM25/semantic)
5. Performance optimizations (pre-building, Web Workers)

---

## Research Findings & Key Decisions

### Lunr.js vs Alternatives

| Library     | Size | Speed     | Features                            | Community          |
| ----------- | ---- | --------- | ----------------------------------- | ------------------ |
| **Lunr.js** | 8KB  | Good      | Stemming, stop words, BM25 scoring  | 3.3M/week, 9.1K⭐  |
| FlexSearch  | ~3KB | Excellent | Multi-language, custom tokenization | 321K/week, 13.2K⭐ |
| ElasticLunr | ~5KB | Good      | Simpler API, less features          | 29K/week, 2K⭐     |

**Decision: Lunr.js** (most established, proven BM25 implementation, good docs)

### Lunr.js + PGLite Integration

**Research Finding:** No direct integration examples exist because they're alternative approaches (both solve client-side search)

**Our Approach:** Use both in parallel:

- Lunr.js: Build BM25 index from chunk content
- PGLite: Store embeddings (already implemented)
- RRF: Fuse results from both systems

### Performance Considerations

**Lunr.js Limits:**

- **Sweet spot**: 1k-10k documents (chunks)
- **Max practical**: ~50k chunks
- **Build time**: Linear O(n)
- **Search time**: <10ms (in-memory)

**Optimization Strategies:**

1. **Pre-build indexes**: Serialize to IndexedDB after indexing completes
2. **Web Workers**: Build index in background thread (non-blocking)
3. **Compression**: gzip serialized index (40% size reduction)
4. **Incremental updates**: Add/remove documents without full rebuild

### IndexedDB Persistence

**Pattern:**

```typescript
// Serialize
const serialized = JSON.stringify(lunrIndex.toJSON());
await indexedDB.put('lunr-index', serialized);

// Deserialize
const serialized = await indexedDB.get('lunr-index');
const lunrIndex = lunr.Index.load(JSON.parse(serialized));
```

**Storage Limits:**

- Chrome: 60% of disk space
- Firefox: Min(10% disk, 10GB)
- Safari: ⚠️ Deletes after 7 days inactivity

### RRF Implementation

**Formula:**

```
RRF_score(doc) = Σ weight_i / (k + rank_i)
```

**Default Parameters:**

- `k = 60` (standard across systems)
- `weight_bm25 = 0.5` (50% weight)
- `weight_semantic = 0.5` (50% weight)

**TypeScript Libraries:**

- `rerank-ts` (tensorlakeai) - Production-ready
- Custom implementation (100-150 LOC)

**Decision:** Custom implementation for full control + no dependencies

---

## Current Codebase State

**Already Implemented (Phase indexing-pipeline):**

- ✅ PGLite worker with pgvector
- ✅ Document chunking (paragraph-based, 1000 chars)
- ✅ OpenAI embeddings integration (`text-embedding-3-small`, 1536d)
- ✅ `chunks` table with embeddings
- ✅ Background indexing pipeline
- ✅ VectorDBContext for state management
- ✅ DocumentCard UI components
- ✅ E2E test infrastructure (`@live` tests)

**To Be Implemented:**

- Lunr.js index builder (in worker)
- IndexedDB persistence for Lunr index
- RRF fusion logic
- Search UI components (SearchBar, SearchResults, SearchModeToggle)
- Vector similarity search query (HNSW index usage)
- Hybrid search orchestration
- Performance optimizations

---

## 1. Dependencies

**Install:**

```bash
npm install lunr @types/lunr
```

**Already Installed:**

- `openai` ✅ (embeddings)
- `@electric-sql/pglite` ✅
- `uuid` ✅

**Optional (if using library):**

```bash
npm install rerank-ts  # For RRF (alternative to custom implementation)
```

---

## 2. Database Schema Extensions

### 2.1 HNSW Index on chunks.embedding

**Purpose:** Fast vector similarity search (< 1ms for 10k chunks)

**SQL Schema:**

```sql
-- Add HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON chunks USING hnsw (embedding vector_cosine_ops);
```

**Index Parameters (tunable):**

```sql
CREATE INDEX idx_chunks_embedding_hnsw
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);  -- defaults
```

**Query-Time Tuning:**

```sql
SET hnsw.ef_search = 100;  -- higher = better recall (default 40)
```

**Implementation:** Add to worker `init()` after `CREATE TABLE chunks`

---

### 2.2 No Additional Tables Required

Lunr index stored in IndexedDB (separate from PGLite database)

---

## 3. Worker API Extensions

### 3.1 New Search Methods

**searchSemantic(query: string, limit: number):**

```typescript
interface SearchSemanticParams {
  query: string;
  limit?: number; // default 10
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  heading?: string;
  score: number; // similarity score (0-1)
}

async function searchSemantic(params: SearchSemanticParams): Promise<SearchResult[]> {
  // 1. Get embedding from OpenAI API (reuse existing setOpenAIKey integration)
  const embedding = await generateEmbedding(params.query);

  // 2. Vector similarity search (cosine distance)
  const result = await db.query(
    `
    SELECT
      c.id as chunk_id,
      c.document_id,
      c.content,
      c.heading,
      d.filename,
      1 - (c.embedding <=> $1::vector) AS score
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
  `,
    [JSON.stringify(embedding), params.limit || 10]
  );

  return result.rows;
}
```

**searchBM25(query: string, limit: number):**

```typescript
interface SearchBM25Params {
  query: string;
  limit?: number; // default 10
}

async function searchBM25(params: SearchBM25Params): Promise<SearchResult[]> {
  // Search Lunr index
  const lunrResults = lunrIndex.search(params.query);

  // Map Lunr results to SearchResult format
  return lunrResults.slice(0, params.limit || 10).map((r) => ({
    chunkId: r.ref,
    // Fetch document details from PGLite
    ...fetchChunkDetails(r.ref),
    score: r.score,
  }));
}
```

**searchHybrid(query: string, limit: number, weights?):**

```typescript
interface SearchHybridParams {
  query: string;
  limit?: number; // default 10
  weightBM25?: number; // default 0.5
  weightSemantic?: number; // default 0.5
}

async function searchHybrid(params: SearchHybridParams): Promise<SearchResult[]> {
  // 1. Run both searches in parallel
  const [bm25Results, semanticResults] = await Promise.all([
    searchBM25({ query: params.query, limit: 20 }),
    searchSemantic({ query: params.query, limit: 20 }),
  ]);

  // 2. Apply RRF fusion
  const fusedResults = reciprocalRankFusion(
    bm25Results,
    semanticResults,
    params.weightBM25 || 0.5,
    params.weightSemantic || 0.5
  );

  // 3. Return top N results
  return fusedResults.slice(0, params.limit || 10);
}
```

### 3.2 Lunr Index Management

**buildLunrIndex():**

```typescript
async function buildLunrIndex(): Promise<{ indexed: number }> {
  // Fetch all chunks from database
  const result = await db.query(`
    SELECT id, content, heading, document_id
    FROM chunks
    WHERE content IS NOT NULL
  `);

  // Build Lunr index
  lunrIndex = lunr(function () {
    this.ref('id');
    this.field('content');
    this.field('heading');

    result.rows.forEach((chunk) => {
      this.add({
        id: chunk.id,
        content: chunk.content,
        heading: chunk.heading || '',
      });
    });
  });

  // Serialize to IndexedDB
  await saveLunrIndexToIDB(lunrIndex);

  return { indexed: result.rows.length };
}
```

**loadLunrIndexFromIDB():**

```typescript
async function loadLunrIndexFromIDB(): Promise<boolean> {
  try {
    // Open IndexedDB
    const db = await openIDB();
    const serialized = await db.get('lunr-index');

    if (serialized) {
      lunrIndex = lunr.Index.load(JSON.parse(serialized));
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to load Lunr index from IndexedDB:', error);
    return false;
  }
}
```

**updateLunrIndex(chunkId: string, content: string):**

```typescript
// Incremental update (add/update single chunk)
async function updateLunrIndex(chunkId: string, content: string, heading?: string): Promise<void> {
  // Lunr doesn't support incremental updates directly
  // Options:
  // 1. Rebuild entire index (simple, slower)
  // 2. Use elasticlunr (supports add/remove)
  // 3. Defer updates, rebuild periodically
  // Decision: Rebuild on document upload completion (Phase embeddings completion)
  // Individual chunk updates not supported (would require full rebuild)
}
```

**deleteLunrIndex(documentId: string):**

```typescript
// Remove all chunks for a document
async function deleteLunrIndex(documentId: string): Promise<void> {
  // Lunr doesn't support removal without rebuild
  // Trigger full rebuild when document deleted
  await buildLunrIndex();
}
```

---

## 4. RRF Fusion Implementation

### 4.1 Reciprocal Rank Fusion Algorithm

**File:** `src/workers/rrf.ts` (NEW)

```typescript
export interface RankedResult {
  chunkId: string;
  score: number;
  [key: string]: any; // Allow additional fields
}

export interface RRFResult extends RankedResult {
  rrfScore: number;
  bm25Rank?: number;
  semanticRank?: number;
}

export function reciprocalRankFusion(
  bm25Results: RankedResult[],
  semanticResults: RankedResult[],
  weightBM25: number = 0.5,
  weightSemantic: number = 0.5,
  k: number = 60
): RRFResult[] {
  const scores = new Map<
    string,
    {
      rrfScore: number;
      bm25Rank?: number;
      semanticRank?: number;
      item: RankedResult;
    }
  >();

  // Process BM25 results
  bm25Results.forEach((item, index) => {
    const rank = index + 1;
    const rrfScore = weightBM25 / (k + rank);

    scores.set(item.chunkId, {
      rrfScore,
      bm25Rank: rank,
      item,
    });
  });

  // Process semantic results
  semanticResults.forEach((item, index) => {
    const rank = index + 1;
    const rrfScore = weightSemantic / (k + rank);

    const existing = scores.get(item.chunkId);
    if (existing) {
      existing.rrfScore += rrfScore;
      existing.semanticRank = rank;
    } else {
      scores.set(item.chunkId, {
        rrfScore,
        semanticRank: rank,
        item,
      });
    }
  });

  // Sort by RRF score and return
  return Array.from(scores.entries())
    .map(([chunkId, data]) => ({
      ...data.item,
      chunkId,
      rrfScore: data.rrfScore,
      bm25Rank: data.bm25Rank,
      semanticRank: data.semanticRank,
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
```

### 4.2 Testing RRF

**Unit Test:** `src/workers/rrf.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('Reciprocal Rank Fusion', () => {
  it('combines results from both sources', () => {
    const bm25 = [
      { chunkId: 'A', score: 0.9 },
      { chunkId: 'B', score: 0.7 },
      { chunkId: 'C', score: 0.5 },
    ];

    const semantic = [
      { chunkId: 'B', score: 0.95 },
      { chunkId: 'D', score: 0.85 },
      { chunkId: 'A', score: 0.75 },
    ];

    const result = reciprocalRankFusion(bm25, semantic);

    // B appears in both (rank 2 BM25, rank 1 semantic) → highest RRF score
    expect(result[0].chunkId).toBe('B');
    expect(result[0].bm25Rank).toBe(2);
    expect(result[0].semanticRank).toBe(1);
  });

  it('respects weight parameters', () => {
    const bm25 = [{ chunkId: 'A', score: 0.9 }];
    const semantic = [{ chunkId: 'B', score: 0.9 }];

    // 70% BM25, 30% semantic
    const result = reciprocalRankFusion(bm25, semantic, 0.7, 0.3);

    // A should rank higher due to BM25 weight
    expect(result[0].chunkId).toBe('A');
  });

  it('handles empty results gracefully', () => {
    const result = reciprocalRankFusion([], []);
    expect(result).toEqual([]);
  });

  it('handles single-source results', () => {
    const bm25 = [{ chunkId: 'A', score: 0.9 }];
    const result = reciprocalRankFusion(bm25, []);

    expect(result.length).toBe(1);
    expect(result[0].chunkId).toBe('A');
  });
});
```

---

## 5. Search UI Components

### 5.1 SearchBar Component

**Location:** `src/components/search/SearchBar.tsx` (NEW)

**Features:**

- Input field with search icon
- Search mode toggle (Hybrid / BM25 / Semantic)
- Clear button
- Loading indicator during search
- Keyboard shortcuts (Enter to search, Esc to clear)

**Props:**

```typescript
interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  isSearching: boolean;
}

type SearchMode = 'hybrid' | 'bm25' | 'semantic';
```

**Data Attributes:**

```typescript
data-testid="input-search-query"
data-testid="button-search"
data-testid="button-clear-search"
data-testid="toggle-search-mode"
data-search-mode="hybrid|bm25|semantic"
data-searching="true|false"
```

### 5.2 SearchResults Component

**Location:** `src/components/search/SearchResults.tsx` (NEW)

**Features:**

- List of search results with chunk content
- Document filename, heading context
- Relevance score display
- Highlight query terms in results
- Click to navigate to full document
- Empty state when no results
- Debug info (BM25 rank, semantic rank, RRF score)

**Props:**

```typescript
interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  mode: SearchMode;
  onResultClick: (documentId: string) => void;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  heading?: string;
  score: number;
  rrfScore?: number;
  bm25Rank?: number;
  semanticRank?: number;
}
```

**Data Attributes:**

```typescript
data-testid="div-search-results"
data-testid="div-search-result-{chunkId}"
data-result-score="{score}"
data-result-rrf-score="{rrfScore}"
data-bm25-rank="{rank}"
data-semantic-rank="{rank}"
```

### 5.3 SearchPage Component

**Location:** `src/pages/SearchPage.tsx` (NEW)

**Layout:**

```
┌────────────────────────────────────────┐
│  Search                                │
│  ┌──────────────────────────────────┐  │
│  │ Enter search query...        [🔍] │  │
│  └──────────────────────────────────┘  │
│  [Hybrid] [BM25] [Semantic]            │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 📄 filename.md                    │  │
│  │ ## Heading Context                │  │
│  │ ...matching content with          │  │
│  │ highlighted query terms...        │  │
│  │ Score: 0.85 | RRF: 0.0145         │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 📄 another-doc.md                 │  │
│  │ ...                               │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**State Management:**

```typescript
const [query, setQuery] = useState('');
const [mode, setMode] = useState<SearchMode>('hybrid');
const [results, setResults] = useState<SearchResult[]>([]);
const [isSearching, setIsSearching] = useState(false);
```

**Integration with VectorDBContext:**

```typescript
const { search } = useVectorDB();

const handleSearch = async (query: string, mode: SearchMode) => {
  setIsSearching(true);
  try {
    const results = await search(query, mode);
    setResults(results);
  } finally {
    setIsSearching(false);
  }
};
```

---

## 6. Context & State Management

### 6.1 VectorDBContext Extensions

**Location:** `src/contexts/VectorDBContext.tsx` (EXTEND EXISTING)

**Add State:**

```typescript
interface VectorDBContextType {
  // ... existing fields
  search: (query: string, mode: SearchMode, limit?: number) => Promise<SearchResult[]>;
  searchBM25: (query: string, limit?: number) => Promise<SearchResult[]>;
  searchSemantic: (query: string, limit?: number) => Promise<SearchResult[]>;
  searchHybrid: (query: string, limit?: number) => Promise<SearchResult[]>;
}
```

**Implementation:**

```typescript
const search = async (
  query: string,
  mode: SearchMode = 'hybrid',
  limit: number = 10
): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  switch (mode) {
    case 'bm25':
      return worker.searchBM25({ query, limit });
    case 'semantic':
      return worker.searchSemantic({ query, limit });
    case 'hybrid':
    default:
      return worker.searchHybrid({ query, limit });
  }
};
```

---

## 7. Incremental TDD Workflow (6 Phases)

### **Phase lunr-foundation**: Lunr.js Integration & BM25 Search

**Goal:** Lunr index builds alongside embeddings, BM25-only search works

**Build:**

- Install lunr + types
- Add Lunr index builder to worker
- Integrate with existing chunking/embedding pipeline
- Store chunk metadata for Lunr (id, content, heading)
- Implement `searchBM25()` worker method
- Create basic SearchPage with BM25-only mode

**Test:** `e2e/search-bm25.spec.ts @live` (NEW)

```typescript
test('BM25 search returns relevant results', async ({ page }) => {
  // Upload document with known content
  // Build Lunr index (wait for indexing completion)
  // Search for exact keyword
  // Assert: results contain expected chunks
  // Assert: results ranked by BM25 score
});
```

**Pass Criteria:**

- ✅ Lunr index builds successfully
- ✅ BM25 search returns results
- ✅ Results ranked by relevance
- ✅ Exact keyword matches work

**Checkpoint:** BM25 search functional

---

### **Phase lunr-persistence**: IndexedDB Serialization

**Goal:** Lunr index persists across page reloads

**Build:**

- Implement IndexedDB wrapper for Lunr index
- Serialize index after indexing completion
- Load index on worker init
- Handle index updates (rebuild on document changes)

**Test:** Extend `e2e/search-bm25.spec.ts @live`

```typescript
test('Lunr index persists after reload', async ({ page }) => {
  // Upload + index document
  // Search (verify results)
  // Reload page
  // Search again (same query)
  // Assert: same results without re-indexing
});
```

**Pass Criteria:**

- ✅ Index serializes to IndexedDB
- ✅ Index loads on startup
- ✅ Search works after reload without rebuild

**Checkpoint:** Persistence complete

---

### **Phase rrf-fusion**: Hybrid Search with RRF

**Goal:** Combine BM25 + semantic results with RRF

**Build:**

- Implement RRF function (`src/workers/rrf.ts`)
- Add unit tests for RRF
- Implement `searchSemantic()` worker method (pgvector similarity)
- Implement `searchHybrid()` worker method (RRF fusion)
- Add HNSW index to chunks.embedding

**Test:** `e2e/search-hybrid.spec.ts @live` (NEW)

```typescript
test('Hybrid search combines BM25 and semantic results', async ({ page }) => {
  // Upload document
  // Search with query that matches:
  //   - Exact keywords (BM25)
  //   - Conceptual similarity (semantic)
  // Compare results across modes:
  //   - BM25-only
  //   - Semantic-only
  //   - Hybrid (RRF)
  // Assert: hybrid results blend both strategies
});
```

**Pass Criteria:**

- ✅ RRF unit tests pass
- ✅ Semantic search works (pgvector)
- ✅ Hybrid search returns fused results
- ✅ Results ranked by RRF score

**Checkpoint:** Hybrid search functional

---

### **Phase search-ui**: Search Interface & Mode Toggle

**Goal:** User-friendly search UI with mode switching

**Build:**

- Create SearchBar component
- Create SearchResults component
- Create SearchPage layout
- Add search mode toggle (Hybrid / BM25 / Semantic)
- Integrate with VectorDBContext
- Add routing (`/search` route)
- Query term highlighting in results

**Test:** `e2e/search-ui.spec.ts` (NEW)

```typescript
test('Search UI allows mode switching', async ({ page }) => {
  // Navigate to /search
  // Upload + index document
  // Enter search query
  // Switch between modes
  // Assert: results update for each mode
  // Assert: mode toggle state persists
});

test('Search results display correctly', async ({ page }) => {
  // Search for query
  // Assert: results show filename, heading, content
  // Assert: scores displayed
  // Assert: click result navigates to document
});
```

**Pass Criteria:**

- ✅ SearchPage accessible via /search route
- ✅ Mode toggle works (Hybrid/BM25/Semantic)
- ✅ Results display with metadata
- ✅ Query highlighting works

**Checkpoint:** Search UI complete

---

### **Phase performance**: Optimization & Web Workers

**Goal:** Fast index building, smooth UX

**Build:**

- Move Lunr index building to Web Worker (non-blocking)
- Implement progress indicator for index building
- Pre-build index optimization (serialize immediately after indexing)
- Benchmark search performance (<10ms target)
- Add index statistics (document count, index size)

**Test:** Performance verification (manual + automated)

```typescript
test('Lunr index builds in background', async ({ page }) => {
  // Upload large document (5k+ words)
  // Monitor UI responsiveness during indexing
  // Assert: UI not blocked during Lunr index build
  // Assert: progress indicator shown
});
```

**Pass Criteria:**

- ✅ Index building doesn't block UI
- ✅ Progress indicator works
- ✅ Search latency <10ms (10k chunks)

**Checkpoint:** Performance optimized

---

### **Phase search-quality**: Tuning & Customization

**Goal:** Improve search relevance and quality

**Build:**

- Customize Lunr tokenization (code-aware)
- Tune stemming for technical content
- Add stop words filtering
- Implement query expansion (optional)
- A/B test RRF weight parameters
- Document tuning guidelines

**Test:** Quality verification (manual)

- Test with real documents from codebase
- Compare results across configurations
- Gather user feedback on relevance

**Pass Criteria:**

- ✅ Search quality subjectively improved
- ✅ Technical terms handled correctly
- ✅ Code snippets searchable

**Checkpoint:** Search quality tuned

---

## 8. Testing Strategy

### 8.1 E2E Test Files

```
e2e/
├── search-bm25.spec.ts           (✅ NEW @live - Phase lunr-foundation + lunr-persistence)
├── search-hybrid.spec.ts         (✅ NEW @live - Phase rrf-fusion)
└── search-ui.spec.ts             (✅ NEW - Phase search-ui)
```

### 8.2 Unit Tests

```
src/
├── workers/
│   ├── rrf.test.ts               (✅ NEW - RRF algorithm)
│   └── lunr-utils.test.ts        (✅ NEW - Lunr helpers)
```

### 8.3 Test Data

**Reuse Existing PG Essays:**

- Use `e2e/fixtures/pg-essays.ts` (5 essays already available)
- Shortest: `078_the_equity_equation.md` (1,142 words)

**Test Queries:**

```typescript
const TEST_QUERIES = {
  exact: 'equity startup founder', // BM25 should excel
  conceptual: 'company ownership distribution', // Semantic should excel
  hybrid: 'startup equity compensation', // Both should contribute
};
```

---

## 9. Implementation Checklist

### Phase lunr-foundation ⏳ PENDING

- [ ] Install lunr + @types/lunr
- [ ] Add Lunr index builder to worker
- [ ] Integrate with chunking pipeline
- [ ] Implement searchBM25() worker method
- [ ] Create SearchPage (BM25-only)
- [ ] Create search-bm25.spec.ts @live
- [ ] ✅ BM25 search works

### Phase lunr-persistence ⏳ PENDING

- [ ] Implement IndexedDB wrapper (save/load)
- [ ] Serialize Lunr index after indexing
- [ ] Load Lunr index on worker init
- [ ] Extend search-bm25.spec.ts (persistence test)
- [ ] ✅ Index persists across reloads

### Phase rrf-fusion ⏳ PENDING

- [ ] Implement RRF function (src/workers/rrf.ts)
- [ ] Write RRF unit tests
- [ ] Implement searchSemantic() worker method
- [ ] Add HNSW index to chunks.embedding
- [ ] Implement searchHybrid() worker method
- [ ] Create search-hybrid.spec.ts @live
- [ ] ✅ Hybrid search works

### Phase search-ui ⏳ PENDING

- [ ] Create SearchBar component
- [ ] Create SearchResults component
- [ ] Create SearchPage layout
- [ ] Add search mode toggle
- [ ] Integrate with VectorDBContext
- [ ] Add /search route
- [ ] Implement query highlighting
- [ ] Create search-ui.spec.ts
- [ ] ✅ Search UI complete

### Phase performance ⏳ PENDING

- [ ] Move Lunr indexing to Web Worker
- [ ] Add progress indicator
- [ ] Benchmark search performance
- [ ] Optimize serialization (compression)
- [ ] ✅ Performance targets met

### Phase search-quality ⏳ PENDING

- [ ] Customize Lunr tokenization
- [ ] Tune stemming for technical content
- [ ] Add stop words filtering
- [ ] A/B test RRF weights
- [ ] Document tuning guidelines
- [ ] ✅ Search quality improved

---

## 10. Acceptance Criteria

**Phase hybrid-search complete when:**

### Functionality ✅

- [ ] BM25 search works (Lunr.js)
- [ ] Semantic search works (pgvector)
- [ ] Hybrid search combines both (RRF)
- [ ] Search UI accessible (/search route)
- [ ] Mode toggle works (Hybrid/BM25/Semantic)
- [ ] Results display with metadata
- [ ] Index persists across reloads

### E2E Tests ✅

- [ ] search-bm25.spec.ts @live passing
- [ ] search-hybrid.spec.ts @live passing
- [ ] search-ui.spec.ts passing
- [ ] All existing tests still pass

### Performance ✅

- [ ] Index building <2s (5k chunks)
- [ ] Search latency <10ms
- [ ] UI not blocked during indexing
- [ ] IndexedDB storage efficient

### Quality ✅

- [ ] TypeScript compilation passing
- [ ] Build successful
- [ ] No console errors
- [ ] Manual testing verified

---

## 11. Known Constraints & Trade-offs

**Decisions:**

- ✅ **Lunr.js** over FlexSearch (more established, proven BM25)
- ✅ **Custom RRF** over library (full control, no dependencies)
- ✅ **IndexedDB** for Lunr index (separate from PGLite)
- ✅ **Rebuild on changes** (Lunr doesn't support incremental updates)
- ✅ **OpenAI embeddings** (no Transformers.js per user requirement)

**Limitations:**

- Lunr practical limit: ~50k chunks (10k sweet spot)
- Index rebuild on document changes (no incremental updates)
- Safari deletes IndexedDB after 7 days inactivity

**Performance Expectations:**

- Index build: 1-2s for 5k chunks
- Search latency: <10ms (in-memory)
- Storage: ~5-10MB for 10k chunks (serialized + gzip)

---

## 12. Research References

**Lunr.js:**

- Official docs: https://lunrjs.com/
- GitHub: https://github.com/olivernn/lunr.js
- Pre-building indexes: https://lunrjs.com/guides/index_prebuilding.html

**RRF Implementations:**

- TypeScript guide: https://alexop.dev/tils/reciprocal-rank-fusion-typescript-vue/
- rerank-ts library: https://github.com/tensorlakeai/rerank-ts

**React + IndexedDB:**

- react-indexed-db-hook: https://www.npmjs.com/package/react-indexed-db
- Custom hooks: https://medium.com/@abgkcode/indexeddb-in-react-with-typescript-a-reusable-hook-you-can-drop-into-any-app-6d0c7af1c5db

**Hybrid Search Theory:**

- ParadeDB guide: https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual
- VectorChord guide: https://docs.vectorchord.ai/vectorchord/use-case/hybrid-search.html

---

## 13. Next Steps After Completion

After Phase hybrid-search complete:

- **Phase chat-rag-integration:** Integrate search with useChat hook for RAG
- **Phase document-preview:** Click search result → preview document with highlighted chunk
- **Phase search-analytics:** Track search queries, click-through rates, relevance feedback
