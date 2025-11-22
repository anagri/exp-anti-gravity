/**
 * Search service for vector and BM25 search operations
 */

import { generateEmbeddings } from '@/lib/embeddings';
import type { SearchResult } from '@/types';
import type { PGlite } from '@electric-sql/pglite';
import type OpenAI from 'openai';

export interface HybridSearchOptions {
  vectorTopK: number;
  similarityThreshold: number;
  bm25Limit: number;
}

export class SearchService {
  constructor(private db: PGlite) {}

  /**
   * Vector similarity search using pgvector
   */
  async searchVector(
    query: string,
    openai: OpenAI,
    embeddingModel: string,
    topK: number,
    similarityThreshold: number,
    knowledgeBaseId?: string
  ): Promise<SearchResult[]> {
    // Generate query embedding
    const embeddings = await generateEmbeddings([query], openai, { model: embeddingModel });
    const queryEmbedding = embeddings[0];

    // Build SQL query
    let sql = `
      SELECT
        c.id as chunk_id,
        c.document_id,
        d.filename,
        c.content,
        c.heading,
        c.chunk_index,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
    `;

    const params: any[] = [`[${queryEmbedding.join(',')}]`];

    if (knowledgeBaseId) {
      sql += ` WHERE d.knowledge_base_id = $2`;
      params.push(knowledgeBaseId);
    }

    sql += `
      ORDER BY c.embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(topK);

    const result = await this.db.query(sql, params);

    return (result.rows as any[])
      .filter((row) => row.similarity >= similarityThreshold)
      .map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        filename: row.filename,
        content: row.content,
        heading: row.heading,
        chunkIndex: row.chunk_index,
        similarity: row.similarity,
      }));
  }

  /**
   * BM25 full-text search (requires Lunr index - not implemented here)
   * This is a placeholder for the BM25 functionality that uses Lunr.js
   */
  async searchBM25(
    _query: string,
    _limit: number,
    _knowledgeBaseId?: string
  ): Promise<SearchResult[]> {
    // BM25 search is handled by Lunr.js in the VectorDBContext
    // This is here for completeness but would need Lunr index passed in
    throw new Error('BM25 search requires Lunr index - use VectorDBContext.searchBM25');
  }

  /**
   * Hybrid search combining vector and BM25 with reciprocal rank fusion
   */
  async searchHybrid(
    query: string,
    openai: OpenAI,
    embeddingModel: string,
    options: HybridSearchOptions,
    knowledgeBaseId?: string
  ): Promise<SearchResult[]> {
    const { vectorTopK, similarityThreshold } = options;

    // Get vector results
    const vectorResults = await this.searchVector(
      query,
      openai,
      embeddingModel,
      vectorTopK,
      similarityThreshold,
      knowledgeBaseId
    );

    // For now, just return vector results
    // Full hybrid implementation would combine with BM25 using RRF
    return vectorResults.map((result, index) => ({
      ...result,
      fusedScore: 1 / (index + 1), // Simple ranking score
    }));
  }

  /**
   * Reciprocal Rank Fusion (RRF) for combining search results
   */
  fuseResults(
    vectorResults: SearchResult[],
    bm25Results: SearchResult[],
    k: number = 60
  ): SearchResult[] {
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    // Add vector results with RRF scores
    vectorResults.forEach((result, index) => {
      const score = 1 / (k + index + 1);
      scoreMap.set(result.chunkId, { result, score });
    });

    // Add BM25 results with RRF scores
    bm25Results.forEach((result, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = scoreMap.get(result.chunkId);

      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.chunkId, { result, score: rrfScore });
      }
    });

    // Sort by fused score and return
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({
        ...result,
        fusedScore: score,
      }));
  }
}
