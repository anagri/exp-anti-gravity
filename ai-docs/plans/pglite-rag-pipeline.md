# PGlite + pgvector RAG Pipeline Implementation Plan

**Created:** 2025-01-19
**Status:** Planning
**Goal:** Convert OpenAI chat app to browser-based RAG application using PGlite + pgvector

---

## 🚨 DEVELOPMENT APPROACH - READ FIRST

### Mandatory Test-Driven Development (TDD) Workflow

**THIS PLAN FOLLOWS STRICT TDD PRACTICES. EACH PHASE MUST BE COMPLETED WITH FULL TEST COVERAGE BEFORE PROCEEDING.**

#### Phase Completion Requirements

For **EVERY PHASE**, you MUST:

1. ✅ **Write Tests First** (where applicable)
   - Write unit tests for functions/logic
   - Write integration tests for component interactions
   - Write E2E tests for user flows

2. ✅ **Implement Code**
   - Implement the feature to make tests pass
   - Follow existing code style and patterns
   - Add proper TypeScript types

3. ✅ **Run All Tests**

   ```bash
   npm test                    # Run unit tests
   npm run test:e2e           # Run E2E tests (if applicable)
   npm run lint               # Check code style
   npm run build              # Verify TypeScript compilation
   ```

4. ✅ **Verify Tests Pass**
   - ALL existing tests must still pass
   - ALL new tests must pass
   - NO test failures tolerated
   - Fix any issues before proceeding

5. ✅ **Commit Changes**

   ```bash
   git add .
   git commit -m "<type>(scope): description"
   ```

   - Use conventional commit format
   - Include test files in commit
   - Verify commit doesn't break tests

6. ✅ **Proceed to Next Phase**
   - Only move forward when ALL tests pass
   - Phase completion checklist must be 100% complete

### Commit Message Conventions

**Format:** `<type>(scope): <description>`

**Types:**

- `feat(scope)`: New feature implementation
- `fix(scope)`: Bug fix
- `test(scope)`: Test additions or modifications
- `refactor(scope)`: Code refactoring (no functional changes)
- `perf(scope)`: Performance improvements
- `build(scope)`: Build system or dependency changes
- `chore(scope)`: Maintenance tasks

**Scopes:**

- `setup`, `worker`, `upload`, `indexing`, `rag`, `ui`, `state`, `perf`, `build`, `deploy`

**Examples:**

```bash
git commit -m "feat(worker): implement PGlite worker with pgvector schema"
git commit -m "test(upload): add file upload integration tests"
git commit -m "fix(indexing): handle rate limit errors with exponential backoff"
```

### Testing Strategy

**E2E-First Approach (Fewer Tests, More Steps):**

- E2E tests are expensive to run and maintain
- Write 2-3 comprehensive tests per phase covering complete workflows
- Each test should have multiple steps and assertions
- Example: Single "CRUD workflow" test covers upload → verify → delete → verify
- Avoid 10+ granular E2E tests - combine related actions

**Unit Tests - Selective:**

- Only for complex component interaction, state updates, algorithms
- NOT for: TypeScript types, schema definitions, third-party libraries
- NOT for: Worker internals (use E2E instead due to Vitest+jsdom+Comlink compatibility issues)
- Focus on behavior, not implementation details

**Integration Tests:**

- Component + context interaction
- Data flow between layers
- Mock external APIs (OpenAI) using MSW

#### Test Types by Phase

| Phase                                 | Unit Tests        | Integration Tests      | E2E Tests         |
| ------------------------------------- | ----------------- | ---------------------- | ----------------- |
| worker-setup: Worker + Documents Page | ✅ Core logic     | ✅ Context integration | ✅ Document CRUD  |
| indexing-pipeline: Indexing           | ✅ Chunking/Retry | ✅ API mocking         | ✅ Full pipeline  |
| vector-search: Search                 | ✅ Query logic    | ✅ HNSW queries        | ✅ RAG flow       |
| ui-components: UI                     | ✅ Components     | ✅ Interactions        | ✅ UI workflows   |
| state-management: State               | ✅ Hooks/Context  | ✅ Propagation         | ✅ Persistence    |
| performance: Perf                     | ✅ Algorithms     | ✅ Benchmarks          | ✅ Large datasets |
| build-config: Build                   | ✅ Config         | ✅ Build output        | ❌                |
| deployment: Deploy                    | ✅ All passing    | ✅ All passing         | ✅ Production     |

#### Test File Organization

```
src/
├── workers/
│   ├── pglite.worker.ts
│   └── pglite.worker.test.ts         # Unit tests for worker
├── hooks/
│   ├── useVectorDB.ts
│   └── useVectorDB.test.ts           # Unit tests for hook
├── components/
│   ├── FileUpload.tsx
│   └── FileUpload.test.tsx           # Component unit tests
└── test/
    ├── setup.ts                       # Vitest + MSW setup
    ├── fixtures/                      # Test data fixtures
    │   ├── sample-documents.ts
    │   └── mock-embeddings.ts
    └── helpers/                       # Test utilities
        ├── db-helpers.ts
        └── worker-helpers.ts

e2e/
├── upload.spec.ts                     # E2E: File upload flow
├── indexing.spec.ts                   # E2E: Indexing pipeline
├── search.spec.ts                     # E2E: Vector search & RAG
└── integration.spec.ts                # E2E: Full user journey
```

### Quality Gates

**Before Committing Any Phase:**

```bash
# 1. Run all tests
npm test                                   # Must pass 100%

# 2. Run E2E tests (if phase includes E2E)
npm run test:e2e                          # Must pass 100%

# 3. Check linting
npm run lint                              # No errors allowed

# 4. Verify TypeScript
npm run build                             # Must compile successfully

# 5. Manual verification
# - Test feature in browser
# - Verify no console errors
# - Check functionality works as expected
```

**If ANY of these fail:**

- ❌ DO NOT COMMIT
- ❌ DO NOT PROCEED TO NEXT PHASE
- ✅ FIX THE ISSUES FIRST

### Phase Completion Checklist Template

Use this checklist for EVERY phase:

```markdown
### Phase <phase-id> Completion Checklist

Implementation:

- [ ] Code written following plan specifications
- [ ] TypeScript types properly defined
- [ ] Error handling implemented
- [ ] Code follows existing patterns

Testing:

- [ ] Unit tests written and passing
- [ ] Integration tests written and passing (if required)
- [ ] E2E tests written and passing (if required)
- [ ] All existing tests still passing
- [ ] Test coverage adequate (>80% for new code)

Quality:

- [ ] No TypeScript errors (npm run build)
- [ ] No lint errors (npm run lint)
- [ ] No console errors in browser
- [ ] Manual testing completed successfully

Documentation:

- [ ] Code comments added for complex logic
- [ ] Type definitions documented
- [ ] README updated (if needed)

Git:

- [ ] Changes committed with conventional commit message
- [ ] Commit verified (tests still pass after commit)
- [ ] Ready to proceed to next phase
```

### Debugging Failed Tests

If tests fail:

1. **Read the error message carefully**
   - What test failed?
   - What was expected vs actual?

