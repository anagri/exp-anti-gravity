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

**No External Chunking Dependencies Required:**
- Custom paragraph-based chunker implemented in-worker (browser-compatible)
- NO `@langchain/textsplitters` dependency (see Section 7.4 for implementation details)

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

  // Create pending indexing job (only if feature enabled)
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

**IMPORTANT:** Workers cannot access localStorage! API key must be passed from main thread via `setOpenAIKey()`.

**setOpenAIKey(apiKey: string | null):**
```typescript
function setOpenAIKey(apiKey: string | null): void {
  if (apiKey) {
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  } else {
    openaiClient = null
  }
}
```

**onProgress(callback: ProgressCallback):**
```typescript
// Callback wrapped with Comlink.proxy() by CALLER (main thread), not in worker
function onProgress(callback: ProgressCallback): void {
  progressCallbacks.push(callback) // Caller already wrapped with Comlink.proxy()
}
```

**triggerQueueProcessing():**
```typescript
async function triggerQueueProcessing(): Promise<{ triggered: boolean }> {
  processQueue() // Manual trigger for immediate UX response after upload
  return { triggered: true }
}
```

**getWorkerState():**
```typescript
// Debugging/testing helper - returns diagnostic info
async function getWorkerState(): Promise<{
  dbInitialized: boolean
  isProcessing: boolean
  indexingEnabled: boolean
  pendingJobs: number
  allJobs: Array<{ status: string; document_id: string; error_message: string | null }>
}> {
  if (!db) {
    return { dbInitialized: false, isProcessing: false, indexingEnabled, pendingJobs: 0, allJobs: [] }
  }

  const pendingResult = await db.query(`SELECT COUNT(*) as count FROM indexing_queue WHERE status = 'pending'`)
  const allJobsResult = await db.query(`SELECT status, document_id, error_message FROM indexing_queue`)

  return {
    dbInitialized: true,
    isProcessing,
    indexingEnabled,
    pendingJobs: pendingResult.rows[0].count,
    allJobs: allJobsResult.rows,
  }
}
```

**VectorDBContext Integration:**
```typescript
// Main thread reads localStorage and passes to worker
const apiKey = localStorage.getItem('openai_api_key')
await worker.setOpenAIKey(apiKey)

// Listen for storage changes and sync to worker
window.addEventListener('storage', (event) => {
  if (event.key === 'openai_api_key') {
    worker.setOpenAIKey(event.newValue)
  }
})
```

**Manual Retry NOT Implemented:**
- VectorDBContext.retryFailed() is placeholder only (console.log statement)
- DocumentCard shows retry button but no backend implementation
- Auto-retry works (up to max_retries), but manual retry button non-functional

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
```typescript
// Wrapper around init() that auto-starts queue processor
const originalInit = init
async function initWithQueueProcessor(): Promise<{ ready: boolean }> {
  const result = await originalInit()

  if (db) {
    await sleep(100)  // Allow callback registration before first queue run
    processQueue()    // Initial queue run
    setInterval(() => processQueue(), 2000)  // Continuous polling every 2 seconds
  }

  return result
}
```

**Timing Details:**
- 100ms initial delay before first queue run (allows progress callback registration)
- 2000ms polling interval (continuous background processing)
- 100ms sleep between individual jobs (prevents CPU thrashing)

**Implementation Notes:**
- Use `isProcessing` flag to prevent concurrent queue runs (race condition protection)
- Query: `SELECT * FROM indexing_queue WHERE status='pending' ORDER BY created_at ASC LIMIT 1`
- Exit loop when no pending jobs found
- Handle errors gracefully without stopping queue processor
- Manual trigger via `triggerQueueProcessing()` for immediate UX response after upload

### 7.3 Job Processing

**Job Lifecycle:**
1. **Start:** Update indexing_queue: status='processing', started_at=CURRENT_TIMESTAMP
2. **Chunk:** Split document content into chunks (emit progress updates)
3. **Embed:** Generate embeddings for all chunks (emit progress updates)
4. **Store:** Save chunks with embeddings to database (emit progress updates)
5. **Complete:** Update indexing_queue: status='completed', completed_at=CURRENT_TIMESTAMP
6. **Finalize:** Update documents: chunk_count, indexed_at=CURRENT_TIMESTAMP

