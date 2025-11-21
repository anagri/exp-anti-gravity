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
import { Tiktoken, encodingForModel, getEncoding } from 'js-tiktoken'
import lunr from 'lunr'
import { isFeatureEnabled, FEATURES, getSearchSetting, getOpenAIConfig } from '@/lib/feature-flags'
import { useApiKey } from './ApiKeyContext'

// Global instance to prevent re-initialization in React StrictMode
let dbGlobal: PGlite | undefined
let isInitializing = false // Prevent concurrent initialization in StrictMode

// Global state
let indexingEnabled = true
let isProcessing = false
let openaiClient: OpenAI | null = null
let tokenizer: Tiktoken | null = null
let lunrIndex: lunr.Index | null = null

interface KnowledgeBase {
  // Metadata
  id: string // UUID
  name: string // unique, 1-50 chars
  description: string | null // optional, max 500 chars
  color: string | null // optional, hex code #RRGGBB
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp

  // Vector Configuration
  embedding_model: string // e.g., 'text-embedding-3-small'
  embedding_dimensions: number // e.g., 768

  // Hybrid Search Configuration
  vector_top_k: number // 1-20, default 3
  similarity_threshold: number // 0-1, default 0.3
  bm25_limit: number // 1-50, default 10
  hnsw_m: number // 4-64, default 16
  hnsw_ef_construction: number // 16-256, default 64
  rrf_k: number // default 0.6

  // Computed Stats
  document_count: number // computed, may be 0
  chunk_count: number // computed from kb_{id}_chunks table
}

interface KnowledgeBaseConfig {
  // Vector Config
  embedding_model?: string
  embedding_dimensions?: number

  // Search Config
  vector_top_k?: number
  similarity_threshold?: number
  bm25_limit?: number
  hnsw_m?: number
  hnsw_ef_construction?: number
  rrf_k?: number
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
  knowledge_base_id: string | null

