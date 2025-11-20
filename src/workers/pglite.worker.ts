import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { v4 as uuidv4 } from 'uuid'
import * as Comlink from 'comlink'

let db: PGlite | null = null
let indexingEnabled = true // default to enabled (used in Phase db-schema for conditional queue creation)
let isProcessing = false // queue processor state (Phase queue-processor)
let progressCallbacks: Array<(progress: IndexingProgress) => void> = [] // Phase queue-processor

// Keep TypeScript happy - variables are used
if (indexingEnabled && !isProcessing && progressCallbacks.length >= 0) {
  // Variables are accessed here to avoid TS6133
}

interface UploadDocumentParams {
  filename: string
  content: string
  mimeType: string
}

interface Document {
  id: string
  filename: string
  content: string
  file_size: number
  mime_type: string
  uploaded_at: string
  chunk_count: number | null
  indexed_at: string | null
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null
  error_message: string | null
  retry_count: number | null
}

interface IndexingProgress {
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number // 0-100
  stage: string
  message: string
}

interface IndexingJob {
  id: string
  document_id: string
  status: string
  error_message: string | null
  retry_count: number
  max_retries: number
}

/**
 * Initialize PGlite database with pgvector extension and documents table
 */
async function init(): Promise<{ ready: boolean }> {
  if (db) {
    return { ready: true }
  }

  db = await PGlite.create({
    dataDir: 'idb://rag-vectors',
    extensions: { vector },
  })

  // Enable pgvector extension (will be used in Phase embeddings)
  await db.query('CREATE EXTENSION IF NOT EXISTS vector')

  // Create documents table for file metadata storage
  await db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Extend documents table with indexing fields (Phase db-schema)
  await db.exec(`
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
  `)

  // Create indexing_queue table (Phase db-schema)
  await db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_queue_status_created ON indexing_queue(status, created_at);
  `)

  // Create chunks table (Phase db-schema)
  await db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
  `)

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Database initialized with all tables')
  }

  return { ready: true }
}

/**
 * Upload a document to the database
 */
async function uploadDocument(
  params: UploadDocumentParams
): Promise<{ id: string }> {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.')
  }

  const id = uuidv4()
  const fileSize = new Blob([params.content]).size

  await db.query(
    `INSERT INTO documents (id, filename, content, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, params.filename, params.content, fileSize, params.mimeType]
  )

  // Create indexing queue entry if feature enabled (Phase db-schema)
  if (indexingEnabled) {
    await db.query(
      `INSERT INTO indexing_queue (id, document_id, status)
       VALUES ($1, $2, 'pending')`,
      [uuidv4(), id]
    )

    if (import.meta.env.DEV) {
      console.log('[PGlite Worker] Indexing queue entry created for:', id)
    }
  }

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Document uploaded:', params.filename, id)
  }

  return { id }
}

/**
 * Get all documents ordered by upload date (newest first)
 */
async function getDocuments(): Promise<Document[]> {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.')
  }

  // LEFT JOIN with indexing_queue to get status (Phase db-schema)
  const result = await db.query<Document>(`
    SELECT
      d.*,
      iq.status as indexing_status,
      iq.error_message,
      iq.retry_count
    FROM documents d
    LEFT JOIN indexing_queue iq ON d.id = iq.document_id
    ORDER BY d.uploaded_at DESC
  `)

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Retrieved documents:', result.rows.length)
  }

  return result.rows
}

/**
 * Delete a document by ID
 */
async function deleteDocument(id: string): Promise<{ deleted: boolean }> {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.')
  }

  await db.query('DELETE FROM documents WHERE id = $1', [id])

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Document deleted:', id)
  }

  return { deleted: true }
}

/**
 * Set whether indexing is enabled
 * Used by feature toggle system to control indexing behavior
 */
function setIndexingEnabled(enabled: boolean): void {
  indexingEnabled = enabled

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Indexing enabled set to:', enabled)
  }
}

// ========== Queue Processor (Phase queue-processor) ==========

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract heading from chunk content (Phase chunking)
 */
function extractHeading(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m)
  return match ? match[1] : undefined
}

/**
 * Simple browser-compatible text chunker (Phase chunking)
 * Splits text into chunks respecting word boundaries
 */
function chunkDocument(content: string): Array<{ content: string, heading?: string }> {
  const chunkSize = 1000
  const chunkOverlap = 200

  // Split on paragraph breaks first (double newline)
  const paragraphs = content.split(/\n\n+/)
  const chunks: Array<{ content: string, heading?: string }> = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedParagraph.length + 2 > chunkSize) {
      // Save current chunk if not empty
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          heading: extractHeading(currentChunk),
        })

        // Start new chunk with overlap from end of previous chunk
        const words = currentChunk.split(/\s+/)
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5)) // rough estimate
        currentChunk = overlapWords.join(' ') + '\n\n'
      }
    }

    // Add paragraph to current chunk
    currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      heading: extractHeading(currentChunk),
    })
  }

  return chunks.length > 0 ? chunks : [{ content: content.substring(0, chunkSize), heading: extractHeading(content) }]
}

/**
 * Store chunks in database (Phase chunking: embedding = NULL, will be added in Phase embeddings)
 */
async function storeChunks(
  documentId: string,
  chunks: Array<{ content: string, heading?: string }>
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const tokenCount = Math.ceil(chunk.content.length / 4)

    await db!.query(
      `INSERT INTO chunks (id, document_id, chunk_index, content, heading, embedding, token_count)
       VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
      [
        uuidv4(),
        documentId,
        i,
        chunk.content,
        chunk.heading,
        tokenCount,
      ]
    )
  }

  if (import.meta.env.DEV) {
    console.log(`[PGlite Worker] Stored ${chunks.length} chunks for document ${documentId}`)
  }
}

