# Phase indexing-pipeline: Implementation Specifications

**Status:** Incremental TDD - Each phase builds & tests independently, tests pass at phase completion
**Dependencies:** Phase worker-setup ✅ COMPLETE
**Goal:** Background indexing pipeline with visible UI state, using real OpenAI API

---

## 🎯 Incremental TDD Approach

**Why Incremental TDD:**
- Each phase delivers testable value independently
- Tests pass at end of each phase (not all at the end)
- Earlier phases provide foundation for later phases
- Can stop at any phase with working system
- Faster feedback loops

**Key Principles:**
1. **Real API Testing** - Hit OpenAI API directly (no MSW mocking)
2. **Test Isolation** - Existing document tests don't trigger indexing (no feature toggled off)
3. **Incremental Tests** - Write tests only for current phase, tests pass at phase completion
4. **Progressive Enhancement** - Each phase adds functionality to working system

**Implementation Order:**
1. **Phase ui-components** - Build UI with data attributes, test visual states (no worker calls)
2. **Phase db-schema** - Create tables, test queue creation on upload
3. **Phase queue-processor** - Status transitions (pending → processing → completed), no real work yet
4. **Phase chunking** - LangChain integration, store chunks (no embeddings)
5. **Phase embeddings** - OpenAI API integration, full indexing pipeline
6. **Phase progress-tracking** - Real-time progress updates
7. **Phase error-retry** - Error handling, retry logic (implementation only, no dedicated test)
8. **Phase persistence** - State survives reload

---

## Overview

Implement background job queue that automatically chunks uploaded documents, generates embeddings via OpenAI API, and stores vectors in PGlite for semantic search.

**Key Components:**
1. **UI Components** - Make background process visible and testable
2. Database schema extensions (indexing_queue, chunks tables)
3. LangChain text splitter integration
4. OpenAI embeddings API client
5. Background queue processor with retry logic
6. Progress tracking system
7. E2E tests with mocked APIs (written BEFORE worker implementation)

---

## Current Codebase State

**Foundation Exists:**
- **VectorDBContext** (`src/contexts/VectorDBContext.tsx`): Context with documents state, uploadFiles, deleteDocument, refreshDocuments
- **DocumentCard** (`src/pages/documents/components/DocumentCard.tsx`): Basic card with filename, size, date, download/delete buttons
- **Worker** (`src/workers/pglite.worker.ts`): PGlite worker with init(), uploadDocument(), getDocuments(), deleteDocument(), setIndexingEnabled()
- **ApiKeyContext** (`src/contexts/ApiKeyContext.tsx`): Manages OpenAI API key in localStorage (key: 'openai_api_key')
- **Feature Toggle System**: Runtime localStorage toggles, Settings UI, test integration (FEATURE_INDEXING_ENABLED)
- **Test Infrastructure**: Page Object Model pattern, component-based test structure, globalSetup fixture
- **PG Essays**: Test data fixtures at `e2e/fixtures/pg-essays.ts` (5 essays)
- **pgvector Extension**: Already enabled in worker (`CREATE EXTENSION IF NOT EXISTS vector`)

**To Be Implemented:**
- IndexingStatusBadge, IndexingProgress components
- Indexing props on DocumentCard
- Indexing state in VectorDBContext (indexingProgress Map, retryFailed)
- Database tables: indexing_queue, chunks
- Database schema extensions: documents.chunk_count, documents.indexed_at
- Chunking/embedding/queue processing logic
- Worker methods: onProgress, startIndexing, retryFailed
- Indexing test files

---

## PGlite Capabilities Verification

**pgvector Extension Support:**
- ✅ PGlite includes pgvector in main package
- ✅ Import via: `import { vector } from '@electric-sql/pglite/vector'`
- ✅ Already enabled in worker

**vector(1536) Data Type:**
- ✅ pgvector supports vectors up to 2000 dimensions
- ✅ 1536 dimensions (OpenAI text-embedding-3-small) fully supported
- ✅ No size limitations for specified use case

**HNSW Index Support:**
- ✅ PGlite supports pgvector's HNSW indexes via WASM
- ✅ Syntax: `CREATE INDEX ON chunks USING hnsw (embedding vector_l2_ops)`
- ✅ Supports vector_ip_ops (inner product), vector_cosine_ops (cosine), vector_l2_ops (Euclidean)
- ✅ HNSW_MAX_DIM = 2000 (1536 dimensions supported)

**Distance Functions:**
- ✅ L2 distance (Euclidean): `<->` operator
- ✅ Inner product: `<#>` operator
- ✅ Cosine distance: `<=>` operator
- ✅ L1, Hamming, Jaccard also available

**Conclusion:** All features specified in this phase are supported by PGlite/pgvector.

---

## 1. UI Components (BUILD FIRST - TDD Step 1)

**Note:** Application uses existing ApiKeyContext for OpenAI API key management. No separate API key input needed for indexing.

### 1.1 Indexing Status Badge Component

**Location:** `src/pages/documents/components/IndexingStatusBadge.tsx` (NEW)

**Purpose:** Color-coded status indicator for indexing state

**Visual Design:**
```typescript
Pending:    [⏳ Pending]     Yellow background
Processing: [⚡ Processing]  Blue background
Completed:  [✓ Indexed]     Green background
Failed:     [✗ Failed (2)]  Red background + retry count
```

**Data Attributes for Testing:**
```typescript
data-testid="badge-indexing-status"
data-status="pending|processing|completed|failed"
data-retry-count="N"
```

### 1.3 Indexing Progress Component

**Location:** `src/pages/documents/components/IndexingProgress.tsx` (NEW)

**Purpose:** Real-time progress bar during indexing

**Visual Design:**
```
┌──────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓░░░░░░░░ 60%                │
│ Embedding batch 3 of 5...            │
└──────────────────────────────────────┘
```

**Data Attributes for Testing:**
```typescript
data-testid="indexing-progress"
data-progress="0-100"                    // 0-100 percentage
data-stage="chunking|embedding|storing"
data-message="Status message text"
```

**Display Logic:**
- Show only when status = "processing"
- Hide when status = "pending", "completed", "failed"

### 1.3 Document Card Extensions

**Location:** `src/pages/documents/components/DocumentCard.tsx` (MODIFY EXISTING)

