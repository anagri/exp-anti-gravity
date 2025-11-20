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
2. **Test Isolation** - Existing document tests don't trigger indexing (no API key set)
3. **Incremental Tests** - Write tests only for current phase, tests pass at phase completion
4. **Progressive Enhancement** - Each phase adds functionality to working system

**Implementation Order:**
1. **Phase ui-components** - Build UI with data attributes, test visual states (no worker calls)
2. **Phase db-schema** - Create tables, test queue creation on upload
3. **Phase queue-processor** - Status transitions (pending → processing → completed), no real work yet
4. **Phase chunking** - LangChain integration, store chunks (no embeddings)
5. **Phase embeddings** - OpenAI API integration, full indexing pipeline
6. **Phase progress-tracking** - Real-time progress updates
7. **Phase error-retry** - Error handling, retry logic
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

## 1. UI Components (BUILD FIRST - TDD Step 1)

### 1.1 API Key Input Component

**Location:** `src/pages/documents/components/APIKeyInput.tsx` (NEW)

**Purpose:** Allow user to set OpenAI API key for embedding generation

**Visual Design:**
```
┌─────────────────────────────────────┐
│ OpenAI API Key Required             │
│ ┌─────────────────────────────────┐ │
│ │ sk-...                    [Set] │ │
│ └─────────────────────────────────┘ │
│ ✓ API key configured successfully   │ ← Success message
│ ✗ Invalid API key                   │ ← Error message
└─────────────────────────────────────┘
```

**Data Attributes for Testing:**
```typescript
data-testid="input-api-key"          // Input field
data-testid="btn-set-api-key"        // Submit button
data-testid="api-key-status"         // Success/error message
data-api-key-set="true|false"        // Whether key is configured
```

**Integration:**
- Add to DocumentsPage header/toolbar
- Connect to `VectorDBContext.setOpenAIKey()`
- Show only if API key not set
- Store in localStorage for persistence

### 1.2 Indexing Status Badge Component

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

### 1.4 Document Card Extensions

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

### 1.5 Empty State Update

**Location:** `src/pages/documents/components/EmptyState.tsx` (MODIFY EXISTING)

**Add API Key Prompt:**
```typescript
// Show different message based on API key state
if (!apiKeySet) {
  return (
    <div data-api-key-required="true">
      <h3>OpenAI API Key Required</h3>
      <p>Set your OpenAI API key to enable document indexing</p>
    </div>
  )
}

return (
  <div data-api-key-required="false">
    <h3>No documents uploaded</h3>
    <p>Drop .md or .txt files in the upload zone above to get started</p>
  </div>
)
```

**Data Attribute:**
```typescript
data-api-key-required="true|false"
```

---

## 2. Context & State Management (BUILD SECOND - TDD Step 1 continued)

### 2.1 VectorDBContext Extensions

**Location:** `src/contexts/VectorDBContext.tsx` (EXTEND EXISTING)

