# Phase indexing-pipeline: Implementation Specifications

**Status:** TDD approach - UI → E2E Tests → Worker Implementation
**Dependencies:** Phase worker-setup ✅ COMPLETE
**Goal:** Background indexing pipeline with visible UI state for comprehensive E2E testing

---

## 🎯 TDD Implementation Approach

**Why TDD for This Phase:**
- Background indexing is invisible without UI → can't test
- Data attributes make all states observable and verifiable
- E2E tests drive implementation requirements
- Catches integration issues early
- No untested code paths

**Implementation Order:**
1. **UI Components First** - Display indexing state (status, progress, errors) with data attributes
2. **E2E Tests Second** - Write tests for complete workflows (WILL FAIL initially)
3. **Worker Implementation Third** - Make tests pass incrementally
4. **Iterate** - Refine based on test feedback

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

## 3. Dependencies

**Install:**
```bash
npm install @langchain/textsplitters openai
```

**Versions:**
- `@langchain/textsplitters`: Latest stable
- `openai`: Latest stable (already installed from chat feature)

---

## 4. Database Schema Extensions

### 2.1 Indexing Queue Table

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

### 2.2 Chunks Table

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

### 2.3 Documents Table Extensions

**SQL Schema:**
```sql
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
```

**New Fields:**
- `chunk_count` - Total chunks created (nullable until indexed)
- `indexed_at` - Indexing completion timestamp (nullable)

---

## 3. Worker API Extensions

### 3.1 Modified Existing Methods

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

### 3.2 New Worker Methods

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

## 4. Indexing Pipeline Implementation

### 4.1 Global State (Worker Scope)

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

### 4.2 Queue Processor

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

### 4.3 Job Processing

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

### 4.4 Chunking with LangChain

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

### 4.5 OpenAI Embeddings with Batching

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

### 4.6 Chunk Storage

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

### 4.7 Error Handling

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

### 4.8 Progress Emission

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

## 5. Testing Strategy

### 5.1 Test Infrastructure

**MSW Handlers for OpenAI API:**
```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Existing chat handler...

  http.post('https://api.openai.com/v1/embeddings', async ({ request }) => {
    const body = await request.json()
    const inputs = Array.isArray(body.input) ? body.input : [body.input]

    return HttpResponse.json({
      data: inputs.map((text, i) => ({
        embedding: Array(1536).fill(0).map(() => Math.random() * 0.1),
        index: i,
      })),
      model: 'text-embedding-3-small',
      usage: {
        prompt_tokens: inputs.join(' ').length / 4,
        total_tokens: inputs.join(' ').length / 4,
      },
    })
  }),
]
```

### 5.2 Page Object Extensions (BUILD BEFORE TESTS - TDD Step 2)

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

### 5.3 E2E Tests (WRITE THIRD - BEFORE WORKER - TDD Step 2)

**⚠️ Important: These tests WILL FAIL initially - that's expected in TDD!**

**Test Files:**
```
e2e/documents/
├── 05-api-key-setup.spec.ts        (NEW)
├── 06-indexing-pipeline.spec.ts    (NEW)
├── 07-indexing-retry.spec.ts       (NEW)
└── 08-indexing-persistence.spec.ts (NEW)
```

**Test 05: Indexing Pipeline**
```typescript
test('upload document and verify automatic indexing', async ({ page }) => {
  documentsPage = new DocumentsPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  // Set API key (triggers OpenAI client initialization)
  await documentsPage.setOpenAIKey('sk-test-key')

  // Upload document
  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])
  await documentsPage.documentList.waitForFileToAppear(FILE_NAMES.DOC_01_MD)

  // Verify indexing status changes: pending → processing → completed
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'pending')
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'processing')
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed')

  // Verify chunk count displayed
  await documentsPage.documentList.expectChunkCount(FILE_NAMES.DOC_01_MD, greaterThan(0))
})
```

