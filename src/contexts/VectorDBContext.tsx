import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { Tiktoken, getEncoding } from 'js-tiktoken';
import lunr from 'lunr';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { FEATURES, getOpenAIConfig, getSearchSetting, isFeatureEnabled } from '@/lib/feature-flags';
import { useApiKey } from './ApiKeyContext';

// Global instance to prevent re-initialization in React StrictMode
let dbGlobal: PGlite | undefined;
let isInitializing = false; // Prevent concurrent initialization in StrictMode

// Global state
let isProcessing = false;
let openaiClient: OpenAI | null = null;
let tokenizer: Tiktoken | null = null;
// Per-KB Lunr indexes: Map<kbId, lunr.Index>
const lunrIndexes = new Map<string, lunr.Index>();

interface KnowledgeBase {
  // Metadata
  id: string; // UUID
  name: string; // unique, 1-50 chars
  description: string | null; // optional, max 500 chars
  color: string | null; // optional, hex code #RRGGBB
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp

  // Vector Configuration
  embedding_model: string; // e.g., 'text-embedding-3-small'
  embedding_dimensions: number; // e.g., 768

  // Chunking Configuration
  chunk_max_tokens: number; // max tokens per chunk, default 2000
  chunk_overlap_tokens: number; // overlap between chunks, default 200

  // Hybrid Search Configuration
  vector_top_k: number; // 1-20, default 3
  similarity_threshold: number; // 0-1, default 0.3
  bm25_limit: number; // 1-50, default 10
  hnsw_m: number; // 4-64, default 16
  hnsw_ef_construction: number; // 16-256, default 64
  rrf_k: number; // default 0.6

  // Computed Stats
  document_count: number; // computed, may be 0
  chunk_count: number; // computed from kb_{id}_chunks table
}

interface KnowledgeBaseConfig {
  // Vector Config
  embedding_model?: string;
  embedding_dimensions?: number;

  // Chunking Config
  chunk_max_tokens?: number;
  chunk_overlap_tokens?: number;

  // Search Config
  vector_top_k?: number;
  similarity_threshold?: number;
  bm25_limit?: number;
  hnsw_m?: number;
  hnsw_ef_construction?: number;
  rrf_k?: number;
}

interface Document {
  id: string;
  filename: string;
  content: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  chunk_count: number | null;
  indexed_at: string | null;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  error_message: string | null;
  retry_count: number | null;
  knowledge_base_id: string | null;

  // Joined KB Fields (from LEFT JOIN knowledge_bases)
  kb_name: string | null;
  kb_color: string | null;
  kb_embedding_model: string | null;
  kb_embedding_dimensions: number | null;
}

interface IndexingProgress {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  message: string;
  chunkCount?: number;
  errorMessage?: string;
  retryCount?: number;
}

interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  heading: string | null;
  content: string;
  chunkIndex: number;
  similarity?: number;
  score?: number;
  vectorScore?: number;
  bm25Score?: number;
  fusedScore?: number;
  vectorRank?: number;
  bm25Rank?: number;
}

interface IndexingJob {
  id: string;
  document_id: string;
  status: string;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
}

interface VectorDBContextType {
  initialized: boolean;
  initError: { message: string; canRetry: boolean } | null;
  documents: Document[];
  knowledgeBases: KnowledgeBase[];
  uploadFiles: (files: File[], kbId: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
  indexingProgress: Map<string, IndexingProgress>;
  retryFailed: (documentId: string) => Promise<void>;
  retryInitialization: () => Promise<void>;
  searchVectors: (query: string, documentIds: string[]) => Promise<SearchResult[]>;
  searchBM25: (query: string, limit?: number, kbId?: string) => Promise<SearchResult[]>;
  searchHybrid: (query: string, documentIds: string[]) => Promise<SearchResult[]>;
  lunrReady: boolean;
  // KB Management
  createKnowledgeBase: (params: {
    name: string;
    description?: string;
    color?: string;
    config?: KnowledgeBaseConfig;
  }) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (
    id: string,
    updates: {
      name?: string;
      description?: string | null;
      color?: string | null;
      config?: KnowledgeBaseConfig;
    }
  ) => Promise<{ requiresReindex: boolean; affectedDocCount?: number }>;
  reindexKnowledgeBase: (id: string) => Promise<void>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
  refreshKnowledgeBases: () => Promise<void>;
}

const VectorDBContext = createContext<VectorDBContextType | undefined>(undefined);

// Helper functions
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initializeTokenizer(): void {
  if (!tokenizer) {
    // Use cl100k_base encoding (used by GPT-4/GPT-3.5)
    // This is a reasonable default for token estimation during chunking
    tokenizer = getEncoding('cl100k_base');
  }
}

function countTokens(text: string): number {
  if (!tokenizer) {
    initializeTokenizer();
  }
  return tokenizer!.encode(text).length;
}

function extractHeading(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m);
  return match ? match[1] : undefined;
}

function splitOversizedParagraph(paragraph: string, maxTokens: number): string[] {
  const tokens = tokenizer!.encode(paragraph);
  const pieces: string[] = [];

  for (let i = 0; i < tokens.length; i += maxTokens) {
    const chunkTokens = tokens.slice(i, i + maxTokens);
    const chunkText = tokenizer!.decode(chunkTokens);
    pieces.push(chunkText);
  }

  return pieces;
}

function chunkDocument(
  content: string,
  maxTokens: number,
  overlapTokens: number
): Array<{ content: string; heading?: string }> {
  initializeTokenizer();

  const paragraphs = content.split(/\n\n+/);
  const chunks: Array<{ content: string; heading?: string }> = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    const paragraphTokens = countTokens(trimmedParagraph);

    if (paragraphTokens > maxTokens) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          heading: extractHeading(currentChunk),
        });
        currentChunk = '';
        currentTokens = 0;
      }

      const pieces = splitOversizedParagraph(trimmedParagraph, maxTokens);
      for (const piece of pieces) {
        chunks.push({
          content: piece,
          heading: extractHeading(piece),
        });
      }

      continue;
    }

    const separatorTokens = currentChunk ? countTokens('\n\n') : 0;

    if (currentTokens + paragraphTokens + separatorTokens > maxTokens) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          heading: extractHeading(currentChunk),
        });

        const words = currentChunk.split(/\s+/);
        let overlapText = '';
        let currentOverlapTokens = 0;

        for (let i = words.length - 1; i >= 0 && currentOverlapTokens < overlapTokens; i--) {
          const word = words[i];
          const testOverlap = word + (overlapText ? ' ' : '') + overlapText;
          const testTokens = countTokens(testOverlap);
          if (testTokens > overlapTokens) break;
          overlapText = testOverlap;
          currentOverlapTokens = testTokens;
        }

        currentChunk = overlapText ? overlapText + '\n\n' : '';
        currentTokens = currentOverlapTokens + (overlapText ? separatorTokens : 0);
      }
    }

    currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    currentTokens = countTokens(currentChunk);
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      heading: extractHeading(currentChunk),
    });
  }

  if (chunks.length === 0 && content.trim()) {
    const tokens = tokenizer!.encode(content);
    const chunkTokens = tokens.slice(0, maxTokens);
    const chunkContent = tokenizer!.decode(chunkTokens);
    return [{ content: chunkContent, heading: extractHeading(chunkContent) }];
  }

  return chunks;
}