**Add Indexing UI to Existing Card:**
```
┌────────────────────────────────────────┐
│ filename.md                  [Download]│
│                              [Delete]  │
│ 1.2 KB · Uploaded 2m ago               │
│                                        │
│ [⚡ Processing]                        │ ← Status badge
│ ▓▓▓▓▓▓▓▓░░░░░░░░ 60%                  │ ← Progress (if processing)
│ Embedding batch 3 of 5...              │ ← Message (if processing)
│                                        │
│ 24 chunks indexed                      │ ← Chunk count (if completed)
│                                        │
│ ✗ Error: Rate limit exceeded           │ ← Error (if failed)
│ [Retry] (Attempt 2/3)                  │ ← Retry button (if failed)
└────────────────────────────────────────┘
```

**New Props:**
```typescript
interface DocumentCardProps {
  // ... existing props
  indexingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  indexingProgress?: { progress: number, stage: string, message: string }
  chunkCount?: number
  errorMessage?: string
  retryCount?: number
  onRetry?: () => void
}
```

**Data Attributes (ADD to existing):**
```typescript
// Existing
data-testid="div-doc-item-{documentId}"

// New
data-indexing-status="pending|processing|completed|failed|null"
data-indexing-progress="0-100"
data-indexing-stage="chunking|embedding|storing|completed|failed"
data-chunk-count="N"
data-error-message="Error text"
data-retry-count="N"
data-testid="btn-retry-{documentId}"  // Retry button
```

---

## 2. Context & State Management (BUILD SECOND - TDD Step 1 continued)

### 2.1 VectorDBContext Extensions

**Location:** `src/contexts/VectorDBContext.tsx` (EXTEND EXISTING)

**Note:** Worker reads OpenAI API key from existing ApiKeyContext (via localStorage 'openai_api_key'). No separate API key management needed.

**Add State:**
```typescript
interface VectorDBContextType {
  // ... existing fields
  indexingProgress: Map<string, IndexingProgress>
  retryFailed: (documentId: string) => Promise<void>
}

interface IndexingProgress {
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number        // 0-100
  stage: string          // "chunking" | "embedding" | "storing"
  message: string
  chunkCount?: number
  errorMessage?: string
  retryCount?: number
}
```

**Implementation:**
```typescript
export function VectorDBProvider({ children }: { children: ReactNode }) {
  const [indexingProgress, setIndexingProgress] = useState<Map<string, IndexingProgress>>(new Map())

  // Subscribe to worker progress updates
  useEffect(() => {
    worker.onProgress((progress: IndexingProgress) => {
      setIndexingProgress(prev => new Map(prev).set(progress.documentId, progress))
    })
  }, [])

  const retryFailed = async (documentId: string) => {
    await worker.retryFailed(documentId)
  }

  return (
    <VectorDBContext.Provider
      value={{
        // ... existing
        indexingProgress,
        retryFailed,
      }}
    >
      {children}
    </VectorDBContext.Provider>
  )
}
```

### 2.2 DocumentWithStatus Interface Extension

**Update Type:**
```typescript
interface DocumentWithStatus {
  id: string
  filename: string
  content: string
  file_size: number
  mime_type: string
  uploaded_at: string
  chunk_count: number | null            // NEW
  indexed_at: string | null             // NEW
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null  // NEW
  error_message: string | null          // NEW
  retry_count: number | null            // NEW
}
```

---

## 3. Test Isolation Strategy

**Problem:** Existing document tests (documents-upload.spec.ts) upload files → would trigger indexing → cost money

**Solution:** Runtime feature toggle to conditionally enable/disable indexing

**Feature Toggle System:** See `feature-toggle.md` for complete specification

**Summary:**
- **Toggle:** `FEATURE_INDEXING_ENABLED` (user-controlled, stored in localStorage)
- **Default:** Enabled (true) if not explicitly disabled
- **Implementation:** Runtime (no build-time env vars)

**Worker Implementation (in Phase db-schema):**
```typescript
// Worker maintains toggle state
let indexingEnabled = true // default

function setIndexingEnabled(enabled: boolean): void {
  indexingEnabled = enabled
}

// In uploadDocument()
async function uploadDocument(params: UploadDocumentParams): Promise<{ id: string }> {
  const id = uuidv4()

  await db.query(
    `INSERT INTO documents (id, filename, content, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, params.filename, params.content, fileSize, params.mimeType]
  )

  // ONLY create indexing job if feature enabled
  if (indexingEnabled) {
    await db.query(
      `INSERT INTO indexing_queue (id, document_id, status)
       VALUES ($1, $2, 'pending')`,
      [uuidv4(), id]
    )
  }

  return { id }
}
```

**Test Strategy:**
- Existing tests (documents-*.spec.ts): Use `page.addInitScript()` to disable toggle → No indexing → No cost
- New indexing tests (indexing-*.spec.ts): Don't set toggle (default=enabled) → Indexing happens
- Feature toggle implemented as prerequisite (see `feature-toggle.md`), queue creation in **Phase db-schema**

---

## 4. Dependencies

**Install (Phase chunking):**
```bash
npm install @langchain/textsplitters
```

**Already Installed:**
- `openai`: ✅ From chat feature

---

## 5. Database Schema Extensions

### 5.1 Indexing Queue Table

**Purpose:** Track background indexing jobs with retry logic

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS indexing_queue (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE (document_id)
);

CREATE INDEX idx_queue_status_created ON indexing_queue(status, created_at);
```

**Fields:**
- `id` - UUID primary key
- `document_id` - Foreign key to documents (CASCADE delete)
- `status` - Current job status (pending/processing/completed/failed)
- `error_message` - Error details if failed (nullable)
- `retry_count` - Current retry attempt (0-based)
- `max_retries` - Maximum retries before marking failed (default: 3)
- `created_at` - Job creation timestamp
- `started_at` - When processing started (nullable)
- `completed_at` - When job finished (nullable)

**Constraints:**
- UNIQUE(document_id) - One queue entry per document
- CHECK constraint on status values

**Index:**
- Composite index on (status, created_at) for efficient job polling

### 5.2 Chunks Table

**Purpose:** Store text chunks with vector embeddings

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  heading TEXT,
  embedding vector(1536),
  token_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON chunks(document_id);
```

**Fields:**
- `id` - UUID primary key
- `document_id` - Foreign key to documents (CASCADE delete)
- `chunk_index` - 0-based position in document
- `content` - Text chunk content
- `heading` - Optional markdown heading context (nullable)
- `embedding` - 1536-dimensional vector (pgvector type)
- `token_count` - Estimated tokens (rough: length / 4)
- `created_at` - Chunk creation timestamp

**Constraints:**
- UNIQUE(document_id, chunk_index) - Prevent duplicate chunks

**Index:**
- B-tree index on document_id for efficient lookups

### 5.3 Documents Table Extensions

**SQL Schema:**
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
```