**Add State:**
```typescript
interface VectorDBContextType {
  // ... existing fields
  apiKeySet: boolean
  indexingProgress: Map<string, IndexingProgress>
  setOpenAIKey: (apiKey: string) => Promise<void>
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
  const [apiKeySet, setApiKeySet] = useState(false)
  const [indexingProgress, setIndexingProgress] = useState<Map<string, IndexingProgress>>(new Map())

  // Check if API key exists on mount
  useEffect(() => {
    const key = localStorage.getItem('openai-api-key')
    if (key) {
      setApiKeySet(true)
      worker.setOpenAIKey(key)  // Will be implemented in Step 3
    }
  }, [])

  // Subscribe to worker progress updates
  useEffect(() => {
    worker.onProgress((progress: IndexingProgress) => {
      setIndexingProgress(prev => new Map(prev).set(progress.documentId, progress))
    })
  }, [])

  const setOpenAIKey = async (apiKey: string) => {
    localStorage.setItem('openai-api-key', apiKey)
    await worker.setOpenAIKey(apiKey)
    setApiKeySet(true)
  }

  const retryFailed = async (documentId: string) => {
    await worker.retryFailed(documentId)
  }

  return (
    <VectorDBContext.Provider
      value={{
        // ... existing
        apiKeySet,
        indexingProgress,
        setOpenAIKey,
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

**Problem:** Existing document tests (01-04) upload files → would trigger indexing → cost money

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
- Existing tests (01-04): Use `page.addInitScript()` to disable toggle → No indexing → No cost
- New indexing tests (05-12): Don't set toggle (default=enabled) → Indexing happens
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

**setOpenAIKey(apiKey: string):**
```typescript
async function setOpenAIKey(apiKey: string): Promise<{ success: boolean }> {
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  return { success: true }
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

```typescript
async function processQueue() {
  if (isProcessing) return
  isProcessing = true

  try {
    while (true) {
      // Get next pending job
      const result = await db.query(`
        SELECT * FROM indexing_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      `)

      if (result.rows.length === 0) break

      const job = result.rows[0]
      await processJob(job)

      await sleep(100) // Brief delay between jobs
    }
  } finally {
    isProcessing = false
  }
}

// Auto-start on worker init
init().then(() => {
  processQueue()
  setInterval(processQueue, 5000) // Poll every 5 seconds
})
```

### 7.3 Job Processing

```typescript
async function processJob(job: IndexingJob) {
  const { id: jobId, document_id } = job

  try {
    // Mark as processing
    await db.query(
      `UPDATE indexing_queue
       SET status = 'processing', started_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    )

    // Get document content
    const docResult = await db.query(
      'SELECT content, filename FROM documents WHERE id = $1',
      [document_id]
    )
    const document = docResult.rows[0]

    // Stage 1: Chunking (10-30%)
    emitProgress(document_id, 'chunking', 10, 'Splitting document into chunks...')
    const chunks = await chunkDocument(document.content)
    emitProgress(document_id, 'chunking', 30, `Created ${chunks.length} chunks`)

    // Stage 2: Embedding (30-70%)
    emitProgress(document_id, 'embedding', 30, 'Generating embeddings...')
    const embeddings = await generateEmbeddings(document_id, chunks)
    emitProgress(document_id, 'embedding', 70, `Generated ${embeddings.length} embeddings`)

    // Stage 3: Storing (70-100%)
    emitProgress(document_id, 'storing', 70, 'Storing chunks in database...')
    await storeChunks(document_id, chunks, embeddings)
    emitProgress(document_id, 'storing', 100, 'All chunks stored')

    // Mark as completed
    await db.query(
      `UPDATE indexing_queue
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    )

    await db.query(
      `UPDATE documents
       SET chunk_count = $1, indexed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [chunks.length, document_id]
    )

    emitProgress(document_id, 'completed', 100, 'Indexing completed successfully')

  } catch (error) {
    await handleJobError(jobId, document_id, job.retry_count, error)
  }
}
```

### 7.4 Chunking with LangChain

```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

async function chunkDocument(content: string): Promise<Array<{ content: string, heading?: string }>> {
  const splitter = RecursiveCharacterTextSplitter.fromLanguage('markdown', {
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const documents = await splitter.createDocuments([content])

  return documents.map(doc => ({
    content: doc.pageContent,
    heading: extractHeading(doc.pageContent), // Optional: extract ## headings
  }))
}

function extractHeading(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m)
  return match ? match[1] : undefined
}
```

### 7.5 OpenAI Embeddings with Batching

```typescript
async function generateEmbeddings(
  documentId: string,
  chunks: Array<{ content: string }>
): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call setOpenAIKey() first.')
  }

  const allEmbeddings: number[][] = []
  const batchSize = 100

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const inputs = batch.map(c => c.content)

    const embeddings = await generateEmbeddingBatchWithRetry(inputs)
    allEmbeddings.push(...embeddings)

    const progress = 30 + ((i + batch.length) / chunks.length) * 40
    emitProgress(
      documentId,
      'embedding',
      Math.round(progress),
      `Embedded batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`
    )
  }

  return allEmbeddings
}

