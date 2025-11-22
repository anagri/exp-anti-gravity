/**
 * Centralized TypeScript type definitions
 * Eliminates duplicate interfaces across the codebase
 */

// Document types
export interface Document {
  id: string;
  filename: string;
  content: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  knowledge_base_id: string | null;
  chunk_count: number | null;
  indexed_at: string | null;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  error_message: string | null;
  retry_count: number | null;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  embedding_model: string;
  embedding_dimensions: number;
  hnsw_m: number;
  hnsw_ef_construction: number;
  document_count: number;
  chunk_count: number;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  heading: string | null;
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  embedding?: number[];
}

// Search types
export interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  heading: string | null;
  chunkIndex: number;
  similarity?: number;
  score?: number;
  vectorScore?: number;
  bm25Score?: number;
  fusedScore?: number;
  vectorRank?: number;
  bm25Rank?: number;
}

// Indexing types
export interface IndexingProgress {
  documentId: string;
  progress: number;
  stage: 'chunking' | 'embedding' | 'storing' | 'indexing' | 'completed';
  message: string;
  error?: string;
}

export interface IndexingQueueItem {
  documentId: string;
  filename: string;
  content: string;
  mimeType: string;
  knowledgeBaseId: string;
  retryCount: number;
}

// Filter types
export type FilterType = 'all' | 'markdown' | 'text' | 'indexed' | 'pending';
export type SortBy = 'name' | 'date' | 'size';
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';

// Message types (for chat)
export interface MessageMetadata {
  chunkIds: string[];
  vectorScores: number[];
  bm25Scores: number[];
  fusedScores: number[];
  vectorRanks: number[];
  bm25Ranks: number[];
  filenames: string[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[];
  metadata?: MessageMetadata;
  prompt?: string;
}