2. **Run single test in isolation**

   ```bash
   npx vitest run path/to/test.test.ts    # Single test file
   npx playwright test path/to/spec.ts    # Single E2E test
   ```

3. **Use debugging tools**

   ```bash
   npx vitest --ui                        # Vitest UI mode
   npx playwright test --debug            # Playwright debug mode
   ```

4. **Check test setup**
   - Is MSW configured correctly?
   - Are test fixtures loaded?
   - Is test environment correct?

5. **Fix and re-run**
   - Fix the code
   - Re-run tests
   - Repeat until all pass

---

## Executive Summary

Transform the existing React + OpenAI chat application into a fully client-side RAG (Retrieval-Augmented Generation) application using:

- **PGlite + pgvector**: PostgreSQL WASM with vector search (3MB, IndexedDB persistence)
- **OPFS**: Raw file storage for uploaded markdown/text files
- **Web Workers**: Background processing for chunking and embedding
- **OpenAI API**: text-embedding-3-small (1536 dims) for embeddings
- **LangChain**: Markdown text splitting with semantic awareness

All processing happens in the browser. No backend required. Deployable to GitHub Pages/S3.

---

## Research Findings & Context

### Why PGlite + pgvector?

After comprehensive research comparing all browser vector database options, PGlite + pgvector emerged as the best choice:

**Alternatives Evaluated:**

1. **Orama** - 2KB bundle, built-in RAG, but proprietary algorithms, smaller ecosystem
2. **DuckDB-WASM + vss** - Excellent for analytics + vectors, but heavier for simple RAG
3. **hnswlib-wasm** - Pure HNSW, but experimental and no SQL layer
4. **sqlite-vec** - NO HNSW support yet (brute force only), dealbreaker for performance
5. **MeMemo** - Research project, 94 min to index 1M vectors

**PGlite Advantages:**

- ✅ Full PostgreSQL compatibility (battle-tested)
- ✅ pgvector = industry standard (Supabase, Neon, etc.)
- ✅ HNSW indexes for fast approximate search
- ✅ SQL + vectors = complex queries with filters
- ✅ 3MB bundle (acceptable, includes full DB)
- ✅ IndexedDB persistence (Safari compatible)
- ✅ Multi-tab support with leader election
- ✅ Future-proof: can sync with cloud Postgres later

**Key Performance Metrics:**

- CRUD queries: <0.3ms
- Multi-row selects: sub-frame
- HNSW: no training step, incremental build
- Better than IVFFlat for query performance

### Storage Technology Decisions

| Technology | Choice                          | Rationale                                       |
| ---------- | ------------------------------- | ----------------------------------------------- |
| Vector DB  | PGlite (IndexedDB)              | Safari support, mature, 60% disk quota          |
| Raw Files  | OPFS (optional) or IndexedDB    | OPFS faster but Safari limited, IndexedDB safer |
| Processing | Web Worker (not Service Worker) | OPFS sync access handles require Web Worker     |

**Storage Limits (Chromium):**

- IndexedDB: Up to 60% of disk space (~307GB on 512GB disk)
- OPFS: Same quota as IndexedDB
- Safari: ~20% of disk space (iOS 17+)

**IMPORTANT:** PGlite recommends IndexedDB over OPFS for browser usage due to Safari limitations:

- OPFS requires Web Worker (not available in main thread)
- Safari has 252 sync access handle limit (Postgres needs 300+ files)
- IndexedDB works everywhere with relaxedDurability mode

### Web Worker vs Service Worker

**Our Choice: Web Worker (Dedicated Worker)**

| Feature          | Web Worker               | Service Worker          |
| ---------------- | ------------------------ | ----------------------- |
| OPFS Sync Access | ✅ Yes                   | ❌ No                   |
| Multi-tab Shared | ❌ No (use PGliteWorker) | ✅ Yes                  |
| Lifecycle        | Page-bound               | Persistent              |
| Use Case         | Computation, DB access   | Caching, offline, proxy |

**Pattern:**

- Main Thread: React UI, file upload, progress display
- Web Worker: PGlite instance, chunking, embedding coordination
- Multi-tab: PGliteWorker with leader election

### OpenAI Embeddings Best Practices

**Model:** text-embedding-3-small

- Dimensions: 1536
- Cost: $0.13 per 1M tokens
- Max input: 8,191 tokens per request
- Rate limits: 3,000 RPM, 200,000 TPM (default tier)

**Batching Strategy:**

- Batch size: 100 chunks per API call (recommended by OpenAI)
- Exponential backoff on 429 rate limit errors
- Token estimation: ~666 tokens per 500-word markdown page

**Cost Estimation:**

- 100 documents: ~$0.01
- 1,000 documents: ~$0.10
- 10,000 documents: ~$1.00

**Alternative: Batch API**

- 50% cost reduction
- 24-hour processing time
- Good for large initial uploads (1000+ docs)
- Use standard API for incremental adds

### pgvector HNSW Index Parameters

**Index Creation:**

```sql
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Parameters Explained:**

- **m**: Max edges per vector in graph (default: 16)
  - Higher = better recall, more memory
  - Small datasets: 16
  - Medium (10K-100K): 24
  - Large (>100K): 32

- **ef_construction**: Candidate queue size during build (default: 64)
  - Higher = better quality, slower build
  - Small datasets: 64
  - Medium: 100
  - Large: 200

- **ef_search**: Query-time parameter (runtime setting)
  - Controls search accuracy vs speed
  - Set via: `SET hnsw.ef_search = 100;`
  - Default: 40, increase for better recall

**Performance Optimization:**

- HNSW has no training step (unlike IVFFlat)
- Can create index on empty table, builds incrementally
- For bulk insert: use COPY with FORMAT BINARY
- Set `max_parallel_maintenance_workers` for faster builds

**Insert Performance:**

- Inserts are slower with HNSW active
- Options:
  1. Build index after all inserts (fast bulk, slow first query)
  2. Incremental build (slower inserts, ready immediately)
  3. Hybrid: disable during bulk, enable for incremental

### LangChain Text Splitting

**Markdown-Specific Splitter:**

```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
  chunkSize: 1000, // ~750 words
  chunkOverlap: 200, // 20% overlap for context preservation
});
```

**Why These Values:**

- 1000 tokens = good balance (context vs granularity)
- 200 overlap = prevents losing info at boundaries
- Recursive splitting: `\n\n` → `\n` → ` ` (preserves structure)

**Alternative: Header-Aware Splitting**

```typescript
import { MarkdownHeaderTextSplitter } from '@langchain/textsplitters';

const headerSplitter = new MarkdownHeaderTextSplitter({
  headersToSplitOn: [
    ['##', 'Section'],
    ['###', 'Subsection'],
  ],
});
```

Captures heading hierarchy as metadata (improves retrieval context).

### PGlite Multi-tab Worker Pattern

**Problem:** PGlite has single exclusive connection, can't open from multiple tabs simultaneously.

**Solution:** PGliteWorker with leader election

```typescript
// worker.ts
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { worker } from '@electric-sql/pglite/worker';

const pg = await PGlite.create({
  dataDir: 'idb://rag-vectors',
  extensions: { vector },
});

worker({ pg });
```

```typescript
// main.ts
import { PGliteWorker } from '@electric-sql/pglite/worker';