**Test 06: Retry Logic**
```typescript
test('retry failed indexing jobs', async ({ page }) => {
  // Configure MSW to fail first 2 attempts, succeed on 3rd
  await page.route('https://api.openai.com/v1/embeddings', (route, request) => {
    const attemptCount = getAttemptCount()
    if (attemptCount < 2) {
      route.fulfill({ status: 429, body: JSON.stringify({ error: 'Rate limit' }) })
    } else {
      route.continue()
    }
  })

  await documentsPage.uploadFiles([TEST_FILES.DOC_01_MD])

  // Should eventually succeed after retries
  await documentsPage.documentList.waitForIndexingStatus(FILE_NAMES.DOC_01_MD, 'completed', { timeout: 30000 })
})
```

### 5.3 Unit Tests (Worker Logic)

**Test chunking logic:**
```typescript
// src/workers/__tests__/chunking.test.ts
test('chunks document with proper overlap', async () => {
  const content = 'A'.repeat(5000) // Long content
  const chunks = await chunkDocument(content)

  expect(chunks.length).toBeGreaterThan(1)
  expect(chunks[0].content.length).toBeLessThanOrEqual(1000 * 4) // ~1000 tokens
})
```

**Test retry logic:**
```typescript
test('retries on rate limit errors', async () => {
  const mockFetch = vi.fn()
    .mockRejectedValueOnce({ status: 429 })
    .mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ data: [{ embedding: [] }] })

  const result = await generateEmbeddingBatchWithRetry(['test'])

  expect(mockFetch).toHaveBeenCalledTimes(3)
  expect(result).toBeDefined()
})
```

---

## 6. TDD Implementation Workflow (FOLLOW THIS ORDER)

### Step 1: Build UI Components (No Backend Logic)

```bash
✅ Create src/pages/documents/components/APIKeyInput.tsx
   - Input field + button + success/error message
   - Data attributes: data-testid, data-api-key-set
   - NO worker calls yet (stub)

✅ Create src/pages/documents/components/IndexingStatusBadge.tsx
   - 4 status variants with colors
   - Data attributes: data-testid, data-status, data-retry-count

✅ Create src/pages/documents/components/IndexingProgress.tsx
   - Progress bar + stage + message
   - Data attributes: data-testid, data-progress, data-stage, data-message

✅ Update src/pages/documents/components/DocumentCard.tsx
   - Add indexing props
   - Render status badge, progress, chunk count, error, retry button
   - Add data attributes: data-indexing-status, data-chunk-count, etc.

✅ Update src/pages/documents/components/EmptyState.tsx
   - Add API key required variant
   - Data attribute: data-api-key-required
```

### Step 2: Extend Context (Stub Methods)

```bash
✅ Update src/contexts/VectorDBContext.tsx
   - Add apiKeySet state (default: false)
   - Add indexingProgress state (empty Map)
   - Add setOpenAIKey() - localStorage only, NO worker call
   - Add retryFailed() - stub, does nothing
   - Add onProgress subscription (stub)
```

### Step 3: Wire UI to Context

```bash
✅ Connect APIKeyInput to context.setOpenAIKey()
✅ Pass indexing data from context to DocumentCard
✅ Show/hide components based on state
✅ Verify UI renders correctly in browser (manual test)
```

### Step 4: Extend Page Objects

```bash
✅ Add methods to DocumentsPage:
   - setAPIKey()
   - expectAPIKeySet()

✅ Add methods to DocumentListComponent:
   - waitForIndexingStatus()
   - expectIndexingProgress()
   - expectChunkCount()
   - getChunkCount()
   - retryFailedIndexing()
   - expectErrorMessage()
```

### Step 5: Write E2E Tests (THEY WILL FAIL)

```bash
✅ Create e2e/documents/05-api-key-setup.spec.ts
✅ Create e2e/documents/06-indexing-pipeline.spec.ts
✅ Create e2e/documents/07-indexing-retry.spec.ts
✅ Create e2e/documents/08-indexing-persistence.spec.ts

❌ Run tests: npm run test:e2e
   Expected: ALL TESTS FAIL (no worker implementation yet)
```

### Step 6: TDD Cycles - Implement Worker Features

**Cycle 1: Database Schema**
```bash
1. Implement: Create indexing_queue table in worker init()
2. Implement: Create chunks table in worker init()
3. Implement: Extend documents table (ALTER TABLE)
4. Run tests: npm run test:e2e
5. Expected: Tests progress further (documents table extended)
```