**Progress Stages & Exact Percentages:**
- **Chunking** (0-30%):
  - 0%: "Starting indexing..."
  - 10%: "Splitting document into chunks..."
  - 30%: "Created N chunks"
- **Embedding** (30-70%):
  - 30%: "Generating embeddings..."
  - 30-70% (dynamic): "Processing batch X/Y..." (formula: `30 + (batchIndex / totalBatches) * 40`)
  - 70%: "All embeddings generated"
- **Storing** (70-100%):
  - 70%: "Storing chunks..."
  - 100%: "All chunks stored"
- **Completed** (100%): "Indexing completed successfully"

**State Transitions:**
- Success: `pending → processing → completed`
- Failure: `pending → processing → failed` (or back to `pending` if retry available)

**Error Handling:**
- Catch all errors during processing
- Delegate to error handler with retry logic
- Ensure queue entry updated even on failure

**Implementation Notes:**
- Emit progress at exact milestones: 0, 10, 30, 30-70 (dynamic), 70, 100
- Include human-readable messages with each progress update
- Progress updates trigger UI re-renders in VectorDBContext

### 7.4 Custom Paragraph-Based Chunking (NO LangChain)

**Implementation Decision:** Custom chunker built in-worker (browser-compatible, no external dependencies)

**Requirements:**
- Paragraph-based splitting for natural semantic boundaries
- Fixed chunk size: 1000 characters
- Fixed overlap: 200 characters
- Word-boundary overlap calculation for context continuity
- Heading extraction for better chunk context

**Algorithm:**
```typescript
function chunkDocument(content: string): Array<{ content: string, heading?: string }> {
  const chunkSize = 1000      // Fixed size
  const chunkOverlap = 200    // Fixed overlap

  // 1. Split on paragraph breaks (\n\n+)
  const paragraphs = content.split(/\n\n+/)
  const chunks: Array<{ content: string, heading?: string }> = []
  let currentChunk = ''

  // 2. Build chunks up to chunkSize, respecting paragraph boundaries
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    if (currentChunk.length + trimmedParagraph.length + 2 > chunkSize) {
      if (currentChunk) {
        chunks.push({ content: currentChunk.trim(), heading: extractHeading(currentChunk) })

        // 3. Create overlap using word slicing (not character slicing)
        const words = currentChunk.split(/\s+/)
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5)) // ~200 chars / 5 = 40 words
        currentChunk = overlapWords.join(' ') + '\n\n'
      }
    }

    currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph
  }

  // 4. Add final chunk
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), heading: extractHeading(currentChunk) })
  }

  // 5. Fallback for edge cases (e.g., single-paragraph documents)
  return chunks.length > 0 ? chunks : [{ content: content.substring(0, chunkSize), heading: extractHeading(content) }]
}

function extractHeading(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m)
  return match ? match[1] : undefined
}
```

