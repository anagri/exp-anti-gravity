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

#### Test Types by Phase

| Phase | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 2. Worker | ✅ Core logic | ✅ DB operations | ❌ |
| 3. Upload | ✅ Components | ✅ Worker RPC | ✅ Upload flow |
| 4. Indexing | ✅ Chunking/Retry | ✅ API mocking | ✅ Full pipeline |
| 5. Search | ✅ Query logic | ✅ HNSW queries | ✅ RAG flow |
| 6. UI | ✅ Components | ✅ Interactions | ✅ UI workflows |
| 7. State | ✅ Hooks/Context | ✅ Propagation | ✅ Persistence |
| 8. Perf | ✅ Algorithms | ✅ Benchmarks | ✅ Large datasets |
| 9. Build | ✅ Config | ✅ Build output | ❌ |
| 10. Deploy | ✅ All passing | ✅ All passing | ✅ Production |

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
### Phase X Completion Checklist

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

### Estimated Timeline with Testing

| Phase | Implementation | Testing | Total |
|-------|---------------|---------|-------|
| 2. Worker | 0.75 days | 0.75 days | **1.5 days** |
| 3. Upload | 0.75 days | 0.75 days | **1.5 days** |
| 4. Indexing | 1.5 days | 1.5 days | **3 days** |
| 5. Search/RAG | 0.75 days | 0.75 days | **1.5 days** |
| 6. UI | 0.75 days | 0.75 days | **1.5 days** |
| 7. State | 0.375 days | 0.375 days | **0.75 days** |
| 8. Perf | 0.375 days | 0.375 days | **0.75 days** |
| 9. Build | 0.25 days | 0.25 days | **0.5 days** |
| 10. Deploy | 0.5 days | 0.5 days | **1 day** |

**Total: ~12 days** (was ~7 days without comprehensive testing)

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

| Technology | Choice | Rationale |
|------------|--------|-----------|
| Vector DB | PGlite (IndexedDB) | Safari support, mature, 60% disk quota |
| Raw Files | OPFS (optional) or IndexedDB | OPFS faster but Safari limited, IndexedDB safer |
| Processing | Web Worker (not Service Worker) | OPFS sync access handles require Web Worker |

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

| Feature | Web Worker | Service Worker |
|---------|-----------|----------------|
| OPFS Sync Access | ✅ Yes | ❌ No |
| Multi-tab Shared | ❌ No (use PGliteWorker) | ✅ Yes |
| Lifecycle | Page-bound | Persistent |
| Use Case | Computation, DB access | Caching, offline, proxy |

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
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
  chunkSize: 1000,        // ~750 words
  chunkOverlap: 200,      // 20% overlap for context preservation
})
```

**Why These Values:**
- 1000 tokens = good balance (context vs granularity)
- 200 overlap = prevents losing info at boundaries
- Recursive splitting: `\n\n` → `\n` → ` ` (preserves structure)

**Alternative: Header-Aware Splitting**
```typescript
import { MarkdownHeaderTextSplitter } from '@langchain/textsplitters'

const headerSplitter = new MarkdownHeaderTextSplitter({
  headersToSplitOn: [
    ["##", "Section"],
    ["###", "Subsection"],
  ],
})
```

Captures heading hierarchy as metadata (improves retrieval context).

### PGlite Multi-tab Worker Pattern

**Problem:** PGlite has single exclusive connection, can't open from multiple tabs simultaneously.

**Solution:** PGliteWorker with leader election

```typescript
// worker.ts
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { worker } from '@electric-sql/pglite/worker'

const pg = await PGlite.create({
  dataDir: 'idb://rag-vectors',
  extensions: { vector }
})

worker({ pg })
```

```typescript
// main.ts
import { PGliteWorker } from '@electric-sql/pglite/worker'

const db = new PGliteWorker(
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
)

// Leader election happens automatically
db.onLeaderChange(() => {
  console.log('Leader changed, this tab is now:', db.isLeader)
})
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

### Database Schema Requirements

The system requires three main tables:

**1. Documents Table**
- Purpose: Store uploaded file metadata
- Fields: unique ID (UUID), filename, full content, file size (bytes), MIME type (text/markdown or text/plain), upload timestamp, chunk count, indexing completion timestamp
- Constraints: Filename and content are required