async function generateEmbeddings(
  chunks: Array<{ content: string; heading?: string }>,
  onBatchProgress: (current: number, total: number) => void,
  embeddingDimensions: number,
  embeddingModel: string
): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Set API key in application settings.');
  }

  const MAX_EMBEDDING_TOKENS = 8191;
  const WARN_THRESHOLD = 5000;

  initializeTokenizer();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokenCount = countTokens(chunk.content);

    if (tokenCount > MAX_EMBEDDING_TOKENS) {
      throw new Error(
        `Chunk ${i} exceeds token limit: ${tokenCount} tokens (max: ${MAX_EMBEDDING_TOKENS}). ` +
          `Chunk preview: ${chunk.content.substring(0, 100)}...`
      );
    }

    if (tokenCount > WARN_THRESHOLD && import.meta.env.DEV) {
      console.warn(
        `[VectorDB] Large chunk detected: ${tokenCount} tokens (chunk ${i}/${chunks.length})`
      );
    }
  }

  const BATCH_SIZE = 50;
  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, chunks.length);
    const batchChunks = chunks.slice(start, end);

    const response = await openaiClient.embeddings.create({
      model: embeddingModel,
      input: batchChunks.map((c) => c.content),
      dimensions: embeddingDimensions,
    });

    const batchEmbeddings = response.data.map((item) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);

    onBatchProgress(batchIndex + 1, totalBatches);
  }

  if (import.meta.env.DEV) {
    const avgTokens = chunks.reduce((sum, c) => sum + countTokens(c.content), 0) / chunks.length;
    const maxTokens = Math.max(...chunks.map((c) => countTokens(c.content)));
    console.log(
      `[VectorDB] Embedding stats: ${chunks.length} chunks, ` +
        `avg: ${Math.round(avgTokens)} tokens, max: ${maxTokens} tokens`
    );
  }

  return allEmbeddings;
}