**Key Implementation Details:**
- Paragraph-first splitting (natural semantic boundaries)
- Word-boundary overlap: `chunkOverlap / 5` approximates word count (5 chars/word average)
- Heading regex: `/^##?\s+(.+)$/m` (matches H1 # or H2 ## at line start)
- Fallback for edge cases: substring(0, chunkSize) when no paragraphs found
- NO external dependencies required (browser-compatible)

**Return Type:**
```typescript
Array<{ content: string, heading?: string }>
```

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
```typescript
const BATCH_SIZE = 50  // Fixed batch size (not configurable)
```
- Fixed batch size: 50 chunks per API call
- Process batches sequentially to simplify progress tracking
- Progress formula: `30 + (currentBatch / totalBatches) * 40` (range: 30-70%)
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

### 7.7 Error Handling & Retry Logic

**Auto-Retry: ✅ IMPLEMENTED**

**Requirements:**
- Catch all errors during job processing
- Automatic retry logic with max retries (default: 3)
- Update queue status and error message in database
- Emit progress update with error information
- Distinguish between retryable and permanent failures

**Retry Logic:**
```typescript
try {
  // Process job: chunk → embed → store
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const maxRetries = job.max_retries
  const currentRetryCount = job.retry_count

  if (currentRetryCount < maxRetries) {
    // Auto-retry: reset to pending and increment retry count
    await db.query(
      `UPDATE indexing_queue
       SET status = 'pending', retry_count = $1, error_message = $2
       WHERE id = $3`,
      [currentRetryCount + 1, errorMessage, jobId]
    )

    emitProgress(document_id, 'failed', 0, 'error', `Retry ${currentRetryCount + 1}/${maxRetries}: ${errorMessage}`)
  } else {
    // Permanent failure
    await db.query(
      `UPDATE indexing_queue
       SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [errorMessage, jobId]
    )

    emitProgress(document_id, 'failed', 0, 'error', `Failed: ${errorMessage}`)
  }
}
```

**Manual Retry: ❌ NOT IMPLEMENTED**
- VectorDBContext.retryFailed() is placeholder only (console.log statement)
- DocumentCard shows retry button (lines 125-136) but callback does nothing
- Backend worker method NOT implemented
- Consider implementing in future iteration if needed

**Implementation Notes:**
- Auto-retry happens on next queue poll (no immediate retry)
- Emit progress with status='failed', progress=0
- Store error_message for display in UI
- Rate limit errors handled with exponential backoff in embeddings phase

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

### 7.9 Worker State Debugging

**Purpose:** Diagnostic helper for testing and debugging

**Implementation:**
```typescript
async function getWorkerState(): Promise<{
  dbInitialized: boolean
  isProcessing: boolean
  indexingEnabled: boolean
  pendingJobs: number
  allJobs: Array<{ status: string; document_id: string; error_message: string | null }>
}> {
  if (!db) {
    return {
      dbInitialized: false,
      isProcessing: false,
      indexingEnabled,
      pendingJobs: 0,
      allJobs: []
    }
  }

  const pendingResult = await db.query(
    `SELECT COUNT(*) as count FROM indexing_queue WHERE status = 'pending'`
  )
  const allJobsResult = await db.query(
    `SELECT status, document_id, error_message FROM indexing_queue`
  )

  return {
    dbInitialized: true,
    isProcessing,
    indexingEnabled,
    pendingJobs: pendingResult.rows[0].count,
    allJobs: allJobsResult.rows
  }
}
```

**VectorDBContext Integration:**
```typescript
// Expose worker state for debugging (test environment)
if (typeof window !== 'undefined') {
  (window as any).__getWorkerState = () => worker.getWorkerState()
}
```

**Usage in Tests:**
```typescript
const state = await page.evaluate(() => (window as any).__getWorkerState())
console.log('Worker state:', state)
```

### 7.10 Queue Processing Lifecycle

**Complete Lifecycle Flow:**

**1. Worker Init:**
```typescript
const originalInit = init
async function initWithQueueProcessor(): Promise<{ ready: boolean }> {
  const result = await originalInit()  // Create tables, setup DB

  if (db) {
    await sleep(100)  // Allow progress callback registration
    processQueue()    // Initial run
    setInterval(() => processQueue(), 2000)  // Continuous polling every 2 seconds
  }

  return result
}
```

**2. Upload Document:**
```typescript
async function uploadDocument(params: UploadDocumentParams): Promise<{ id: string }> {
  // Insert document
  const id = uuidv4()
  await db.query(`INSERT INTO documents (id, filename, content, file_size, mime_type) VALUES (...)`)

  // Create indexing job (only if feature enabled)
  if (indexingEnabled) {
    await db.query(`INSERT INTO indexing_queue (id, document_id, status) VALUES ($1, $2, 'pending')`, [uuidv4(), id])
  }

  return { id }
}

