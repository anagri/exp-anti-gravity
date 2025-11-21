import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { Tiktoken, encodingForModel } from 'js-tiktoken'
import { isFeatureEnabled, FEATURES } from '@/lib/feature-flags'
import { useApiKey } from './ApiKeyContext'

// Global instance to prevent re-initialization in React StrictMode
let dbGlobal: PGlite | undefined

// Global state
let indexingEnabled = true
let isProcessing = false
let openaiClient: OpenAI | null = null
let tokenizer: Tiktoken | null = null

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
  progress: number
  stage: string
  message: string
  chunkCount?: number
  errorMessage?: string
  retryCount?: number
}

interface SearchResult {
  chunkId: string
  documentId: string
  filename: string
  heading: string | null
  content: string
  chunkIndex: number
  similarity: number
}

interface IndexingJob {
  id: string
  document_id: string
  status: string
  error_message: string | null
  retry_count: number
  max_retries: number
}

interface VectorDBContextType {
  initialized: boolean
  initError: { message: string; canRetry: boolean } | null
  documents: Document[]
  uploadFiles: (files: File[]) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  refreshDocuments: () => Promise<void>
  indexingProgress: Map<string, IndexingProgress>
  retryFailed: (documentId: string) => Promise<void>
  retryInitialization: () => Promise<void>
  searchVectors: (query: string, documentIds: string[]) => Promise<SearchResult[]>
}

const VectorDBContext = createContext<VectorDBContextType | undefined>(
  undefined
)

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function initializeTokenizer(): void {
  if (!tokenizer) {
    tokenizer = encodingForModel('text-embedding-3-small')
  }
}

function countTokens(text: string): number {
  if (!tokenizer) {
    initializeTokenizer()
  }
  return tokenizer!.encode(text).length
}

function extractHeading(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m)
  return match ? match[1] : undefined
}

function splitOversizedParagraph(paragraph: string, maxTokens: number): string[] {
  const tokens = tokenizer!.encode(paragraph)
  const pieces: string[] = []

  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens)
    const chunkText = tokenizer!.decode(chunkTokens)
    pieces.push(chunkText)
  }

  return pieces
}

function chunkDocument(content: string): Array<{ content: string, heading?: string }> {
  const MAX_CHUNK_TOKENS = 2000
  const MAX_OVERLAP_TOKENS = 200

  initializeTokenizer()

  const paragraphs = content.split(/\n\n+/)
  const chunks: Array<{ content: string, heading?: string }> = []
  let currentChunk = ''
  let currentTokens = 0

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim()
    if (!trimmedParagraph) continue

    const paragraphTokens = countTokens(trimmedParagraph)

    if (paragraphTokens > MAX_CHUNK_TOKENS) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          heading: extractHeading(currentChunk),
        })
        currentChunk = ''
        currentTokens = 0
      }

      const pieces = splitOversizedParagraph(trimmedParagraph, MAX_CHUNK_TOKENS)
      for (const piece of pieces) {
        chunks.push({
          content: piece,
          heading: extractHeading(piece),
        })
      }

      continue
    }

    const separatorTokens = currentChunk ? countTokens('\n\n') : 0

    if (currentTokens + paragraphTokens + separatorTokens > MAX_CHUNK_TOKENS) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          heading: extractHeading(currentChunk),
        })

        const words = currentChunk.split(/\s+/)
        let overlapText = ''
        let overlapTokens = 0

        for (let i = words.length - 1; i >= 0 && overlapTokens < MAX_OVERLAP_TOKENS; i--) {
          const word = words[i]
          const testOverlap = word + (overlapText ? ' ' : '') + overlapText
          const testTokens = countTokens(testOverlap)
          if (testTokens > MAX_OVERLAP_TOKENS) break
          overlapText = testOverlap
          overlapTokens = testTokens
        }

        currentChunk = overlapText ? overlapText + '\n\n' : ''
        currentTokens = overlapTokens + (overlapText ? separatorTokens : 0)
      }
    }

    currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph
    currentTokens = countTokens(currentChunk)
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      heading: extractHeading(currentChunk),
    })
  }

  if (chunks.length === 0 && content.trim()) {
    const tokens = tokenizer!.encode(content)
    const chunkTokens = tokens.slice(0, MAX_CHUNK_TOKENS)
    const chunkContent = tokenizer!.decode(chunkTokens)
    return [{ content: chunkContent, heading: extractHeading(chunkContent) }]
  }

  return chunks
}