const db = new PGliteWorker(
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
);

// Leader election happens automatically
db.onLeaderChange(() => {
  console.log('Leader changed, this tab is now:', db.isLeader);
});
```

**How It Works:**

1. Each tab starts own worker
2. Workers run election to nominate leader
3. Only leader initializes PGlite and processes queries
4. Non-leader workers proxy to leader
5. When leader tab closes, new election occurs

**For Our Use Case:**

- Only leader worker processes indexing queue
- All workers can read/search vectors
- Leader handles background embedding jobs

---

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Thread (React)                      │
│  • UI Components (Upload, Chat, Document Manager)               │
│  • State Management (Context, Hooks)                            │
│  • File Upload Handling                                         │
│  • Progress Display                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │ Comlink RPC
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Web Worker (PGlite + Processing)             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PGlite Instance (IndexedDB: idb://rag-vectors)         │   │
│  │  • pgvector extension loaded                            │   │
│  │  • Tables: documents, chunks, indexing_queue            │   │
│  │  • HNSW index on embeddings                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Indexing Pipeline                                      │   │
│  │  1. Read file from OPFS/IndexedDB                       │   │
│  │  2. Chunk with LangChain                                │   │
│  │  3. Batch embed with OpenAI API                         │   │
│  │  4. Insert vectors into PGlite                          │   │
│  │  5. Update queue status                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Vector Search                                          │   │
│  │  • Query embedding generation                           │   │
│  │  • HNSW similarity search                               │   │
│  │  • Result ranking & filtering                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Storage Layer                                   │
│  ┌────────────────────────┐  ┌─────────────────────────────┐   │
│  │  IndexedDB             │  │  OPFS (Optional)            │   │
│  │  • PGlite database     │  │  • Raw uploaded files       │   │
│  │  • Vector indexes      │  │  • Faster file I/O          │   │
│  │  • Document metadata   │  │  • Worker-only access       │   │
│  └────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    External APIs                                 │
│  • OpenAI Embeddings API (text-embedding-3-small)               │
│  • OpenAI Chat API (existing, enhanced with RAG context)        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

**Note:** Database tables and indexes are created incrementally across phases:

- **Phase worker-setup:** Documents table (basic file metadata storage)
- **Phase indexing-pipeline:** Indexing queue + Chunks tables (job queue and embeddings storage)
- **Phase vector-search:** HNSW index on chunks (fast vector search)

#### File Upload Flow

```
User Selects Files (.md, .txt)
         │
         ↓
Main Thread: Validate files (type, size)
         │
         ↓
Main Thread: Read file content (FileReader API)
         │
         ↓
Worker RPC: uploadFile({ filename, content, mimeType })
         │
         ↓
Worker: Generate UUID
         │
         ↓
Worker: Store in OPFS (optional) or keep in PGlite
         │
         ↓
Worker: INSERT INTO documents (id, filename, content, ...)
         │
         ↓
Worker: INSERT INTO indexing_queue (document_id, status='pending')
         │
         ↓
Worker: Return document ID to main thread
         │
         ↓
Main Thread: Update UI (show in document list)
         │
         ↓
Main Thread: Display indexing status (pending)
```

#### Background Indexing Flow

```
Worker: Poll indexing_queue for status='pending'
         │
         ↓
Worker: UPDATE status='processing', started_at=NOW()
         │
         ↓
Worker: Read document content from PGlite/OPFS
         │
         ↓
Worker: Chunk with LangChain MarkdownTextSplitter
         │ (Emit progress: "Chunking... 1 of 1 files")
         ↓
Worker: Extract metadata (headings, positions)
         │
         ↓
Worker: Create batches (100 chunks per batch)
         │
         ↓
┌────────────────────────────────────────────────────┐
│  FOR EACH BATCH:                                   │
│    │                                               │
│    ↓                                               │
│  Worker: Call OpenAI embeddings API               │
│    │ POST /v1/embeddings                          │
│    │ { model: 'text-embedding-3-small',           │
│    │   input: [...100 chunks],                    │
│    │   dimensions: 1536 }                         │
│    │                                               │
│    ↓                                               │
│  Worker: Receive embeddings                       │
│    │ (Emit progress: "Embedding... batch X of Y") │
│    │                                               │
│    ↓                                               │
│  Worker: INSERT chunks with embeddings            │
│    │ (Batch INSERT for performance)               │
│    │ (Emit progress: "Indexing... X of Y chunks") │
│    │                                               │
│    ↓                                               │
│  Retry on rate limit (429) with backoff           │
└────────────────────────────────────────────────────┘
         │
         ↓
Worker: UPDATE documents SET chunk_count=X, indexed_at=NOW()
         │
         ↓
Worker: UPDATE indexing_queue SET status='completed', completed_at=NOW()
         │
         ↓
Worker: Emit event to main thread (indexing_completed)
         │
         ↓
Main Thread: Update UI (show "Indexed" status)
```

#### Vector Search Flow

```
User enters question in chat
         │
         ↓
Main Thread: Check if RAG mode enabled
         │
         ├─ No → Normal chat (existing flow)
         │
         └─ Yes ↓
              │
              ↓
Worker RPC: search(query, topK=10)
         │
         ↓
Worker: Generate query embedding
         │ POST /v1/embeddings
         │ { model: 'text-embedding-3-small',
         │   input: query,
         │   dimensions: 1536 }
         │
         ↓
Worker: Execute HNSW search
         │ SELECT c.content, c.heading, d.filename,
         │        1 - (c.embedding <=> $1::vector) as similarity
         │ FROM chunks c
         │ JOIN documents d ON c.document_id = d.id
         │ ORDER BY c.embedding <=> $1::vector
         │ LIMIT $2
         │
         ↓
Worker: Return top-k results
         │ [{ content, heading, filename, similarity }, ...]
         │
         ↓
Main Thread: Format RAG context
         │ Context:
         │ [Document: file1.md, Section: Introduction]
         │ {chunk content}
         │
         │ [Document: file2.md, Section: Overview]
         │ {chunk content}
         │
         ↓
Main Thread: Inject into OpenAI chat prompt
         │ System: "Use the following context to answer..."
         │ Context: {formatted chunks}
         │ User: {original question}
         │
         ↓
Main Thread: Stream response with citations
         │
         ↓