// Main thread calls triggerQueueProcessing() for immediate UX response
await worker.uploadDocument({ filename, content, mimeType })
await worker.triggerQueueProcessing()  // Manual trigger (doesn't wait for 2s poll)
```

**3. Process Queue:**
```typescript
async function processQueue() {
  if (isProcessing) return  // Race condition prevention

  isProcessing = true

  try {
    while (true) {
      // Get oldest pending job
      const result = await db.query(
        `SELECT * FROM indexing_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`
      )

      if (result.rows.length === 0) break  // No pending jobs

      await processJob(result.rows[0])
      await sleep(100)  // Brief delay between jobs
    }
  } finally {
    isProcessing = false
  }
}
```

**4. Progress Updates:**
```typescript
function emitProgress(documentId: string, status: string, progress: number, stage: string, message: string) {
  const progressData: IndexingProgress = { documentId, status, progress, stage, message }

  // Call all registered callbacks
  for (const callback of progressCallbacks) {
    try {
      callback(progressData)
    } catch (error) {
      console.error('[Worker] Progress callback error:', error)
    }
  }
}
```

**Timing Summary:**
- 100ms: Initial delay before first queue run
- 2000ms: Polling interval for continuous processing
- 100ms: Delay between individual jobs

### 7.11 Comlink Proxy Pattern

**Critical Pattern for Cross-Worker Communication:**

**Main Thread (VectorDBContext):**
```typescript
// IMPORTANT: Wrap callback with Comlink.proxy() on MAIN thread (not in worker)
await worker.onProgress(Comlink.proxy((progress: IndexingProgress) => {
  _setIndexingProgress(prev => new Map(prev).set(progress.documentId, progress))

  // Auto-refresh documents on completion/failure
  if (progress.status === 'completed' || progress.status === 'failed') {
    refreshDocuments()
  }
}))
```

**Worker:**
```typescript
// Callback already proxied by caller, just push to array
function onProgress(callback: (progress: IndexingProgress) => void): void {
  progressCallbacks.push(callback)  // NO Comlink.proxy() in worker
}

// Later: call callbacks
for (const callback of progressCallbacks) {
  callback(progressData)  // Comlink handles serialization across worker boundary
}
```

**Why Comlink.proxy() Needed:**
- Functions cannot be serialized across worker boundary (normal postMessage limitation)
- Comlink.proxy() creates a proxy that enables function calls across workers
- Wrapper MUST be on calling side (main thread), not receiving side (worker)
- Without proxy: callbacks would be lost/undefined in worker

**Common Mistake:**
```typescript
// ❌ WRONG: Wrapping in worker (too late)
function onProgress(callback: (progress: IndexingProgress) => void): void {
  progressCallbacks.push(Comlink.proxy(callback))  // Already received as undefined!
}

// ✅ CORRECT: Wrapping on main thread (before passing)
await worker.onProgress(Comlink.proxy((progress) => { ... }))
```

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

**ACTUAL Implementation (DocumentListComponent):**

```typescript
// e2e/pages/documents/DocumentListComponent.ts (IMPLEMENTED METHODS)

export class DocumentListComponent {
  // ... existing methods (findFileByName, waitForFileToAppear, deleteFileByName, etc.)

  // Returns locator for document card (used by other methods)
  getDocumentCard(fileId: string): Locator {
    return this.page.locator(`[data-testid="div-doc-item-${fileId}"]`)
  }

  // Wait for indexing status to reach final state (completed or failed)
  // NOTE: Uses fileId parameter (not filename), only supports final states
  async waitForIndexingStatus(fileId: string, status: 'completed' | 'failed'): Promise<void> {
    const card = this.getDocumentCard(fileId)
    await expect(card).toHaveAttribute('data-indexing-status', status)
    // Uses Playwright auto-wait - no explicit timeout, no page.waitForFunction
  }

  // Assert indexing status matches expected value
  async expectIndexingStatus(fileId: string, status: string): Promise<void> {
    const card = this.getDocumentCard(fileId)
    await expect(card).toHaveAttribute('data-indexing-status', status)
  }