  // Joined KB Fields (from LEFT JOIN knowledge_bases)
  kb_name: string | null
  kb_color: string | null
  kb_embedding_model: string | null
  kb_embedding_dimensions: number | null
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
  similarity?: number
  score?: number
  vectorScore?: number
  bm25Score?: number
  fusedScore?: number
  vectorRank?: number
  bm25Rank?: number
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
  knowledgeBases: KnowledgeBase[]
  uploadFiles: (files: File[]) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  refreshDocuments: () => Promise<void>
  indexingProgress: Map<string, IndexingProgress>
  retryFailed: (documentId: string) => Promise<void>
  retryInitialization: () => Promise<void>
  searchVectors: (query: string, documentIds: string[]) => Promise<SearchResult[]>
  searchBM25: (query: string, limit?: number) => Promise<SearchResult[]>
  searchHybrid: (query: string, documentIds: string[]) => Promise<SearchResult[]>
  lunrReady: boolean
  // KB Management
  createKnowledgeBase: (params: {
    name: string
    description?: string
    color?: string
    config?: KnowledgeBaseConfig
  }) => Promise<KnowledgeBase>
  updateKnowledgeBase: (
    id: string,
    updates: {
      name?: string
      description?: string | null
      color?: string | null
      config?: KnowledgeBaseConfig
    }
  ) => Promise<{ requiresReindex: boolean; affectedDocCount?: number }>
  deleteKnowledgeBase: (id: string) => Promise<void>
  refreshKnowledgeBases: () => Promise<void>
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
    const embeddingModel = getOpenAIConfig('EMBEDDING_MODEL') as any
    try {
      tokenizer = encodingForModel(embeddingModel)
    } catch (error) {
      // Fallback to cl100k_base (used by GPT-4/GPT-3.5) for unknown models
      // This is common when using local LLM servers (llama.cpp, etc.)
      console.warn(
        `[VectorDB] Unknown model "${embeddingModel}" for tiktoken, using cl100k_base encoding. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
      tokenizer = getEncoding('cl100k_base')
    }
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

    const embeddingModel = getOpenAIConfig('EMBEDDING_MODEL')
    const response = await openaiClient.embeddings.create({
      model: embeddingModel,
      input: batchChunks.map(c => c.content),
      dimensions: 768,
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
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [indexingProgress, setIndexingProgress] = useState<Map<string, IndexingProgress>>(new Map())
  const [lunrReadyState, setLunrReadyState] = useState(false)

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
    // Prevent concurrent initialization attempts (StrictMode double-mount)
    if (isInitializing || dbGlobal) {
      if (import.meta.env.DEV) {
        console.log('[VectorDB] Skipping initialization - already initialized or in progress')
      }
      if (dbGlobal) {
        setInitialized(true)
      }
      return
    }

    isInitializing = true
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

        // Create knowledge_bases table
        const defaultVectorTopK = getSearchSetting('VECTOR_TOP_K')
        const defaultSimilarityThreshold = getSearchSetting('SIMILARITY_THRESHOLD')
        const defaultBm25Limit = getSearchSetting('BM25_LIMIT')
        const defaultHnswM = getSearchSetting('HNSW_M')
        const defaultHnswEfConstruction = getSearchSetting('HNSW_EF_CONSTRUCTION')
        const defaultRrfK = getSearchSetting('RRF_K')

        await db.exec(`
          CREATE TABLE IF NOT EXISTS knowledge_bases (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL UNIQUE CHECK (length(name) <= 50 AND length(trim(name)) > 0),
            description TEXT CHECK (description IS NULL OR length(description) <= 500),
            color TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
            embedding_dimensions INTEGER NOT NULL DEFAULT 768,
            vector_top_k INTEGER NOT NULL DEFAULT ${defaultVectorTopK},
            similarity_threshold REAL NOT NULL DEFAULT ${defaultSimilarityThreshold},
            bm25_limit INTEGER NOT NULL DEFAULT ${defaultBm25Limit},
            hnsw_m INTEGER NOT NULL DEFAULT ${defaultHnswM},
            hnsw_ef_construction INTEGER NOT NULL DEFAULT ${defaultHnswEfConstruction},
            rrf_k REAL NOT NULL DEFAULT ${defaultRrfK}
          );

          CREATE INDEX IF NOT EXISTS idx_knowledge_bases_name ON knowledge_bases(name);
        `)

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

        // Add knowledge_base_id FK to documents table
        await db.exec(`
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE;

          CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base_id ON documents(knowledge_base_id);
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
            embedding vector(768),
            token_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (document_id, chunk_index)
          );

          CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
        `)

        // Create HNSW index using settings
        const hnswM = getSearchSetting('HNSW_M')
        const hnswEfConstruction = getSearchSetting('HNSW_EF_CONSTRUCTION')
        await db.exec(`
          CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
          ON chunks
          USING hnsw (embedding vector_cosine_ops)
          WITH (m = ${hnswM}, ef_construction = ${hnswEfConstruction});
        `)

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Database initialized with all tables and HNSW index')
        }

        // Initialize indexing state
        indexingEnabled = isFeatureEnabled(FEATURES.INDEXING_ENABLED)

        // Initialize OpenAI client
        if (apiKey) {
          const baseURL = getOpenAIConfig('BASE_URL');
          openaiClient = new OpenAI({
            apiKey,
            baseURL: baseURL || undefined,
            dangerouslyAllowBrowser: true,
          })
        }

        // Build Lunr index if chunks exist
        const chunkCountResult = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM chunks')
        const chunkCount = parseInt(chunkCountResult.rows[0]?.count?.toString() || '0')
        if (chunkCount > 0) {
          await buildLunrIndex()
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

        isInitializing = false // Reset flag on success
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
          isInitializing = false // Reset flag on failure
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
    // Reset global instance and flag to force fresh initialization
    dbGlobal = undefined
    isInitializing = false
    await initializeDatabase()
  }

  // Helper method for creating KB-specific chunks tables
  const createKBChunksTable = async (
    kbId: string,
    dimensions: number,
    hnswM: number,
    hnswEfConstruction: number
  ) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    const tableName = `kb_${kbId.replace(/-/g, '_')}_chunks`

    // Create chunks table for this KB
    await dbGlobal.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY,
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        heading TEXT,
        embedding vector(${dimensions}),
        token_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (document_id, chunk_index)
      );

      CREATE INDEX IF NOT EXISTS idx_${tableName}_document ON ${tableName}(document_id);
    `)