/**
 * Emit progress update to all registered callbacks
 */
function emitProgress(
  documentId: string,
  status: IndexingProgress['status'],
  progress: number,
  stage: string,
  message: string
): void {
  const progressData: IndexingProgress = {
    documentId,
    status,
    progress,
    stage,
    message,
  }

  progressCallbacks.forEach(callback => {
    try {
      callback(progressData)
    } catch (error) {
      console.error('[PGlite Worker] Progress callback error:', error)
    }
  })

  if (import.meta.env.DEV) {
    console.log(`[PGlite Worker] ${documentId}: ${status} ${progress}% - ${message}`)
  }
}

/**
 * Process a single indexing job
 * Phase queue-processor: Basic status transitions
 * Phase chunking: Actually chunk and store (no embeddings yet)
 */
async function processJob(job: IndexingJob): Promise<void> {
  const { id: jobId, document_id } = job

  try {
    // Mark as processing
    await db!.query(
      `UPDATE indexing_queue
       SET status = 'processing', started_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    )

    emitProgress(document_id, 'processing', 0, 'chunking', 'Starting indexing...')

    // Get document content
    const docResult = await db!.query<{ content: string }>(
      'SELECT content FROM documents WHERE id = $1',
      [document_id]
    )

    if (docResult.rows.length === 0) {
      throw new Error(`Document not found: ${document_id}`)
    }

    const document = docResult.rows[0]

    // Phase chunking: Chunk the document
    emitProgress(document_id, 'processing', 10, 'chunking', 'Splitting document into chunks...')
    const chunks = chunkDocument(document.content)
    emitProgress(document_id, 'processing', 30, 'chunking', `Created ${chunks.length} chunks`)

    // Phase chunking: Store chunks (no embeddings yet)
    emitProgress(document_id, 'processing', 30, 'storing', 'Storing chunks...')
    await storeChunks(document_id, chunks)
    emitProgress(document_id, 'processing', 100, 'storing', 'All chunks stored')

    // Mark as completed
    await db!.query(
      `UPDATE indexing_queue
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    )

    // Update documents table with chunk count
    await db!.query(
      `UPDATE documents
       SET chunk_count = $1, indexed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [chunks.length, document_id]
    )

    emitProgress(document_id, 'completed', 100, 'completed', 'Indexing completed successfully')

  } catch (error) {
    console.error('[PGlite Worker] Job processing error:', error)

    // Basic error handling (full retry logic in Phase error-retry)
    const errorMessage = error instanceof Error ? error.message : String(error)

    await db!.query(
      `UPDATE indexing_queue
       SET status = 'failed', error_message = $1
       WHERE id = $2`,
      [errorMessage, jobId]
    )

    emitProgress(document_id, 'failed', 0, 'error', `Failed: ${errorMessage}`)
  }
}

/**
 * Process pending jobs from the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing || !db) {
    return
  }

  isProcessing = true

  try {
    while (true) {
      // Get next pending job
      const result = await db.query<IndexingJob>(`
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
  } catch (error) {
    console.error('[PGlite Worker] Queue processing error:', error)
  } finally {
    isProcessing = false
  }
}

/**
 * Register a progress callback
 * Callback should be wrapped with Comlink.proxy() by caller (main thread)
 */
function onProgress(callback: (progress: IndexingProgress) => void): void {
  progressCallbacks.push(callback)
}

/**
 * Manually trigger queue processing (for testing/debugging)
 */
async function triggerQueueProcessing(): Promise<{ triggered: boolean }> {
  processQueue()
  return { triggered: true }
}

/**
 * Get diagnostic info about worker state (for testing/debugging)
 */
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
      isProcessing,
      indexingEnabled,
      pendingJobs: 0,
      allJobs: [],
    }
  }

  const countResult = await db.query<{ count: number }>(`
    SELECT COUNT(*) as count FROM indexing_queue WHERE status = 'pending'
  `)

  const jobsResult = await db.query<{ status: string; document_id: string; error_message: string | null }>(`
    SELECT status, document_id, error_message FROM indexing_queue ORDER BY created_at DESC LIMIT 5
  `)

  return {
    dbInitialized: true,
    isProcessing,
    indexingEnabled,
    pendingJobs: parseInt(countResult.rows[0]?.count?.toString() || '0'),
    allJobs: jobsResult.rows,
  }
}

// Auto-start queue processor after init (Phase queue-processor)
const originalInit = init
async function initWithQueueProcessor(): Promise<{ ready: boolean }> {
  const result = await originalInit()

  // Ensure db is ready before starting queue processor
  if (db) {
    // Small delay to allow callback registration to complete
    await sleep(100)
    // Start queue processor in background
    processQueue()
    // Poll for new jobs every 2 seconds (faster for better UX)
    setInterval(() => processQueue(), 2000)
  }

  return result
}

const api = {
  init: initWithQueueProcessor,
  uploadDocument,
  getDocuments,
  deleteDocument,
  setIndexingEnabled,
  onProgress,
  triggerQueueProcessing,
  getWorkerState,
}

Comlink.expose(api)

export type PGliteWorkerAPI = typeof api
