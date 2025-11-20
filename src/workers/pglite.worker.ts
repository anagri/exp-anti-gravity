import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { v4 as uuidv4 } from 'uuid'
import * as Comlink from 'comlink'

let db: PGlite | null = null

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

  const result = await db.query<Document>(
    'SELECT * FROM documents ORDER BY uploaded_at DESC'
  )

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

const api = {
  init,
  uploadDocument,
  getDocuments,
  deleteDocument,
}

Comlink.expose(api)

export type PGliteWorkerAPI = typeof api