**New Fields:**
- `chunk_count` - Total chunks created (nullable until indexed)
- `indexed_at` - Indexing completion timestamp (nullable)

---

## 6. Worker API Extensions

### 6.1 Modified Existing Methods

**uploadDocument():**
```typescript
async function uploadDocument(params: UploadDocumentParams): Promise<{ id: string }> {
  const id = uuidv4()

  // Insert document
  await db.query(
    `INSERT INTO documents (id, filename, content, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, params.filename, params.content, fileSize, params.mimeType]
  )

  // Create pending indexing job
  await db.query(
    `INSERT INTO indexing_queue (id, document_id, status)
     VALUES ($1, $2, 'pending')`,
    [uuidv4(), id]
  )

  return { id }
}
```

**getDocuments():**
```typescript
async function getDocuments(): Promise<DocumentWithStatus[]> {
  const result = await db.query<DocumentWithStatus>(`
    SELECT
      d.*,
      iq.status as indexing_status,
      iq.error_message,
      iq.retry_count
    FROM documents d
    LEFT JOIN indexing_queue iq ON d.id = iq.document_id
    ORDER BY d.uploaded_at DESC
  `)

  return result.rows
}
```

**deleteDocument():**
- No changes needed (CASCADE handles queue + chunks)

### 6.2 New Worker Methods

**Note:** Worker reads OpenAI API key from localStorage ('openai_api_key') on init(). No separate setOpenAIKey() method needed.

**Worker init() extension:**
```typescript
async function init() {
  // ... existing db init

  // Initialize OpenAI client from existing ApiKeyContext
  const apiKey = localStorage.getItem('openai_api_key')
  if (apiKey) {
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  }
}
```

**onProgress(callback: ProgressCallback):**
```typescript
function onProgress(callback: ProgressCallback): void {
  progressCallbacks.push(Comlink.proxy(callback))
}
```

**startIndexing():**
```typescript
async function startIndexing(): Promise<{ started: boolean }> {
  processQueue() // Don't await, runs in background
  return { started: true }
}
```

**retryFailed(documentId: string):**
```typescript
async function retryFailed(documentId: string): Promise<{ retried: boolean }> {
  await db.query(
    `UPDATE indexing_queue
     SET status = 'pending', retry_count = 0, error_message = NULL
     WHERE document_id = $1`,
    [documentId]
  )

  processQueue()
  return { retried: true }
}
```

---

## 7. Indexing Pipeline Implementation

### 7.1 Global State (Worker Scope)

```typescript
let openaiClient: OpenAI | null = null
let isProcessing = false
let progressCallbacks: Array<(progress: IndexingProgress) => void> = []

interface IndexingProgress {
  documentId: string
  stage: 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
}
```

### 7.2 Queue Processor

**Requirements:**
- Poll `indexing_queue` for jobs with status='pending'
- Process oldest job first (ORDER BY created_at ASC)
- Process one job at a time to avoid race conditions
- Continue until no pending jobs remain
- Prevent concurrent processing (single-threaded queue)

**Auto-Start Behavior:**
- Start queue processor on worker init
- Poll periodically for new jobs (recommended: every few seconds)
- Consider brief delays between jobs to avoid CPU thrashing

**Implementation Notes:**
- Use flag (`isProcessing`) to serialize queue access
- Query: `SELECT * FROM indexing_queue WHERE status='pending' ORDER BY created_at ASC LIMIT 1`
- Exit loop when no pending jobs found
- Handle errors gracefully without stopping queue processor

### 7.3 Job Processing

**Job Lifecycle:**
1. **Start:** Update indexing_queue: status='processing', started_at=CURRENT_TIMESTAMP
2. **Chunk:** Split document content into chunks (emit progress updates)
3. **Embed:** Generate embeddings for all chunks (emit progress updates)
4. **Store:** Save chunks with embeddings to database (emit progress updates)
5. **Complete:** Update indexing_queue: status='completed', completed_at=CURRENT_TIMESTAMP
6. **Finalize:** Update documents: chunk_count, indexed_at=CURRENT_TIMESTAMP

**Progress Stages:**
- **Chunking** (0-30%): Text splitting phase
- **Embedding** (30-70%): OpenAI API calls phase
- **Storing** (70-100%): Database writes phase
- **Completed** (100%): Job finished successfully

**State Transitions:**
- Success: `pending → processing → completed`
- Failure: `pending → processing → failed` (or back to `pending` if retry available)

**Error Handling:**
- Catch all errors during processing
- Delegate to error handler with retry logic
- Ensure queue entry updated even on failure

**Implementation Notes:**
- Emit progress at meaningful milestones for smooth UX
- Balance progress update frequency vs performance overhead
- Consider progress percentages as guidelines, not strict requirements
- Include human-readable messages with each progress update

### 7.4 Chunking with LangChain

**Requirements:**
- Use LangChain `RecursiveCharacterTextSplitter` for intelligent text splitting
- Configure for markdown content (respects headings, code blocks, paragraphs)
- Chunk size: 500-1500 characters (balance between context and granularity)
- Overlap: 10-20% of chunk size (maintains context across boundaries)
- Return chunks with optional heading extraction for better context

**Dependency:**
```bash
npm install @langchain/textsplitters
```

**Import:**
```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
```

**Return Type:**
```typescript
Array<{ content: string, heading?: string }>
```

**Implementation Notes:**
- Use `.fromLanguage('markdown')` for markdown-aware splitting
- Extract heading from chunk content using regex: `/^##?\s+(.+)$/m`
- Heading extraction is optional but improves chunk context
- Test with Paul Graham essays to tune chunk size for semantic coherence

### 7.5 OpenAI Embeddings with Batching

**Requirements:**
- Generate embeddings using OpenAI `text-embedding-3-small` model
- Dimensions: 1536 (compatible with PGlite pgvector)
- Process chunks in batches to handle large documents efficiently
- Emit progress updates after each batch
- Handle rate limits with exponential backoff retry

**API Configuration:**
```typescript
model: 'text-embedding-3-small'
dimensions: 1536
input: string[] // batch of chunk contents
```

**Batching Strategy:**
- Batch size: 50-100 chunks per API call (balance cost vs latency)
- Process batches sequentially to simplify progress tracking
- Return: `number[][]` (array of 1536-dimension vectors)

