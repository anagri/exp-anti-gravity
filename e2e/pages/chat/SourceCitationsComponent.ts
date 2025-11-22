import { Page, expect, Locator } from '@playwright/test';

interface ScoreData {
  chunkId: string | null;
  vectorScore: number;
  bm25Score: number;
  fusedScore: number;
}

interface ScoreArray {
  vectorScores: number[];
  bm25Scores: number[];
  fusedScores: number[];
}

/**
 * Combined component for citations and sources
 * Maps to src/pages/chat/SourceCitations.tsx
 */
export class SourceCitationsComponent {
  constructor(private readonly page: Page) {}

  // Citation methods (inline citation markers)

  async getCitationCount(): Promise<number> {
    return await this.page.locator('[data-citation-index]').count();
  }

  async hoverCitation(index: number) {
    const citation = this.page.locator(`[data-citation-index="${index}"]`).first();
    await expect(citation).toBeVisible();
    await citation.hover();
  }

  async expectTooltipVisible() {
    await expect(this.page.locator('[data-citation-tooltip]')).toBeVisible();
  }

  // Sources methods (sources footer section)

  async getSourceCount(): Promise<number> {
    return await this.page.locator('[data-source-index]').count();
  }

  async getSourceFilenames(): Promise<string[]> {
    const sources = await this.page.locator('[data-source-filename]').all();
    const filenames = await Promise.all(
      sources.map(s => s.getAttribute('data-source-filename'))
    );
    return filenames.filter((f): f is string => f !== null);
  }

  getSourceAt(messageIndex: number, sourceIndex: number): Locator {
    const messageDiv = this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(messageIndex);
    return messageDiv.locator(`[data-source-index="${sourceIndex}"]`);
  }

  async getScoreData(messageIndex: number, sourceIndex: number): Promise<ScoreData> {
    const source = this.getSourceAt(messageIndex, sourceIndex);

    const chunkId = await source.getAttribute('data-chunk-id');
    const vectorScore = await source.getAttribute('data-vector-score');
    const bm25Score = await source.getAttribute('data-bm25-score');
    const fusedScore = await source.getAttribute('data-fused-score');

    return {
      chunkId,
      vectorScore: parseFloat(vectorScore || '0'),
      bm25Score: parseFloat(bm25Score || '0'),
      fusedScore: parseFloat(fusedScore || '0'),
    };
  }

  async getSourceScores(messageIndex: number): Promise<ScoreArray> {
    const messageDiv = this.page.locator('[data-testid="div-chat-assistant-msg"]').nth(messageIndex);
    const sources = await messageDiv.locator('[data-source-index]').all();

    const vectorScores: number[] = [];
    const bm25Scores: number[] = [];
    const fusedScores: number[] = [];

    for (const source of sources) {
      const vectorScore = await source.getAttribute('data-vector-score');
      const bm25Score = await source.getAttribute('data-bm25-score');
      const fusedScore = await source.getAttribute('data-fused-score');

      vectorScores.push(parseFloat(vectorScore || '0'));
      bm25Scores.push(parseFloat(bm25Score || '0'));
      fusedScores.push(parseFloat(fusedScore || '0'));
    }

    return { vectorScores, bm25Scores, fusedScores };
  }

  async verifyScoreOrdering(messageIndex: number, scoreType: 'fused' | 'vector' | 'bm25'): Promise<void> {
    const scores = await this.getSourceScores(messageIndex);
    const scoreArray = scoreType === 'fused' ? scores.fusedScores :
                       scoreType === 'vector' ? scores.vectorScores :
                       scores.bm25Scores;

    for (let i = 1; i < scoreArray.length; i++) {
      expect(
        scoreArray[i],
        `${scoreType} score at index ${i} (${scoreArray[i]}) is greater than previous (${scoreArray[i - 1]})`
      ).toBeLessThanOrEqual(scoreArray[i - 1]);
    }
  }

  // Backward-compatible aliases
  async getCount(): Promise<number> {
    return await this.getSourceCount();
  }
}