async function generateEmbeddingBatchWithRetry(
  inputs: string[],
  retries = 3
): Promise<number[][]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openaiClient!.embeddings.create({
        model: 'text-embedding-3-small',
        input: inputs,
        dimensions: 1536,
      })

      return response.data.map(d => d.embedding)

    } catch (error: any) {
      if (error.status === 429 && attempt < retries - 1) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await sleep(delay)
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to generate embeddings after retries')
}
```

### 7.6 Chunk Storage

```typescript
async function storeChunks(
  documentId: string,
  chunks: Array<{ content: string, heading?: string }>,
  embeddings: number[][]
) {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = embeddings[i]
    const tokenCount = Math.ceil(chunk.content.length / 4)

    await db.query(
      `INSERT INTO chunks (id, document_id, chunk_index, content, heading, embedding, token_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        documentId,
        i,
        chunk.content,
        chunk.heading,
        `[${embedding.join(',')}]`, // pgvector format
        tokenCount,
      ]
    )

    if (i % 10 === 0) {
      const progress = 70 + ((i / chunks.length) * 30)
      emitProgress(
        documentId,
        'storing',
        Math.round(progress),
        `Stored ${i + 1} of ${chunks.length} chunks`
      )
    }
  }
}
```

### 7.7 Error Handling

```typescript
async function handleJobError(
  jobId: string,
  documentId: string,
  currentRetryCount: number,
  error: any
) {
  const errorMessage = error.message || String(error)
  const nextRetryCount = currentRetryCount + 1
  const maxRetries = 3

  if (nextRetryCount >= maxRetries) {
    // Mark as failed
    await db.query(
      `UPDATE indexing_queue
       SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [errorMessage, jobId]
    )

    emitProgress(documentId, 'failed', 0, `Failed: ${errorMessage}`)
  } else {
    // Retry
    await db.query(
      `UPDATE indexing_queue
       SET status = 'pending', retry_count = $1, error_message = $2
       WHERE id = $3`,
      [nextRetryCount, errorMessage, jobId]
    )

    emitProgress(
      documentId,
      'failed',
      0,
      `Retry ${nextRetryCount}/${maxRetries}: ${errorMessage}`
    )
  }
}
```

### 7.8 Progress Emission

```typescript
function emitProgress(
  documentId: string,
  stage: IndexingProgress['stage'],
  progress: number,
  message: string
) {
  const progressData: IndexingProgress = {
    documentId,
    stage,
    progress,
    message,
  }

  progressCallbacks.forEach(callback => {
    try {
      callback(progressData)
    } catch (error) {
      console.error('[Worker] Progress callback error:', error)
    }
  })

  if (import.meta.env.DEV) {
    console.log(`[Worker] ${documentId}: ${stage} ${progress}% - ${message}`)
  }
}
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

### 8.3 E2E Test Files (Written Per Phase)

**Test Files Structure:**
```
e2e/documents/
├── 00-01-feature-flags-enabled.spec.ts  (PREREQUISITE - see feature-toggle.md)
├── 00-02-feature-flags-disabled.spec.ts (PREREQUISITE - see feature-toggle.md)
├── 00-03-feature-toggle-interaction.spec.ts (PREREQUISITE - see feature-toggle.md)
├── 01-document-lifecycle.spec.ts        (✅ EXISTING - toggle disabled, no indexing)
├── 02-multi-document-operations.spec.ts (✅ EXISTING - toggle disabled, no indexing)
├── 03-file-validation.spec.ts           (✅ EXISTING - toggle disabled, no indexing)
├── 04-persistence.spec.ts               (✅ EXISTING - toggle disabled, no indexing)
├── 05-indexing-ui.spec.ts               (NEW - Phase ui-components)
├── 06-indexing-queue.spec.ts            (NEW - Phase db-schema)
├── 07-indexing-status.spec.ts           (NEW - Phase queue-processor)
├── 08-indexing-chunking.spec.ts         (NEW - Phase chunking)
├── 09-indexing-embeddings.spec.ts       (NEW - Phase embeddings)
├── 10-indexing-progress.spec.ts         (NEW - Phase progress-tracking)
├── 11-indexing-retry.spec.ts            (NEW - Phase error-retry)
└── 12-indexing-persistence.spec.ts      (NEW - Phase persistence)
```

**Tests are written and pass at END of each phase** (details in section 9)

---

## 9. Incremental TDD Workflow (8 Phases)

Each phase: Build → Test → Pass → Move to next phase

**Prerequisite:** Feature toggle system (see `feature-toggle.md`) must be implemented first

---

### **Phase ui-components**: UI Components & Visual State

