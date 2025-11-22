/**
 * Pure functions for document chunking
 */

export interface Chunk {
  content: string;
  heading: string | null;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
}

interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
}

/**
 * Split text into sentences using simple heuristics
 */
export function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  const regex = /[.!?]+\s+/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remaining = text.substring(lastIndex).trim();
  if (remaining) {
    sentences.push(remaining);
  }

  return sentences;
}

/**
 * Chunk document content with overlap
 */
export function chunkDocument(
  content: string,
  documentMetadata: { filename: string; mimeType: string },
  options: ChunkingOptions = {}
): Chunk[] {
  const { maxChunkSize = 512, overlapSize = 50 } = options;
  const chunks: Chunk[] = [];

  // Extract heading from markdown (first # line)
  let heading: string | null = null;
  if (documentMetadata.mimeType === 'text/markdown') {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      heading = headingMatch[1].trim();
    }
  }

  // Split into sentences for better semantic chunking
  const sentences = splitIntoSentences(content);

  let currentChunk = '';
  let chunkStartOffset = 0;
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

    if (potentialChunk.length > maxChunkSize && currentChunk) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        heading,
        chunkIndex,
        startOffset: chunkStartOffset,
        endOffset: chunkStartOffset + currentChunk.length,
      });

      chunkIndex++;

      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlapSize);
      currentChunk = overlapText + ' ' + sentence;
      chunkStartOffset = chunkStartOffset + currentChunk.length - overlapText.length - 1;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      heading,
      chunkIndex,
      startOffset: chunkStartOffset,
      endOffset: chunkStartOffset + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Calculate optimal chunk size based on content length
 */
export function calculateOptimalChunkSize(contentLength: number): number {
  if (contentLength < 1000) return 256;
  if (contentLength < 5000) return 512;
  if (contentLength < 20000) return 1024;
  return 2048;
}