export function VectorDBProvider({ children }: { children: ReactNode }) {
  const { apiKey } = useApiKey();
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [indexingProgress, setIndexingProgress] = useState<Map<string, IndexingProgress>>(
    new Map()
  );
  const [lunrReadyState, setLunrReadyState] = useState(false);

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
    };

    setIndexingProgress((prev) => new Map(prev).set(documentId, progressData));

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] ${documentId}: ${status} ${progress}% - ${message}`);
    }
  };

  const initializeDatabase = async () => {
    // Prevent concurrent initialization attempts (StrictMode double-mount)
    if (isInitializing || dbGlobal) {
      if (import.meta.env.DEV) {
        console.log('[VectorDB] Skipping initialization - already initialized or in progress');
      }
      if (dbGlobal) {
        setInitialized(true);
      }
      return;
    }

    isInitializing = true;
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        // Use global instance pattern to prevent re-initialization in StrictMode
        dbGlobal ??= await PGlite.create({
          dataDir: 'idb://rag-vectors',
          extensions: { vector },
        });

        const db = dbGlobal;

        // Enable pgvector extension
        await db.query('CREATE EXTENSION IF NOT EXISTS vector');

        // Create knowledge_bases table
        const defaultVectorTopK = getSearchSetting('VECTOR_TOP_K');
        const defaultSimilarityThreshold = getSearchSetting('SIMILARITY_THRESHOLD');
        const defaultBm25Limit = getSearchSetting('BM25_LIMIT');
        const defaultHnswM = 16; // HNSW M default (per-KB setting)
        const defaultHnswEfConstruction = 64; // HNSW ef_construction default (per-KB setting)
        const defaultRrfK = getSearchSetting('RRF_K');

        await db.exec(`
          CREATE TABLE IF NOT EXISTS knowledge_bases (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL UNIQUE CHECK (length(name) <= 50 AND length(trim(name)) > 0),
            description TEXT CHECK (description IS NULL OR length(description) <= 500),
            color TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
            embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
            chunk_max_tokens INTEGER NOT NULL DEFAULT 2000,
            chunk_overlap_tokens INTEGER NOT NULL DEFAULT 200,
            vector_top_k INTEGER NOT NULL DEFAULT ${defaultVectorTopK},
            similarity_threshold REAL NOT NULL DEFAULT ${defaultSimilarityThreshold},
            bm25_limit INTEGER NOT NULL DEFAULT ${defaultBm25Limit},
            hnsw_m INTEGER NOT NULL DEFAULT ${defaultHnswM},
            hnsw_ef_construction INTEGER NOT NULL DEFAULT ${defaultHnswEfConstruction},
            rrf_k REAL NOT NULL DEFAULT ${defaultRrfK}
          );

          CREATE INDEX IF NOT EXISTS idx_knowledge_bases_name ON knowledge_bases(name);
        `);

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
        `);

        // Extend documents table with indexing fields
        await db.exec(`
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_count INTEGER;
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;
        `);

        // Add knowledge_base_id FK to documents table
        await db.exec(`
          ALTER TABLE documents ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE;

          CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base_id ON documents(knowledge_base_id);
        `);

        // Enforce NOT NULL constraint on knowledge_base_id
        // Count orphaned documents before deletion
        const orphanedResult = await db.query<{ count: number; id: string; filename: string }>(
          `SELECT COUNT(*)::integer as count FROM documents WHERE knowledge_base_id IS NULL`
        );
        const orphanedCount = orphanedResult.rows[0]?.count || 0;

        if (orphanedCount > 0) {
          // Log warning about orphaned documents
          console.warn(
            `[VectorDB] Found ${orphanedCount} orphaned documents without KB assignment - will be deleted`
          );

          if (import.meta.env.DEV) {
            // List first 10 orphaned documents
            const orphanedDocs = await db.query<{ id: string; filename: string }>(
              `SELECT id, filename FROM documents WHERE knowledge_base_id IS NULL LIMIT 10`
            );
            console.log(
              '[VectorDB] Orphaned documents:',
              orphanedDocs.rows.map((d) => d.filename).join(', ')
            );
          }

          // Delete orphaned documents
          await db.exec(`DELETE FROM documents WHERE knowledge_base_id IS NULL;`);

          if (import.meta.env.DEV) {
            console.log(`[VectorDB] Deleted ${orphanedCount} orphaned documents`);
          }
        } else if (import.meta.env.DEV) {
          console.log('[VectorDB] No orphaned documents found');
        }

        // Check if NOT NULL constraint already exists
        const constraintResult = await db.query<{ constraint_type: string }>(
          `SELECT c.contype as constraint_type
           FROM pg_constraint c
           JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
           WHERE c.conrelid = 'documents'::regclass
             AND a.attname = 'knowledge_base_id'
             AND c.contype = 'n'`
        );

        const constraintExists = constraintResult.rows.length > 0;

        if (!constraintExists) {
          try {
            await db.exec(`
              ALTER TABLE documents
              ALTER COLUMN knowledge_base_id SET NOT NULL;
            `);

            if (import.meta.env.DEV) {
              console.log('[VectorDB] Added NOT NULL constraint on knowledge_base_id');
            }
          } catch (e) {
            console.error('[VectorDB] Failed to add NOT NULL constraint on knowledge_base_id:', e);
            // Re-throw error so caller knows migration failed
            throw new Error(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (import.meta.env.DEV) {
          console.log('[VectorDB] NOT NULL constraint on knowledge_base_id already exists');
        }

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
        `);

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Database initialized with all tables (KB-specific chunks only)');
        }

        // Initialize OpenAI client
        if (apiKey) {
          const baseURL = getOpenAIConfig('BASE_URL');
          openaiClient = new OpenAI({
            apiKey,
            baseURL: baseURL || undefined,
            dangerouslyAllowBrowser: true,
          });
        }

        // Lunr indexes will be built lazily on-demand during first BM25 search
        if (import.meta.env.DEV) {
          console.log('[VectorDB] Lunr indexes will build on-demand during BM25 search');
        }

        // Mark Lunr as ready (indexes built on-demand)
        setLunrReadyState(true);

        // Start queue processor
        processQueue();
        setInterval(() => processQueue(), 2000);

        await refreshKnowledgeBases();
        await refreshDocuments();

        // Expose database to window for E2E tests
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).dbGlobal = dbGlobal;
        if (import.meta.env.DEV) {
          console.log('[VectorDB] Database exposed to window.dbGlobal for testing');
        }

        setInitialized(true);
        setInitError(null);

        if (import.meta.env.DEV) {
          console.log(
            '[VectorDB] Context initialized, indexing enabled:',
            isFeatureEnabled(FEATURES.INDEXING_ENABLED)
          );
        }

        isInitializing = false; // Reset flag on success
        break; // Success - exit retry loop
      } catch (error) {
        retryCount++;
        console.error(
          `[VectorDB] Initialization error (attempt ${retryCount}/${MAX_RETRIES}):`,
          error
        );

        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('WebAssembly') || errorMessage.includes('magic word')) {
          console.error('[VectorDB] WebAssembly compilation error detected. Try:');
          console.error('  - Clear browser cache, hard reload (Cmd+Shift+R)');
          console.error('  - Clear IndexedDB storage (DevTools > Application > Storage)');
        }

        if (retryCount >= MAX_RETRIES) {
          setInitError({
            message: `Failed to initialize database after ${MAX_RETRIES} attempts: ${errorMessage}`,
            canRetry: true,
          });
          console.error('[VectorDB] Failed to initialize after max retries.');
          isInitializing = false; // Reset flag on failure
        } else {
          console.log(`[VectorDB] Retrying initialization in ${retryCount}s...`);
          await sleep(retryCount * 1000);
        }
      }
    }
  };

  const retryInitialization = async () => {
    setInitError(null);
    setInitialized(false);
    // Reset global instance and flag to force fresh initialization
    dbGlobal = undefined;
    isInitializing = false;
    await initializeDatabase();
  };

  // Helper method for creating KB-specific chunks tables
  const createKBChunksTable = async (
    kbId: string,
    dimensions: number,
    hnswM: number,
    hnswEfConstruction: number
  ) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    const tableName = `kb_${kbId.replace(/-/g, '_')}_chunks`;

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
    `);

    // Create HNSW index with KB-specific parameters
    await dbGlobal.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding_hnsw
      ON ${tableName}
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = ${hnswM}, ef_construction = ${hnswEfConstruction});
    `);

    if (import.meta.env.DEV) {
      console.log(
        `[VectorDB] Created chunks table for KB ${kbId}: ${tableName} (dimensions: ${dimensions}, hnsw_m: ${hnswM}, hnsw_ef: ${hnswEfConstruction})`
      );
    }
  };

  const refreshKnowledgeBases = async () => {
    if (!dbGlobal) return;

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
          kb.chunk_max_tokens,
          kb.chunk_overlap_tokens,
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
      `);

      // Compute chunk counts for each KB
      const kbsWithChunkCounts = await Promise.all(
        result.rows.map(async (kb) => {
          const tableName = `kb_${kb.id.replace(/-/g, '_')}_chunks`;
          try {
            const chunkResult = await dbGlobal!.query<{ count: number }>(
              `SELECT COUNT(*)::integer as count FROM ${tableName}`
            );
            const chunkCount = chunkResult.rows[0]?.count || 0;
            return { ...kb, chunk_count: chunkCount };
          } catch {
            // Table doesn't exist yet, return 0
            return { ...kb, chunk_count: 0 };
          }
        })
      );

      setKnowledgeBases(kbsWithChunkCounts);
    } catch (error) {
      console.error('[VectorDB] Error refreshing knowledge bases:', error);
    }
  };

  const createKnowledgeBase = async (params: {
    name: string;
    description?: string;
    color?: string;
    config?: KnowledgeBaseConfig;
  }): Promise<KnowledgeBase> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    // Validate name
    const trimmedName = params.name.trim();
    if (!trimmedName || trimmedName.length > 50) {
      throw new Error('Name must be between 1 and 50 characters');
    }

    // Check for duplicate name
    const existing = await dbGlobal.query<{ count: number }>(
      'SELECT COUNT(*)::integer as count FROM knowledge_bases WHERE name = $1',
      [trimmedName]
    );
    if ((existing.rows[0]?.count || 0) > 0) {
      throw new Error('A knowledge base with this name already exists');
    }

    // Extract config with validation
    const config = params.config || {};

    // Embedding settings are required (no global defaults)
    if (!config.embedding_model) {
      throw new Error('Embedding model is required');
    }
    if (!config.embedding_dimensions) {
      throw new Error('Embedding dimensions are required');
    }

    const embeddingModel = config.embedding_model;
    const embeddingDimensions = config.embedding_dimensions;
    const chunkMaxTokens = config.chunk_max_tokens || 2000;
    const chunkOverlapTokens = config.chunk_overlap_tokens || 200;
    const vectorTopK = config.vector_top_k ?? getSearchSetting('VECTOR_TOP_K');
    const similarityThreshold =
      config.similarity_threshold ?? getSearchSetting('SIMILARITY_THRESHOLD');
    const bm25Limit = config.bm25_limit ?? getSearchSetting('BM25_LIMIT');
    const hnswM = config.hnsw_m ?? 16; // HNSW M default (per-KB setting)
    const hnswEfConstruction = config.hnsw_ef_construction ?? 64; // HNSW ef_construction default (per-KB setting)
    const rrfK = config.rrf_k ?? getSearchSetting('RRF_K');

    const kbId = uuidv4();

    // Insert KB record using parameterized query
    await dbGlobal.query(
      `INSERT INTO knowledge_bases (
        id, name, description, color,
        embedding_model, embedding_dimensions,
        chunk_max_tokens, chunk_overlap_tokens,
        vector_top_k, similarity_threshold, bm25_limit,
        hnsw_m, hnsw_ef_construction, rrf_k
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        kbId,
        trimmedName,
        params.description || null,
        params.color || null,
        embeddingModel,
        embeddingDimensions,
        chunkMaxTokens,
        chunkOverlapTokens,
        vectorTopK,
        similarityThreshold,
        bm25Limit,
        hnswM,
        hnswEfConstruction,
        rrfK,
      ]
    );

    // Create KB-specific chunks table
    await createKBChunksTable(kbId, embeddingDimensions, hnswM, hnswEfConstruction);

    // Query the newly created KB directly
    const result = await dbGlobal.query<KnowledgeBase>(
      `SELECT
        kb.id,
        kb.name,
        kb.description,
        kb.color,
        kb.created_at,
        kb.updated_at,
        kb.embedding_model,
        kb.embedding_dimensions,
        kb.chunk_max_tokens,
        kb.chunk_overlap_tokens,
        kb.vector_top_k,
        kb.similarity_threshold,
        kb.bm25_limit,
        kb.hnsw_m,
        kb.hnsw_ef_construction,
        kb.rrf_k,
        0 as document_count,
        0 as chunk_count
      FROM knowledge_bases kb
      WHERE kb.id = $1`,
      [kbId]
    );

    const newKB = result.rows[0];
    if (!newKB) {
      throw new Error('Failed to create knowledge base');
    }

    // Refresh KB list in background
    refreshKnowledgeBases();

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Created knowledge base: ${trimmedName} (${kbId})`);
    }

    return newKB;
  };

  const updateKnowledgeBase = async (
    id: string,
    updates: {
      name?: string;
      description?: string | null;
      color?: string | null;
      config?: KnowledgeBaseConfig;
    }
  ): Promise<{ requiresReindex: boolean; affectedDocCount?: number }> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    // Get current KB
    const currentResult = await dbGlobal.query<KnowledgeBase>(
      'SELECT * FROM knowledge_bases WHERE id = $1',
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) {
      throw new Error('Knowledge base not found');
    }

    // Validate name if provided
    if (updates.name) {
      const trimmedName = updates.name.trim();
      if (!trimmedName || trimmedName.length > 50) {
        throw new Error('Name must be between 1 and 50 characters');
      }

      // Check for duplicate name (excluding current KB)
      const existing = await dbGlobal.query<{ count: number }>(
        'SELECT COUNT(*)::integer as count FROM knowledge_bases WHERE name = $1 AND id != $2',
        [trimmedName, id]
      );
      if ((existing.rows[0]?.count || 0) > 0) {
        throw new Error('A knowledge base with this name already exists');
      }
    }

    // Detect if re-index is required
    const config = updates.config || {};
    const requiresReindex =
      (config.embedding_model && config.embedding_model !== current.embedding_model) ||
      (config.embedding_dimensions &&
        config.embedding_dimensions !== current.embedding_dimensions) ||
      (config.chunk_max_tokens && config.chunk_max_tokens !== current.chunk_max_tokens) ||
      (config.chunk_overlap_tokens &&
        config.chunk_overlap_tokens !== current.chunk_overlap_tokens) ||
      (config.hnsw_m && config.hnsw_m !== current.hnsw_m) ||
      (config.hnsw_ef_construction && config.hnsw_ef_construction !== current.hnsw_ef_construction);

    if (requiresReindex) {
      // Get affected document count
      const docResult = await dbGlobal.query<{ count: number }>(
        'SELECT COUNT(*)::integer as count FROM documents WHERE knowledge_base_id = $1',
        [id]
      );
      return { requiresReindex: true, affectedDocCount: docResult.rows[0]?.count || 0 };
    }

    // Build UPDATE statement using parameterized query
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (updates.name) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name.trim());
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      params.push(updates.color);
    }
    if (config.chunk_max_tokens !== undefined) {
      setClauses.push(`chunk_max_tokens = $${paramIndex++}`);
      params.push(config.chunk_max_tokens);
    }
    if (config.chunk_overlap_tokens !== undefined) {
      setClauses.push(`chunk_overlap_tokens = $${paramIndex++}`);
      params.push(config.chunk_overlap_tokens);
    }
    if (config.vector_top_k !== undefined) {
      setClauses.push(`vector_top_k = $${paramIndex++}`);
      params.push(config.vector_top_k);
    }
    if (config.similarity_threshold !== undefined) {
      setClauses.push(`similarity_threshold = $${paramIndex++}`);
      params.push(config.similarity_threshold);
    }
    if (config.bm25_limit !== undefined) {
      setClauses.push(`bm25_limit = $${paramIndex++}`);
      params.push(config.bm25_limit);
    }
    if (config.rrf_k !== undefined) {
      setClauses.push(`rrf_k = $${paramIndex++}`);
      params.push(config.rrf_k);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    if (setClauses.length > 1) {
      // More than just updated_at
      params.push(id);
      await dbGlobal.query(
        `UPDATE knowledge_bases SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        params
      );
    }

    await refreshKnowledgeBases();

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Updated knowledge base: ${id}`);
    }

    return { requiresReindex: false };
  };

  const reindexKnowledgeBase = async (id: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Starting re-index for KB ${id}...`);
    }

    // Validation Phase: Get current KB configuration
    const kbResult = await dbGlobal.query<KnowledgeBase>(
      'SELECT * FROM knowledge_bases WHERE id = $1',
      [id]
    );
    const kb = kbResult.rows[0];
    if (!kb) {
      throw new Error('Knowledge base not found');
    }

    // Get all documents for this KB
    const docsResult = await dbGlobal.query<{ id: string; filename: string }>(
      'SELECT id, filename FROM documents WHERE knowledge_base_id = $1',
      [id]
    );
    const documents = docsResult.rows;

    if (import.meta.env.DEV) {
      console.log(
        `[VectorDB] Re-indexing ${documents.length} documents in KB "${kb.name}" (${id})`
      );
    }

    // Cleanup Phase: Drop existing chunks table
    const tableName = `kb_${id.replace(/-/g, '_')}_chunks`;

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Dropping chunks table: ${tableName}`);
    }

    await dbGlobal.exec(`DROP TABLE IF EXISTS ${tableName} CASCADE`);

    // Verify table was dropped
    const verifyResult = await dbGlobal.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );

    if (verifyResult.rows.length > 0) {
      throw new Error(`Failed to drop chunks table ${tableName}`);
    }

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Verified chunks table dropped: ${tableName}`);
    }

    // Rebuild Phase: Create new chunks table with updated config
    await createKBChunksTable(id, kb.embedding_dimensions, kb.hnsw_m, kb.hnsw_ef_construction);

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Recreated chunks table with updated config`);
    }

    // Clear Lunr index (will rebuild automatically during indexing)
    lunrIndexes.delete(id);

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Cleared Lunr index for KB ${id}`);
    }

    // Queue Phase: Mark all documents for re-indexing
    for (const doc of documents) {
      // Delete existing queue entry if exists
      await dbGlobal.query('DELETE FROM indexing_queue WHERE document_id = $1', [doc.id]);

      // Insert new queue entry with reset state
      await dbGlobal.query(
        `INSERT INTO indexing_queue (id, document_id, status, retry_count)
         VALUES ($1, $2, 'pending', 0)`,
        [uuidv4(), doc.id]
      );

      // Reset document indexing metadata
      await dbGlobal.query(
        `UPDATE documents
         SET chunk_count = NULL, indexed_at = NULL
         WHERE id = $1`,
        [doc.id]
      );

      if (import.meta.env.DEV) {
        console.log(`[VectorDB] Queued document for re-indexing: ${doc.filename} (${doc.id})`);
      }
    }

    if (import.meta.env.DEV) {
      console.log(
        `[VectorDB] Re-index complete for KB ${id}. Queued ${documents.length} documents for processing.`
      );
    }

    // Trigger indexing pipeline
    await refreshDocuments();
    await refreshKnowledgeBases();
    processQueue();
  };

  const deleteKnowledgeBase = async (id: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    const tableName = `kb_${id.replace(/-/g, '_')}_chunks`;

    try {
      // Delete KB (CASCADE will delete documents and indexing_queue entries)
      await dbGlobal.query('DELETE FROM knowledge_bases WHERE id = $1', [id]);

      // Drop KB-specific chunks table with CASCADE
      await dbGlobal.exec(`DROP TABLE IF EXISTS ${tableName} CASCADE`);

      // Verify table was dropped
      const verifyResult = await dbGlobal.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );

      if (verifyResult.rows.length > 0) {
        throw new Error(`Failed to drop chunks table ${tableName} - table still exists after DROP`);
      }

      // Remove Lunr index for this KB
      if (lunrIndexes.has(id)) {
        lunrIndexes.delete(id);
        if (import.meta.env.DEV) {
          console.log(`[VectorDB] Removed Lunr index for KB ${id}`);
        }
      }

      await refreshKnowledgeBases();
      await refreshDocuments();

      if (import.meta.env.DEV) {
        console.log(`[VectorDB] Deleted knowledge base: ${id}, chunks table: ${tableName}`);
      }
    } catch (error) {
      console.error(`[VectorDB] Error deleting knowledge base ${id}:`, error);
      // Re-throw error for UI to handle
      throw error;
    }
  };

  useEffect(() => {
    initializeDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync API key to OpenAI client
  useEffect(() => {
    if (apiKey) {
      const baseURL = getOpenAIConfig('BASE_URL');
      openaiClient = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
        dangerouslyAllowBrowser: true,
      });
    } else {
      openaiClient = null;
    }

    if (import.meta.env.DEV) {
      console.log('[VectorDB] OpenAI client', apiKey ? 'initialized' : 'cleared');
    }
  }, [apiKey]);

  // Listen for OpenAI config changes (base URL, chat model)
  useEffect(() => {
    const handleConfigChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { config, value } = customEvent.detail;

      // Recreate OpenAI client when base URL changes
      if (config === 'BASE_URL') {
        if (apiKey) {
          openaiClient = new OpenAI({
            apiKey,
            baseURL: value || undefined,
            dangerouslyAllowBrowser: true,
          });

          if (import.meta.env.DEV) {
            console.log('[VectorDB] OpenAI client recreated with new base URL:', value);
          }
        }
      }
    };

    window.addEventListener('openaiConfigChanged', handleConfigChange);
    return () => window.removeEventListener('openaiConfigChanged', handleConfigChange);
  }, [apiKey]);

  // Listen for search setting changes
  useEffect(() => {
    const handleSettingChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { setting, value } = customEvent.detail;

      if (import.meta.env.DEV) {
        console.log(`[VectorDB] Search setting changed: ${setting} = ${value}`);
      }

      // HNSW index parameters require index rebuild (not implemented in this phase)
      if (setting === 'HNSW_M' || setting === 'HNSW_EF_CONSTRUCTION') {
        console.warn(
          '[VectorDB] HNSW index parameters changed. Index rebuild required but not automated. ' +
            'Please reload the page and re-index documents for changes to take effect.'
        );
      }

      // Other settings (topK, threshold, BM25 limit) apply immediately on next search
    };

    window.addEventListener('searchSettingChanged', handleSettingChange);
    return () => window.removeEventListener('searchSettingChanged', handleSettingChange);
  }, []);

  const refreshDocuments = async () => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await dbGlobal.query<Document>(`
        SELECT
          d.*,
          iq.status as indexing_status,
          iq.error_message,
          iq.retry_count,
          kb.name as kb_name,
          kb.color as kb_color,
          kb.embedding_model as kb_embedding_model,
          kb.embedding_dimensions as kb_embedding_dimensions
        FROM documents d
        LEFT JOIN indexing_queue iq ON d.id = iq.document_id
        LEFT JOIN knowledge_bases kb ON d.knowledge_base_id = kb.id
        ORDER BY d.uploaded_at DESC
      `);

      setDocuments(result.rows);

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Retrieved documents:', result.rows.length);
      }
    } catch (error) {
      console.error('[VectorDB] Error refreshing documents:', error);
      throw error;
    }
  };

  const uploadFiles = async (files: File[], kbId: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (!kbId) {
      throw new Error('Knowledge Base ID is required for document upload');
    }

    try {
      const validFiles = files.filter(
        (file) => file.name.endsWith('.md') || file.name.endsWith('.txt')
      );

      if (validFiles.length === 0) {
        console.log('[VectorDB] No valid files to upload');
        return;
      }

      for (const file of validFiles) {
        const content = await file.text();
        const mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain';
        const id = uuidv4();
        const fileSize = new Blob([content]).size;

        await dbGlobal.query(
          `INSERT INTO documents (id, filename, content, file_size, mime_type, knowledge_base_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, file.name, content, fileSize, mimeType, kbId]
        );

        if (isFeatureEnabled(FEATURES.INDEXING_ENABLED)) {
          await dbGlobal.query(
            `INSERT INTO indexing_queue (id, document_id, status)
             VALUES ($1, $2, 'pending')`,
            [uuidv4(), id]
          );

          if (import.meta.env.DEV) {
            console.log('[VectorDB] Indexing queue entry created for:', id);
          }
        }

        if (import.meta.env.DEV) {
          console.log('[VectorDB] File uploaded:', file.name);
        }
      }

      await refreshDocuments();
      await refreshKnowledgeBases(); // Update KB stats
      processQueue(); // Trigger immediate processing
    } catch (error) {
      console.error('[VectorDB] Error uploading files:', error);
      throw error;
    }
  };

  const deleteDocument = async (id: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    try {
      await dbGlobal.query('DELETE FROM documents WHERE id = $1', [id]);

      if (import.meta.env.DEV) {
        console.log('[VectorDB] Document deleted:', id);
      }

      await refreshDocuments();
    } catch (error) {
      console.error('[VectorDB] Error deleting document:', error);
      throw error;
    }
  };

  const storeChunks = async (
    documentId: string,
    chunks: Array<{ content: string; heading?: string }>,
    embeddings: number[][],
    knowledgeBaseId?: string
  ) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    initializeTokenizer();

    // All documents must belong to a KB
    if (!knowledgeBaseId) {
      throw new Error('Knowledge Base ID is required for storing chunks');
    }

    // Determine table name based on KB
    const tableName = `kb_${knowledgeBaseId.replace(/-/g, '_')}_chunks`;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const tokenCount = countTokens(chunk.content);

      const embeddingStr = `[${embedding.join(',')}]`;

      await dbGlobal.query(
        `INSERT INTO ${tableName} (id, document_id, chunk_index, content, heading, embedding, token_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), documentId, i, chunk.content, chunk.heading, embeddingStr, tokenCount]
      );
    }

    if (import.meta.env.DEV) {
      console.log(
        `[VectorDB] Stored ${chunks.length} chunks with embeddings for document ${documentId} in table ${tableName}`
      );
    }
  };

  const processJob = async (job: IndexingJob) => {
    if (!dbGlobal) return;

    const { id: jobId, document_id } = job;

    try {
      await dbGlobal.query(
        `UPDATE indexing_queue
         SET status = 'processing', started_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      );

      emitProgress(document_id, 'processing', 0, 'chunking', 'Starting indexing...');

      const docResult = await dbGlobal.query<{
        content: string;
        knowledge_base_id: string | null;
        kb_embedding_dimensions: number | null;
        kb_embedding_model: string | null;
        kb_chunk_max_tokens: number | null;
        kb_chunk_overlap_tokens: number | null;
      }>(
        `SELECT d.content, d.knowledge_base_id,
                kb.embedding_dimensions as kb_embedding_dimensions,
                kb.embedding_model as kb_embedding_model,
                kb.chunk_max_tokens as kb_chunk_max_tokens,
                kb.chunk_overlap_tokens as kb_chunk_overlap_tokens
         FROM documents d
         LEFT JOIN knowledge_bases kb ON d.knowledge_base_id = kb.id
         WHERE d.id = $1`,
        [document_id]
      );

      if (docResult.rows.length === 0) {
        throw new Error(`Document not found: ${document_id}`);
      }

      const document = docResult.rows[0];

      // Validate KB config exists (all documents must belong to a KB)
      if (
        !document.kb_embedding_dimensions ||
        !document.kb_embedding_model ||
        !document.kb_chunk_max_tokens ||
        !document.kb_chunk_overlap_tokens
      ) {
        throw new Error('Document must belong to a Knowledge Base with full configuration');
      }

      emitProgress(document_id, 'processing', 10, 'chunking', 'Splitting document into chunks...');
      const chunks = chunkDocument(
        document.content,
        document.kb_chunk_max_tokens,
        document.kb_chunk_overlap_tokens
      );
      emitProgress(document_id, 'processing', 30, 'chunking', `Created ${chunks.length} chunks`);

      emitProgress(document_id, 'processing', 30, 'embedding', 'Generating embeddings...');
      const embeddings = await generateEmbeddings(
        chunks,
        (current, total) => {
          const embeddingProgress = 30 + Math.floor((current / total) * 40);
          emitProgress(
            document_id,
            'processing',
            embeddingProgress,
            'embedding',
            `Processing batch ${current}/${total}`
          );
        },
        document.kb_embedding_dimensions,
        document.kb_embedding_model
      );
      emitProgress(document_id, 'processing', 70, 'embedding', 'All embeddings generated');

      emitProgress(document_id, 'processing', 70, 'storing', 'Storing chunks...');
      await storeChunks(document_id, chunks, embeddings, document.knowledge_base_id || undefined);
      emitProgress(document_id, 'processing', 100, 'storing', 'All chunks stored');

      await dbGlobal.query(
        `UPDATE indexing_queue
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [jobId]
      );

      await dbGlobal.query(
        `UPDATE documents
         SET chunk_count = $1, indexed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [chunks.length, document_id]
      );

      // Rebuild Lunr index for this KB only
      if (document.knowledge_base_id) {
        await buildLunrIndex(document.knowledge_base_id);
      }

      emitProgress(document_id, 'completed', 100, 'completed', 'Indexing completed successfully');

      await refreshDocuments();
    } catch (error) {
      console.error('[VectorDB] Job processing error:', error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const maxRetries = job.max_retries;
      const currentRetryCount = job.retry_count;

      if (currentRetryCount < maxRetries) {
        await dbGlobal.query(
          `UPDATE indexing_queue
           SET status = 'pending', retry_count = $1, error_message = $2
           WHERE id = $3`,
          [currentRetryCount + 1, errorMessage, jobId]
        );

        emitProgress(
          document_id,
          'failed',
          0,
          'error',
          `Retry ${currentRetryCount + 1}/${maxRetries}: ${errorMessage}`
        );

        if (import.meta.env.DEV) {
          console.log(`[VectorDB] Job will retry (${currentRetryCount + 1}/${maxRetries})`);
        }
      } else {
        await dbGlobal.query(
          `UPDATE indexing_queue
           SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [errorMessage, jobId]
        );

        emitProgress(document_id, 'failed', 0, 'error', `Failed: ${errorMessage}`);

        if (import.meta.env.DEV) {
          console.log('[VectorDB] Job permanently failed after max retries');
        }
      }

      await refreshDocuments();
    }
  };

  const processQueue = async () => {
    if (isProcessing || !dbGlobal) {
      return;
    }

    isProcessing = true;

    try {
      while (true) {
        const result = await dbGlobal.query<IndexingJob>(`
          SELECT * FROM indexing_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 1
        `);

        if (result.rows.length === 0) break;

        const job = result.rows[0];
        await processJob(job);

        await sleep(100);
      }
    } catch (error) {
      console.error('[VectorDB] Queue processing error:', error);
    } finally {
      isProcessing = false;
    }
  };

  const buildLunrIndex = async (kbId?: string) => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Building Lunr index${kbId ? ` for KB ${kbId}` : ' for all KBs'}...`);
    }

    setLunrReadyState(false);

    // Determine which KBs to build indexes for
    const kbIds: string[] = [];
    if (kbId) {
      kbIds.push(kbId);
    } else {
      const kbResult = await dbGlobal.query<{ id: string }>('SELECT id FROM knowledge_bases');
      kbIds.push(...kbResult.rows.map((row) => row.id));
    }

    // Build index for each KB
    for (const currentKbId of kbIds) {
      const tableName = `kb_${currentKbId.replace(/-/g, '_')}_chunks`;

      try {
        const chunks = await dbGlobal.query<{
          id: string;
          content: string;
          heading: string | null;
          document_id: string;
        }>(`
          SELECT id, content, heading, document_id
          FROM ${tableName}
          WHERE content IS NOT NULL
          ORDER BY document_id, chunk_index
        `);

        const index = lunr(function () {
          this.ref('id');
          this.field('content');
          this.field('heading');

          chunks.rows.forEach((chunk) => {
            this.add({
              id: chunk.id,
              content: chunk.content,
              heading: chunk.heading || '',
            });
          });
        });

        lunrIndexes.set(currentKbId, index);

        if (import.meta.env.DEV) {
          console.log(
            `[VectorDB] Lunr index built for KB ${currentKbId}: ${chunks.rows.length} chunks`
          );
        }
      } catch (error) {
        console.error(`[VectorDB] Error building index for ${tableName}:`, error);
      }
    }

    setLunrReadyState(true);
  };

  const retryFailed = async (documentId: string) => {
    console.log('[VectorDB] Retry indexing for document:', documentId);
  };

  // Helper to get KB config from document IDs
  const getKnowledgeBaseFromDocuments = async (documentIds: string[]): Promise<KnowledgeBase> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (!documentIds || documentIds.length === 0) {
      throw new Error('No documents provided');
    }

    // Get KB IDs for all documents
    const result = await dbGlobal.query<{ knowledge_base_id: string }>(
      `SELECT DISTINCT knowledge_base_id FROM documents WHERE id = ANY($1::uuid[])`,
      [documentIds]
    );

    if (result.rows.length === 0) {
      throw new Error('No documents found');
    }

    // Validate all documents belong to same KB
    if (result.rows.length > 1) {
      throw new Error('Cannot search across multiple Knowledge Bases (different embedding spaces)');
    }

    const kbId = result.rows[0].knowledge_base_id;
    if (!kbId) {
      throw new Error('Documents must belong to a Knowledge Base');
    }

    // Load KB config
    const kbResult = await dbGlobal.query<KnowledgeBase>(
      `SELECT * FROM knowledge_bases WHERE id = $1`,
      [kbId]
    );

    if (kbResult.rows.length === 0) {
      throw new Error('Knowledge Base not found');
    }

    return kbResult.rows[0];
  };

  const searchBM25 = async (
    query: string,
    limit?: number,
    kbId?: string
  ): Promise<SearchResult[]> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    // Determine which KB to search
    // kbId can be passed explicitly or will be determined from the hybrid search context
    if (!kbId) {
      // If no KB specified, return empty (BM25 should only search within a specific KB)
      return [];
    }

    // Get KB-specific Lunr index
    let lunrIndex = lunrIndexes.get(kbId);
    if (!lunrIndex) {
      // Build index for this KB if it doesn't exist
      await buildLunrIndex(kbId);
      lunrIndex = lunrIndexes.get(kbId);
    }

    if (!lunrIndex) {
      return [];
    }

    const resultLimit = limit || getSearchSetting('BM25_LIMIT');

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] BM25 search for: "${query}" in KB ${kbId}`);
    }

    const lunrResults = lunrIndex.search(query);

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Lunr returned ${lunrResults.length} results`);
    }

    const chunkIds = lunrResults.slice(0, resultLimit).map((r) => r.ref);

    if (chunkIds.length === 0) {
      return [];
    }

    // Query only this KB's chunks table
    const tableName = `kb_${kbId.replace(/-/g, '_')}_chunks`;

    const result = await dbGlobal.query<{
      id: string;
      document_id: string;
      content: string;
      heading: string | null;
      chunk_index: number;
      filename: string;
    }>(
      `
      SELECT
        c.id,
        c.document_id,
        c.content,
        c.heading,
        c.chunk_index,
        d.filename
      FROM ${tableName} c
      JOIN documents d ON c.document_id = d.id
      WHERE c.id = ANY($1::uuid[])
    `,
      [chunkIds]
    );

    const scoreMap = new Map(lunrResults.map((r) => [r.ref, r.score]));
    const resultsMap = new Map(result.rows.map((row) => [row.id, row]));

    const results: SearchResult[] = chunkIds
      .map((chunkId) => {
        const row = resultsMap.get(chunkId);
        if (!row) return null;

        return {
          chunkId: row.id,
          documentId: row.document_id,
          filename: row.filename,
          content: row.content,
          heading: row.heading,
          chunkIndex: row.chunk_index,
          score: scoreMap.get(chunkId) || 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return results;
  };

  const searchVectors = async (query: string, documentIds: string[]): Promise<SearchResult[]> => {
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized. Set API key in settings.');
    }

    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (!documentIds || documentIds.length === 0) {
      return [];
    }

    // Get KB config from documents
    const kb = await getKnowledgeBaseFromDocuments(documentIds);

    // Use KB-specific search settings
    const topK = kb.vector_top_k;
    const similarityThreshold = kb.similarity_threshold;

    // Generate query embedding with KB's model and dimensions
    const embeddingResponse = await openaiClient.embeddings.create({
      model: kb.embedding_model,
      input: query,
      dimensions: kb.embedding_dimensions,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Query KB-specific chunks table
    const tableName = `kb_${kb.id.replace(/-/g, '_')}_chunks`;

    const result = await dbGlobal.query<{
      chunk_id: string;
      document_id: string;
      filename: string;
      heading: string | null;
      content: string;
      chunk_index: number;
      similarity: number;
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
      FROM ${tableName} c
      JOIN documents d ON c.document_id = d.id
      WHERE c.document_id = ANY($2::uuid[])
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $3
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $4
    `,
      [embeddingStr, documentIds, similarityThreshold, topK]
    );

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Vector search returned ${result.rows.length} results`);
    }

    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      filename: row.filename,
      heading: row.heading,
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: row.similarity,
    }));
  };

  const searchHybrid = async (query: string, documentIds: string[]): Promise<SearchResult[]> => {
    if (!dbGlobal) {
      throw new Error('Database not initialized');
    }

    if (!openaiClient) {
      throw new Error('OpenAI client not initialized. Set API key in settings.');
    }

    // Get KB config from documents (for BM25, RRF, and topK settings)
    // searchVectors() will also load KB config internally for vector search settings
    const kb = await getKnowledgeBaseFromDocuments(documentIds);
    const bm25Limit = kb.bm25_limit;
    const rrfK = kb.rrf_k;
    const topK = kb.vector_top_k;

    if (import.meta.env.DEV) {
      console.log('[VectorDB] Hybrid search:', { query, kb: kb.name, bm25Limit, rrfK, topK });
    }

    // Execute both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      searchVectors(query, documentIds),
      searchBM25(query, bm25Limit, kb.id),
    ]);

    if (import.meta.env.DEV) {
      console.log(
        `[VectorDB] Hybrid search: ${vectorResults.length} vector results, ${bm25Results.length} BM25 results`
      );
    }

    // Build rank maps (1-based ranking)
    const vectorRankMap = new Map<string, number>();
    vectorResults.forEach((result, index) => {
      vectorRankMap.set(result.chunkId, index + 1);
    });

    const bm25RankMap = new Map<string, number>();
    bm25Results.forEach((result, index) => {
      bm25RankMap.set(result.chunkId, index + 1);
    });

    // Collect all unique chunk IDs
    const allChunkIds = new Set<string>([
      ...vectorResults.map((r) => r.chunkId),
      ...bm25Results.map((r) => r.chunkId),
    ]);

    // Build result map for easy lookup
    const resultMap = new Map<string, SearchResult>();
    vectorResults.forEach((r) => resultMap.set(r.chunkId, r));
    bm25Results.forEach((r) => {
      if (!resultMap.has(r.chunkId)) {
        resultMap.set(r.chunkId, r);
      }
    });

    // Calculate RRF scores for all chunks
    const fusedResults: SearchResult[] = [];

    allChunkIds.forEach((chunkId) => {
      const vectorRank = vectorRankMap.get(chunkId);
      const bm25Rank = bm25RankMap.get(chunkId);

      // RRF formula: score = 1/(k + rank)
      const vectorScore = vectorRank ? 1 / (rrfK + vectorRank) : 0;
      const bm25Score = bm25Rank ? 1 / (rrfK + bm25Rank) : 0;
      const fusedScore = vectorScore + bm25Score;

      const baseResult = resultMap.get(chunkId)!;

      fusedResults.push({
        ...baseResult,
        vectorScore,
        bm25Score,
        fusedScore,
        vectorRank,
        bm25Rank,
      });
    });

    // Sort by fused score (descending)
    fusedResults.sort((a, b) => (b.fusedScore || 0) - (a.fusedScore || 0));

    // Limit to topK results
    const finalResults = fusedResults.slice(0, topK);

    if (import.meta.env.DEV) {
      console.log(`[VectorDB] Hybrid search returned ${finalResults.length} fused results`);
    }

    return finalResults;
  };

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
        reindexKnowledgeBase,
        deleteKnowledgeBase,
        refreshKnowledgeBases,
      }}
    >
      {children}
    </VectorDBContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVectorDB() {
  const context = useContext(VectorDBContext);
  if (context === undefined) {
    throw new Error('useVectorDB must be used within a VectorDBProvider');
  }
  return context;
}

export type { SearchResult };