Main Thread: Display answer + sources
```

---

## Testing Infrastructure & Setup

### Test Environment Requirements

**Test Setup Configuration:**

- MSW server already configured in existing test/setup.ts
- Continue using existing Vitest configuration
- Clean IndexedDB databases before each test to ensure fresh state

**Testing Approach - YAGNI Principle:**

Create test helpers and fixtures ONLY when actually needed:

1. **Write Tests First**: Start with inline test data in each test
2. **Extract When Duplicated**: If 3+ tests need same setup, create helper
3. **Keep It Simple**: Prefer simple test data over complex fixtures

**Common Patterns to Watch For:**

- Database setup: Extract helper when pattern stabilizes across 3+ tests
- Test data: Start inline, extract only if repeated
- Worker helpers: Create when worker tests actually need them
- Mock handlers: Add to MSW handlers as needed for each phase

**Create Incrementally by Phase:**

- Phase worker-setup: Basic worker test helpers (if needed)
- Phase indexing-pipeline: Embedding/chunking mocks (when those tests written)
- Phase vector-search: Vector search test data (when search tests written)

Don't create "just in case" test infrastructure.

---

## Implementation Plan

### Phase worker-setup: PGlite Worker Setup + Full-Featured Documents Page

**Status:** ⚠️ **IN PROGRESS** - Core features complete, optional enhancements pending

**Goal:** Browser-based PostgreSQL with full document management UI + comprehensive E2E tests

---

#### ✅ COMPLETED REQUIREMENTS

**Dependencies Installed:**

- ✅ @electric-sql/pglite@^0.3.14 (PGlite with pgvector)
- ✅ comlink@^4.4.2 (Web Worker RPC)
- ✅ uuid@^13.0.0 (UUID generation)
- ✅ @types/uuid@^10.0.0 (TypeScript types)
- ✅ @radix-ui/react-dialog@^1.1.15 (Modal component - already present)

**TypeScript Configuration:**

- ✅ tsconfig.worker.json created (WebWorker lib, ES2020)
- ✅ vite.config.ts updated (worker format: 'es', exclude PGlite from optimizeDeps)

**Core Infrastructure:**

- ✅ PGlite worker (`src/workers/pglite.worker.ts`) with singleton pattern
- ✅ Worker client (`src/lib/pglite-client.ts`) with Comlink RPC
- ✅ Database: IndexedDB (idb://rag-vectors) with relaxedDurability
- ✅ pgvector extension enabled (ready for Phase indexing-pipeline)
- ✅ Documents table with UUID, filename, content, size, mimeType, uploaded_at

**Worker API Implemented:**

- ✅ `init()` - Initialize database, return ready status
- ✅ `uploadDocument(file)` - Insert document, return UUID
- ✅ `getDocuments()` - Query all documents (ordered by uploaded_at DESC)
- ✅ `deleteDocument(id)` - Delete by ID

**React Context & State:**

- ✅ VectorDBContext (`src/contexts/VectorDBContext.tsx`)
- ✅ useVectorDB hook
- ✅ State: initialized, documents, uploadFiles, deleteDocument, refreshDocuments
- ✅ Auto-refresh after upload/delete
- ✅ Client-side file type validation (.md/.txt only)

**UI Components - Full Document Management Page:**

- ✅ DocumentsPage (`src/pages/documents/index.tsx`) - Standalone route at /documents
- ✅ UploadZone (`src/pages/documents/components/UploadZone.tsx`) - Drag-and-drop with visual feedback
- ✅ DocumentCard (`src/pages/documents/components/DocumentCard.tsx`) - Card layout with download/delete buttons
- ✅ DeleteModal (`src/pages/documents/components/DeleteModal.tsx`) - Confirmation dialog (replaced browser confirm())
- ✅ DocumentToolbar (`src/pages/documents/components/DocumentToolbar.tsx`) - Search, filter (markdown/text/all), sort (name/date/size)
- ✅ EmptyState (`src/pages/documents/components/EmptyState.tsx`) - When no documents exist
- ✅ Navigation link in ChatPage header to /documents page

**Routing:**

- ✅ /documents route added to App.tsx
- ✅ VectorDBProvider wraps all routes
- ✅ Navigation between /chat and /documents

**E2E Test Infrastructure:**

- ✅ Page Object Model (7 classes):
  - DocumentsPage (main page object)
  - UploadZoneComponent
  - DocumentListComponent
  - DeleteModalComponent
  - ToolbarComponent
  - EmptyStateComponent
- ✅ Test fixtures (4 files: 3 valid .md/.txt, 1 invalid .pdf)
- ✅ Helper functions (clearPGliteDB, navigateToDocuments, etc.)

**E2E Tests Passing (3 test files):**

✅ **Test 1: `e2e/documents/01-document-lifecycle.spec.ts`**

- Upload single file
- Verify file appears in list
- Download file (blob URL generation)
- Delete with cancel (verify still exists)
- Delete with confirm (verify removed)
- Verify empty state shown

✅ **Test 2a: `e2e/documents/02-multi-document-operations.spec.ts`**

- Upload 3 files simultaneously
- Verify all 3 visible
- Search by filename
- Clear search
- Filter by file type (markdown/text/all)
- Sort by name/date/size
- Delete one file
- Verify remaining 2 files

✅ **Test 3: `e2e/documents/03-file-validation.spec.ts`**

- Reject invalid file type (.pdf)
- Accept valid file types (.md/.txt)
- Verify no errors thrown

**Additional Features Implemented:**

- ✅ Document download functionality (blob URLs)
- ✅ Drag-and-drop upload with isDragging state
- ✅ Search/filter/sort toolbar (client-side filtering)
- ✅ Delete confirmation modal (better UX than browser confirm)
- ✅ Loading indicators (data-db-initialized, data-uploading attributes)
- ✅ Comprehensive Page Object Model for maintainable E2E tests

---

#### ✅ COMPLETED - PERSISTENCE TEST & FIX

**Critical E2E Test:**

✅ **IndexedDB Persistence Test** (COMPLETED)

- ✅ Upload 3 files (doc1.md, doc2.txt, doc3.md)
- ✅ Verify all 3 documents visible in list
- ✅ **Reload page (test IndexedDB persistence)**
- ✅ **Verify all 3 documents still visible after reload**
- ✅ Delete doc2.txt (middle document)
- ✅ Verify only doc1.md and doc3.md remain
- ✅ Reload again and verify 2 documents persist

**File Created:**

- ✅ `e2e/documents/04-persistence.spec.ts` (PASSING)

**Root Cause Identified & Fixed:**

- **Issue:** `relaxedDurability: true` causes async flush to IndexedDB, allowing page reloads before data persists
- **Fix:** Removed `relaxedDurability: true` from `PGlite.create()` in `src/workers/pglite.worker.ts`
- **Result:** Data now persists synchronously, all 4 E2E tests passing
- **Trade-off:** Slightly slower writes (sync flush), but guaranteed persistence - acceptable for document uploads

---

#### 📋 PHASE worker-setup: ✅ COMPLETE

**Status:** Production-ready PGlite worker with full document management UI and guaranteed IndexedDB persistence.

**Implementation Summary:**

**Core Infrastructure:**

- ✅ PGlite worker (singleton pattern) with pgvector extension enabled
- ✅ Worker client (Comlink RPC) for main thread ↔ worker communication
- ✅ Documents table (id, filename, content, file_size, mime_type, uploaded_at)
- ✅ IndexedDB persistence (idb://rag-vectors) with **sync flush** mode
- ✅ TypeScript configs (tsconfig.worker.json, vite.config.ts worker settings)

**Worker API:**

- ✅ `init()` - Initialize DB, create schema, return ready status
- ✅ `uploadDocument({ filename, content, mimeType })` - Insert document, return UUID
- ✅ `getDocuments()` - Query all documents (ordered by uploaded_at DESC)
- ✅ `deleteDocument(id)` - Delete by ID

**React Architecture:**

- ✅ VectorDBContext provider with useVectorDB hook
- ✅ State: initialized, documents[], uploadFiles(), deleteDocument(), refreshDocuments()
- ✅ Auto-initialization on mount with error handling

**UI Components (6 specialized + 1 page):**

- ✅ DocumentsPage - Main /documents route (search, filter, sort, upload, delete)
- ✅ UploadZone - Drag-and-drop file upload with visual feedback
- ✅ DocumentCard - Individual document display with download/delete actions
- ✅ DeleteModal - Confirmation dialog (Radix UI Dialog)
- ✅ DocumentToolbar - Search, filter (markdown/text/all), sort (name/date/size)
- ✅ EmptyState - Display when no documents exist

**E2E Testing (Page Object Model):**

- ✅ 7 page object classes (DocumentsPage + 6 component classes)
- ✅ Test fixtures (3 valid files: .md/.txt, 1 invalid: .pdf)
- ✅ 4 comprehensive E2E tests (100% passing):
  1. Document lifecycle (upload → download → delete with cancel/confirm → empty state)
  2. Multi-document operations (upload 3 → search → filter → sort → delete → verify)
  3. File validation (reject .pdf → accept .md/.txt)
  4. **IndexedDB persistence** (upload 3 → reload → verify 3 → delete 1 → reload → verify 2)

**Critical Bug Fix:**

- ✅ **Issue identified:** `relaxedDurability: true` caused async flush to IndexedDB
- ✅ **Root cause:** Page reloads happened before data persisted to disk
- ✅ **Solution:** Removed `relaxedDurability` from PGlite.create() (line 32-33 of pglite.worker.ts)
- ✅ **Result:** Synchronous flush mode ensures data persists before query returns
- ✅ **Trade-off:** Slightly slower writes (~10-50ms), but guaranteed durability

**Dependencies Installed:**

```json
{
  "@electric-sql/pglite": "^0.3.14",
  "comlink": "^4.4.2",
  "uuid": "^13.0.0",
  "@types/uuid": "^10.0.0",
  "@radix-ui/react-dialog": "^1.1.15"
}
```

**Build & Quality:**

- ✅ TypeScript compilation passing (npm run build)
- ✅ No TypeScript errors
- ✅ Vite production build successful (dist/ output verified)
- ✅ All E2E tests passing in production build

**Files Created/Modified:**

```
src/workers/pglite.worker.ts          (131 lines) - PGlite worker with schema
src/lib/pglite-client.ts              (44 lines)  - Comlink RPC client wrapper
src/contexts/VectorDBContext.tsx      (146 lines) - React context + hook
src/pages/documents/index.tsx         (184 lines) - Main documents page
src/pages/documents/components/       (6 files)   - Specialized UI components
e2e/documents/                        (4 tests)   - E2E test suite
e2e/documents/page-objects/           (7 files)   - Page Object Model
e2e/fixtures/                         (4 files)   - Test fixtures
tsconfig.worker.json                  (new)       - Worker TypeScript config
```

**Next Phase:** Ready for **Phase indexing-pipeline** (Background Indexing Pipeline with LangChain + OpenAI embeddings)

### Phase indexing-pipeline: Background Indexing Pipeline

**Dependency Installation Requirements:**

- Install LangChain text splitters (@langchain/textsplitters) for markdown chunking

**Database Schema Requirements:**

**Functional Goal:** Implement background job queue with retry logic and store chunked text with vector embeddings

Create two new tables:

1. **Indexing Queue Table**
   - Purpose: Manage background indexing jobs with retry logic and error tracking
   - Fields needed: unique ID (UUID), document reference (foreign key to documents with cascade delete), status (pending/processing/completed/failed), error message (nullable), retry attempt count, maximum retries allowed (default: 3), creation timestamp, processing start timestamp, completion timestamp
   - Constraints: One queue entry per document, status must be one of the allowed values
   - Index needed: Composite index on (status, created_at) for efficient job polling

2. **Chunks Table**
   - Purpose: Store text chunks with vector embeddings for similarity search
   - Fields needed: unique ID (UUID), document reference (foreign key to documents with cascade delete), chunk position index (0-based), chunk text content, optional heading context (markdown section), vector embedding (1536 dimensions), estimated token count, creation timestamp
   - Constraints: Unique combination of document ID and chunk index to prevent duplicates
   - Index needed: B-tree index on document_id for efficient lookups

**Document Table Extensions:**

- Add fields to existing documents table: chunk count (integer), indexing completion timestamp

**Worker API Extensions:**

Update existing worker operations:

- **uploadDocument()** - After inserting document, create pending entry in indexing_queue
- **getDocuments()** - Left join with indexing_queue to include status and error messages
- **deleteDocument()** - Cascade delete will now remove queue entries and chunks

**Indexing Pipeline Requirements:**

_Progress Tracking:_

- Define progress interface with fields: documentId, stage (chunking/embedding/storing/completed/failed), progress percentage (0-100), message string
- Maintain array of progress callback functions
- Provide function to register progress callbacks
- Emit progress updates to all registered callbacks
- Include progress updates at each major stage

_OpenAI Client Management:_

- Store OpenAI client instance in worker scope (initially null)
- Provide function to set API key and initialize OpenAI client with dangerouslyAllowBrowser flag
- Validate API key is set before indexing operations

_Queue Processing:_

- Maintain processing flag to prevent concurrent processing
- Query indexing queue for next pending job (oldest first)
- Return if no pending jobs found
- Update job status to 'processing' with started timestamp before processing
- Process job and handle success/failure outcomes
- On success: mark queue entry as 'completed', update document indexed timestamp, emit completion progress
- On failure: increment retry count, mark as 'failed' if max retries exceeded (default 3), emit failure progress, otherwise reset to 'pending' for retry
- Schedule next queue check after 1 second delay
- Auto-start queue processor on worker initialization with 5-second polling interval

_Document Indexing Flow:_

1. **Chunking Stage (Progress: 10-30%):**
   - Use LangChain RecursiveCharacterTextSplitter with markdown language mode
   - Configure chunk size: 1000 tokens
   - Configure chunk overlap: 200 tokens
   - Create document chunks and extract content
   - Calculate estimated token count for each chunk (rough estimate: 1 token ≈ 4 characters)
   - Emit progress update with chunk count

2. **Embedding Stage (Progress: 30-70%):**
   - Create batches of 100 chunks (OpenAI recommended batch size)
   - For each batch:
     - Call OpenAI embeddings API with model 'text-embedding-3-small', dimensions 1536
     - Implement retry logic with exponential backoff for rate limits (429 errors)
     - Retry delays: 1s, 2s, 4s (max 3 retries)
     - Emit progress update for each batch
     - Collect embeddings for all chunks

3. **Storage Stage (Progress: 70-100%):**
   - Insert chunks into database with embeddings
   - Include: document_id, chunk_index, content, embedding vector, token_count
   - Emit progress update every 10 chunks
   - Update document table with total chunk count after all inserts

_Worker API Extensions:_

- **setOpenAIKey(apiKey)** - Initialize OpenAI client
- **onProgress(callback)** - Register progress callback
- **startIndexing()** - Manually trigger queue processing
- **retryFailed(documentId)** - Reset failed job to pending status and trigger processing

**Test Requirements:**

Write tests after implementing. Focus on key workflows, not exhaustive unit tests.

_Key Behaviors to Test:_

- Full indexing pipeline works end-to-end
- Queue processes documents automatically
- Retry logic handles failures correctly
- Progress updates emitted during indexing
- Chunking splits documents appropriately
- Embeddings stored with chunks
- Cascade delete works (document → queue → chunks)

_Testing Strategy:_

- Write integration tests with mocked OpenAI API first
- Add unit tests for complex logic (retry logic, chunking algorithm)
- E2E test with real API for verification (use small document first)
- Don't test schema creation details
- Don't test every field individually

**Phase indexing-pipeline Completion:**

- LangChain text splitters dependency installed
- Indexing_queue table created with retry logic support
- Chunks table created for storing embeddings
- Documents table extended with indexing metadata
- Required indexes created (composite on queue, B-tree on chunks)
- Worker API operations updated (uploadDocument, getDocuments, deleteDocument)
- Indexing pipeline implemented in worker
- Progress tracking system implemented
- Queue processor with retry logic implemented
- LangChain integration for chunking implemented
- OpenAI embeddings API integration with batching implemented
- All unit tests passing (mocked APIs)
- All integration tests passing (mocked APIs)
- All E2E tests passing (real APIs, 10,000-word document)
- Review changes and commit with appropriate message

### Phase vector-search: Vector Search & RAG Integration

**Database Schema Requirements:**

**Functional Goal:** Enable fast vector similarity search on chunk embeddings

Create HNSW index:

- **HNSW Index on chunks.embedding**
  - Purpose: Fast approximate nearest neighbor search on vector embeddings
  - Index type: HNSW (Hierarchical Navigable Small World)
  - Distance operator: Cosine distance (<=>)
  - Parameters: m=16, ef_construction=64 (small dataset defaults)
  - Note: HNSW builds incrementally, no training step required
  - This enables sub-50ms vector search queries

**Vector Search Worker Requirements:**

_Search Function Implementation:_

- Accept parameters: query string, topK (default 10), optional filters (filename)
- Validate OpenAI client is initialized
- Generate query embedding using OpenAI embeddings API (model: text-embedding-3-small, dimensions: 1536)
- Build SQL query with:
  - SELECT: chunk content, heading, filename, document_id, similarity score (1 - cosine distance)
  - JOIN chunks with documents table
  - WHERE clause supporting optional filename filter
  - ORDER BY cosine distance (closest first)
  - LIMIT topK results
- Use pgvector cosine distance operator (<=>)
- Return array of results with content, heading, filename, documentId, similarity

**useChat Hook RAG Integration Requirements:**

**Note:** The useChat hook already exists (src/hooks/useChat.ts). This phase extends it with RAG functionality.

_State Extensions:_

- Add ragMode boolean state (default: false)
- Add sources array state (search results)
- Get vector DB worker instance

_RAG-Enhanced Message Flow:_

1. When RAG mode enabled and user sends message:
   - Call worker.search() with user query, topK=5
   - If results found:
     - Store sources in state for display
     - Format context from search results: "[N] From 'filename' (heading): content"
     - Create system message injecting formatted context
     - Instruct assistant to use context and cite sources with [1], [2], etc.
     - Prepend system message to conversation history
2. Send modified conversation (with context) to OpenAI chat API
3. Stream response as normal (existing streaming logic)
4. Display sources alongside response

_Return Interface Extensions:_

- Add ragMode: boolean
- Add setRAGMode: function to toggle RAG mode
- Add sources: array of search results with metadata

**Test Requirements:**

Write tests after implementing. Focus on RAG workflow, not implementation details.

_Key Behaviors to Test:_

- Vector search returns relevant chunks
- RAG mode integrates search results into chat
- Context formatted correctly with citations
- Sources displayed with similarity scores
- RAG toggle works during conversation
- Search performance acceptable (measure actual latency)

_Testing Strategy:_

- Integration tests with mocked APIs for RAG flow
- E2E test with real APIs for full RAG verification
- Use small document for E2E tests first
- Don't test HNSW index parameters individually
- Don't test SQL query syntax

**Phase vector-search Completion:**

- HNSW index created on chunks.embedding for fast similarity search
- Vector search function implemented in worker using HNSW index
- RAG integration added to useChat hook
- Context formatting and injection implemented
- Source tracking and display implemented
- All unit tests passing (mocked APIs)
- All integration tests passing (mocked APIs)
- All E2E tests passing (real APIs, 10,000-word document Q&A)
- Review changes and commit with appropriate message

### Phase ui-components: UI Components

**Components to Create:**

Add these components to src/components/:

- DocumentManager - document library display
- IndexingStatusBadge - status display
- RAGToggle - RAG mode toggle
- SourcesList - search result sources display

**Document Manager Component Requirements:**

_User Interface:_

- Display "Document Library" heading
- Show loading state while documents are being fetched
- Display empty state message when no documents exist
- List all documents with the following information per document:
  - Filename (prominent display)
  - Upload date/time (formatted, locale-aware)
  - Chunk count (or 0 if not indexed)
  - Indexing status badge
  - Delete button (red color, hover state)
- Use card layout for each document (border, padding, flex layout)
- Integrate with useVectorDB hook for data and operations

_Indexing Status Badge Requirements:_

- Display status text (pending/processing/completed/failed)
- Apply color-coded backgrounds:
  - Pending: yellow background
  - Processing: blue background
  - Completed: green background
  - Failed: red background
- Show warning icon with error message tooltip when status is failed
- Small, rounded badge styling

**RAG Toggle Component Requirements:**

_User Interface:_

- Checkbox input for RAG mode toggle
- Label text: "RAG Mode (search documents)"
- Flex layout with small gap between checkbox and label
- Integrate with useChat hook for ragMode state
- Update ragMode state on checkbox change
- Display current ragMode state (checked/unchecked)

**Sources List Component Requirements:**

_User Interface:_

- Return null (don't render) if sources array is empty
- Display "Sources:" heading when sources exist
- List each source with:
  - Citation number ([1], [2], etc.)
  - Filename
  - Optional heading/section context
  - Similarity score formatted as percentage (1 decimal place)
- Light gray background for each source item
- Small text size, rounded corners
- Border-top separator from main content

**Test Requirements:**

Write tests after implementing components. Focus on integration with existing hooks/context.

_Key Behaviors to Test:_

- Document list displays uploaded documents
- Status badges show correct states
- Delete button removes documents
- RAG toggle changes mode
- Sources list displays after RAG query

_Testing Strategy:_

- Integration tests for component + context interaction
- Unit tests only if complex rendering logic exists
- E2E tests for user workflows
- Use data-testid for selectors (per project conventions)

**Phase ui-components Completion:**

- DocumentManager component created with status display
- IndexingStatusBadge component created
- RAGToggle component created
- SourcesList component created
- All components use existing shadcn/ui styling patterns
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Review changes and commit with appropriate message

### Phase state-management: State Management Integration

**Note:** VectorDBContext was implemented in Phase worker-setup as part of the documents page.

**This Phase: Extend Context with RAG Search Capability**

_VectorDBContext Extensions:_

- Add search: async function for vector search with optional topK parameter
- Implement search: proxy to worker search function

_Background Indexing:_

- Start background indexing queue processor when context initializes
- Queue processor auto-starts in Phase indexing-pipeline when indexing queue is created

**Test Requirements:**

Write tests after implementing. Focus on:

- Search function proxies to worker correctly
- Background indexing queue processes automatically

**Phase state-management Completion:**

- VectorDBContext extended with search capability
- Background indexing queue auto-starts
- Tests written for new behaviors
- All tests passing
- Review changes and commit with appropriate message

### Phase performance: Performance Measurement & Conditional Optimization

**YAGNI Approach - Measure First, Optimize Only If Needed**

**Performance Measurement (Required):**

After completing Phases worker-setup through state-management, measure actual performance:

1. **Test with Realistic Dataset:**
   - Upload 100-1000 documents
   - Typical document size: 500-5000 words
   - Complete full indexing pipeline

2. **Measure Key Metrics:**
   - Upload time per document
   - Indexing time per document
   - Search query latency
   - Memory usage during indexing
   - Browser storage used

3. **Define Acceptable Thresholds:**
   - Indexing: <5 minutes for typical dataset
   - Search: <100ms per query
   - Upload: No UI freezing

**Conditional Optimization (Only If Measurements Show Problems):**

_If indexing is slow (>5 min for typical dataset):_

- Consider bulk insert optimization (disable HNSW during inserts, rebuild after)
- Consider adjusting HNSW parameters for larger datasets

_If search is slow (>100ms):_

- Check HNSW index exists
- Consider tuning ef_search parameter
- Consider adjusting HNSW m/ef_construction parameters

_If uploads freeze UI:_

- Consider Comlink transfer() for large files (>10MB)

_If quota exceeded errors occur:_

- Add basic error handling (catch error, show message)
- If users request it, add quota monitoring

**Test Requirements:**

_Performance Tests:_

- Measure baseline performance with realistic dataset
- Document actual measurements
- Only test optimizations if implemented

**Phase performance Completion:**

Option A - No Optimization Needed (Preferred):

- Performance measurements documented
- All metrics within acceptable thresholds
- Skip optimization, proceed to Phase build-config
- Review changes and commit with appropriate message

Option B - Optimization Required (Only if measurements show problems):

- Specific optimizations implemented based on bottlenecks
- Performance improvement measured and documented
- All tests passing
- Review changes and commit with appropriate message

**Default Assumption: Performance will be acceptable, this phase can be skipped.**

### Phase build-config: Build Configuration

**Vite Configuration Requirements:**

_Plugin Configuration:_

- Keep existing React and Tailwind CSS v4 plugins
- Maintain existing path alias (@/ → ./src/)

_Worker Build Configuration:_

- Set worker format to 'es' (ES modules)
- Include React plugin for workers (enables JSX if needed)

_Dependency Optimization:_

- Exclude @electric-sql/pglite from optimization (WASM module, can't be pre-bundled)
- Prevent Vite from trying to optimize WASM files

_Build Configuration:_

- Target ES2020 for modern browser support
- Configure manual code splitting:
  - Separate chunk for 'pglite' (large WASM module)
  - Separate chunk for 'langchain' (text splitters)
  - Separate chunk for 'openai' (SDK)
- Improves initial load time and caching

_Test Configuration:_

- Maintain existing Vitest configuration
- Globals enabled
- jsdom environment
- Setup file: ./src/test/setup.ts
- Exclude node_modules, dist, and e2e directories

_Git Ignore:_

- Add WASM build artifacts (\*.wasm)
- Add worker build directory (dist-worker/)

**Test Requirements:**

_Unit Tests:_

- Test Vite config compiles without errors
- Test worker builds successfully
- Test manual chunks are created correctly
- Test build output contains expected files

_Integration Tests:_

- Test built app runs in production mode
- Test WASM modules load correctly in build
- Test worker executes in production build
- Test code splitting reduces initial bundle size

_E2E Tests:_

- Test built app works in browser (npm run preview)
- Test all features work in production build

**Phase build-config Completion:**

- Vite config updated with worker and WASM support
- Manual chunking configured for optimal loading
- Build tested and verified
- .gitignore updated
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Review changes and commit with appropriate message

### Phase deployment: Testing & Deployment

**Comprehensive Testing Requirements:**

_Final Test Suite Verification:_

- Ensure ALL unit tests from all phases are passing (mocked APIs)
- Ensure ALL integration tests from all phases are passing (mocked APIs)
- Ensure ALL E2E tests from all phases are passing (real OpenAI APIs)

_Full E2E RAG Pipeline Test:_

- Load application in browser
- Enter OpenAI API key
- Upload 10,000-word markdown document (.md file)
- Verify document appears in document library with "pending" status
- Wait for indexing to complete (status changes to "completed")
- Verify chunk count is displayed correctly
- Enable RAG mode using toggle checkbox
- Ask question related to document content
- Verify AI response includes relevant information from document
- Verify sources section displays with document filename
- Verify source citations ([1], [2], etc.) appear in response
- Verify similarity scores are displayed
- Ask multiple follow-up questions
- Toggle RAG mode off and verify normal chat still works
- Delete document and verify it's removed from library

_Test Data Requirements:_

- Prepare 10,000-word markdown document with:
  - Multiple sections (## headings)
  - Rich content for testing chunk retrieval
  - Specific facts that can be queried
- Prepare test questions related to document content
- Verify answers cite correct sources

**Deployment Requirements:**

_Deploy to GitHub Pages:_

1. Run production build: `npm run build`
2. Test locally: `npm run preview`
3. Verify all features work in production mode
4. Install gh-pages: `npm install --save-dev gh-pages`
5. Add deploy script to package.json
6. Deploy: `npm run deploy`
7. Verify deployed app works at GitHub Pages URL
8. Fix any issues that arise (WASM loading, routing, etc.)
9. Document actual deployment steps taken

_If Deployment Issues Occur:_

- WASM MIME types: Configure if needed
- Routing: Add 404.html for SPA routing if needed
- Cache headers: Add if needed for performance

Don't configure things "just in case" - fix actual problems as they occur.

_Security Verification:_

- API key not exposed in source code
- API key stays in localStorage only
- No CORS needed (client-side only app)

**Test Requirements:**

_Run Full Test Suite:_

- `npm test` - All unit and integration tests
- `npm run test:e2e` - All E2E tests
- Fix any failures before deploying

_Performance Verification:_

- Test with realistic dataset (100-1000 documents)
- Measure key metrics (upload time, indexing time, search latency)
- Document actual performance (not theoretical)

**Phase deployment Completion:**

- All unit tests passing (all phases)
- All integration tests passing (all phases)
- All E2E tests passing (all phases)
- Full RAG pipeline tested with 10,000-word document
- Application deployed to GitHub Pages (or alternative)
- Deployment verified and functional
- Performance benchmarks documented
- Review changes and commit with appropriate message

**Post-Deployment Verification:**

- Test deployed app in multiple browsers (Chrome, Firefox, Safari)
- Verify IndexedDB works across browsers
- Verify worker execution in production
- Verify WASM loading in production
- Test full RAG workflow in production
- Document any browser-specific issues
- Verify storage persistence across page reloads

---

## Key Implementation Notes

### Error Handling Strategies

**Basic Error Handling (All Phases):**

1. **Catch exceptions** in async operations
2. **Display error messages** to user (use existing UI patterns)
3. **Log to console** for debugging (with context)
4. **Fail gracefully** (don't crash the app)

**Add Advanced Handling ONLY When Problems Occur:**

_If API rate limits hit (429 errors):_

- Add exponential backoff retry logic
- Implement in Phase indexing-pipeline if needed

_If storage quota exceeded errors:_

- Catch error, show message: "Storage full. Delete old documents."
- If users request it, add quota monitoring later

_If worker crashes frequently:_

- PGlite data already persists in IndexedDB
- Indexing queue already survives page reload
- Add recovery logic only if crashes occur in testing

_If file encoding failures:_

- Basic validation already in Phase worker-setup
- Add encoding detection only if users report issues

**Default Approach:** Start simple. Add complexity when pain points emerge.

### Security Considerations

1. **API Key Storage:**
   - Already handled by existing ApiKeyContext
   - Stored in localStorage (acceptable for client-side app)
   - Never send to backend (no backend exists)

2. **XSS Protection:**
   - Sanitize document content before display
   - Use React's built-in escaping
   - Be careful with `dangerouslySetInnerHTML`

3. **Data Privacy:**
   - All data stays in browser (IndexedDB)
   - No telemetry or tracking
   - OpenAI API calls = only external communication

### Performance Benchmarks (Expected)

| Metric             | Small (100 docs) | Medium (1K docs) | Large (10K docs) |
| ------------------ | ---------------- | ---------------- | ---------------- |
| **Indexing Time**  | ~2 min           | ~20 min          | ~3 hours         |
| **Storage Used**   | ~5 MB            | ~50 MB           | ~500 MB          |
| **Search Time**    | <10ms            | <20ms            | <50ms            |
| **Embedding Cost** | $0.01            | $0.10            | $1.00            |

_Assumes average 500 words/doc, 5 chunks/doc_

### Debugging Approach

**Simple Console Logging:**

```typescript
// Log important events in development
if (import.meta.env.DEV) {
  console.log('[VectorDB] Document uploaded:', documentId);
  console.log('[VectorDB] Indexing started:', documentId);
  console.log('[VectorDB] Indexing completed:', documentId, chunkCount);
}