  // Get chunk count with type-safe parsing
  async getChunkCount(fileId: string): Promise<number> {
    const card = this.getDocumentCard(fileId)
    const chunkCountStr = await card.getAttribute('data-chunk-count')
    const chunkCount = parseInt(chunkCountStr || '0', 10)

    if (isNaN(chunkCount)) {
      throw new Error(`Invalid chunk count for file ${fileId}: ${chunkCountStr}`)
    }

    return chunkCount
  }
}
```

**NOT Implemented:**
- `expectIndexingProgress(filename, minProgress)` - not needed for current tests
- `retryFailedIndexing(filename)` - backend not implemented (manual retry placeholder only)
- `expectErrorMessage(filename, partialError)` - not needed for current tests

**Key Differences from Spec:**
- Methods use `fileId` parameter (NOT `filename`)
- `waitForIndexingStatus` only supports `'completed' | 'failed'` (final states, not intermediate)
- Uses Playwright `expect().toHaveAttribute()` pattern (no `page.waitForFunction`)
- Relies on Playwright auto-wait (no explicit timeouts)
- Type-safe `getChunkCount()` with NaN validation

### 8.3 E2E Test Files & Pattern

**Test Files Structure (ACTUAL):**
```
e2e/
├── feature-flags.spec.ts                 (✅ EXISTING - prerequisite, feature toggle tests)
├── documents-upload.spec.ts              (✅ EXISTING - toggle disabled, no indexing)
└── indexing-workflow-basic.spec.ts       (✅ IMPLEMENTED @live - single file workflow + persistence)
```

**NOTE:** `indexing-workflow-multi.spec.ts` NOT implemented (spec overpromised, single test file sufficient)

**Test Pattern: Comprehensive workflow test**

**ACTUAL Implementation:**

```typescript
// e2e/indexing-workflow-basic.spec.ts
import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays';
import { loadTestApiKey } from './utils/env';

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY;