**Rate Limit Handling:**
- Detect HTTP 429 (rate limit) errors
- Retry with exponential backoff (e.g., 1s, 2s, 4s, 8s)
- Max retries: 3-5 attempts recommended
- Only retry transient errors (429), not auth/validation failures

**Error Messages:**
- No API key: "OpenAI client not initialized. Set API key in application settings."
- Rate limit: Include retry attempt info in progress message
- Other errors: Propagate to job error handler

**Implementation Notes:**
- OpenAI client already initialized in worker (from ApiKeyContext)
- Progress updates: emit after each batch with current batch number and total batches
- Consider batch size vs API limits (check OpenAI docs for current limits)

### 7.6 Chunk Storage

**Requirements:**
- Store chunks and embeddings in `chunks` table
- Each chunk: UUID, document_id, chunk_index (0-based), content, heading (optional), embedding, token_count
- Emit progress updates periodically during storage
- Insert chunks in order to maintain chunk_index consistency

**Database Insert:**
```sql
INSERT INTO chunks (id, document_id, chunk_index, content, heading, embedding, token_count)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

**Field Values:**
- `id`: Generated UUID (use uuidv4())
- `document_id`: From job
- `chunk_index`: 0-based position (array index)
- `content`: Chunk text
- `heading`: Optional heading extracted during chunking
- `embedding`: Vector in pgvector format: `[${embedding.join(',')}]`
- `token_count`: Rough estimate (e.g., `Math.ceil(content.length / 4)`)

**Progress Updates:**
- Emit periodically (e.g., every 10-20 chunks) to balance UX vs performance
- Include: chunks stored count, total chunks
- Stage: 'storing', percentage: 70-100%

**Implementation Notes:**
- Process chunks sequentially to maintain order
- Consider batch inserts for better performance (trade-off: simpler progress tracking vs speed)
- Rough token counting is sufficient for display purposes

### 7.7 Error Handling

**Requirements:**
- Catch all errors during job processing
- Implement automatic retry logic with configurable max retries
- Update queue status and error message in database
- Emit progress update with error information
- Distinguish between retryable and permanent failures

**Retry Logic:**
- Max retries: 3-5 attempts recommended
- If retry_count < max_retries: Set status='pending', increment retry_count, store error_message
- If retry_count >= max_retries: Set status='failed', completed_at=CURRENT_TIMESTAMP

**Database Updates:**

**For Retry:**
```sql
UPDATE indexing_queue
SET status = 'pending', retry_count = $1, error_message = $2
WHERE id = $3
```

**For Permanent Failure:**
```sql
UPDATE indexing_queue
SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
WHERE id = $2
```

**Error Messages:**
- Extract: `error.message || String(error)`
- Include retry count in progress update: `Retry ${count}/${maxRetries}: ${message}`
- Permanent failure: `Failed: ${message}`

**Implementation Notes:**
- Emit progress with stage='failed', progress=0
- Store error_message for display in UI
- Auto-retry happens on next queue poll (no immediate retry)
- Consider different handling for auth errors (don't retry) vs rate limits (retry with backoff)

### 7.8 Progress Emission

**Requirements:**
- Emit progress updates to all registered callbacks (VectorDBContext)
- Include: documentId, stage, progress (0-100), human-readable message
- Handle callback errors gracefully (don't crash worker)
- Log progress in development mode for debugging

**Progress Data Structure:**
```typescript
interface IndexingProgress {
  documentId: string
  stage: 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
}
```

**Callback Management:**
- Store callbacks in array: `progressCallbacks: Array<(progress: IndexingProgress) => void>`
- Use Comlink.proxy() when registering callbacks to enable cross-worker communication
- Iterate all callbacks on progress update
- Catch and log callback errors to prevent worker crash

**Development Logging:**
- Log progress in DEV environment only
- Format: `[Worker] ${documentId}: ${stage} ${progress}% - ${message}`
- Use console.log for info, console.error for callback failures

**Implementation Notes:**
- Call emitProgress() at meaningful milestones throughout job processing
- Balance update frequency for smooth UX without performance overhead
- Messages should be user-friendly and descriptive

---

## 8. Testing Strategy

### 8.1 Real API Testing

**No MSW Mocking** - Tests hit real OpenAI API:
- More realistic testing
- Catches API integration issues
- Validates actual embedding quality
- Cost: ~$0.001 per test run (negligible)

**API Key Management:**
```typescript
// Load from .env.test or environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
```

### 8.2 Page Object Extensions

**Extend DocumentsPage:**
```typescript
// e2e/documents/page-objects/DocumentsPage.ts (ADD METHODS)

export class DocumentsPage {
  // ... existing methods

  async setAPIKey(apiKey: string = 'sk-test-key-123') {
    await this.page.getByTestId('input-api-key').fill(apiKey)
    await this.page.getByTestId('btn-set-api-key').click()

    await this.page.waitForFunction(() => {
      const status = document.querySelector('[data-api-key-set]')
      return status?.getAttribute('data-api-key-set') === 'true'
    })
  }

  async expectAPIKeySet() {
    const apiKeySet = await this.page.locator('[data-api-key-set="true"]').isVisible()
    expect(apiKeySet).toBe(true)
  }
}
```

**Extend DocumentListComponent:**
```typescript
// e2e/documents/page-objects/DocumentListComponent.ts (ADD METHODS)

export class DocumentListComponent {
  // ... existing methods

  async waitForIndexingStatus(
    filename: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    options?: { timeout?: number }
  ) {
    const fileId = await this.findFileByName(filename)
    if (!fileId) throw new Error(`File not found: ${filename}`)

    await this.page.waitForFunction(
      ({ id, targetStatus }) => {
        const card = document.querySelector(`[data-testid="div-doc-item-${id}"]`)
        const currentStatus = card?.getAttribute('data-indexing-status')
        return currentStatus === targetStatus
      },
      { id: fileId, targetStatus: status },
      { timeout: options?.timeout || 30000 }
    )
  }

  async expectIndexingProgress(filename: string, minProgress: number) {
    const fileId = await this.findFileByName(filename)
    const card = this.page.locator(`[data-testid="div-doc-item-${fileId}"]`)
    const progress = await card.getAttribute('data-indexing-progress')
    expect(parseInt(progress || '0')).toBeGreaterThanOrEqual(minProgress)
  }