**2. Chunks Table**
- Purpose: Store text chunks with vector embeddings
- Fields: unique ID (UUID), document reference (foreign key with cascade delete), chunk position index (0-based), chunk text content, optional heading context (markdown section), vector embedding (1536 dimensions), estimated token count, creation timestamp
- Constraints: Unique combination of document ID and chunk index to prevent duplicates

**3. Indexing Queue Table**
- Purpose: Manage background indexing jobs with retry logic
- Fields: unique ID (UUID), document reference (foreign key with cascade delete), status (pending/processing/completed/failed), error message (nullable), retry attempt count, maximum retries allowed (default: 3), creation timestamp, processing start timestamp, completion timestamp
- Constraints: One queue entry per document, status must be one of the allowed values

**Required Indexes:**
- HNSW index on chunk embeddings for fast vector similarity search (parameters: m=16, ef_construction=64, cosine distance)
- B-tree index on chunk document_id for efficient document lookups
- Composite index on indexing queue (status, created_at) for efficient job polling

### Data Flow Diagrams

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
- Initialize MSW server before all tests with bypass mode for unhandled requests
- Reset all MSW request handlers after each test to ensure isolation
- Clear all mocks after each test
- Clean up MSW server after all tests complete
- Clean up all IndexedDB databases before each test to ensure fresh state
- Integrate with existing Vitest configuration

**Database Test Helpers:**
- Provide utility to create isolated PGlite test database instances with unique names
- Implement helper to create test database with pgvector extension enabled
- Implement helper to create all required tables (documents, chunks, indexing_queue)
- Provide function to insert test documents with default or custom content
- Provide function to insert test chunks with mock embeddings
- Support parameterized test data creation for various scenarios

**Worker Test Helpers:**
- Provide utility to create and initialize test worker instances
- Implement worker initialization with Comlink wrapping
- Provide cleanup utility to terminate workers after tests
- Ensure workers are properly isolated between tests

**Test Data Fixtures:**
- Provide sample markdown document with sections and headings for testing chunking
- Provide plain text document for testing text file processing
- Provide large document (100+ paragraphs) for testing chunking behavior
- Provide utility to generate mock embeddings (configurable dimensions, default 1536)
- Provide utility to generate similar embeddings for testing similarity search
- Provide mock OpenAI embedding response structure

**MSW Mock Handlers:**
- Mock OpenAI embeddings endpoint (POST /v1/embeddings)
- Support both single string and array input formats
- Return properly formatted embedding responses with configurable dimensions
- Include realistic usage metadata (prompt_tokens, total_tokens)
- Maintain existing chat completions handlers
- Support batch embedding requests (up to 100 inputs)

---

## Implementation Plan

### Phase 2: PGlite Worker Setup

**Dependency Installation Requirements:**
- Install PGlite with pgvector support (@electric-sql/pglite)
- Install UUID generation library (uuid) for document ID generation
- Install Comlink for simplified Web Worker RPC communication

**TypeScript Configuration Requirements:**
- Update main tsconfig.json to include WebWorker library types
- Add @types/uuid to types array
- Ensure ES2020, DOM, and DOM.Iterable libraries are available
- Create separate tsconfig for workers (tsconfig.worker.json) that extends main config
- Worker config should only include WebWorker lib (no DOM)
- Worker config should only include src/workers/**/* files

