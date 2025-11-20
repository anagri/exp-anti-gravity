import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { v4 as uuidv4 } from 'uuid'
import * as Comlink from 'comlink'

let db: PGlite | null = null
let indexingEnabled = true // default to enabled (used in Phase db-schema for conditional queue creation)

// Keep TypeScript happy - this variable is used by setIndexingEnabled
if (indexingEnabled) {
  // Variable is accessed here to avoid TS6133
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

  // Enable pgvector extension (will be used in Phase 4 for embeddings)
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

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Database initialized with documents table')
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

  const result = await db.query<Pick<Document, 'id' | 'filename' | 'content' | 'file_size' | 'mime_type' | 'uploaded_at'>>(
    'SELECT * FROM documents ORDER BY uploaded_at DESC'
  )

  if (import.meta.env.DEV) {
    console.log('[PGlite Worker] Retrieved documents:', result.rows.length)
  }

  // Map to full Document interface with null indexing fields (will be populated in Phase db-schema)
  return result.rows.map(row => ({
    ...row,
    chunk_count: null,
    indexed_at: null,
    indexing_status: null,
    error_message: null,
    retry_count: null,
  }))
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

const api = {
  init,
  uploadDocument,
  getDocuments,
  deleteDocument,
  setIndexingEnabled,
}

Comlink.expose(api)

export type PGliteWorkerAPI = typeof api