  async expectChunkCount(filename: string, expectedCount: number) {
    const fileId = await this.findFileByName(filename)
    const card = this.page.locator(`[data-testid="div-doc-item-${fileId}"]`)
    const count = await card.getAttribute('data-chunk-count')
    expect(parseInt(count || '0')).toBe(expectedCount)
  }

  async getChunkCount(filename: string): Promise<number> {
    const fileId = await this.findFileByName(filename)
    const card = this.page.locator(`[data-testid="div-doc-item-${fileId}"]`)
    const count = await card.getAttribute('data-chunk-count')
    return parseInt(count || '0')
  }

  async retryFailedIndexing(filename: string) {
    const fileId = await this.findFileByName(filename)
    await this.page.click(`[data-testid="btn-retry-${fileId}"]`)
  }

  async expectErrorMessage(filename: string, partialError: string) {
    const fileId = await this.findFileByName(filename)
    const card = this.page.locator(`[data-testid="div-doc-item-${fileId}"]`)
    const error = await card.getAttribute('data-error-message')
    expect(error).toContain(partialError)
  }
}
```

### 8.3 E2E Test Files & Pattern

**Test Files Structure:**
```
e2e/
├── feature-flags.spec.ts                 (✅ EXISTING - prerequisite, feature toggle tests)
├── documents-upload.spec.ts              (✅ EXISTING - toggle disabled, no indexing)
├── indexing-workflow-basic.spec.ts       (NEW @live - single file workflow + persistence)
└── indexing-workflow-multi.spec.ts       (NEW @live - multiple files, parallel indexing)
```

**Test Pattern: Follow documents-upload.spec.ts**

Like `documents-upload.spec.ts`, each test file contains **ONE comprehensive test with multiple scenarios** that build on each other:

```typescript
// indexing-workflow-basic.spec.ts @live
test('indexing workflow: queue → chunk → embed → complete → persist', async ({ page }) => {
  // Scenario 1: Queue creation (Phase db-schema)
  await documentsPage.uploadFilesAndWait(PG_ESSAYS.EQUITY, PG_ESSAY_NAMES.EQUITY);
  await documentsPage.expectIndexingStatus(PG_ESSAY_NAMES.EQUITY, 'pending');

  // Scenario 2: Status transitions (Phase queue-processor)
  await documentsPage.waitForIndexingStatus(PG_ESSAY_NAMES.EQUITY, 'processing', { timeout: 5000 });
  await documentsPage.expectProgressVisible(PG_ESSAY_NAMES.EQUITY);

  // Scenario 3: Chunking complete (Phase chunking)
  await documentsPage.waitForIndexingStatus(PG_ESSAY_NAMES.EQUITY, 'completed', { timeout: 30000 });
  const chunkCount = await documentsPage.getChunkCount(PG_ESSAY_NAMES.EQUITY);
  expect(chunkCount).toBeGreaterThan(0);

  // Scenario 4: Embeddings stored (Phase embeddings)
  const hasEmbeddings = await documentsPage.queryDatabase(
    'SELECT COUNT(*) FROM chunks WHERE document_id = $1 AND embedding IS NOT NULL'
  );
  expect(hasEmbeddings).toBeGreaterThan(0);

  // Scenario 5: Persistence (Phase persistence)
  const chunkCountBeforeReload = chunkCount;
  await page.reload();
  await documentsPage.waitForDBInitialized();

  await documentsPage.expectIndexingStatus(PG_ESSAY_NAMES.EQUITY, 'completed');
  const chunkCountAfterReload = await documentsPage.getChunkCount(PG_ESSAY_NAMES.EQUITY);
  expect(chunkCountAfterReload).toBe(chunkCountBeforeReload);
})
```

**Key Pattern Elements:**
- ✅ **Single test, multiple scenarios**: One comprehensive workflow per test file
- ✅ **Scenarios build on each other**: State flows naturally (upload → queue → process → persist)
- ✅ **No separate setup/teardown**: Earlier scenarios create state for later scenarios
- ✅ **Extended incrementally**: Add new scenarios as phases are implemented
- ✅ **Data attribute assertions**: Wait for observable state changes (`data-indexing-status`, etc.)

**Live Test Strategy:**
- All indexing tests tagged with `@live` (exclude from regular test:e2e)
- Use real Paul Graham essays from `e2e/fixtures/files/`
- Tests hit real OpenAI API (acceptable cost for realistic testing)
- Run via `npm run test:e2e:live`
- Error/retry implementation included but not tested (manual verification only)

**Test Essay Selection:**
- `078_the_equity_equation.md` (1,142 words) - **SHORT** ← Used in basic test
- `049_inequality_and_risk.md` (2,854 words) - **MEDIUM-SHORT** ← Used in multi test
- `182_the_lesson_to_unlearn.md` (4,059 words) - MEDIUM
- `018_a_plan_for_spam.md` (5,374 words) - LONG
- `021_why_nerds_are_unpopular.md` (5,727 words) - LONGEST

**Incremental Test Development:**
- Tests extended incrementally across phases (not all written upfront)
- Each phase adds new scenarios to existing test file
- Early phases: stub/mock assertions (UI visible, queue created)
- Later phases: full end-to-end assertions (embeddings stored, persistence works)

---

## 9. Incremental TDD Workflow (8 Phases)

**Vertical Slice Approach:**
Each phase (after ui-components foundation) builds a complete vertical slice: **UI + DB + Logic + Tests**. Every phase delivers independently testable value.

**Workflow per Phase:**
1. Build: Implement UI updates, database changes, business logic together
2. Test: Extend existing test file with new scenarios (not new test files)
3. Pass: All tests pass at phase completion
4. Move: Next phase builds on working foundation

**Prerequisite:** Feature toggle system complete (feature-flags.spec.ts passing)

**Test Strategy:**
- ONE test file per workflow (`indexing-workflow-basic.spec.ts`, `indexing-workflow-multi.spec.ts`)
- ONE comprehensive test per file with multiple scenarios (like documents-upload.spec.ts)
- Extend tests incrementally as phases progress
- Each scenario tests what was built in that phase

---

### **Phase ui-components**: UI Components & Visual State

**Goal:** Render all indexing UI with data attributes, no worker integration

**Build:**
- Create `IndexingStatusBadge.tsx` (4 status variants)
- Create `IndexingProgress.tsx` (progress bar)
- Update `DocumentCard.tsx` (add indexing props + UI)
- Update `VectorDBContext.tsx` (add indexingProgress state)
- Wire components to context

**Test:** UI verification (stubbed data, no real worker integration yet)

**Pass Criteria:**
- ✅ All UI components render with data attributes
- ✅ Status badges display all 4 states
- ✅ Progress bar component exists

**Checkpoint:** UI complete, no worker calls yet

---

### **Phase db-schema**: Database Schema & Queue Creation

**Goal:** Create tables, queue entries created on upload (if feature toggle enabled)

**Build:**
- Create `indexing_queue` table in worker `init()`
- Create `chunks` table in worker `init()`
- Extend `documents` table (ALTER TABLE - chunk_count, indexed_at)
- Update `uploadDocument()`: create queue entry if FEATURE_INDEXING_ENABLED
- Update `getDocuments()`: LEFT JOIN with indexing_queue

**Test:** Queue entry verification (extend existing documents-upload.spec.ts assertions or create focused verification)

**Pass Criteria:**
- ✅ Tables created successfully
- ✅ Queue entry created only when feature toggle enabled
- ✅ Existing tests still pass (toggle disabled, no queue)

**Checkpoint:** Database schema complete, conditional queue creation works

---

### **Phase queue-processor**: Status Transitions (Mock Work)

**Goal:** Queue processor runs, status changes pending → processing → completed (no real work)

**Build:**
- Implement `processQueue()` function
- Implement `processJob()`: marks job as processing, waits 1 second, marks completed
- Connect VectorDBContext to worker via `onProgress` events
- Auto-start queue processor on worker init

**Test:** Begin `e2e/indexing-workflow-basic.spec.ts @live` - verify status transitions

**Pass Criteria:**
- ✅ Queue processor runs automatically
- ✅ Status transitions visible in UI (pending → processing → completed)

**Checkpoint:** Queue processing works, status updates visible

---

### **Phase chunking**: LangChain Text Splitting

**Goal:** Documents actually get chunked and stored (no embeddings yet)

**Build:**
- Install `@langchain/textsplitters`
- Implement `chunkDocument()` with RecursiveCharacterTextSplitter
- Update `processJob()`: actually chunk document
- Store chunks in `chunks` table (embedding = NULL for now)
- Update `documents.chunk_count` after chunking

**Test:** Extend `e2e/indexing-workflow-basic.spec.ts @live` - upload `078_the_equity_equation.md`, verify chunk count > 0

**Pass Criteria:**
- ✅ Documents chunked with LangChain
- ✅ Chunks stored in database
- ✅ Chunk count visible in UI

**Checkpoint:** Chunking works, chunks stored

---

### **Phase embeddings**: OpenAI API Integration

**Goal:** Generate real embeddings via OpenAI API, store with chunks

**Build:**
- Worker reads API key from localStorage ('openai_api_key') on init
- Implement `generateEmbeddings()` with batching (batch size: implementation choice)
- Implement retry logic with exponential backoff for rate limits
- Update `storeChunks()` to include embeddings
- Update `documents.indexed_at` timestamp

**Test:** Complete `e2e/indexing-workflow-basic.spec.ts @live` - full workflow test
```typescript
test('complete indexing: upload → chunk → embed → complete', async ({ page }) => {
  // Upload 078_the_equity_equation.md (SHORT - 1,142 words)
  // Assert: pending → processing → completed
  // Assert: chunk_count > 0
  // Assert: embeddings stored in DB (query chunks WHERE embedding IS NOT NULL)
  // Assert: indexed_at timestamp set
})
```

**Pass Criteria:**
- ✅ OpenAI client initialized from existing ApiKeyContext
- ✅ Embeddings generated and stored
- ✅ Full pipeline works end-to-end

**Checkpoint:** Complete indexing pipeline functional

---

### **Phase progress-tracking**: Real-time Progress Updates

**Goal:** Progress bar updates during indexing stages

**Build:**
- Implement `emitProgress()` function
- Add progress emission in `processJob()` at each stage (chunking/embedding/storing)
- Implement `onProgress()` worker method
- Connect VectorDBContext to worker progress events
- Update DocumentCard to display progress bar and stage messages

**Test:** Create `e2e/indexing-workflow-multi.spec.ts @live`
```typescript
test('progress tracking across multiple files', async ({ page }) => {
  // Upload 2 shortest PG essays simultaneously
  // - 078_the_equity_equation.md (SHORT - 1,142 words)
  // - 049_inequality_and_risk.md (MEDIUM-SHORT - 2,854 words)
  // Assert: Both show progress 0-100%
  // Assert: Stages visible (chunking → embedding → storing)
  // Assert: Both complete successfully
})
```

**Pass Criteria:**
- ✅ Progress updates visible in UI
- ✅ Progress increases during processing
- ✅ Stages visible (chunking, embedding, storing)

**Checkpoint:** Progress tracking works

---

### **Phase error-retry**: Error Handling & Retry Logic

**Goal:** Failed jobs retry automatically, manual retry button works

**Build:**
- Implement `handleJobError()` with retry logic (max retries: implementation choice)
- Implement `retryFailed()` worker method
- Connect `context.retryFailed()` to worker
- Add retry button to DocumentCard UI
- Rate limit errors already handled in embeddings phase

**Test:** No dedicated E2E test (manual verification recommended)

**Pass Criteria:**
- ✅ Error handling logic implemented
- ✅ Retry button UI exists
- ✅ Retry mechanism works (manual verification)

**Checkpoint:** Error handling and retry implementation complete

---

### **Phase persistence**: State Survives Reload

**Goal:** Indexing state persists across page reload

**Build:**
- Verify `getDocuments()` query includes all indexing fields (status, chunk_count, indexed_at, error_message, retry_count)
- Verify VectorDBContext repopulates indexingProgress map on mount
- Verify ongoing indexing continues after reload

**Test:** Extend `e2e/indexing-workflow-basic.spec.ts @live` with persistence test
```typescript
test('indexing state persists across page reload', async ({ page }) => {
  // Phase 1: Index file successfully
  // Upload 078_the_equity_equation.md, wait for completion
  // Record chunk_count

  // Phase 2: Reload page
  // Assert: status still 'completed'
  // Assert: chunk_count matches pre-reload value
  // Assert: indexed_at timestamp present
  // Assert: document still visible in list
})
```

**Pass Criteria:**
- ✅ Completed indexing state survives reload
- ✅ Chunk count survives reload
- ✅ All indexing metadata persists

**Checkpoint:** Persistence complete

---

### **Final Verification**

```bash
# Run regular E2E tests (excludes @live)
npm run test:e2e
# Expected: 2/2 tests passing
# - feature-flags.spec.ts ✅
# - documents-upload.spec.ts ✅