test.describe('Indexing Workflow @live', () => {
  let documentsPage: DocumentPage;
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);
  });

  test('Phase embeddings: upload → queue → chunk → embed → store → persist after reload', async ({ page }) => {
    // Verify empty state
    await documentsPage.expectEmptyState();

    // Upload file
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY);
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    // Get file ID
    const fileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME);
    if (!fileId) throw new Error('File not found after upload');

    // Wait for indexing to complete
    await documentsPage.documentList.waitForIndexingStatus(fileId, 'completed');

    // Verify chunk count > 0
    const preReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(preReloadChunkCount).toBeGreaterThan(0);

    // Test persistence: reload page
    await page.reload();
    await documentsPage.waitForDBInitialized();

    // Verify file still appears
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME);

    // Verify state persisted
    const postReloadChunkCount = await documentsPage.documentList.getChunkCount(fileId);
    await documentsPage.documentList.expectIndexingStatus(fileId, 'completed');
    expect(postReloadChunkCount).toBe(preReloadChunkCount);
    expect(postReloadChunkCount).toBeGreaterThan(0);
  });
});
```

**Key Pattern Elements:**
- ✅ **Data attribute assertions**: Wait for final state using `data-indexing-status='completed'`
- ✅ **Playwright auto-wait**: Uses `expect().toHaveAttribute()` pattern (no explicit timeouts)
- ✅ **No intermediate state waits**: Only waits for final states (completed/failed)
- ✅ **Page Object Model**: All interactions encapsulated in DocumentPage/DocumentListComponent
- ✅ **Type-safe helpers**: `getChunkCount()` validates chunk count parsing

**Live Test Strategy:**
- Indexing test tagged with `@live` (excluded from regular `test:e2e`)
- Uses `078_the_equity_equation.md` (shortest PG essay - 1,142 words)
- Tests hit real OpenAI API (cost: ~$0.0002-0.0005 per run)
- Run via: `npm run test:e2e:live`
- Test covers: upload → queue → chunk → embed → store → persist after reload
- Manual retry NOT tested (backend not implemented)

**Test Essay Selection (Available):**
- `078_the_equity_equation.md` (1,142 words) - **SHORT** ← Used in test
- `049_inequality_and_risk.md` (2,854 words) - **MEDIUM-SHORT**
- `182_the_lesson_to_unlearn.md` (4,059 words) - MEDIUM
- `018_a_plan_for_spam.md` (5,374 words) - LONG
- `021_why_nerds_are_unpopular.md` (5,727 words) - LONGEST

**Implementation Approach:**
- **NOT** incremental (all phases delivered cohesively in single commit range)
- Test validates complete end-to-end pipeline (not individual phases)
- Full implementation: chunking + embedding + storage + persistence tested together

---

## 9. Incremental TDD Workflow (8 Phases)

**⚠️ ACTUAL IMPLEMENTATION APPROACH DIFFERED:**
- Phases were NOT developed incrementally with passing tests at each stage
- Full implementation delivered in single cohesive commit range (da63804..HEAD)
- Final test validates complete pipeline (not incremental phases)
- All 8 phases implemented together as one deliverable

**ORIGINAL SPEC (Incremental TDD Vision):**

**Vertical Slice Approach:**
Each phase (after ui-components foundation) builds a complete vertical slice: **UI + DB + Logic + Tests**. Every phase delivers independently testable value.

**Workflow per Phase:**
1. Build: Implement UI updates, database changes, business logic together
2. Test: Extend existing test file with new scenarios (not new test files)
3. Pass: All tests pass at phase completion
4. Move: Next phase builds on working foundation

**Prerequisite:** Feature toggle system complete (feature-flags.spec.ts passing)

**Test Strategy:**
- ONE test file: `indexing-workflow-basic.spec.ts` (multi.spec.ts NOT implemented)
- Test validates complete workflow: upload → queue → chunk → embed → store → persist
- Uses Playwright auto-wait with data attributes (no explicit timeouts)

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

### **Phase chunking**: Custom Text Splitting (NO LangChain)

**Goal:** Documents actually get chunked and stored (no embeddings yet)

**Build:**
- Implement custom `chunkDocument()` with paragraph-based splitting
- Fixed chunk size: 1000 chars, overlap: 200 chars
- Word-boundary overlap calculation
- Update `processJob()`: actually chunk document
- Store chunks in `chunks` table (embedding = NULL for now)
- Update `documents.chunk_count` after chunking

**Test:** Extend `e2e/indexing-workflow-basic.spec.ts @live` - upload `078_the_equity_equation.md`, verify chunk count > 0

**Pass Criteria:**
- ✅ Documents chunked with custom chunker (NO LangChain)
- ✅ Chunks stored in database
- ✅ Chunk count visible in UI

**Checkpoint:** Chunking works, chunks stored

---

### **Phase embeddings**: OpenAI API Integration

**Goal:** Generate real embeddings via OpenAI API, store with chunks

**Build:**
- Main thread passes API key to worker via `setOpenAIKey()` (workers can't access localStorage)
- Listen for storage events and sync API key changes to worker
- Implement `generateEmbeddings()` with fixed batch size: 50 chunks
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
- ✅ OpenAI client initialized via `setOpenAIKey()` from main thread
- ✅ Storage event listener syncs API key changes to worker
- ✅ Embeddings generated and stored (batch size: 50)
- ✅ Full pipeline works end-to-end

**Checkpoint:** Complete indexing pipeline functional

---

### **Phase progress-tracking**: Real-time Progress Updates

**Goal:** Progress bar updates during indexing stages

**Build:**
- Implement `emitProgress()` function
- Add progress emission in `processJob()` at exact percentages: 0, 10, 30, 30-70 (dynamic), 70, 100
- Implement `onProgress()` worker method (callback wrapped by caller with Comlink.proxy)
- Connect VectorDBContext to worker progress events
- Update DocumentCard to display progress bar and stage messages
- Auto-refresh documents when indexing completes/fails

**Test:** Included in `e2e/indexing-workflow-basic.spec.ts @live`
- Progress updates happen during test execution
- Visual verification in headed mode shows progress bar
- No explicit progress assertions (not needed for basic workflow validation)

**Pass Criteria:**
- ✅ Progress updates visible in UI (manual verification in headed mode)
- ✅ Progress increases: 0 → 10 → 30 → 70 → 100
- ✅ Stages visible (chunking, embedding, storing)
- ✅ Auto-refresh on completion/failure

**Checkpoint:** Progress tracking works

---

### **Phase error-retry**: Error Handling & Retry Logic

**Goal:** Failed jobs retry automatically

**Build:**
- Implement error handling with auto-retry logic (max retries: 3)
- Update `indexing_queue` status: failed → pending (if retries remaining)
- Increment `retry_count` on each retry attempt
- Store `error_message` in database for UI display
- Emit progress updates with retry information
- Add retry button to DocumentCard UI (placeholder - backend NOT implemented)
- Rate limit errors handled with exponential backoff in embeddings phase

**Test:** No dedicated E2E test (manual verification only)

**Pass Criteria:**
- ✅ Auto-retry logic implemented (up to 3 attempts)
- ✅ Error messages stored and displayed in UI
- ✅ Retry count tracked and displayed
- ⚠️ Manual retry button UI exists but non-functional (backend placeholder only)

**Checkpoint:** Auto-retry implementation complete, manual retry NOT implemented

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
# Expected: 7/7 tests passing
# - chat-real-api.spec.ts, documents-api-key.spec.ts, documents-upload.spec.ts,
#   feature-flags.spec.ts, settings-dialog.spec.ts, welcome.spec.ts, welcome-navigation.spec.ts

# Run live tests (hits real OpenAI API)
npm run test:e2e:live
# Expected: 2/2 tests passing
# - chat-real-api.spec.ts @live ✅
# - indexing-workflow-basic.spec.ts @live ✅ (includes persistence test)

# Total: 9/9 tests passing

# Build verification
npm run build

# Manual browser testing (verify error/retry UI, progress tracking)
npm run dev
```