**Goal:** Render all indexing UI with data attributes, no worker integration

**Build:**
- Create `APIKeyInput.tsx` (input + button + localStorage)
- Create `IndexingStatusBadge.tsx` (4 status variants)
- Create `IndexingProgress.tsx` (progress bar)
- Update `DocumentCard.tsx` (add indexing props + UI)
- Update `EmptyState.tsx` (API key variant)
- Update `VectorDBContext.tsx` (add apiKeySet, indexingProgress states - stubbed)
- Wire components to context

**Test:** `e2e/documents/05-indexing-ui.spec.ts`
```typescript
test('UI components render with data attributes', async ({ page }) => {
  // Set API key via localStorage
  await page.evaluate(() => localStorage.setItem('openai-api-key', 'sk-test'))
  await page.reload()

  // Verify API key set indicator
  await expect(page.locator('[data-api-key-set="true"]')).toBeVisible()

  // Manually trigger indexing state changes via context (stub)
  await page.evaluate(() => {
    window.setMockIndexingState('doc-id', {
      status: 'pending',
      progress: 0,
      stage: 'pending',
      message: 'Waiting...'
    })
  })

  // Verify status badge renders
  await expect(page.locator('[data-status="pending"]')).toBeVisible()

  // Change to processing
  await page.evaluate(() => {
    window.setMockIndexingState('doc-id', {
      status: 'processing',
      progress: 50,
      stage: 'embedding',
      message: 'Generating embeddings...'
    })
  })

  // Verify progress bar
  await expect(page.locator('[data-progress="50"]')).toBeVisible()
  await expect(page.locator('[data-stage="embedding"]')).toBeVisible()
})
```

**Pass Criteria:**
- ✅ All UI components render
- ✅ Data attributes present and correct
- ✅ API key input works (localStorage)
- ✅ Test 05 passes

**Checkpoint:** UI complete, no worker calls yet

---

### **Phase db-schema**: Database Schema & Queue Creation

**Goal:** Create tables, queue entries created on upload (if API key set)

**Build:**
- Create `indexing_queue` table in worker `init()`
- Create `chunks` table in worker `init()`
- Extend `documents` table (ALTER TABLE)
- Update `uploadDocument()`: create queue entry only if API key exists in localStorage
- Update `getDocuments()`: LEFT JOIN with indexing_queue

**Test:** `e2e/documents/06-indexing-queue.spec.ts`
```typescript
test('queue entry created on upload when API key set', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  // Upload WITHOUT API key → no queue entry
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])
  await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_01_MD)

  const statusWithoutKey = await documentsPage.documentList.getIndexingStatus(FILE_NAMES.DOC_01_MD)
  expect(statusWithoutKey).toBeNull() // No queue entry

  // Set API key
  await documentsPage.setAPIKey(OPENAI_KEY)

  // Upload WITH API key → queue entry created
  await documentsPage.uploadFiles([TEST_FILES.DOC_02_TXT])
  await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_02_TXT)

  const statusWithKey = await documentsPage.documentList.getIndexingStatus(FILE_NAMES.DOC_02_TXT)
  expect(statusWithKey).toBe('pending')
})
```

**Pass Criteria:**
- ✅ Tables created successfully
- ✅ Queue entry created only when API key set
- ✅ Existing tests (01-04) still pass (no API key, no queue)
- ✅ Test 06 passes

**Checkpoint:** Database schema complete, conditional queue creation works

---

### **Phase queue-processor**: Status Transitions (Mock Work)

**Goal:** Queue processor runs, status changes pending → processing → completed (no real work)

**Build:**
- Implement `processQueue()` function
- Implement `processJob()`: marks job as processing, waits 1 second, marks completed
- Update `getDocuments()` query to return indexing_status
- Connect VectorDBContext to worker via polling or worker events
- Auto-start queue processor on worker init

**Test:** `e2e/documents/07-indexing-status.spec.ts`
```typescript
test('status transitions from pending to completed', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  await documentsPage.setAPIKey(OPENAI_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])
  await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_01_MD)

  // Wait for pending
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'pending', { timeout: 5000 })

  // Wait for processing
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'processing', { timeout: 10000 })

  // Wait for completed
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 15000 })
})
```