async function generateEmbeddings(
  chunks: Array<{ content: string, heading?: string }>,
  onBatchProgress: (current: number, total: number) => void
): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Set API key in application settings.')
  }

  const MAX_EMBEDDING_TOKENS = 8191
  const WARN_THRESHOLD = 5000

  initializeTokenizer()

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const tokenCount = countTokens(chunk.content)

    if (tokenCount > MAX_EMBEDDING_TOKENS) {
      throw new Error(
        `Chunk ${i} exceeds token limit: ${tokenCount} tokens (max: ${MAX_EMBEDDING_TOKENS}). ` +
        `Chunk preview: ${chunk.content.substring(0, 100)}...`
      )
    }

    if (tokenCount > WARN_THRESHOLD && import.meta.env.DEV) {
      console.warn(
        `[VectorDB] Large chunk detected: ${tokenCount} tokens (chunk ${i}/${chunks.length})`
      )
    }
  }

  const BATCH_SIZE = 50
  const allEmbeddings: number[][] = []
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, chunks.length)
    const batchChunks = chunks.slice(start, end)

    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: batchChunks.map(c => c.content),
      dimensions: 1536,
    })

    const batchEmbeddings = response.data.map(item => item.embedding)
    allEmbeddings.push(...batchEmbeddings)

    onBatchProgress(batchIndex + 1, totalBatches)
  }

  if (import.meta.env.DEV) {
    const avgTokens = chunks.reduce((sum, c) => sum + countTokens(c.content), 0) / chunks.length
    const maxTokens = Math.max(...chunks.map(c => countTokens(c.content)))
    console.log(
      `[VectorDB] Embedding stats: ${chunks.length} chunks, ` +
      `avg: ${Math.round(avgTokens)} tokens, max: ${maxTokens} tokens`
    )
  }

  return allEmbeddings
}

