/**
 * Pure functions for generating embeddings
 */

import type OpenAI from 'openai';

export interface EmbeddingOptions {
  model: string;
  batchSize?: number;
}

/**
 * Generate embeddings for text chunks in batches
 */
export async function generateEmbeddings(
  texts: string[],
  openai: OpenAI,
  options: EmbeddingOptions = { model: 'text-embedding-3-small', batchSize: 100 }
): Promise<number[][]> {
  const { model, batchSize = 100 } = options;
  const embeddings: number[][] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model,
      input: batch,
    });

    embeddings.push(...response.data.map((d) => d.embedding));
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Normalize embedding vector
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vector.map((val) => val / norm) : vector;
}