**Pass Criteria:**
- ✅ Queue processor runs automatically
- ✅ Status transitions visible in UI
- ✅ Test 07 passes

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

**Test:** `e2e/documents/08-indexing-chunking.spec.ts`
```typescript
test('document gets chunked and count displayed', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  await documentsPage.setAPIKey(OPENAI_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])

  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 30000 })

  const chunkCount = await documentsPage.documentList.getChunkCount(FILE_NAMES.DOC_01_MD)
  expect(chunkCount).toBeGreaterThan(0)
})
```

**Pass Criteria:**
- ✅ Documents chunked with LangChain
- ✅ Chunks stored in database
- ✅ Chunk count visible in UI
- ✅ Test 08 passes

**Checkpoint:** Chunking works, chunks stored

---

### **Phase embeddings**: OpenAI API Integration

**Goal:** Generate real embeddings via OpenAI API, store with chunks

**Build:**
- Implement `setOpenAIKey()` worker method
- Connect `context.setOpenAIKey()` to worker
- Implement `generateEmbeddings()` with batching
- Implement `generateEmbeddingBatchWithRetry()` with exponential backoff
- Update `storeChunks()` to include embeddings
- Update `documents.indexed_at` timestamp

**Test:** `e2e/documents/09-indexing-embeddings.spec.ts`
```typescript
test('full indexing pipeline with real embeddings', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  await documentsPage.setAPIKey(OPENAI_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])

  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 60000 })

  // Verify embeddings stored (query worker directly)
  const hasEmbeddings = await page.evaluate(async () => {
    const result = await window.worker.query('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL')
    return result.rows[0].count > 0
  })

  expect(hasEmbeddings).toBe(true)
})
```

**Pass Criteria:**
- ✅ OpenAI client initialized with API key
- ✅ Embeddings generated and stored
- ✅ Full pipeline works end-to-end
- ✅ Test 09 passes

**Checkpoint:** Complete indexing pipeline functional

---

### **Phase progress-tracking**: Real-time Progress Updates

**Goal:** Progress bar updates during indexing stages

**Build:**
- Implement `emitProgress()` function
- Add progress emission in `processJob()` at each stage
- Implement `onProgress()` worker method
- Connect VectorDBContext to worker progress events
- Update UI to display progress

**Test:** `e2e/documents/10-indexing-progress.spec.ts`
```typescript
test('progress updates during indexing', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  await documentsPage.setAPIKey(OPENAI_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_03_MD]) // Large file

  // Wait for processing to start
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_03_MD, 'processing', { timeout: 10000 })

  // Check progress increases
  await page.waitForFunction(() => {
    const card = document.querySelector(`[data-testid*="${FILE_NAMES.DOC_03_MD}"]`)
    const progress = parseInt(card?.getAttribute('data-indexing-progress') || '0')
    return progress > 0 && progress < 100
  }, { timeout: 30000 })

  // Wait for completion
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_03_MD, 'completed', { timeout: 60000 })

  // Final progress should be 100
  await documentsPage.documentList.expectIndexingProgress(FILE_NAMES.DOC_03_MD, 100)
})
```

**Pass Criteria:**
- ✅ Progress updates visible in UI
- ✅ Progress increases during processing
- ✅ Stages visible (chunking, embedding, storing)
- ✅ Test 10 passes

**Checkpoint:** Progress tracking works

---

### **Phase error-retry**: Error Handling & Retry Logic

**Goal:** Failed jobs retry automatically, manual retry button works

**Build:**
- Implement `handleJobError()` with retry logic
- Implement `retryFailed()` worker method
- Connect `context.retryFailed()` to worker
- Add retry button to DocumentCard UI
- Handle rate limit errors with exponential backoff

**Test:** `e2e/documents/11-indexing-retry.spec.ts`
```typescript
test('manual retry works after failure', async ({ page }) => {
  const INVALID_KEY = 'sk-invalid-key-12345'
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  // Set invalid API key
  await documentsPage.setAPIKey(INVALID_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])

  // Wait for failure
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'failed', { timeout: 30000 })

  // Verify error message
  await documentsPage.documentList.expectErrorMessage(FILE_NAMES.DOC_01_MD, 'Incorrect API key')

  // Set valid API key
  const VALID_KEY = process.env.OPENAI_API_KEY
  await documentsPage.setAPIKey(VALID_KEY)

  // Click retry button
  await documentsPage.documentList.retryFailedIndexing(FILE_NAMES.DOC_01_MD)

  // Should succeed now
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 60000 })
})
```

