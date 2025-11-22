/**
 * Database service for PGlite operations
 * Separates DB logic from React context
 */

import type { PGlite } from '@electric-sql/pglite';
import type { KnowledgeBase, Document } from '@/types';

export class DBService {
  constructor(private db: PGlite) {}

  // Knowledge Base operations
  async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    const result = await this.db.query(`
      SELECT
        kb.*,
        COUNT(DISTINCT d.id) as document_count,
        COALESCE(SUM(d.chunk_count), 0)::int as chunk_count
      FROM knowledge_bases kb
      LEFT JOIN documents d ON d.knowledge_base_id = kb.id
      GROUP BY kb.id
      ORDER BY kb.created_at DESC
    `);
    return result.rows as KnowledgeBase[];
  }

  async createKnowledgeBase(params: {
    name: string;
    description?: string;
    embeddingModel: string;
    embeddingDimensions: number;
    hnswM: number;
    hnswEfConstruction: number;
  }): Promise<string> {
    const { name, description, embeddingModel, embeddingDimensions, hnswM, hnswEfConstruction } =
      params;

    const result = await this.db.query(
      `INSERT INTO knowledge_bases (name, description, embedding_model, embedding_dimensions, hnsw_m, hnsw_ef_construction)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, description || null, embeddingModel, embeddingDimensions, hnswM, hnswEfConstruction]
    );

    return (result.rows[0] as { id: string }).id;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    await this.db.query('DELETE FROM knowledge_bases WHERE id = $1', [id]);
  }

  // Document operations
  async getDocuments(knowledgeBaseId?: string): Promise<Document[]> {
    if (knowledgeBaseId) {
      const result = await this.db.query(
        'SELECT * FROM documents WHERE knowledge_base_id = $1 ORDER BY uploaded_at DESC',
        [knowledgeBaseId]
      );
      return result.rows as Document[];
    }

    const result = await this.db.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    return result.rows as Document[];
  }

  async createDocument(params: {
    filename: string;
    content: string;
    fileSize: number;
    mimeType: string;
    knowledgeBaseId: string;
  }): Promise<string> {
    const { filename, content, fileSize, mimeType, knowledgeBaseId } = params;

    const result = await this.db.query(
      `INSERT INTO documents (filename, content, file_size, mime_type, knowledge_base_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [filename, content, fileSize, mimeType, knowledgeBaseId]
    );

    return (result.rows[0] as { id: string }).id;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.query('DELETE FROM documents WHERE id = $1', [id]);
  }

  async updateDocumentIndexingStatus(
    id: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    if (status === 'completed') {
      await this.db.query(
        `UPDATE documents
         SET indexing_status = $1, indexed_at = NOW(), error_message = NULL
         WHERE id = $2`,
        [status, id]
      );
    } else {
      await this.db.query(
        `UPDATE documents
         SET indexing_status = $1, error_message = $2
         WHERE id = $3`,
        [status, errorMessage || null, id]
      );
    }
  }

  // Chunk operations
  async getChunkCount(documentId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM chunks WHERE document_id = $1',
      [documentId]
    );
    return parseInt((result.rows[0] as { count: string }).count);
  }

  async deleteChunks(documentId: string): Promise<void> {
    await this.db.query('DELETE FROM chunks WHERE document_id = $1', [documentId]);
  }
}