**Cycle 2: API Key Setup**
```bash
1. Implement: setOpenAIKey() in worker
2. Implement: Connect context.setOpenAIKey() to worker
3. Run test: npm run test:e2e -- 05-api-key-setup
4. Expected: Test 05 PASSES
```

**Cycle 3: Queue Basics**
```bash
1. Implement: processQueue() skeleton
2. Implement: Update uploadDocument() to create queue entry
3. Implement: Update getDocuments() to join with indexing_queue
4. Run test: npm run test:e2e -- 06-indexing-pipeline
5. Expected: Test shows "pending" status
```

**Cycle 4: Chunking**
```bash
1. Install: npm install @langchain/textsplitters
2. Implement: chunkDocument() with LangChain
3. Implement: Store chunks (without embeddings yet)
4. Run test: npm run test:e2e -- 06-indexing-pipeline
5. Expected: Test shows "processing" → "chunking" stage
```

**Cycle 5: Embeddings**
```bash
1. Implement: generateEmbeddings() with OpenAI API
2. Implement: generateEmbeddingBatchWithRetry() with exponential backoff
3. Implement: Store embeddings with chunks
4. Run test: npm run test:e2e -- 06-indexing-pipeline
5. Expected: Test 06 PASSES (completed status)
```

**Cycle 6: Progress Tracking**
```bash
1. Implement: emitProgress() function
2. Implement: Progress updates at each stage
3. Implement: Connect context to worker progress
4. Run test: npm run test:e2e -- 06-indexing-pipeline
5. Expected: Test shows accurate progress percentages
```

**Cycle 7: Error Handling & Retry**
```bash
1. Implement: handleJobError() with retry logic
2. Implement: retryFailed() in worker
3. Implement: Connect context.retryFailed() to worker
4. Run test: npm run test:e2e -- 07-indexing-retry
5. Expected: Test 07 PASSES
```

**Cycle 8: Persistence**
```bash
1. Verify: getDocuments() returns indexing_status
2. Verify: Data persists across page reload
3. Run test: npm run test:e2e -- 08-indexing-persistence
4. Expected: Test 08 PASSES
```

### Step 7: Verify All Tests Pass

```bash
✅ Run all E2E tests: npm run test:e2e
   Expected: 8/8 tests passing (4 new + 4 existing)

✅ Run build: npm run build
   Expected: No TypeScript errors

✅ Manual testing in browser
   Expected: Upload → Index → Complete workflow works
```

---

## 7. Implementation Checklist (TDD Order)

### Phase 1: UI & Test Infrastructure (Steps 1-5)

**UI Components:**
- [ ] Create APIKeyInput.tsx (with data attributes)
- [ ] Create IndexingStatusBadge.tsx (4 status variants)
- [ ] Create IndexingProgress.tsx (progress bar)
- [ ] Update DocumentCard.tsx (add indexing UI)
- [ ] Update EmptyState.tsx (API key variant)

**Context Extensions:**
- [ ] Add apiKeySet state to VectorDBContext
- [ ] Add indexingProgress state to VectorDBContext
- [ ] Add setOpenAIKey() stub method
- [ ] Add retryFailed() stub method
- [ ] Add onProgress() subscription stub

**Page Object Extensions:**
- [ ] Add setAPIKey() to DocumentsPage
- [ ] Add expectAPIKeySet() to DocumentsPage
- [ ] Add 6 indexing methods to DocumentListComponent

**E2E Tests (Will Fail Initially):**
- [ ] Create 05-api-key-setup.spec.ts
- [ ] Create 06-indexing-pipeline.spec.ts
- [ ] Create 07-indexing-retry.spec.ts
- [ ] Create 08-indexing-persistence.spec.ts
- [ ] Add MSW handler for OpenAI embeddings API

**Checkpoint:** UI renders, tests exist but fail

### Phase 2: Worker Implementation (Step 6 - TDD Cycles)

**Database Schema (Cycle 1):**
- [ ] Create indexing_queue table
- [ ] Create chunks table
- [ ] Extend documents table (ALTER TABLE)
- [ ] Create indexes

**Dependencies:**
- [ ] Install @langchain/textsplitters

**API Key Setup (Cycle 2):**
- [ ] Implement setOpenAIKey() in worker
- [ ] Connect context to worker
- [ ] ✅ Test 05 PASSES