**Pass Criteria:**
- ✅ Failed jobs show error message
- ✅ Retry button appears and works
- ✅ Automatic retry on transient errors
- ✅ Test 11 passes

**Checkpoint:** Error handling and retry complete

---

### **Phase persistence**: State Survives Reload

**Goal:** Indexing state persists across page reload

**Build:**
- Verify `getDocuments()` query includes all indexing fields
- Verify VectorDBContext repopulates state on mount
- Verify ongoing indexing continues after reload

**Test:** `e2e/documents/12-indexing-persistence.spec.ts`
```typescript
test('indexing state persists across reload', async ({ page }) => {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  await documentsPage.setAPIKey(OPENAI_KEY)
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])

  // Wait for completed
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 60000 })

  const chunkCountBefore = await documentsPage.documentList.getChunkCount(FILE_NAMES.DOC_01_MD)

  // Reload page
  await page.reload()
  await documentsPage.waitForDBInitialized()

  // Verify state persisted
  const statusAfter = await documentsPage.documentList.getIndexingStatus(FILE_NAMES.DOC_01_MD)
  expect(statusAfter).toBe('completed')

  const chunkCountAfter = await documentsPage.documentList.getChunkCount(FILE_NAMES.DOC_01_MD)
  expect(chunkCountAfter).toBe(chunkCountBefore)
})
```

**Pass Criteria:**
- ✅ Indexing status survives reload
- ✅ Chunk count survives reload
- ✅ API key survives reload
- ✅ Test 12 passes

**Checkpoint:** Persistence complete

---

### **Final Verification**

```bash
# Run ALL E2E tests
npm run test:e2e

# Expected: 12/12 tests passing
# - 01-04: Existing document tests (4) ✅
# - 05-12: New indexing tests (8) ✅

# Build verification
npm run build

# Manual browser testing
npm run dev
```

---

## 10. Implementation Checklist (Incremental Phases)

**Prerequisite:** Complete feature toggle system (see `feature-toggle.md`) before starting

### Phase ui-components
- [ ] Create `APIKeyInput.tsx`
- [ ] Create `IndexingStatusBadge.tsx`
- [ ] Create `IndexingProgress.tsx`
- [ ] Update `DocumentCard.tsx` (add indexing UI)
- [ ] Update `EmptyState.tsx` (API key variant)
- [ ] Update `VectorDBContext.tsx` (apiKeySet, indexingProgress states - stubbed)
- [ ] Extend DocumentsPage POM (setAPIKey, expectAPIKeySet)
- [ ] Extend DocumentListComponent POM (6 indexing methods)
- [ ] Create `05-indexing-ui.spec.ts`
- [ ] ✅ Test 05 PASSES

### Phase db-schema
- [ ] Create `indexing_queue` table in worker init()
- [ ] Create `chunks` table in worker init()
- [ ] Extend `documents` table (ALTER TABLE)
- [ ] Update `uploadDocument()` (conditional queue creation)
- [ ] Update `getDocuments()` (LEFT JOIN indexing_queue)
- [ ] Create `06-indexing-queue.spec.ts`
- [ ] ✅ Test 06 PASSES
- [ ] ✅ Tests 01-04 still pass (no indexing triggered)

### Phase queue-processor
- [ ] Implement `processQueue()` function
- [ ] Implement `processJob()` (mock work, 1 second delay)
- [ ] Connect VectorDBContext to worker for status updates
- [ ] Auto-start queue processor on worker init
- [ ] Create `07-indexing-status.spec.ts`
- [ ] ✅ Test 07 PASSES

### Phase chunking
- [ ] Install `@langchain/textsplitters`
- [ ] Implement `chunkDocument()` with RecursiveCharacterTextSplitter
- [ ] Update `processJob()` to actually chunk
- [ ] Store chunks (embedding = NULL)
- [ ] Update `documents.chunk_count`
- [ ] Create `08-indexing-chunking.spec.ts`
- [ ] ✅ Test 08 PASSES