---

## 10. Implementation Checklist (ACTUAL Implementation Status)

**Note:** All 8 phases delivered cohesively (not incrementally)

### Phase ui-components ✅ COMPLETE
- [x] Create `IndexingStatusBadge.tsx`
- [x] Create `IndexingProgress.tsx`
- [x] Update `DocumentCard.tsx` (add indexing UI with all data attributes)
- [x] Update `VectorDBContext.tsx` (indexingProgress Map state)
- [x] Extend DocumentListComponent POM (4 new methods)
- [x] Create `e2e/fixtures/pg-essays.ts`
- [x] Create `indexing-workflow-basic.spec.ts @live`
- [x] ✅ All UI components render with correct data attributes

### Phase db-schema ✅ COMPLETE
- [x] Create `indexing_queue` table (exact match to spec)
- [x] Create `chunks` table (exact match to spec)
- [x] Extend `documents` table (chunk_count, indexed_at, indexing_status, error_message, retry_count)
- [x] Update `uploadDocument()` (conditional queue creation if FEATURE_INDEXING_ENABLED)
- [x] Update `getDocuments()` (LEFT JOIN indexing_queue)
- [x] ✅ All tables created, conditional queue works
- [x] ✅ Existing tests still pass (toggle disabled by default in those tests)

### Phase queue-processor ✅ COMPLETE
- [x] Implement `processQueue()` function
- [x] Implement `processJob()` (full implementation: chunk → embed → store)
- [x] Implement `onProgress()` worker method
- [x] Connect VectorDBContext to worker progress events (Comlink.proxy pattern)
- [x] Auto-start queue processor via `initWithQueueProcessor()` wrapper
- [x] 100ms initial delay, 2000ms polling interval, 100ms inter-job delay
- [x] ✅ Queue processor runs automatically, status transitions work

### Phase chunking ✅ COMPLETE (Custom Chunker)
- [x] ~~Install `@langchain/textsplitters`~~ NOT USED
- [x] Implement custom `chunkDocument()` (paragraph-based, 1000 char chunks, 200 char overlap)
- [x] Word-boundary overlap calculation (chunkOverlap / 5)
- [x] Heading extraction regex
- [x] Update `processJob()` to actually chunk
- [x] Store chunks in `chunks` table
- [x] Update `documents.chunk_count`
- [x] ✅ Custom chunker works (NO external dependencies)

