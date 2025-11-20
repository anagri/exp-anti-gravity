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
 * Process a single indexing job (Phase queue-processor: mock work only)
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

    emitProgress(document_id, 'processing', 0, 'processing', 'Starting indexing...')

    // Mock work: Just wait 1 second (Phase queue-processor)
    // Real chunking, embedding, storing will be added in later phases
    await sleep(1000)

    emitProgress(document_id, 'processing', 100, 'completed', 'Indexing complete (mock)')

    // Mark as completed
    await db!.query(
      `UPDATE indexing_queue
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    )

    emitProgress(document_id, 'completed', 100, 'completed', 'Indexing completed successfully')

  } catch (error) {
    console.error('[PGlite Worker] Job processing error:', error)
    // Error handling will be implemented in Phase error-retry
  }
}

/**
 * Process pending jobs from the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing || !db) return
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
 */
function onProgress(callback: (progress: IndexingProgress) => void): void {
  progressCallbacks.push(Comlink.proxy(callback))
}

// Auto-start queue processor after init (Phase queue-processor)
const originalInit = init
async function initWithQueueProcessor(): Promise<{ ready: boolean }> {
  const result = await originalInit()

  // Start queue processor in background
  processQueue()
  // Poll for new jobs every 5 seconds
  setInterval(() => processQueue(), 5000)

  return result
}

const api = {
  init: initWithQueueProcessor,
  uploadDocument,
  getDocuments,
  deleteDocument,
  setIndexingEnabled,
  onProgress,
}

Comlink.expose(api)

export type PGliteWorkerAPI = typeof api