    // Create HNSW index with KB-specific parameters
    await dbGlobal.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding_hnsw
      ON ${tableName}
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = ${hnswM}, ef_construction = ${hnswEfConstruction});
    `)

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Created chunks table for KB ${kbId}: ${tableName} (dimensions: ${dimensions}, hnsw_m: ${hnswM}, hnsw_ef: ${hnswEfConstruction})`)
    }
  }

  const refreshKnowledgeBases = async () => {
    if (!dbGlobal) return

    try {
      const result = await dbGlobal.query<KnowledgeBase>(`
        SELECT
          kb.id,
          kb.name,
          kb.description,
          kb.color,
          kb.created_at,
          kb.updated_at,
          kb.embedding_model,
          kb.embedding_dimensions,
          kb.vector_top_k,
          kb.similarity_threshold,
          kb.bm25_limit,
          kb.hnsw_m,
          kb.hnsw_ef_construction,
          kb.rrf_k,
          COUNT(DISTINCT d.id)::integer as document_count
        FROM knowledge_bases kb
        LEFT JOIN documents d ON d.knowledge_base_id = kb.id
        GROUP BY kb.id
        ORDER BY kb.created_at DESC
      `)

      // Compute chunk counts for each KB
      const kbsWithChunkCounts = await Promise.all(
        result.rows.map(async (kb) => {
          const tableName = `kb_${kb.id.replace(/-/g, '_')}_chunks`
          try {
            const chunkResult = await dbGlobal!.query<{ count: number }>(`SELECT COUNT(*)::integer as count FROM ${tableName}`)
            const chunkCount = chunkResult.rows[0]?.count || 0
            return { ...kb, chunk_count: chunkCount }
          } catch {
            // Table doesn't exist yet, return 0
            return { ...kb, chunk_count: 0 }
          }
        })
      )

      setKnowledgeBases(kbsWithChunkCounts)
    } catch (error) {
      console.error('[VectorDB] Error refreshing knowledge bases:', error)
    }
  }

  const createKnowledgeBase = async (params: {
    name: string
    description?: string
    color?: string
    config?: KnowledgeBaseConfig
  }): Promise<KnowledgeBase> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    // Validate name
    const trimmedName = params.name.trim()
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Name must be between 1 and 50 characters')
    }

    // Check for duplicate name
    const existing = await dbGlobal.query<{ count: number }>(
      'SELECT COUNT(*)::integer as count FROM knowledge_bases WHERE name = $1',
      [trimmedName]
    )
    if ((existing.rows[0]?.count || 0) > 0) {
      throw new Error('A knowledge base with this name already exists')
    }

    // Get defaults from global settings
    const config = params.config || {}
    const embeddingModel = config.embedding_model || 'text-embedding-3-small'
    const embeddingDimensions = config.embedding_dimensions || 768
    const vectorTopK = config.vector_top_k ?? getSearchSetting('VECTOR_TOP_K')
    const similarityThreshold = config.similarity_threshold ?? getSearchSetting('SIMILARITY_THRESHOLD')
    const bm25Limit = config.bm25_limit ?? getSearchSetting('BM25_LIMIT')
    const hnswM = config.hnsw_m ?? getSearchSetting('HNSW_M')
    const hnswEfConstruction = config.hnsw_ef_construction ?? getSearchSetting('HNSW_EF_CONSTRUCTION')
    const rrfK = config.rrf_k ?? getSearchSetting('RRF_K')

    const kbId = uuidv4()

    // Insert KB record
    await dbGlobal.exec(`
      INSERT INTO knowledge_bases (
        id, name, description, color,
        embedding_model, embedding_dimensions,
        vector_top_k, similarity_threshold, bm25_limit,
        hnsw_m, hnsw_ef_construction, rrf_k
      ) VALUES (
        '${kbId}', '${trimmedName.replace(/'/g, "''")}',
        ${params.description ? `'${params.description.replace(/'/g, "''")}'` : 'NULL'},
        ${params.color ? `'${params.color}'` : 'NULL'},
        '${embeddingModel}', ${embeddingDimensions},
        ${vectorTopK}, ${similarityThreshold}, ${bm25Limit},
        ${hnswM}, ${hnswEfConstruction}, ${rrfK}
      )
    `)

    // Create KB-specific chunks table
    await createKBChunksTable(kbId, embeddingDimensions, hnswM, hnswEfConstruction)

    // Refresh KB list
    await refreshKnowledgeBases()

    const newKB = knowledgeBases.find(kb => kb.id === kbId)
    if (!newKB) {
      throw new Error('Failed to create knowledge base')
    }

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Created knowledge base: ${trimmedName} (${kbId})`)
    }

    return newKB
  }

  const updateKnowledgeBase = async (
    id: string,
    updates: {
      name?: string
      description?: string | null
      color?: string | null
      config?: KnowledgeBaseConfig
    }
  ): Promise<{ requiresReindex: boolean; affectedDocCount?: number }> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    // Get current KB
    const currentResult = await dbGlobal.query<KnowledgeBase>(
      'SELECT * FROM knowledge_bases WHERE id = $1',
      [id]
    )
    const current = currentResult.rows[0]
    if (!current) {
      throw new Error('Knowledge base not found')
    }

    // Validate name if provided
    if (updates.name) {
      const trimmedName = updates.name.trim()
      if (!trimmedName || trimmedName.length > 50) {
        throw new Error('Name must be between 1 and 50 characters')
      }

      // Check for duplicate name (excluding current KB)
      const existing = await dbGlobal.query<{ count: number }>(
        'SELECT COUNT(*)::integer as count FROM knowledge_bases WHERE name = $1 AND id != $2',
        [trimmedName, id]
      )
      if ((existing.rows[0]?.count || 0) > 0) {
        throw new Error('A knowledge base with this name already exists')
      }
    }

    // Detect if re-index is required
    const config = updates.config || {}
    const requiresReindex =
      (config.embedding_model && config.embedding_model !== current.embedding_model) ||
      (config.embedding_dimensions && config.embedding_dimensions !== current.embedding_dimensions) ||
      (config.hnsw_m && config.hnsw_m !== current.hnsw_m) ||
      (config.hnsw_ef_construction && config.hnsw_ef_construction !== current.hnsw_ef_construction)

    if (requiresReindex) {
      // Get affected document count
      const docResult = await dbGlobal.query<{ count: number }>(
        'SELECT COUNT(*)::integer as count FROM documents WHERE knowledge_base_id = $1',
        [id]
      )
      return { requiresReindex: true, affectedDocCount: docResult.rows[0]?.count || 0 }
    }

    // Build UPDATE statement
    const setClauses: string[] = []
    if (updates.name) setClauses.push(`name = '${updates.name.trim().replace(/'/g, "''")}'`)
    if (updates.description !== undefined) {
      setClauses.push(updates.description ? `description = '${updates.description.replace(/'/g, "''")}'` : 'description = NULL')
    }
    if (updates.color !== undefined) {
      setClauses.push(updates.color ? `color = '${updates.color}'` : 'color = NULL')
    }
    if (config.vector_top_k !== undefined) setClauses.push(`vector_top_k = ${config.vector_top_k}`)
    if (config.similarity_threshold !== undefined) setClauses.push(`similarity_threshold = ${config.similarity_threshold}`)
    if (config.bm25_limit !== undefined) setClauses.push(`bm25_limit = ${config.bm25_limit}`)
    if (config.rrf_k !== undefined) setClauses.push(`rrf_k = ${config.rrf_k}`)

    setClauses.push('updated_at = CURRENT_TIMESTAMP')

    if (setClauses.length > 0) {
      await dbGlobal.exec(`
        UPDATE knowledge_bases
        SET ${setClauses.join(', ')}
        WHERE id = '${id}'
      `)
    }

    await refreshKnowledgeBases()

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Updated knowledge base: ${id}`)
    }

    return { requiresReindex: false }
  }

  const deleteKnowledgeBase = async (id: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    // Delete KB (CASCADE will delete documents and indexing_queue entries)
    await dbGlobal.exec(`DELETE FROM knowledge_bases WHERE id = '${id}'`)

    // Drop KB-specific chunks table
    const tableName = `kb_${id.replace(/-/g, '_')}_chunks`
    try {
      await dbGlobal.exec(`DROP TABLE IF EXISTS ${tableName}`)
    } catch (error) {
      console.error(`[VectorDB] Error dropping chunks table ${tableName}:`, error)
    }

    await refreshKnowledgeBases()
    await refreshDocuments()

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Deleted knowledge base: ${id}`)
    }
  }

  useEffect(() => {
    initializeDatabase()
  }, [])

  // Sync API key to OpenAI client
  useEffect(() => {
    if (apiKey) {
      const baseURL = getOpenAIConfig('BASE_URL');
      openaiClient = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
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

  // Listen for search setting changes
  useEffect(() => {
    const handleSettingChange = (event: Event) => {
      const customEvent = event as CustomEvent
      const { setting, value } = customEvent.detail

      if (import.meta.env.DEV) {
        console.log(`[VectorDB] Search setting changed: ${setting} = ${value}`)
      }

      // HNSW index parameters require index rebuild (not implemented in this phase)
      if (setting === 'HNSW_M' || setting === 'HNSW_EF_CONSTRUCTION') {
        console.warn(
          '[VectorDB] HNSW index parameters changed. Index rebuild required but not automated. ' +
          'Please reload the page and re-index documents for changes to take effect.'
        )
      }

      // Other settings (topK, threshold, BM25 limit) apply immediately on next search
    }

    window.addEventListener('searchSettingChanged', handleSettingChange)
    return () => window.removeEventListener('searchSettingChanged', handleSettingChange)
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

      // Rebuild Lunr index after adding new chunks
      await buildLunrIndex()

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

  const buildLunrIndex = async () => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    if (import.meta.env.DEV) {
      console.log('[VectorDB] Building Lunr index...')
    }

    setLunrReadyState(false)

    const result = await dbGlobal.query<{
      id: string
      content: string
      heading: string | null
      document_id: string
    }>(`
      SELECT id, content, heading, document_id
      FROM chunks
      WHERE content IS NOT NULL
      ORDER BY document_id, chunk_index
    `)

    lunrIndex = lunr(function() {
      this.ref('id')
      this.field('content')
      this.field('heading')

      result.rows.forEach(chunk => {
        this.add({
          id: chunk.id,
          content: chunk.content,
          heading: chunk.heading || ''
        })
      })
    })

    setLunrReadyState(true)

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Lunr index built with ${result.rows.length} chunks`)
    }
  }

  const retryFailed = async (documentId: string) => {
    console.log('[VectorDB] Retry indexing for document:', documentId)
  }

  const searchBM25 = async (query: string, limit?: number): Promise<SearchResult[]> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    if (!lunrIndex) {
      await buildLunrIndex()
    }

    if (!lunrIndex) {
      return []
    }

    const resultLimit = limit || getSearchSetting('BM25_LIMIT')

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] BM25 search for: "${query}"`)
    }

    const lunrResults = lunrIndex.search(query)

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Lunr returned ${lunrResults.length} results`)
    }

    const chunkIds = lunrResults.slice(0, resultLimit).map(r => r.ref)

    if (chunkIds.length === 0) {
      return []
    }

    const result = await dbGlobal.query<{
      id: string
      document_id: string
      content: string
      heading: string | null
      chunk_index: number
      filename: string
    }>(`
      SELECT
        c.id,
        c.document_id,
        c.content,
        c.heading,
        c.chunk_index,
        d.filename
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.id = ANY($1::uuid[])
    `, [chunkIds])

    const scoreMap = new Map(lunrResults.map(r => [r.ref, r.score]))
    const resultsMap = new Map(result.rows.map(row => [row.id, row]))

    const results: SearchResult[] = chunkIds
      .map(chunkId => {
        const row = resultsMap.get(chunkId)
        if (!row) return null

        return {
          chunkId: row.id,
          documentId: row.document_id,
          filename: row.filename,
          content: row.content,
          heading: row.heading,
          chunkIndex: row.chunk_index,
          score: scoreMap.get(chunkId) || 0
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    return results
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

    const topK = getSearchSetting('VECTOR_TOP_K')
    const similarityThreshold = getSearchSetting('SIMILARITY_THRESHOLD')

    const embeddingModel = getOpenAIConfig('EMBEDDING_MODEL')
    const embeddingResponse = await openaiClient.embeddings.create({
      model: embeddingModel,
      input: query,
      dimensions: 768,
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

  const searchHybrid = async (query: string, documentIds: string[]): Promise<SearchResult[]> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized')
    }

    if (!openaiClient) {
      throw new Error('OpenAI client not initialized. Set API key in settings.')
    }

    // Get search settings
    const topK = getSearchSetting('VECTOR_TOP_K')
    const similarityThreshold = getSearchSetting('SIMILARITY_THRESHOLD')
    const bm25Limit = getSearchSetting('BM25_LIMIT')
    const rrfK = getSearchSetting('RRF_K')

    if (import.meta.env.DEV) {
      console.log('[VectorDB] Hybrid search:', { query, topK, similarityThreshold, bm25Limit, rrfK })
    }

    // Execute both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      searchVectors(query, documentIds),
      searchBM25(query, bm25Limit)
    ])

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Hybrid search: ${vectorResults.length} vector results, ${bm25Results.length} BM25 results`)
    }

    // Build rank maps (1-based ranking)
    const vectorRankMap = new Map<string, number>()
    vectorResults.forEach((result, index) => {
      vectorRankMap.set(result.chunkId, index + 1)
    })

    const bm25RankMap = new Map<string, number>()
    bm25Results.forEach((result, index) => {
      bm25RankMap.set(result.chunkId, index + 1)
    })

    // Collect all unique chunk IDs
    const allChunkIds = new Set<string>([
      ...vectorResults.map(r => r.chunkId),
      ...bm25Results.map(r => r.chunkId)
    ])

    // Build result map for easy lookup
    const resultMap = new Map<string, SearchResult>()
    vectorResults.forEach(r => resultMap.set(r.chunkId, r))
    bm25Results.forEach(r => {
      if (!resultMap.has(r.chunkId)) {
        resultMap.set(r.chunkId, r)
      }
    })

    // Calculate RRF scores for all chunks
    const fusedResults: SearchResult[] = []

    allChunkIds.forEach(chunkId => {
      const vectorRank = vectorRankMap.get(chunkId)
      const bm25Rank = bm25RankMap.get(chunkId)

      // RRF formula: score = 1/(k + rank)
      const vectorScore = vectorRank ? 1 / (rrfK + vectorRank) : 0
      const bm25Score = bm25Rank ? 1 / (rrfK + bm25Rank) : 0
      const fusedScore = vectorScore + bm25Score

      const baseResult = resultMap.get(chunkId)!

      fusedResults.push({
        ...baseResult,
        vectorScore,
        bm25Score,
        fusedScore,
        vectorRank,
        bm25Rank
      })
    })

    // Sort by fused score (descending)
    fusedResults.sort((a, b) => (b.fusedScore || 0) - (a.fusedScore || 0))

    // Limit to topK results
    const finalResults = fusedResults.slice(0, topK)

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Hybrid search returned ${finalResults.length} fused results`)
    }

    return finalResults
  }

  return (
    <VectorDBContext.Provider
      value={{
        initialized,
        initError,
        documents,
        knowledgeBases,
        uploadFiles,
        deleteDocument,
        refreshDocuments,
        indexingProgress,
        retryFailed,
        retryInitialization,
        searchVectors,
        searchBM25,
        searchHybrid,
        lunrReady: lunrReadyState,
        createKnowledgeBase,
        updateKnowledgeBase,
        deleteKnowledgeBase,
        refreshKnowledgeBases,
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