### Phase embeddings ✅ COMPLETE
- [x] ~~Worker init() reads API key from localStorage~~ INCORRECT (workers can't access localStorage)
- [x] Implement `setOpenAIKey()` worker method (main thread passes key)
- [x] Listen for storage events and sync to worker
- [x] Implement `generateEmbeddings()` with fixed batch size: 50
- [x] Implement exponential backoff retry for rate limits
- [x] Update `storeChunks()` to include embeddings
- [x] Update `documents.indexed_at`
- [x] ✅ Full indexing pipeline works (OpenAI API integration successful)

### Phase progress-tracking ✅ COMPLETE
- [x] Implement `emitProgress()` function
- [x] Add progress emission at exact percentages: 0, 10, 30, 30-70 (dynamic), 70, 100
- [x] Comlink.proxy wrapping on main thread (not in worker)
- [x] Auto-refresh documents on completion/failure
- [x] Update DocumentCard to display progress bar
- [x] ~~Create `indexing-workflow-multi.spec.ts @live`~~ NOT CREATED
- [x] ✅ Progress tracking works (visual verification in headed mode)

### Phase error-retry ⚠️ PARTIAL
- [x] Implement auto-retry logic (max retries: 3)
- [x] Update `indexing_queue` on failure (increment retry_count, store error_message)
- [x] ~~Implement `retryFailed()` worker method~~ NOT IMPLEMENTED (placeholder only)
- [x] ~~Connect `context.retryFailed()` to worker~~ PLACEHOLDER ONLY
- [x] Add retry button to DocumentCard UI (non-functional backend)
- [x] Handle rate limit errors with exponential backoff
- [x] ✅ Auto-retry works, ❌ manual retry NOT implemented

### Phase persistence ✅ COMPLETE
- [x] `getDocuments()` returns all indexing fields
- [x] VectorDBContext repopulates from getDocuments() on mount
- [x] Persistence test in `indexing-workflow-basic.spec.ts @live`
- [x] ✅ State persists across reload (chunk_count, indexing_status, etc.)

### Final Verification ✅ ALL PASSING
- [x] Regular tests: `npm run test:e2e` (7/7 passing)
- [x] Live tests: `npm run test:e2e:live` (2/2 passing)
- [x] Total: 9/9 E2E tests passing
- [x] TypeScript compilation passing
- [x] Build successful (`npm run build`)
- [x] No console errors (DEV logging wrapped in import.meta.env.DEV)
- [x] Manual browser testing verified

---

## 11. Acceptance Criteria (ACTUAL Implementation Status)

**Phase indexing-pipeline complete - all 8 phases implemented:**

### UI & Visibility ✅
✅ Uses existing ApiKeyContext (key passed to worker via setOpenAIKey)
✅ Indexing status badge shows all 4 states (pending/processing/completed/failed)
✅ Progress bar displays during processing with exact percentages (0, 10, 30, 70, 100)
✅ Document cards show indexing state with all specified data attributes
✅ All background states observable via data attributes for testing
✅ Retry button UI exists (non-functional backend)

### E2E Tests (9 Passing Total) ✅
✅ Regular tests (7/7): chat-real-api, documents-api-key, documents-upload, feature-flags, settings-dialog, welcome, welcome-navigation
✅ Live tests (2/2): chat-real-api @live, indexing-workflow-basic @live
✅ Indexing test covers: upload → queue → chunk → embed → store → persist

### Worker Implementation ✅
✅ Database tables created (exact match to spec: indexing_queue, chunks, documents extended)
✅ Conditional queue creation (only when FEATURE_INDEXING_ENABLED)
✅ Custom chunker (paragraph-based, 1000 char chunks, 200 char overlap) - NO LangChain
✅ OpenAI embeddings API integrated with fixed batch size: 50 chunks
✅ Background queue processor runs automatically (2000ms polling, 100ms delays)
✅ Auto-retry logic handles failures (max 3 retries)
✅ Rate limit retry with exponential backoff
✅ Progress tracking emits real-time updates (exact percentages)
✅ Cascade deletes work (document → queue → chunks)
✅ API key syncing from main thread to worker (storage event listener)
✅ getWorkerState() debugging helper
✅ triggerQueueProcessing() for immediate UX response

### Quality ✅
✅ 9/9 E2E tests passing (7 regular + 2 @live)
✅ TypeScript compilation passing
✅ Build successful
✅ No console errors (DEV logging wrapped in import.meta.env.DEV)
✅ Manual testing verified in browser (progress tracking, error display)
✅ Live tests use real PG essays (shortest: 078_the_equity_equation.md, 1,142 words)
✅ Test refactored to remove anti-patterns (no page.waitForFunction, no explicit timeouts)

### Implementation Approach (Differed from Spec)
⚠️ Phases delivered cohesively (not incrementally as spec planned)
⚠️ Single test file (indexing-workflow-multi.spec.ts NOT implemented)
⚠️ Manual retry NOT implemented (auto-retry works, UI button placeholder only)
✅ All other functionality implemented as specified or better

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