# Run live tests (hits real OpenAI API)
npm run test:e2e:live
# Expected: 2/2 tests passing
# - indexing-workflow-basic.spec.ts ✅ (includes persistence test)
# - indexing-workflow-multi.spec.ts ✅

# Build verification
npm run build

# Manual browser testing (verify error/retry UI)
npm run dev
```

---

## 10. Implementation Checklist (Incremental Phases)

**Prerequisite:** Complete feature toggle system (see `feature-toggle.md`) before starting

### Phase ui-components
- [ ] Create `IndexingStatusBadge.tsx`
- [ ] Create `IndexingProgress.tsx`
- [ ] Update `DocumentCard.tsx` (add indexing UI)
- [ ] Update `VectorDBContext.tsx` (indexingProgress state)
- [ ] Extend DocumentListComponent POM (indexing helper methods)
- [ ] Create `e2e/fixtures/pg-essays.ts`
- [ ] Begin `indexing-workflow-basic.spec.ts @live` (UI stub tests)
- [ ] ✅ UI components render with data attributes

### Phase db-schema
- [ ] Create `indexing_queue` table in worker init()
- [ ] Create `chunks` table in worker init()
- [ ] Extend `documents` table (ALTER TABLE - chunk_count, indexed_at)
- [ ] Update `uploadDocument()` (conditional queue creation if FEATURE_INDEXING_ENABLED)
- [ ] Update `getDocuments()` (LEFT JOIN indexing_queue)
- [ ] ✅ Queue entries created conditionally
- [ ] ✅ documents-upload.spec.ts still passes (toggle disabled)

### Phase queue-processor
- [ ] Implement `processQueue()` function
- [ ] Implement `processJob()` (mock work, 1 second delay)
- [ ] Implement `onProgress()` worker method
- [ ] Connect VectorDBContext to worker progress events
- [ ] Auto-start queue processor on worker init
- [ ] Extend `indexing-workflow-basic.spec.ts @live` (verify status transitions)
- [ ] ✅ Status transitions visible (pending → processing → completed)

### Phase chunking
- [ ] Install `@langchain/textsplitters`
- [ ] Implement `chunkDocument()` with RecursiveCharacterTextSplitter
- [ ] Update `processJob()` to actually chunk
- [ ] Store chunks (embedding = NULL)
- [ ] Update `documents.chunk_count`
- [ ] Extend `indexing-workflow-basic.spec.ts @live` (upload PG essay, verify chunk count)
- [ ] ✅ Documents chunked and stored

### Phase embeddings
- [ ] Worker init() reads API key from localStorage
- [ ] Implement `generateEmbeddings()` with batching (100 chunks/batch)
- [ ] Implement `generateEmbeddingBatchWithRetry()` (exponential backoff)
- [ ] Update `storeChunks()` to include embeddings
- [ ] Update `documents.indexed_at`
- [ ] Complete `indexing-workflow-basic.spec.ts @live` (full workflow with 078_the_equity_equation.md)
- [ ] ✅ Full indexing pipeline works end-to-end

### Phase progress-tracking
- [ ] Implement `emitProgress()` function
- [ ] Add progress emission in `processJob()` at each stage (10-30-70-100%)
- [ ] Update DocumentCard to display progress
- [ ] Create `indexing-workflow-multi.spec.ts @live` (2 shortest PG essays: 078 + 049)
- [ ] ✅ Progress tracking works across multiple files

### Phase error-retry
- [ ] Implement `handleJobError()` with retry logic (max 3)
- [ ] Implement `retryFailed()` worker method
- [ ] Connect `context.retryFailed()` to worker
- [ ] Add retry button to DocumentCard
- [ ] Handle rate limit errors with exponential backoff
- [ ] ✅ Error handling and retry implementation complete (manual verification)

### Phase persistence
- [ ] Verify `getDocuments()` returns all indexing fields
- [ ] Verify VectorDBContext repopulates indexingProgress on mount
- [ ] Extend `indexing-workflow-basic.spec.ts @live` (persistence test after completion)
- [ ] ✅ Indexing state persists across reload

### Final Verification
- [ ] Regular tests pass: `npm run test:e2e` (2/2: feature-flags, documents-upload)
- [ ] Live tests pass: `npm run test:e2e:live` (2/2: basic, multi)
- [ ] TypeScript compilation passing
- [ ] Build successful (`npm run build`)
- [ ] No console errors
- [ ] Manual browser testing verified (including error/retry UI)

---

## 11. Acceptance Criteria (Incremental TDD Success)

**Phase indexing-pipeline complete when all 8 phases pass:**

### UI & Visibility
✅ Uses existing ApiKeyContext (no separate API key input)
✅ Indexing status badge shows all 4 states (pending/processing/completed/failed)
✅ Progress bar displays during processing with accurate percentages
✅ Document cards show indexing state with data attributes
✅ All background states observable via data attributes for testing

### E2E Tests (4 Passing)
✅ feature-flags.spec.ts: Feature toggle tests (prerequisite)
✅ documents-upload.spec.ts: Existing document tests (toggle disabled, no indexing)
✅ indexing-workflow-basic.spec.ts @live: Single file workflow + persistence (real OpenAI API)
✅ indexing-workflow-multi.spec.ts @live: Multiple files, parallel indexing, progress tracking

### Worker Implementation
✅ Database tables created (indexing_queue, chunks, documents extended)
✅ Conditional queue creation (only when toggle enabled)
✅ LangChain text splitter chunks documents correctly
✅ OpenAI embeddings API integrated with batching (100 chunks/batch)
✅ Background queue processor runs automatically
✅ Retry logic handles rate limits with exponential backoff
✅ Progress tracking emits real-time updates
✅ Cascade deletes work (document → queue → chunks)

### Quality
✅ 4 E2E test files passing (2 regular + 2 @live)
✅ TypeScript compilation passing
✅ Build successful
✅ No console errors in tests
✅ Manual testing verified in browser (including error/retry UI)
✅ Live tests use real PG essays (realistic content)

### Incremental TDD Process Followed
✅ Each phase built and tested independently
✅ Tests pass at end of each phase (not all at the end)
✅ Earlier phases provide foundation for later phases
✅ Test isolation strategy works (existing tests don't trigger indexing)
✅ Real OpenAI API integration tested successfully

---

## 12. Known Constraints & Trade-offs

**Decisions:**
- ✅ No `relaxedDurability` - synchronous flush for guaranteed persistence
- ✅ Page Object Model pattern for all E2E tests
- ✅ **Real OpenAI API** - No MSW mocking (more realistic testing)
- ✅ **Conditional indexing** - Only when API key set (test isolation)
- ✅ **Incremental TDD** - Tests pass at each phase completion
- ✅ YAGNI approach - build only what's specified, no extras

**Performance Expectations (Real PG Essays):**
- 078_the_equity_equation.md (1,142 words): ~2-5 seconds
- 049_inequality_and_risk.md (2,854 words): ~5-10 seconds
- 182_the_lesson_to_unlearn.md (4,059 words): ~8-15 seconds
- 018_a_plan_for_spam.md (5,374 words): ~10-20 seconds
- 021_why_nerds_are_unpopular.md (5,727 words): ~12-25 seconds

**Cost Expectations (OpenAI API text-embedding-3-small):**
- Basic test (078 - shortest): ~$0.0002-0.0005
- Multi test (078 + 049 - 2 shortest): ~$0.0005-0.001
- Live test suite total (2 tests): < $0.002 per run
- Acceptable cost for realistic testing

**Test Isolation Strategy:**
- documents-*.spec.ts: Feature toggle disabled → No indexing → No cost
- indexing-*.spec.ts @live: Feature toggle enabled → Real indexing → Minimal cost
- Total live test cost per run: < $0.002

---

## 13. Manual Testing Scenarios

While automated E2E tests cover the happy path workflows, certain error scenarios require manual verification during development and QA.

### Error Handling & Retry Flow

**Scenario 1: Invalid API Key Error**

**Setup:**
1. Start application: `npm run dev`
2. Navigate to Documents page
3. Open browser DevTools → Application → Local Storage
4. Set invalid API key: `localStorage.setItem('openai_api_key', 'sk-invalid-key-12345')`
5. Reload page

**Test Steps:**
1. Upload shortest essay: `078_the_equity_equation.md`
2. Observe indexing status changes: pending → processing
3. Wait for failure (should happen within 10-15 seconds)

**Expected Behavior:**
- ✅ Status badge shows "Failed" (red background)
- ✅ Error message visible on document card: "Incorrect API key provided"
- ✅ Retry button appears on card
- ✅ Retry count shows: "Attempt 1/3" (or similar)
- ✅ Document remains in list (not deleted)

**Manual Retry Test:**
1. Open DevTools → Application → Local Storage
2. Set valid API key: `localStorage.setItem('openai_api_key', 'YOUR_VALID_KEY')`
3. Click retry button on failed document card
4. Observe status changes: pending → processing → completed

**Expected Behavior:**
- ✅ Status changes to "Pending"
- ✅ Retry count resets to 0
- ✅ Error message clears
- ✅ Indexing completes successfully
- ✅ Chunk count appears
- ✅ Status badge shows "Indexed" (green background)

---

**Scenario 2: Rate Limit Handling (Transient Error)**

**Note:** Difficult to test reliably without hitting actual rate limits

**Setup:**
1. Use valid API key
2. Upload multiple essays rapidly to trigger rate limiting

**Test Steps:**
1. Upload all 5 PG essays simultaneously
2. Monitor network tab for 429 responses
3. Observe automatic retry behavior

**Expected Behavior:**
- ✅ Rate limited requests automatically retry with exponential backoff (1s, 2s, 4s)
- ✅ Eventually all documents complete successfully
- ✅ No manual intervention required for transient errors
- ✅ Only permanent failures (max retries exceeded) show retry button

---

**Scenario 3: Automatic Retry Logic (3 Attempts)**

**Setup:**
1. Set invalid API key
2. Upload document

**Test Steps:**
1. Monitor indexing status
2. Job should automatically retry 3 times before marking as failed

**Expected Behavior:**
- ✅ First attempt fails
- ✅ Automatic retry after brief delay
- ✅ Second attempt fails
- ✅ Automatic retry after brief delay
- ✅ Third attempt fails
- ✅ Status marked as "Failed" after 3rd attempt
- ✅ Retry count shows: 3/3
- ✅ Manual retry button appears

---

### UI State Verification

**Scenario 4: Progress Bar During Indexing**

**Test Steps:**
1. Upload medium-length essay: `049_inequality_and_risk.md` (2,854 words)
2. Watch progress bar during indexing

**Expected Behavior:**
- ✅ Progress bar appears when status = "Processing"
- ✅ Progress increases: 10% → 30% → 70% → 100%
- ✅ Stage labels update: "Chunking" → "Generating embeddings" → "Storing chunks"
- ✅ Progress percentage visible
- ✅ Progress bar disappears when status = "Completed"

---

**Scenario 5: Error State UI**

**Test Steps:**
1. Trigger failure (invalid API key method)
2. Inspect document card UI

**Expected Behavior:**
- ✅ Red "Failed" badge visible
- ✅ Error message text clearly displayed
- ✅ Retry button styled appropriately
- ✅ Retry count visible: "Attempt X/3"
- ✅ No progress bar shown
- ✅ Chunk count not displayed (since indexing failed)

---

### Edge Cases

**Scenario 6: Network Interruption During Indexing**

**Test Steps:**
1. Upload document
2. During processing, disconnect network (DevTools → Network → Offline)
3. Wait for timeout
4. Reconnect network

**Expected Behavior:**
- ✅ Job marked as failed after timeout
- ✅ Error message indicates network issue
- ✅ Retry button works after reconnection
- ✅ Manual retry completes successfully

---

**Scenario 7: Multiple Failed Documents**

**Test Steps:**
1. Set invalid API key
2. Upload 3 documents
3. All should fail
4. Set valid API key
5. Retry each document individually

**Expected Behavior:**
- ✅ All 3 documents show failed state independently
- ✅ Each has its own retry button
- ✅ Retrying one document doesn't affect others
- ✅ Each can be retried successfully
- ✅ Documents complete in order of retry clicks

---

### Performance & Cost Monitoring

**Scenario 8: Monitor OpenAI API Costs**

**Test Steps:**
1. Note OpenAI API usage before testing
2. Run manual test scenarios above
3. Check OpenAI dashboard for usage

**Expected Costs:**
- Single short document (078): ~$0.0002-0.0005
- All 5 essays: ~$0.002-0.005
- Failed attempts do NOT incur embedding costs (only during retry)

---

## 14. Next Steps After Completion

After Phase indexing-pipeline is complete, proceed to:
- **Phase vector-search:** HNSW index creation + vector similarity search + RAG integration with useChat hook