export function VectorDBProvider({ children }: { children: ReactNode }) {
  const { apiKey } = useApiKey()
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<{ message: string; canRetry: boolean } | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [indexingProgress, setIndexingProgress] = useState<Map<string, IndexingProgress>>(new Map())

  const emitProgress = (
    documentId: string,
    status: IndexingProgress['status'],
    progress: number,
    stage: string,
    message: string
  ) => {
    const progressData: IndexingProgress = {
      documentId,
      status,
      progress,
      stage,
      message,
    }

    setIndexingProgress(prev => new Map(prev).set(documentId, progressData))

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] ${documentId}: ${status} ${progress}% - ${message}`)
    }
  }

  const initializeDatabase = async () => {
    const MAX_RETRIES = 3
    let retryCount = 0

    while (retryCount < MAX_RETRIES) {
      try {
        // Use global instance pattern to prevent re-initialization in StrictMode
        dbGlobal ??= await PGlite.create({
          dataDir: 'idb://rag-vectors',
          extensions: { vector },
        })

        const db = dbGlobal

        // Enable pgvector extension
        await db.query('CREATE EXTENSION IF NOT EXISTS vector')

        // Create documents table
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

        // Extend documents table with indexing fields
        await db.exec(`
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
        `)

        // Create indexing_queue table
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

        // Create chunks table
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

        // Create HNSW index
        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
          ON chunks
          USING hnsw (embedding vector_cosine_ops)
          WITH (m = 16, ef_construction = 64);
        `)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Database initialized with all tables and HNSW index')
        }

        // Initialize indexing state
        indexingEnabled = isFeatureEnabled(FEATURES.INDEXING_ENABLED)

        // Initialize OpenAI client
        if (apiKey) {
          openaiClient = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
          })
        }

        // Start queue processor
        processQueue()
        setInterval(() => processQueue(), 2000)

        await refreshDocuments()
        setInitialized(true)
        setInitError(null)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Context initialized, indexing enabled:', indexingEnabled)
        }

        break // Success - exit retry loop
      } catch (error) {
        retryCount++
        console.error(`[VectorDB] Initialization error (attempt ${retryCount}/${MAX_RETRIES}):`, error)

        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('magic word')) {
          console.error('[VectorDB] WebAssembly compilation error detected. Try:')
          console.error('  - Clear browser cache, hard reload (Cmd+Shift+R)')
          console.error('  - Clear IndexedDB storage (DevTools > Application > Storage)')
        }

        if (retryCount >= MAX_RETRIES) {
          setInitError({
            message: `Failed to initialize database after ${MAX_RETRIES} attempts: ${errorMessage}`,
            canRetry: true,
          })
          console.error('[VectorDB] Failed to initialize after max retries.')
        } else {
          console.log(`[VectorDB] Retrying initialization in ${retryCount}s...`)
          await sleep(retryCount * 1000)
        }
      }
    }
  }

  const retryInitialization = async () => {
    setInitError(null)
    setInitialized(false)
    // Reset global instance to force fresh initialization
    dbGlobal = undefined
    await initializeDatabase()
  }

  useEffect(() => {
    initializeDatabase()
  }, [])

  // Sync API key to OpenAI client
  useEffect(() => {
    if (apiKey) {
      openaiClient = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      })
    } else {
      openaiClient = null
    }

    if (import.meta.env.DEV) {
      console.log('[VectorDB] OpenAI client', apiKey ? 'initialized' : 'cleared')
    }
  }, [apiKey])

  // Listen for feature flag changes
  useEffect(() => {
    const handleFlagChange = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail.flag === 'FEATURE_INDEXING_ENABLED') {
        indexingEnabled = customEvent.detail.enabled

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Indexing enabled changed to:', customEvent.detail.enabled)
        }
      }
    }

    window.addEventListener('featureFlagChanged', handleFlagChange)
    return () => window.removeEventListener('featureFlagChanged', handleFlagChange)
  }, [])

  const refreshDocuments = async () => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    try {
      const result = await dbGlobal.query<Document>(`
        SELECT
          d.*,
          iq.status as indexing_status,
          iq.error_message,
          iq.retry_count
        FROM documents d
        LEFT JOIN indexing_queue iq ON d.id = iq.document_id
        ORDER BY d.uploaded_at DESC
      `)

      setDocuments(result.rows)

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Retrieved documents:', result.rows.length)
      }
    } catch (error) {
      console.error('[VectorDB] Error refreshing documents:', error)
      throw error
    }
  }

  const uploadFiles = async (files: File[]) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    try {
      const validFiles = files.filter(
        (file) => file.name.endsWith('.md') || file.name.endsWith('.txt')
      )

      if (validFiles.length === 0) {
        console.log('[VectorDB] No valid files to upload')
        return
      }

      for (const file of validFiles) {
        const content = await file.text()
        const mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain'
        const id = uuidv4()
        const fileSize = new Blob([content]).size

        await dbGlobal.query(
          `INSERT INTO documents (id, filename, content, file_size, mime_type)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, file.name, content, fileSize, mimeType]
        )

        if (indexingEnabled) {
          await dbGlobal.query(
            `INSERT INTO indexing_queue (id, document_id, status)
             VALUES ($1, $2, 'pending')`,
            [uuidv4(), id]
          )

          if (import.meta.env.DEV) {
            console.log('[VectorDB] Indexing queue entry created for:', id)
          }
        }

        if (import.meta.env.DEV) {
          console.log('[VectorDB] File uploaded:', file.name)
        }
      }

      await refreshDocuments()
      processQueue() // Trigger immediate processing
    } catch (error) {
      console.error('[VectorDB] Error uploading files:', error)
      throw error
    }
  }

  const deleteDocument = async (id: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    try {
      await dbGlobal.query('DELETE FROM documents WHERE id = $1', [id])

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Document deleted:', id)
      }

      await refreshDocuments()
    } catch (error) {
      console.error('[VectorDB] Error deleting document:', error)
      throw error
    }
  }

  const storeChunks = async (
    documentId: string,
    chunks: Array<{ content: string, heading?: string }>,
    embeddings: number[][]
  ) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    initializeTokenizer()

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]
      const tokenCount = countTokens(chunk.content)

      const embeddingStr = `[${embedding.join(',')}]`

      await dbGlobal.query(
        `INSERT INTO chunks (id, document_id, chunk_index, content, heading, embedding, token_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          documentId,
          i,
          chunk.content,
          chunk.heading,
          embeddingStr,
          tokenCount,
        ]
      )
    }

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Stored ${chunks.length} chunks with embeddings for document ${documentId}`)
    }
  }

  const processJob = async (job: IndexingJob) => {
    if (!dbGlobal) return

    const { id: jobId, document_id } = job

    try {
      await dbGlobal.query(
        `UPDATE indexing_queue
         SET status = 'processing', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      )

      emitProgress(document_id, 'processing', 0, 'chunking', 'Starting indexing...')

      const docResult = await dbGlobal.query<{ content: string }>(
        'SELECT content FROM documents WHERE id = $1',
        [document_id]
      )

      if (docResult.rows.length === 0) {
        throw new Error(`Document not found: ${document_id}`)
      }

      const document = docResult.rows[0]

      emitProgress(document_id, 'processing', 10, 'chunking', 'Splitting document into chunks...')
      const chunks = chunkDocument(document.content)
      emitProgress(document_id, 'processing', 30, 'chunking', `Created ${chunks.length} chunks`)

      emitProgress(document_id, 'processing', 30, 'embedding', 'Generating embeddings...')
      const embeddings = await generateEmbeddings(chunks, (current, total) => {
        const embeddingProgress = 30 + Math.floor((current / total) * 40)
        emitProgress(document_id, 'processing', embeddingProgress, 'embedding', `Processing batch ${current}/${total}`)
      })
      emitProgress(document_id, 'processing', 70, 'embedding', 'All embeddings generated')

      emitProgress(document_id, 'processing', 70, 'storing', 'Storing chunks...')
      await storeChunks(document_id, chunks, embeddings)
      emitProgress(document_id, 'processing', 100, 'storing', 'All chunks stored')

      await dbGlobal.query(
        `UPDATE indexing_queue
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      )

      await dbGlobal.query(
        `UPDATE documents
         SET chunk_count = $1, indexed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [chunks.length, document_id]
      )

      emitProgress(document_id, 'completed', 100, 'completed', 'Indexing completed successfully')

      await refreshDocuments()
    } catch (error) {
      console.error('[VectorDB] Job processing error:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)
      const maxRetries = job.max_retries
      const currentRetryCount = job.retry_count

      if (currentRetryCount < maxRetries) {
        await dbGlobal.query(
          `UPDATE indexing_queue
           SET status = 'pending', retry_count = $1, error_message = $2
           WHERE id = $3`,
          [currentRetryCount + 1, errorMessage, jobId]
        )

        emitProgress(
          document_id,
          'failed',
          0,
          'error',
          `Retry ${currentRetryCount + 1}/${maxRetries}: ${errorMessage}`
        )

        if (import.meta.env.DEV) {
          console.log(`[VectorDB] Job will retry (${currentRetryCount + 1}/${maxRetries})`)
        }
      } else {
        await dbGlobal.query(
          `UPDATE indexing_queue
           SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [errorMessage, jobId]
        )

        emitProgress(document_id, 'failed', 0, 'error', `Failed: ${errorMessage}`)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Job permanently failed after max retries')
        }
      }

      await refreshDocuments()
    }
  }

  const processQueue = async () => {
    if (isProcessing || !dbGlobal) {
      return
    }

    isProcessing = true

    try {
      while (true) {
        const result = await dbGlobal.query<IndexingJob>(`
          SELECT * FROM indexing_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
        `)

        if (result.rows.length === 0) break

        const job = result.rows[0]
        await processJob(job)

        await sleep(100)
      }
    } catch (error) {
      console.error('[VectorDB] Queue processing error:', error)
    } finally {
      isProcessing = false
    }
  }

  const retryFailed = async (documentId: string) => {
    console.log('[VectorDB] Retry indexing for document:', documentId)
  }

  const searchVectors = async (query: string, documentIds: string[]): Promise<SearchResult[]> => {
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized. Set API key in settings.')
    }

    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    if (!documentIds || documentIds.length === 0) {
      return []
    }

    const topK = 3
    const similarityThreshold = 0.3

    const embeddingResponse = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    })

    const queryEmbedding = embeddingResponse.data[0].embedding
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    const result = await dbGlobal.query<{
      chunk_id: string
      document_id: string
      filename: string
      heading: string | null
      content: string
      chunk_index: number
      similarity: number
    }>(
      `
      SELECT
        c.id as chunk_id,
        c.document_id,
        c.content,
        c.heading,
        c.chunk_index,
        d.filename,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.document_id = ANY($2::uuid[])
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $3
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $4
    `,
      [embeddingStr, documentIds, similarityThreshold, topK]
    )

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Vector search returned ${result.rows.length} results`)
    }

    return result.rows.map(row => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      filename: row.filename,
      heading: row.heading,
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: row.similarity,
    }))
  }

  return (
    <VectorDBContext.Provider
      value={{
        initialized,
        initError,
        documents,
        uploadFiles,
        deleteDocument,
        refreshDocuments,
        indexingProgress,
        retryFailed,
        retryInitialization,
        searchVectors,
      }}
    >
      {children}
    </VectorDBContext.Provider>
  )
}

export function useVectorDB() {
  const context = useContext(VectorDBContext)
  if (context === undefined) {
    throw new Error('useVectorDB must be used within a VectorDBProvider')
  }
  return context
}

export type { SearchResult }