**Project Structure Requirements:**
Create the following directory structure:
- **src/workers/** - Web worker files for PGlite instance, database operations, and shared types
- **src/lib/** - Add Comlink wrapper for worker client communication
- **src/types/** - Add type definitions for vector database operations

**PGlite Worker Requirements:**

*Database Initialization:*
- Create singleton PGlite instance stored in worker scope
- Configure PGlite with IndexedDB data directory (idb://rag-vectors)
- Enable pgvector extension
- Enable relaxedDurability mode for better performance
- Create all required tables (documents, chunks, indexing_queue) if they don't exist
- Create all required indexes (HNSW on embeddings, B-tree on document_id, composite on queue status)
- Return existing instance if already initialized (prevent duplicate initialization)

*Worker API Interface:*
Expose the following operations via Comlink:

1. **init()** - Initialize database and return ready status
2. **uploadDocument(file)** - Accept file metadata (filename, content, mimeType), calculate file size, insert into documents table, create pending indexing queue entry, return generated document ID
3. **getDocuments()** - Query all documents with left join to indexing queue, include indexing status and error messages, return ordered by upload date descending
4. **deleteDocument(id)** - Delete document by ID (cascade delete will remove chunks and queue entries)
5. **search(query, topK)** - Placeholder for Phase 5 implementation, return empty array for now

*Worker Client Requirements:*
- Implement singleton pattern for worker instance management
- Provide function to get or create worker instance using module URL
- Wrap worker API with Comlink for RPC communication
- Provide function to terminate worker and clean up references
- Ensure worker is created with type='module' for ES module support

**Test Requirements:**

*Unit Tests:*
- Test all required dependencies are installed and importable
- Test TypeScript configuration compiles without errors
- Test worker TypeScript configuration is correctly isolated from main config
- Test WebWorker types are available in worker context
- Test DOM types are not available in worker context
- Test database initialization creates PGlite instance
- Test database initialization creates all required tables
- Test database initialization creates pgvector extension
- Test database initialization creates all required indexes
- Test singleton pattern prevents duplicate database initialization
- Test uploadDocument inserts document and creates queue entry
- Test uploadDocument calculates correct file size
- Test uploadDocument returns generated UUID
- Test getDocuments returns documents with indexing status
- Test getDocuments orders by upload date descending
- Test deleteDocument removes document and cascades to chunks/queue
- Test worker client singleton pattern
- Test worker client wraps API with Comlink correctly

*Integration Tests:*
- Test worker initialization via Comlink RPC
- Test full upload flow: upload document, verify in database, verify queue entry created
- Test document retrieval after upload includes correct status
- Test delete operation removes all related data
- Test multiple worker API calls maintain single database instance

*E2E Tests:*
- Not required for this phase

**Phase Completion:**
- All dependencies installed (PGlite, uuid, Comlink)
- TypeScript configurations created and validated
- Project structure directories created (workers/, lib/, types/)
- PGlite worker file created with all required operations
- Worker client wrapper created
- All tables and indexes created on initialization
- All unit tests passing
- All integration tests passing
- Commit message: `feat(worker): implement PGlite worker with database operations`

### Phase 3: File Upload & Storage

**Storage Decision: Use IndexedDB (via PGlite) Instead of OPFS**

Rationale:
- Safari compatibility (OPFS has limitations - 252 sync access handle limit)
- Simpler implementation (files stored in documents.content column)
- No need for separate OPFS worker
- Sufficient performance with relaxedDurability mode

**Project Structure Requirements:**
Create the following directory structure:
- **src/components/** - Add new components for file upload with drag-drop
- **src/hooks/** - Add new hooks for vector DB operations and file upload handling

**File Upload Component Requirements:**

*User Interface:*
- Provide drag-and-drop zone for file selection (border, centered text)
- Provide hidden file input for click-to-select functionality
- Accept only .md and .txt files
- Support multiple file selection
- Display upload progress for each file with status updates
- Show status transitions: "Reading..." → "Uploading..." → "Queued for indexing"
- Disable interactions during upload
- Clear progress display after completion

*File Handling:*
- Validate file types before processing (reject non-.md/.txt files)
- Read file content using FileReader API's text() method
- Extract filename, content, and MIME type
- Call uploadFiles function from vector DB hook for each valid file
- Handle drag events properly (preventDefault on dragOver)
- Iterate through files sequentially with status updates

**useVectorDB Hook Requirements:**

*State Management:*
- Maintain documents array state
- Maintain loading state (initially true)
- Get worker instance from worker client singleton

*Initialization:*
- Initialize worker on mount
- Load initial documents on mount
- Set loading to false after initialization

*Operations:*
- **refreshDocuments()** - Fetch latest documents from worker and update state
- **uploadFiles(files)** - Upload array of files to worker sequentially, refresh documents after all uploads complete
- **deleteDocument(id)** - Delete document by ID via worker, refresh documents after deletion

*Return Interface:*
- documents: current documents array
- loading: boolean loading state
- uploadFiles: function to upload multiple files
- deleteDocument: function to delete document by ID
- refreshDocuments: function to manually refresh documents list

**Test Requirements:**

*Unit Tests:*
- Test FileUpload component renders drag-drop zone
- Test FileUpload component filters only .md and .txt files
- Test FileUpload component updates progress state correctly
- Test FileUpload component calls uploadFiles for valid files
- Test FileUpload component handles drag events properly
- Test useVectorDB hook initializes worker on mount
- Test useVectorDB hook loads documents on mount
- Test useVectorDB hook refreshes documents after upload
- Test useVectorDB hook refreshes documents after delete
- Test useVectorDB hook manages loading state correctly

*Integration Tests:*
- Test file upload flow: select file → read content → call worker → refresh documents
- Test multiple file upload processes files sequentially
- Test invalid file types are rejected
- Test worker integration: upload creates database entry and queue entry

*E2E Tests:*
- Test drag-and-drop file upload in browser
- Test click-to-select file upload
- Test upload progress displays for each file
- Test uploaded documents appear in document list
- Test upload of multiple files simultaneously
- Test only .md and .txt files are accepted

**Phase Completion:**
- FileUpload component created with drag-drop and file input
- useVectorDB hook created with upload/delete/refresh operations
- File validation implemented
- Progress tracking implemented
- All unit tests passing (using mocked worker)
- All integration tests passing
- All E2E tests passing (with real worker)
- Commit message: `feat(upload): implement file upload with drag-drop support`

### Phase 4: Background Indexing Pipeline

**Dependency Installation Requirements:**
- Install LangChain text splitters (@langchain/textsplitters) for markdown chunking

**Indexing Pipeline Requirements:**

*Progress Tracking:*
- Define progress interface with fields: documentId, stage (chunking/embedding/storing/completed/failed), progress percentage (0-100), message string
- Maintain array of progress callback functions
- Provide function to register progress callbacks
- Emit progress updates to all registered callbacks
- Include progress updates at each major stage

*OpenAI Client Management:*
- Store OpenAI client instance in worker scope (initially null)
- Provide function to set API key and initialize OpenAI client with dangerouslyAllowBrowser flag
- Validate API key is set before indexing operations

*Queue Processing:*
- Maintain processing flag to prevent concurrent processing
- Query indexing queue for next pending job (oldest first)
- Return if no pending jobs found
- Update job status to 'processing' with started timestamp before processing
- Process job and handle success/failure outcomes
- On success: mark queue entry as 'completed', update document indexed timestamp, emit completion progress
- On failure: increment retry count, mark as 'failed' if max retries exceeded (default 3), emit failure progress, otherwise reset to 'pending' for retry
- Schedule next queue check after 1 second delay
- Auto-start queue processor on worker initialization with 5-second polling interval

*Document Indexing Flow:*

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

*Worker API Extensions:*
- **setOpenAIKey(apiKey)** - Initialize OpenAI client
- **onProgress(callback)** - Register progress callback
- **startIndexing()** - Manually trigger queue processing
- **retryFailed(documentId)** - Reset failed job to pending status and trigger processing

**Test Requirements:**

*Unit Tests (Mocked APIs):*
- Test progress tracking emits to all registered callbacks
- Test OpenAI client initialization
- Test queue processor fetches oldest pending job first
- Test queue processor updates status to 'processing' before indexing
- Test successful indexing marks queue as 'completed'
- Test failed indexing increments retry count
- Test failed indexing marks as 'failed' after max retries
- Test chunking creates correct number of chunks with overlap
- Test token estimation algorithm
- Test batch creation (100 chunks per batch)
- Test exponential backoff retry logic for rate limits
- Test chunk insertion into database
- Test document chunk count update

*Integration Tests (Mocked APIs):*
- Test full indexing pipeline: upload document → chunking → embedding → storage
- Test progress updates emitted at each stage
- Test retry logic on simulated API failures
- Test queue processing handles multiple documents sequentially
- Test concurrent queue processing prevented by processing flag
- Test auto-retry on transient failures
- Test permanent failure after max retries

*E2E Tests (Real APIs):*
- Test upload 10,000-word markdown document
- Test document is automatically queued for indexing
- Test indexing completes successfully with real OpenAI API
- Test chunks are created and stored with real embeddings
- Test progress updates appear in UI during indexing
- Test indexed document status shows 'completed'
- Test chunk count matches expected value for 10,000-word document

**Phase Completion:**
- LangChain text splitters dependency installed
- Indexing pipeline implemented in worker
- Progress tracking system implemented
- Queue processor with retry logic implemented
- LangChain integration for chunking implemented
- OpenAI embeddings API integration with batching implemented
- All unit tests passing (mocked APIs)
- All integration tests passing (mocked APIs)
- All E2E tests passing (real APIs, 10,000-word document)
- Commit message: `feat(indexing): implement background indexing pipeline with retry logic`

### Phase 5: Vector Search & RAG Integration

**Vector Search Worker Requirements:**

*Search Function Implementation:*
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

*State Extensions:*
- Add ragMode boolean state (default: false)
- Add sources array state (search results)
- Get vector DB worker instance

*RAG-Enhanced Message Flow:*
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

*Return Interface Extensions:*
- Add ragMode: boolean
- Add setRAGMode: function to toggle RAG mode
- Add sources: array of search results with metadata

**Test Requirements:**

*Unit Tests (Mocked APIs):*
- Test search generates query embedding correctly
- Test search executes HNSW vector search query
- Test search returns topK results ordered by similarity
- Test search applies filename filter when provided
- Test search calculates similarity score correctly (1 - cosine distance)
- Test RAG mode toggle updates state
- Test RAG mode disabled sends normal message
- Test RAG mode enabled triggers vector search
- Test RAG mode formats context correctly with citations
- Test RAG mode injects system message with context
- Test sources state updated with search results

*Integration Tests (Mocked APIs):*
- Test full RAG flow: user query → vector search → context injection → chat completion
- Test vector search returns relevant chunks based on embedding similarity
- Test context formatting includes document names and headings
- Test chat completion receives context in system message
- Test sources displayed match search results
- Test RAG toggle affects message sending behavior

*E2E Tests (Real APIs):*
- Test upload 10,000-word markdown document and complete indexing
- Test enable RAG mode in chat interface
- Test ask question related to document content
- Test vector search returns relevant chunks from indexed document
- Test AI response references document content correctly
- Test AI response includes source citations ([1], [2], etc.)
- Test sources section displays document filenames and similarity scores
- Test ask multiple questions in same conversation
- Test RAG mode can be toggled on/off during conversation

**Phase Completion:**
- Vector search function implemented in worker using HNSW index
- RAG integration added to useChat hook
- Context formatting and injection implemented
- Source tracking and display implemented
- All unit tests passing (mocked APIs)
- All integration tests passing (mocked APIs)
- All E2E tests passing (real APIs, 10,000-word document Q&A)
- Commit message: `feat(rag): implement vector search and RAG integration`

### Phase 6: UI Components

**Project Structure Requirements:**
Create the following components in **src/components/**:
- DocumentManager component for document library display
- IndexingStatusBadge component for status display
- RAGToggle component for RAG mode toggle
- SourcesList component for displaying search result sources

**Document Manager Component Requirements:**

*User Interface:*
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

*Indexing Status Badge Requirements:*
- Display status text (pending/processing/completed/failed)
- Apply color-coded backgrounds:
  - Pending: yellow background
  - Processing: blue background
  - Completed: green background
  - Failed: red background
- Show warning icon with error message tooltip when status is failed
- Small, rounded badge styling

**RAG Toggle Component Requirements:**

*User Interface:*
- Checkbox input for RAG mode toggle
- Label text: "RAG Mode (search documents)"
- Flex layout with small gap between checkbox and label
- Integrate with useChat hook for ragMode state
- Update ragMode state on checkbox change
- Display current ragMode state (checked/unchecked)

**Sources List Component Requirements:**

*User Interface:*
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

*Unit Tests:*
- Test DocumentManager renders loading state
- Test DocumentManager renders empty state
- Test DocumentManager renders document list
- Test DocumentManager displays document metadata correctly
- Test DocumentManager delete button calls deleteDocument
- Test IndexingStatusBadge applies correct colors for each status
- Test IndexingStatusBadge shows error icon when error present
- Test RAGToggle renders checkbox with correct checked state
- Test RAGToggle calls setRAGMode on change
- Test SourcesList returns null when empty
- Test SourcesList renders sources with citations
- Test SourcesList formats similarity percentage correctly

*Integration Tests:*
- Test DocumentManager integrates with useVectorDB hook
- Test document list updates after upload
- Test document list updates after delete
- Test RAGToggle integrates with useChat hook
- Test SourcesList displays search results from RAG query

*E2E Tests:*
- Test document library displays uploaded documents
- Test document status updates from pending to processing to completed
- Test delete document removes from list
- Test RAG mode toggle enables/disables RAG functionality
- Test sources list appears after RAG query with indexed document

**Phase Completion:**
- DocumentManager component created with status display
- IndexingStatusBadge component created
- RAGToggle component created
- SourcesList component created
- All components use existing shadcn/ui styling patterns
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Commit message: `feat(ui): add document manager, RAG toggle, and sources display`

### Phase 7: VectorDB Context & State Management

**Project Structure Requirements:**
Create the following directory structure:
- **src/contexts/** - Add new VectorDBContext for vector DB state management (ApiKeyContext already exists)

**VectorDBContext Requirements:**

*Context Type Definition:*
- initialized: boolean (tracks if worker and database are ready)
- documents: array of documents with metadata
- uploadFiles: async function to upload multiple files
- deleteDocument: async function to delete by ID
- refreshDocuments: async function to reload documents from database
- search: async function for vector search with optional topK parameter

*Provider Implementation:*
- Accept children (React nodes) and apiKey (from ApiKeyContext)
- Maintain initialized state (default: false)
- Maintain documents state (default: empty array)
- Get worker instance from singleton on component creation
- On mount/apiKey change:
  - Initialize worker database
  - Set OpenAI API key in worker if apiKey provided
  - Refresh documents from database
  - Mark as initialized
  - Start background indexing queue processor
- Implement refreshDocuments: fetch from worker, update state
- Implement uploadFiles: upload each file to worker, refresh documents
- Implement deleteDocument: delete via worker, refresh documents
- Implement search: proxy to worker search function
- Provide all state and functions via context value

*useVectorDB Hook Requirements:*
- Access VectorDBContext using useContext
- Throw error if used outside VectorDBProvider
- Return context value (all state and functions)

*App Integration Requirements:*
- Wrap app routes with VectorDBProvider inside ApiKeyProvider
- Create wrapper component to access apiKey from ApiKeyContext
- Pass apiKey to VectorDBProvider
- Ensure VectorDBProvider is inside BrowserRouter and ApiKeyProvider

**Test Requirements:**

*Unit Tests:*
- Test VectorDBProvider initializes worker on mount
- Test VectorDBProvider sets API key when provided
- Test VectorDBProvider loads initial documents
- Test VectorDBProvider re-initializes when apiKey changes
- Test VectorDBProvider starts indexing queue on init
- Test useVectorDB throws error outside provider
- Test useVectorDB returns context value inside provider
- Test uploadFiles function uploads and refreshes
- Test deleteDocument function deletes and refreshes
- Test search function proxies to worker

*Integration Tests:*
- Test context provides worker access to all components
- Test apiKey changes propagate to worker
- Test document list updates propagate to all consumers
- Test upload from one component updates list in another
- Test delete from one component updates list in another

*E2E Tests:*
- Test entire app initializes with VectorDB context
- Test context state persists across navigation
- Test multiple components can access same document state

**Phase Completion:**
- VectorDBContext created with full API
- VectorDBProvider implemented with worker integration
- useVectorDB hook created
- App.tsx updated to include VectorDBProvider
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Commit message: `feat(state): add VectorDB context for global state management`

### Phase 8: Optimization & Performance Tuning

**HNSW Index Optimization Requirements:**

*Dynamic Index Tuning:*
- Implement function to adjust HNSW parameters based on dataset size
- Parameter thresholds:
  - Small (<10K vectors): m=16, ef_construction=64
  - Medium (10K-100K): m=24, ef_construction=100
  - Large (>100K): m=32, ef_construction=200
- Drop existing index before recreation
- Create new index with optimized parameters
- Consider ef_search runtime parameter for query optimization

*Bulk Insert Optimization:*
- For large batch operations (>100 chunks), temporarily disable HNSW index
- Insert all chunks without index overhead
- Rebuild index after all inserts complete
- Significantly faster for initial bulk uploads
- Use for Phase 4 indexing pipeline when chunk count is high

*Worker Communication Optimization:*
- Use Comlink's transfer() function for large data transfers
- Transfer ArrayBuffer ownership to worker (zero-copy)
- Reduces memory overhead and transfer time
- Apply to file upload operations with large content

**Storage Quota Management Requirements:**

*Quota Monitoring:*
- Implement function to check browser storage quota
- Use navigator.storage.estimate() API
- Calculate percentage used (usage / quota * 100)
- Warn user when quota exceeds 80%
- Display quota information in UI (optional)
- Return: used bytes, total bytes, percentage used

*Quota Handling:*
- Provide cleanup suggestions when quota is low
- Allow user to delete old documents
- Consider implementing LRU (Least Recently Used) eviction policy
- Gracefully handle quota exceeded errors during uploads

**Test Requirements:**

*Unit Tests:*
- Test HNSW parameter selection for different dataset sizes
- Test index recreation with new parameters
- Test bulk insert disables and rebuilds index
- Test storage quota calculation
- Test storage quota warning triggers at 80%

*Integration Tests:*
- Test HNSW optimization improves search performance on large datasets
- Test bulk insert optimization reduces indexing time
- Test transfer() optimization reduces memory usage
- Test quota monitoring tracks actual storage usage

*E2E Tests:*
- Test large document upload (>1000 chunks) uses optimized bulk insert
- Test storage quota warning appears when quota is low
- Test application handles quota exceeded gracefully

**Phase Completion:**
- HNSW dynamic tuning implemented
- Bulk insert optimization implemented
- Comlink transfer optimization applied
- Storage quota management implemented
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Commit message: `perf(optimization): add HNSW tuning and storage quota management`

### Phase 9: Build Configuration

**Vite Configuration Requirements:**

*Plugin Configuration:*
- Keep existing React and Tailwind CSS v4 plugins
- Maintain existing path alias (@/ → ./src/)

*Worker Build Configuration:*
- Set worker format to 'es' (ES modules)
- Include React plugin for workers (enables JSX if needed)

*Dependency Optimization:*
- Exclude @electric-sql/pglite from optimization (WASM module, can't be pre-bundled)
- Prevent Vite from trying to optimize WASM files

*Build Configuration:*
- Target ES2020 for modern browser support
- Configure manual code splitting:
  - Separate chunk for 'pglite' (large WASM module)
  - Separate chunk for 'langchain' (text splitters)
  - Separate chunk for 'openai' (SDK)
- Improves initial load time and caching

*Test Configuration:*
- Maintain existing Vitest configuration
- Globals enabled
- jsdom environment
- Setup file: ./src/test/setup.ts
- Exclude node_modules, dist, and e2e directories

*Git Ignore:*
- Add WASM build artifacts (*.wasm)
- Add worker build directory (dist-worker/)

**Test Requirements:**

*Unit Tests:*
- Test Vite config compiles without errors
- Test worker builds successfully
- Test manual chunks are created correctly
- Test build output contains expected files

*Integration Tests:*
- Test built app runs in production mode
- Test WASM modules load correctly in build
- Test worker executes in production build
- Test code splitting reduces initial bundle size

*E2E Tests:*
- Test built app works in browser (npm run preview)
- Test all features work in production build

**Phase Completion:**
- Vite config updated with worker and WASM support
- Manual chunking configured for optimal loading
- Build tested and verified
- .gitignore updated
- All unit tests passing
- All integration tests passing
- All E2E tests passing
- Commit message: `build(vite): configure worker and WASM module support`

### Phase 10: Testing & Deployment

**Comprehensive Testing Requirements:**

*Final Test Suite Verification:*
- Ensure ALL unit tests from Phases 1-9 are passing (mocked APIs)
- Ensure ALL integration tests from Phases 1-9 are passing (mocked APIs)
- Ensure ALL E2E tests from Phases 1-9 are passing (real OpenAI APIs)

*Full E2E RAG Pipeline Test:*
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

*Test Data Requirements:*
- Prepare 10,000-word markdown document with:
  - Multiple sections (## headings)
  - Rich content for testing chunk retrieval
  - Specific facts that can be queried
- Prepare test questions related to document content
- Verify answers cite correct sources

**Deployment Requirements:**

*GitHub Pages Deployment:*
- Run production build (npm run build)
- Test production build locally (npm run preview)
- Verify all features work in production mode
- Install gh-pages package (--save-dev)
- Add deploy script to package.json
- Run deploy script to publish to GitHub Pages
- Verify deployed app works (real URL)

*Alternative Deployment (S3/Netlify/Vercel):*
- Build app (npm run build)
- Configure static hosting
- Set proper MIME types for .wasm files
- Configure cache headers for WASM files (immutable, max-age=31536000)
- Verify deployment

*CORS & Security:*
- No CORS configuration needed (no backend)
- OpenAI API allows browser requests
- Verify API key is not exposed in source code
- Verify API key stays in localStorage only

**Test Requirements:**

*Unit Tests:*
- Run full test suite: npm test
- Verify 100% passing
- Verify code coverage >80% for new code

*Integration Tests:*
- Run integration tests with mocked APIs
- Verify 100% passing
- Verify worker communication works correctly

*E2E Tests:*
- Run E2E test suite: npm run test:e2e
- Verify 100% passing
- Test with real OpenAI API key
- Test full RAG pipeline with 10,000-word document
- Measure and document:
  - Upload time
  - Indexing time
  - Search latency
  - Storage used

**Phase Completion:**
- All unit tests passing (Phases 1-10)
- All integration tests passing (Phases 1-10)
- All E2E tests passing (Phases 1-10)
- Full RAG pipeline tested with 10,000-word document
- Application deployed to GitHub Pages (or alternative)
- Deployment verified and functional
- Performance benchmarks documented
- Commit message: `chore(deploy): finalize testing and deploy to production`

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

1. **Network Failures:**
   - Exponential backoff for OpenAI API (429 rate limits)
   - Retry queue for failed indexing jobs
   - Store partial progress (allow resume)

2. **Storage Quota Exceeded:**
   - Monitor quota with `navigator.storage.estimate()`
   - Warn user at 80% capacity
   - Provide cleanup UI (delete old documents)

3. **Worker Crashes:**
   - PGlite data persists in IndexedDB
   - Indexing queue survives page reload
   - Auto-resume pending jobs on startup

4. **Invalid Files:**
   - Validate file type before upload
   - Handle non-UTF8 encoding gracefully
   - Skip chunks that fail embedding

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

| Metric | Small (100 docs) | Medium (1K docs) | Large (10K docs) |
|--------|------------------|------------------|------------------|
| **Indexing Time** | ~2 min | ~20 min | ~3 hours |
| **Storage Used** | ~5 MB | ~50 MB | ~500 MB |
| **Search Time** | <10ms | <20ms | <50ms |
| **Embedding Cost** | $0.01 | $0.10 | $1.00 |

*Assumes average 500 words/doc, 5 chunks/doc*

### Monitoring & Debugging

**Add telemetry to worker:**

```typescript
const stats = {
  totalDocuments: 0,
  totalChunks: 0,
  totalEmbeddings: 0,
  indexingTime: 0,
  errorCount: 0,
}

async function getStats() {
  const db = await initDB()

  const docCount = await db.query('SELECT COUNT(*) FROM documents')
  const chunkCount = await db.query('SELECT COUNT(*) FROM chunks')
  const pendingCount = await db.query(`
    SELECT COUNT(*) FROM indexing_queue WHERE status = 'pending'
  `)

  return {
    documents: docCount.rows[0].count,
    chunks: chunkCount.rows[0].count,
    pendingJobs: pendingCount.rows[0].count,
    ...stats
  }
}
```

**Console logging:**

```typescript
// Enable debug mode
const DEBUG = import.meta.env.DEV

function log(...args: any[]) {
  if (DEBUG) console.log('[VectorDB]', ...args)
}
```

---

## Migration & Upgrade Paths

### From Current App

1. Install dependencies
2. Create workers
3. Add VectorDB context (doesn't affect existing chat)
4. Add upload UI (new page/modal)
5. Update chat to support RAG mode (toggle)
6. Deploy

**Backward Compatible:** Existing chat still works without RAG.

### Future Enhancements

1. **Cloud Sync (ElectricSQL):**
   - Sync PGlite to cloud Postgres
   - Multi-device access
   - Collaborative document libraries

2. **Advanced Search:**
   - Full-text + vector hybrid search
   - Filters: date range, document type, tags
   - Search within specific documents

3. **Document Processing:**
   - PDF support (pdf.js)
   - DOCX support
   - Image OCR (Tesseract.js)
   - Code file chunking (tree-sitter)

4. **Embeddings Cache:**
   - Store embeddings in separate table
   - Reuse for similar queries
   - LRU eviction policy

5. **Batch API Integration:**
   - For large initial uploads
   - 50% cost savings
   - Background processing over 24hrs

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

**Total Estimated Timeline:** 8 days
**Bundle Size Impact:** +3-4 MB (PGlite WASM)
**Cost per 1000 documents:** ~$0.10 (OpenAI embeddings)

The plan is **production-ready**, **scalable** (handles 100-100K documents), and **future-proof** (can upgrade to cloud Postgres later).