// Always log errors
console.error('[VectorDB] Error:', error.message, { context });
```

**Don't Create Stats System Unless Needed:**

- Console logging sufficient for debugging
- Browser DevTools shows IndexedDB contents
- SQL queries in appendix for manual inspection
- Add stats dashboard only if users request it

---

## Migration & Upgrade Paths

### From Current App

Follow the implementation phases in order:

1. **Phase worker-setup:** Set up PGlite worker with full-featured documents page
2. **Phase indexing-pipeline:** Implement background indexing pipeline
3. **Phase vector-search:** Add vector search and RAG integration
4. **Phase ui-components & state-management:** Build UI components and state management
5. **Phase performance & build-config:** Optimize and configure build
6. **Phase deployment:** Test and deploy

**Backward Compatible:** Existing chat still works without RAG throughout the implementation.

---

## Appendix

### Useful SQL Queries

**Find documents without indexes:**

```sql
SELECT d.* FROM documents d
LEFT JOIN chunks c ON d.id = c.document_id
WHERE c.id IS NULL;
```

**Top documents by chunk count:**

```sql
SELECT filename, chunk_count
FROM documents
ORDER BY chunk_count DESC
LIMIT 10;
```

**Failed indexing jobs:**

```sql
SELECT d.filename, iq.error_message, iq.retry_count
FROM indexing_queue iq
JOIN documents d ON iq.document_id = d.id
WHERE iq.status = 'failed';
```

**Storage breakdown:**

```sql
SELECT
  COUNT(DISTINCT d.id) as total_documents,
  COUNT(c.id) as total_chunks,
  SUM(d.file_size) as total_file_size,
  AVG(c.token_count) as avg_chunk_tokens