**Queue Basics (Cycle 3):**
- [ ] Implement processQueue() skeleton
- [ ] Update uploadDocument() to create queue entry
- [ ] Update getDocuments() to join with queue
- [ ] ✅ Test shows "pending" status

**Chunking (Cycle 4):**
- [ ] Implement chunkDocument() with LangChain
- [ ] Store chunks without embeddings
- [ ] ✅ Test shows "chunking" stage

**Embeddings (Cycle 5):**
- [ ] Implement generateEmbeddings()
- [ ] Implement generateEmbeddingBatchWithRetry()
- [ ] Store embeddings with chunks
- [ ] ✅ Test 06 PASSES

**Progress Tracking (Cycle 6):**
- [ ] Implement emitProgress()
- [ ] Add progress updates at each stage
- [ ] Connect context to worker progress
- [ ] ✅ Test shows accurate progress

**Error & Retry (Cycle 7):**
- [ ] Implement handleJobError()
- [ ] Implement retryFailed() in worker
- [ ] Connect context to worker
- [ ] ✅ Test 07 PASSES

**Persistence (Cycle 8):**
- [ ] Verify getDocuments() returns status
- [ ] Verify data persists across reload
- [ ] ✅ Test 08 PASSES

**Checkpoint:** All 8 E2E tests passing

### Phase 3: Final Verification (Step 7)

**Quality Gates:**
- [ ] All 8 E2E tests passing (4 new + 4 existing)
- [ ] TypeScript compilation passing
- [ ] Build successful
- [ ] No console errors in tests
- [ ] Manual testing verified

**Documentation:**
- [ ] Update plan with completion status
- [ ] Document TDD learnings
- [ ] Prepare commit message

---

## 8. Acceptance Criteria (TDD Success Metrics)

**Phase indexing-pipeline TDD is complete when:**

### UI & Visibility
✅ API key input component renders and accepts input
✅ Indexing status badge shows all 4 states (pending/processing/completed/failed)
✅ Progress bar displays during processing with accurate percentages
✅ Document cards show indexing state with data attributes
✅ All background states observable via data attributes for testing

### E2E Tests (All Passing)
✅ Test 05: API key setup flow works
✅ Test 06: End-to-end indexing pipeline (upload → pending → processing → completed)
✅ Test 07: Retry logic handles failures and rate limits
✅ Test 08: Indexing state persists across page reload
✅ All 4 existing tests still pass (regression check)

### Worker Implementation
✅ Database tables created (indexing_queue, chunks, documents extended)
✅ LangChain text splitter chunks documents correctly
✅ OpenAI embeddings API integrated with batching (100 chunks/batch)
✅ Background queue processor runs automatically
✅ Retry logic handles rate limits with exponential backoff
✅ Progress tracking emits real-time updates
✅ Cascade deletes work (document → queue → chunks)

### Quality
✅ 8 E2E tests passing (4 new + 4 existing)
✅ TypeScript compilation passing
✅ Build successful
✅ No console errors in tests
✅ Manual testing verified in browser

### TDD Process Followed
✅ UI built first with data attributes
✅ E2E tests written before worker implementation
✅ Tests drove implementation (failed → implemented → passed)
✅ All features verified by tests before commit

### Documentation
✅ TDD approach documented
✅ Implementation deviations (if any) noted
✅ Commit message prepared

---

## 8. Known Constraints & Trade-offs

**Decisions from Phase worker-setup:**
- ✅ No `relaxedDurability` - synchronous flush for guaranteed persistence
- ✅ Page Object Model pattern for all E2E tests
- ✅ MSW for mocking external APIs in tests
- ✅ YAGNI approach - build only what's specified, no extras

**Performance Expectations:**
- Small document (500 words): ~2-5 seconds
- Medium document (5000 words): ~10-30 seconds
- Large document (50,000 words): ~1-3 minutes

**Cost Expectations (OpenAI API):**
- 100 documents (~500 words each): ~$0.01
- 1,000 documents: ~$0.10
- 10,000 documents: ~$1.00

---

## Next Steps After Completion

After Phase indexing-pipeline is complete, proceed to:
- **Phase vector-search:** HNSW index creation + vector similarity search + RAG integration with useChat hook