### Phase embeddings
- [ ] Implement `setOpenAIKey()` worker method
- [ ] Connect `context.setOpenAIKey()` to worker
- [ ] Implement `generateEmbeddings()` with batching
- [ ] Implement `generateEmbeddingBatchWithRetry()` (exponential backoff)
- [ ] Update `storeChunks()` to include embeddings
- [ ] Update `documents.indexed_at`
- [ ] Create `09-indexing-embeddings.spec.ts`
- [ ] ✅ Test 09 PASSES

### Phase progress-tracking
- [ ] Implement `emitProgress()` function
- [ ] Add progress emission in `processJob()` at each stage
- [ ] Implement `onProgress()` worker method
- [ ] Connect VectorDBContext to worker progress events
- [ ] Update DocumentCard to display progress
- [ ] Create `10-indexing-progress.spec.ts`
- [ ] ✅ Test 10 PASSES

### Phase error-retry
- [ ] Implement `handleJobError()` with retry logic
- [ ] Implement `retryFailed()` worker method
- [ ] Connect `context.retryFailed()` to worker
- [ ] Add retry button to DocumentCard
- [ ] Handle rate limit errors in embeddings
- [ ] Create `11-indexing-retry.spec.ts`
- [ ] ✅ Test 11 PASSES

### Phase persistence
- [ ] Verify `getDocuments()` returns all indexing fields
- [ ] Verify VectorDBContext repopulates on mount
- [ ] Verify ongoing indexing continues after reload
- [ ] Create `12-indexing-persistence.spec.ts`
- [ ] ✅ Test 12 PASSES

### Final Verification
- [ ] All 12 E2E tests passing (4 existing + 8 new indexing)
- [ ] Feature toggle tests pass (3 tests - see feature-toggle.md)
- [ ] TypeScript compilation passing
- [ ] Build successful (`npm run build`)
- [ ] No console errors
- [ ] Manual browser testing verified

---

## 11. Acceptance Criteria (Incremental TDD Success)

**Phase indexing-pipeline complete when all 8 phases pass:**

### UI & Visibility
✅ API key input component renders and accepts input
✅ Indexing status badge shows all 4 states (pending/processing/completed/failed)
✅ Progress bar displays during processing with accurate percentages
✅ Document cards show indexing state with data attributes
✅ All background states observable via data attributes for testing

### E2E Tests (All 12 Passing)
✅ Test 05: UI components render with data attributes
✅ Test 06: Queue entry created conditionally (toggle dependent)
✅ Test 07: Status transitions (pending → processing → completed)
✅ Test 08: Documents chunked and stored
✅ Test 09: Full indexing with real OpenAI embeddings
✅ Test 10: Real-time progress updates
✅ Test 11: Error handling and manual retry
✅ Test 12: Indexing state persists across reload
✅ Tests 01-04: Existing document tests still pass (no indexing triggered)

**Prerequisites** (see `feature-toggle.md`):
✅ Test 00-01: Feature toggle enabled (default state)
✅ Test 00-02: Feature toggle disabled (addInitScript)
✅ Test 00-03: Toggle interaction and persistence

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
✅ 12 E2E tests passing (4 existing + 8 new indexing)
✅ 3 feature toggle tests passing (prerequisite - see feature-toggle.md)
✅ TypeScript compilation passing
✅ Build successful
✅ No console errors in tests
✅ Manual testing verified in browser

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

**Performance Expectations:**
- Small document (500 words): ~2-5 seconds
- Medium document (5000 words): ~10-30 seconds
- Large document (50,000 words): ~1-3 minutes

**Cost Expectations (OpenAI API):**
- E2E test run (8 tests, ~8 small docs): ~$0.001 (negligible)
- 100 documents (~500 words each): ~$0.01
- 1,000 documents: ~$0.10
- 10,000 documents: ~$1.00

**Test Isolation Strategy:**
- Existing tests (01-04): No API key → No indexing → No cost
- New tests (05-12): Set API key → Indexing happens → Minimal cost
- Total test cost per run: < $0.01

---

## 13. Next Steps After Completion

After Phase indexing-pipeline is complete, proceed to:
- **Phase vector-search:** HNSW index creation + vector similarity search + RAG integration with useChat hook