FROM documents d
LEFT JOIN chunks c ON d.id = c.document_id;
```

**Similar documents (to a given document):**

```sql
-- Find chunks similar to chunks from document X
SELECT
  d2.filename,
  AVG(1 - (c1.embedding <=> c2.embedding)) as avg_similarity
FROM chunks c1
JOIN chunks c2 ON c1.document_id != c2.document_id
JOIN documents d2 ON c2.document_id = d2.id
WHERE c1.document_id = $1
GROUP BY d2.id, d2.filename
ORDER BY avg_similarity DESC
LIMIT 5;
```

### Troubleshooting Guide

**Problem:** Indexing stuck in "processing"

- **Solution:** Check browser console for errors, retry job manually

**Problem:** Search returns no results

- **Solution:** Verify documents are indexed (`indexed_at IS NOT NULL`), check HNSW index exists

**Problem:** "Quota exceeded" error

- **Solution:** Check storage usage, delete old documents, increase quota (browser settings)

**Problem:** Slow embedding generation

- **Solution:** Reduce batch size, check network, verify API key tier

**Problem:** Worker not responding

- **Solution:** Reload page, check console for worker errors, verify PGlite initialized

### Resources & References

**Documentation:**

- PGlite: https://pglite.dev/docs
- pgvector: https://github.com/pgvector/pgvector
- LangChain.js: https://js.langchain.com/docs
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- Comlink: https://github.com/GoogleChromeLabs/comlink

**Examples:**

- PGlite + pgvector example: https://gist.github.com/45deg/6b4b01477cdac6dd8f600285e20c3f21
- Browser Vector Search: https://github.com/thorwebdev/browser-vector-search
- In-browser RAG: https://supabase.com/blog/in-browser-semantic-search-pglite

**Benchmarks:**

- PGlite benchmarks: https://pglite.dev/benchmarks
- pgvector HNSW performance: https://jkatz05.com/post/postgres/pgvector-hnsw-performance/

---

## Summary

This plan provides a complete implementation roadmap for converting the OpenAI chat app into a browser-based RAG application using PGlite + pgvector. The architecture leverages:

- **PGlite (PostgreSQL WASM)** for robust vector storage with SQL capabilities
- **pgvector HNSW indexes** for fast approximate nearest neighbor search
- **Web Workers** for background processing without blocking UI
- **IndexedDB** for persistent storage with Safari compatibility
- **LangChain** for intelligent markdown chunking
- **OpenAI API** for state-of-the-art embeddings (text-embedding-3-small)

The implementation is **fully client-side**, requires **no backend**, and can be deployed to **static hosting** (GitHub Pages, S3, etc.). All data remains in the user's browser, ensuring **complete privacy**.

**Bundle Size Impact:** +3-4 MB (PGlite WASM)
**Cost per 1000 documents:** ~$0.10 (OpenAI embeddings)

The plan is **production-ready**, **scalable** (handles 100-100K documents), and **future-proof** (can upgrade to cloud Postgres later).

**Database Schema Approach:** Tables and indexes are created incrementally as needed rather than upfront, avoiding premature architectural commitments.
