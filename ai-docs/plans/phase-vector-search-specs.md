# Phase vector-search: Implementation Specifications

**Status:** Planning - Incremental TDD
**Dependencies:** Phase indexing-pipeline ✅ COMPLETE (9/9 tests passing)
**Goal:** RAG-powered chat with document attachments, HNSW vector search, and source citations

---

## 🎯 Incremental TDD Approach

**Why Incremental TDD:**
- Each phase delivers testable value independently
- Tests pass at end of each phase (not all at the end)
- Earlier phases provide foundation for later phases
- Can stop at any phase with working system
- Faster feedback loops

**Key Principles:**
1. **Real API Testing** - Hit OpenAI API directly (no MSW mocking for @live tests)
2. **Test Isolation** - Regular chat tests don't trigger vector search
3. **Incremental Tests** - Write tests only for current phase, tests pass at phase completion
4. **Progressive Enhancement** - Each phase adds functionality to working system

**Implementation Order:**
1. **Phase hnsw-index** - Create HNSW index for fast vector search
2. **Phase ui-attach-button** - Add attach button to ChatPage
3. **Phase ui-file-selector** - Build file selector modal with search/filter
4. **Phase ui-attachments** - Display attachment badges above chat input
5. **Phase search-api** - Implement searchVectors worker method
6. **Phase rag-integration** - Extend useChat hook with RAG flow
7. **Phase ui-citations** - Parse and display source citations

---

## Overview

Implement Retrieval-Augmented Generation (RAG) functionality that allows users to:
1. Select indexed documents as attachments for chat queries
2. Perform vector similarity search on selected documents only
3. Inject retrieved context into LLM prompts
4. Display source citations with responses

**Key Components:**
1. **HNSW Index** - Fast approximate nearest neighbor search on chunk embeddings
2. **Attach UI** - Button, file selector modal, attachment badges
3. **Vector Search** - Worker method for HNSW queries with document filtering
4. **RAG Flow** - Embed query → search → format context → augment prompt
5. **Citations** - Display source metadata with hover preview

---

## Current Codebase State

**Foundation Exists:**
- **chunks table** (`src/workers/pglite.worker.ts`): Contains document chunks with `embedding vector(1536)` column
- **B-tree index** (`idx_chunks_document`): Efficient lookups by document_id
- **VectorDBContext** (`src/contexts/VectorDBContext.tsx`): Context with documents state, uploadFiles, deleteDocument, refreshDocuments, indexingProgress
- **useChat hook** (`src/hooks/useChat.ts`): Handles chat state, OpenAI streaming API calls, model selection
- **ChatPage** (`src/pages/ChatPage.tsx`): Chat UI with input, message list, model selector
- **DocumentCard** (`src/pages/documents/components/DocumentCard.tsx`): Reusable card with filename, status badges, indexing state
- **DocumentListComponent** (Page Object): E2E test helpers for file selection
- **PG Essays fixtures** (`e2e/fixtures/pg-essays.ts`): Test data (5 essays)
- **Worker** (`src/workers/pglite.worker.ts`): PGlite worker with OpenAI client, pgvector extension enabled

**To Be Implemented:**
- HNSW index on chunks.embedding
- AttachButton, FileSelector, AttachmentBadge, SourceCitation components
- searchVectors() worker method
- RAG flow in useChat hook
- Citation parsing and display
- Vector search E2E test

---

## PGlite + pgvector Capabilities & Best Practices

### Vector Search Capabilities

**PGlite Overview:**
- PostgreSQL WASM running in browser/Node.js (3MB compressed)
- Native pgvector extension support with HNSW indexing
- Storage via IndexedDB (browser) with ~50MB-1GB limits (browser-dependent)
- CRUD queries: <0.3ms, multi-row selects: sub-frame timing
- **Reference:** [PGlite Announcement](https://news.ycombinator.com/item?id=41224689)

**pgvector HNSW Index:**
- No training phase required (unlike IVFFlat) - builds incrementally
- Approximate nearest neighbor search (speed-recall trade-off)
- Supports vectors up to 2,000 dimensions (standard), 4,000 with halfvec
- Better query performance than IVFFlat for small-to-medium datasets
- **Reference:** [pgvector GitHub](https://github.com/pgvector/pgvector)

**Distance Operators:**
- `<->` L2/Euclidean distance (vector_l2_ops) - spatial data
- `<#>` Negative inner product (vector_ip_ops) - fastest for normalized vectors
- `<=>` Cosine distance (vector_cosine_ops) - best for text similarity
- `<+>` L1/Manhattan distance (vector_l1_ops)
- **Reference:** [Supabase HNSW Docs](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)

**Our Choice: Cosine Distance (`<=>`)**
- OpenAI embeddings are normalized (unit vectors)
- Magnitude-independent similarity (best for text)
- Operator: `<=>` (returns distance 0-2, where 0 = identical)
- Similarity formula: `1 - (embedding <=> query)` (returns 0-1)

### Index Parameters

**m (connections per layer):**
- Default: 16 (good for most use cases)
- Range: 12-48
- Higher m = better recall, more memory
- Our choice: 16 (small-to-medium dataset, 1536 dimensions)
- **Reference:** [HNSW Algorithm Params](https://github.com/nmslib/hnswlib/blob/master/ALGO_PARAMS.md)

**ef_construction (build-time candidates):**
- Default: 64
- Should be ≥ 2x the m value
- Higher = better quality index, slower build
- Check quality: Run M-NN search with `ef = ef_construction`, aim for >90% recall
- Our choice: 64 (balanced build time vs quality)
- **Reference:** [Practical Guide to HNSW Hyperparameters](https://opensearch.org/blog/a-practical-guide-to-selecting-hnsw-hyperparameters/)

**ef_search (query-time candidates):**
- Default: 40 (set at runtime)
- Higher = better recall, slower queries
- Can be adjusted per-query: `SET hnsw.ef_search = 100;`
- Our choice: Default 40 initially (adjust if recall insufficient)

### Performance Characteristics

**Query Performance:**
- Sub-50ms for 10K chunks (with default parameters)
- <100ms for 100K chunks
- Scales better than IVFFlat for growing datasets
- **Reference:** [Crunchy Data HNSW](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector)

**Index Build Performance:**
- Slower than IVFFlat (6+ minutes for moderate datasets)
- Incremental build: Inserts 10% slower with HNSW active
- Can create index after bulk inserts for faster initial load
- **Reference:** [AWS HNSW Deep Dive](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)

**Memory Considerations:**
- Index memory usage: `(level + 2) * m` per neighbor tuple
- ~10-20% storage overhead vs raw embeddings
- Browser constraint: Database runs entirely in memory
- Monitor memory consumption via browser DevTools

### Best Practices for Implementation

**Index Creation:**
```sql
-- Create after chunks table exists (worker init)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Query Optimization:**
- Keep queries simple (complex WHERE clauses prevent index usage)
- Avoid CTEs/subqueries when possible
- Use B-tree indexes on filter columns (document_id)
- Always verify with `EXPLAIN ANALYZE`
- **Reference:** [Neon Vector Search Optimization](https://neon.com/docs/ai/ai-vector-search-optimization)

**Browser-Specific:**
- Singleton pattern for single DB instance (already implemented)
- IndexedDB persistence: `new PGlite('idb://db-name', { extensions: { vector } })`
- No `relaxedDurability` (synchronous flush for guaranteed persistence)
- Memory limits: Monitor with DevTools Performance tab

### Practical Examples

**Setup (Already Implemented):**
```typescript
import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'

const db = await PGlite.create({
  dataDir: 'idb://rag-vectors',
  extensions: { vector }
})
```

**Search Query Pattern:**
```sql
-- Set query-time parameter (optional)
SET hnsw.ef_search = 100;

-- Vector search with document filtering
SELECT
  c.id, c.content, c.heading,
  d.filename,
  1 - (c.embedding <=> $1::vector) as similarity
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE c.document_id = ANY($2::uuid[])
  AND c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> $1::vector) >= $3
ORDER BY c.embedding <=> $1::vector ASC
LIMIT $4;
```

**References for Implementation:**
- [Supabase In-Browser Semantic Search](https://supabase.com/blog/in-browser-semantic-search-pglite)
- [Browser Vector Search Example](https://github.com/thorwebdev/browser-vector-search)
- [PGlite Vector Demo Gist](https://gist.github.com/raidendotai/76fe0254590e1a79dbe3c2ea4c95acae)
- [Lantern pgvector Storage](https://lantern.dev/blog/pgvector-storage)

---

## 1. Database Extensions

### 1.1 HNSW Index Creation

**Phase:** Phase hnsw-index

**Purpose:** Enable fast approximate nearest neighbor search on chunk embeddings

**SQL Schema:**
```sql
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Why HNSW:**
- No training step required (unlike IVFFlat)
- Builds incrementally as chunks inserted
- Sub-50ms query time for 1000s of vectors
- Better recall than IVFFlat for small-to-medium datasets

**Why Cosine Distance:**
- OpenAI embeddings are normalized (unit vectors)
- Cosine distance most efficient for normalized vectors
- Operator: `<=>` (cosine distance)
- Similarity formula: `1 - (embedding <=> query_vector)`

**Index Parameters:**
- **m = 16**: Max edges per vector in HNSW graph (default for small datasets)
- **ef_construction = 64**: Candidate queue size during build (default)
- **ef_search**: Query-time parameter (set at runtime if needed: `SET hnsw.ef_search = 100`)

**Index Creation Timing:**
- Create at worker init (after chunks table exists)
- Index builds incrementally as chunks inserted
- No blocking required (index available immediately for queries)

**Performance Expectations:**
- Index size: ~10-20% of embedding data size
- Query latency: <50ms for 10K chunks, <100ms for 100K chunks
- Insert performance: ~10% slower with HNSW active (acceptable for background indexing)

**Implementation Location:**
- Worker init sequence: `src/workers/pglite.worker.ts` (after CREATE TABLE chunks)

**Verification:**
```sql
-- Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'chunks'
  AND indexname = 'idx_chunks_embedding_hnsw';
```

---

## 2. UI Components

### 2.1 Attach Button Component

**Phase:** Phase ui-attach-button

**Location:** `src/pages/ChatPage.tsx` (inline component or extract to `src/components/ui/AttachButton.tsx`)

**Purpose:** Trigger file selector modal from chat interface

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  [Chat Page Header]                     │
├─────────────────────────────────────────┤
│  [Message List]                         │
│  ...                                    │
├─────────────────────────────────────────┤
│  [📎 Attach]  [Input Field]  [Send]    │ ← Attach button
└─────────────────────────────────────────┘
```

**Button Specification:**
- Icon: Paperclip (📎) or lucide-react `Paperclip` icon
- Position: Left of chat input field
- Tooltip: "Attach indexed documents"
- Click behavior: Open file selector modal
- Disabled state: While uploading or waiting for response

**Data Attributes for Testing:**
```typescript
data-testid="btn-attach-files"
data-state="enabled|disabled"
```

**Props Interface:**
```typescript
interface AttachButtonProps {
  onClick: () => void
  disabled?: boolean
}
```

**Integration:**
- Add to ChatPage component near chat input
- Opens FileSelector modal on click
- Disabled during message streaming

### 2.2 File Selector Modal Component

**Phase:** Phase ui-file-selector

**Location:** `src/components/FileSelector.tsx` (NEW)

**Purpose:** Allow users to select indexed documents for RAG context

**Visual Design:**
```
┌───────────────────────────────────────────────┐
│  Select Documents                       [X]   │ ← Modal header
├───────────────────────────────────────────────┤
│  🔍 [Search by filename...]                   │ ← Search bar
├───────────────────────────────────────────────┤
│  ☑ document1.md         ✓ Indexed  [Remove]  │ ← Indexed file (selected)
│  ☐ document2.md         ✓ Indexed            │ ← Indexed file (not selected)
│  ☐ document3.txt        ⏳ Pending           │ ← Non-indexed (disabled checkbox)
│  ☐ document4.md         ⚡ Processing        │ ← Non-indexed (disabled checkbox)
│                                               │
│  [Empty state if no documents]                │
├───────────────────────────────────────────────┤
│  [Cancel]              [Attach Selected (1)]  │ ← Footer
└───────────────────────────────────────────────┘
```

**Requirements:**

1. **File List Display:**
   - Show all uploaded documents
   - Sort alphabetically by filename (ONLY sort option per user requirement)
   - Display indexing status badge for each file
   - Checkbox for file selection

2. **Selection Logic:**
   - Checkbox **enabled** only if `indexing_status = 'completed'`
   - Checkbox **disabled** if `indexing_status IN ('pending', 'processing', 'failed')`
   - Show indexing status badge next to filename
   - Visually distinguish disabled files (gray text, disabled cursor)

3. **Search Bar:**
   - Filter files by filename (client-side, case-insensitive)
   - Placeholder: "Search by filename..."
   - Clear button when text entered

4. **Modal Footer:**
   - "Cancel" button: Close modal without changes
   - "Attach Selected (N)" button: Confirm selection and close modal
   - Attach button disabled if no files selected

**Data Attributes for Testing:**
```typescript
// Modal
data-testid="modal-file-selector"
data-state="open|closed"

// Search bar
data-testid="input-file-search"

// File list item
data-testid="file-selector-item-{documentId}"
data-indexing-status="pending|processing|completed|failed"
data-selected="true|false"

// Checkbox
data-testid="checkbox-file-{documentId}"
data-disabled="true|false"

// Footer buttons
data-testid="btn-cancel-file-selector"
data-testid="btn-confirm-file-selector"
data-selected-count="N"
```

**Props Interface:**
```typescript
interface FileSelectorProps {
  documents: Document[]
  selectedDocumentIds: string[]
  onSelectionChange: (documentIds: string[]) => void
  onClose: () => void
}
```

**State Management:**
- Local state: `selectedFiles` (string[])
- Search query state
- On confirm: call `onSelectionChange(selectedFiles)`

**Reuse Existing Components:**
- **IndexingStatusBadge** (`src/pages/documents/components/IndexingStatusBadge.tsx`) - Already exists
- **Radix UI Dialog** - For modal container (already used in DeleteModal)
- **Search input** - shadcn/ui pattern

### 2.3 Attachment Badges Component

**Phase:** Phase ui-attachments

**Location:** `src/components/AttachmentBadges.tsx` (NEW)

**Purpose:** Display selected documents as badges above chat input

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  [Message List]                         │
│  ...                                    │
├─────────────────────────────────────────┤
│  📎 document1.md [x]  document2.md [x]  │ ← Attachment badges
├─────────────────────────────────────────┤
│  [📎 Attach]  [Input Field]  [Send]    │
└─────────────────────────────────────────┘
```

**Badge Specification:**
- Icon: Paperclip prefix
- Text: Filename (truncate if >20 chars: "document-very-lo...")
- Remove button: [x] icon
- Styling: Light gray background, rounded, small padding
- Hover: Darker background, show full filename in tooltip

**Data Attributes for Testing:**
```typescript
data-testid="attachment-badge-{documentId}"
data-filename="{filename}"

// Remove button
data-testid="btn-remove-attachment-{documentId}"
```

**Props Interface:**
```typescript
interface AttachmentBadgesProps {
  attachedDocuments: Array<{ id: string, filename: string }>
  onRemove: (documentId: string) => void
}
```

**Behavior:**
- Display only when `attachedDocuments.length > 0`
- Click [x] button: Remove attachment, trigger `onRemove(documentId)`
- Hover badge: Show full filename in tooltip

**Layout:**
- Position: Above chat input, below message list
- Wrap badges if multiple (flex-wrap)
- Max visible badges: All (no limit)

### 2.4 Source Citations Component

**Phase:** Phase ui-citations

**Location:** `src/components/SourceCitations.tsx` (NEW)

**Purpose:** Display source metadata for RAG responses with hover preview

**Visual Design:**
```
┌─────────────────────────────────────────┐
│  [Assistant Message]                    │
│  Based on the documents, equity is...   │
│  As mentioned in [1] and [2]...         │ ← Citation markers
│                                         │
│  ─────────────────────────────────────  │ ← Divider
│  Sources:                               │
│  [1] document1.md - Section Title       │ ← Source entry
│      Similarity: 0.87                   │
│  [2] document2.md - Introduction        │
│      Similarity: 0.82                   │
└─────────────────────────────────────────┘
```

**Citation Marker (Inline):**
- Format: `[1]`, `[2]`, `[3]`, etc.
- Styling: Superscript, blue color, clickable
- Hover: Show chunk preview in tooltip (first 100 chars)
- Click: Scroll to source entry in footer

**Source Entry (Footer):**
- Format: `[N] filename - heading`
- Metadata: Similarity score (1 decimal place)
- Styling: Light gray background, small text, rounded corners
- Hover: Expand to show full chunk content
- Click (optional): Navigate to document page (future enhancement)

**Data Attributes for Testing:**
```typescript
// Citation marker (inline)
data-testid="citation-marker-{index}"
data-source-index="{index}"

// Source entry (footer)
data-testid="source-entry-{index}"
data-filename="{filename}"
data-similarity="{similarity}"
data-document-id="{documentId}"
data-chunk-index="{chunkIndex}"
```

**Props Interface:**
```typescript
interface SourceCitationsProps {
  sources: Array<{
    index: number          // 1-based citation number
    filename: string
    heading?: string
    content: string        // Full chunk content
    similarity: number     // 0-1
    documentId: string
    chunkIndex: number
  }>
}
```

**Citation Parsing Strategy:**
- Parse assistant message for `[N]` patterns
- Match numbers to source indices
- Replace with clickable citation markers
- Render sources footer at bottom of message

**Tooltip Content:**
- Citation marker hover: First 100 chars of chunk content + "..."
- Source entry hover: Full chunk content (scrollable if long)

---

## 3. Worker API Extensions

### 3.1 searchVectors Method

**Phase:** Phase search-api

**Location:** `src/workers/pglite.worker.ts` (ADD)

**Purpose:** Perform HNSW vector similarity search on selected documents

**Method Signature:**
```typescript
interface SearchParams {
  query: string                    // User query text
  documentIds: string[]            // Selected document IDs
  topK?: number                    // Number of results (default: 10)
  similarityThreshold?: number     // Minimum similarity (default: 0.7)
}

interface SearchResult {
  chunkId: string
  documentId: string
  filename: string
  heading?: string
  content: string
  chunkIndex: number
  similarity: number               // 0-1 (1 = identical)
}

async function searchVectors(params: SearchParams): Promise<SearchResult[]>
```

**Implementation Flow:**

1. **Validate OpenAI Client:**
   ```typescript
   if (!openaiClient) {
     throw new Error('OpenAI client not initialized. Set API key in settings.')
   }
   ```

2. **Generate Query Embedding:**
   ```typescript
   const embeddingResponse = await openaiClient.embeddings.create({
     model: 'text-embedding-3-small',
     input: params.query,
     dimensions: 1536,
   })

   const queryEmbedding = embeddingResponse.data[0].embedding
   ```

3. **Execute HNSW Search Query:**
   ```sql
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
   ```

   **Query Parameters:**
   - `$1`: Query embedding vector (format: `[${queryEmbedding.join(',')}]`)
   - `$2`: Document IDs array (format: `{uuid1,uuid2,...}`)
   - `$3`: Similarity threshold (default: 0.7)
   - `$4`: Top-K limit (default: 10)

4. **Return Results:**
   ```typescript
   return result.rows.map(row => ({
     chunkId: row.chunk_id,
     documentId: row.document_id,
     filename: row.filename,
     heading: row.heading,
     content: row.content,
     chunkIndex: row.chunk_index,
     similarity: row.similarity,
   }))
   ```

**Error Handling:**
- No API key: Throw descriptive error
- No documents selected: Return empty array
- Embedding API failure: Retry with exponential backoff (reuse existing retry logic)
- No results above threshold: Return empty array (valid case)

**Performance Considerations:**
- HNSW index provides sub-50ms query time for 10K chunks
- Embedding API call: ~100-300ms
- Total latency: ~150-350ms (acceptable for UX)

**Default Values:**
```typescript
const topK = params.topK ?? 10
const similarityThreshold = params.similarityThreshold ?? 0.7
```

**Worker Export:**
```typescript
Comlink.expose({
  // ... existing methods
  searchVectors,
})
```

**VectorDBContext Integration:**
```typescript
// Add to VectorDBContext
const searchVectors = async (query: string, documentIds: string[]) => {
  return await worker.searchVectors({ query, documentIds })
}
```

---

## 4. RAG Flow Implementation

### 4.1 useChat Hook Extensions

**Phase:** Phase rag-integration

**Location:** `src/hooks/useChat.ts` (EXTEND)

**Purpose:** Integrate vector search and context injection into chat flow

**State Extensions:**
```typescript
interface UseChatReturn {
  // ... existing fields
  attachedDocumentIds: string[]
  setAttachedDocumentIds: (ids: string[]) => void
  sources: SearchResult[]              // Last RAG query sources
  isSearching: boolean                 // Vector search in progress
}
```

**RAG-Enhanced sendMessage Flow:**

**BEFORE (Current):**
```typescript
async function sendMessage(content: string) {
  // 1. Add user message to history
  // 2. Send to OpenAI chat API
  // 3. Stream response
}
```

**AFTER (RAG-Enhanced):**
```typescript
async function sendMessage(content: string) {
  // 1. Add user message to history
  addMessage({ role: 'user', content })

  // 2. Check if RAG mode active (attachments exist)
  if (attachedDocumentIds.length > 0) {
    setIsSearching(true)

    // 3. Perform vector search
    const searchResults = await worker.searchVectors({
      query: content,
      documentIds: attachedDocumentIds,
      topK: 10,
      similarityThreshold: 0.7,
    })

    setSources(searchResults)
    setIsSearching(false)

    // 4. Format context from search results
    const context = formatContext(searchResults)

    // 5. Inject context into system message
    const systemMessage = {
      role: 'system',
      content: `You are a helpful assistant. Answer the user's question using the provided context.
If the context doesn't contain enough information, say so.

CONTEXT:
${context}

Provide citations using [1], [2] format when referencing specific sources.`,
    }

    // 6. Prepend system message to conversation
    const messagesWithContext = [systemMessage, ...messages, { role: 'user', content }]

    // 7. Send to OpenAI chat API
    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: messagesWithContext,
      stream: true,
    })

    // 8. Stream response (existing logic)
    // ...
  } else {
    // No attachments: normal chat flow (existing)
    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: [...messages, { role: 'user', content }],
      stream: true,
    })

    // Stream response (existing logic)
    // ...
  }
}
```

**Helper Function: formatContext**

**Phase:** Phase rag-integration

**Purpose:** Format search results into structured context for LLM

```typescript
function formatContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant context found in attached documents.'
  }

  return results
    .map((result, index) => {
      const sourceNumber = index + 1
      const heading = result.heading ? ` - ${result.heading}` : ''

      return `[Source ${sourceNumber}] ${result.filename}${heading}
${result.content}
`
    })
    .join('\n\n')
}
```

**Example Formatted Context:**
```
[Source 1] equity_equation.md - Introduction
In the startup world, equity represents ownership. When founders give equity to employees...

[Source 2] equity_equation.md - Vesting Schedules
Vesting typically occurs over four years with a one-year cliff. This means...

[Source 3] inequality_and_risk.md - Risk and Reward
The relationship between risk and equity is fundamental. Higher risk justifies...
```

**State Management:**
```typescript
const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([])
const [sources, setSources] = useState<SearchResult[]>([])
const [isSearching, setIsSearching] = useState(false)
```

**Integration with ChatPage:**
```typescript
// ChatPage.tsx
const {
  messages,
  sendMessage,
  attachedDocumentIds,
  setAttachedDocumentIds,
  sources,
  isSearching,
} = useChat()
```

**Loading State:**
- Display "Searching documents..." indicator during vector search
- Disable input while `isSearching === true`
- Show sources after response completes

---

## 5. Context Formatting Strategy

### 5.1 System Prompt Template

**Phase:** Phase rag-integration

**Purpose:** Inject retrieved context into LLM prompt with clear instructions

**Template Structure:**
```typescript
const SYSTEM_PROMPT_TEMPLATE = `You are a helpful assistant. Answer the user's question using ONLY the provided context below.

IMPORTANT INSTRUCTIONS:
- Use ONLY information from the CONTEXT section below
- If the context doesn't contain enough information to answer fully, say: "Based on the provided documents, I can only partially answer: [partial answer]. The documents don't contain information about [missing info]."
- Cite your sources using [1], [2], [3] format when referencing specific context
- Do not make up information not present in the context
- If the question is completely unrelated to the context, say: "I cannot answer this question based on the provided documents."

CONTEXT:
{{CONTEXT}}

Now answer the user's question using the context above. Remember to cite sources with [1], [2], etc.`
```

**Context Injection:**
```typescript
const systemMessage = {
  role: 'system',
  content: SYSTEM_PROMPT_TEMPLATE.replace('{{CONTEXT}}', formatContext(searchResults)),
}
```

### 5.2 Citation Format

**Phase:** Phase ui-citations

**Purpose:** Standardize citation markers for parsing and display

**Format Specification:**
- **Marker:** `[N]` where N is 1-based index
- **Position:** Inline after referenced statement
- **Mapping:** `[1]` maps to first search result, `[2]` to second, etc.

**Example Response with Citations:**
```
Assistant: Based on the documents, equity in startups represents ownership and is typically distributed over a vesting schedule [1]. The relationship between risk and equity is fundamental, where higher risk justifies greater equity allocation [3]. Vesting commonly occurs over four years with a one-year cliff [2].
```

**Citation Parsing (Client-Side):**
```typescript
function parseCitations(messageContent: string): Array<{ text: string, citationIndex?: number }> {
  const parts: Array<{ text: string, citationIndex?: number }> = []
  const regex = /\[(\d+)\]/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(messageContent)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push({ text: messageContent.substring(lastIndex, match.index) })
    }

    // Add citation marker
    parts.push({
      text: `[${match[1]}]`,
      citationIndex: parseInt(match[1], 10),
    })

    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < messageContent.length) {
    parts.push({ text: messageContent.substring(lastIndex) })
  }

  return parts
}
```

**Rendering Citations:**
```typescript
// In message component
const parsedContent = parseCitations(message.content)

return (
  <div>
    {parsedContent.map((part, index) => {
      if (part.citationIndex !== undefined) {
        return (
          <CitationMarker
            key={index}
            index={part.citationIndex}
            source={sources[part.citationIndex - 1]}
          />
        )
      }
      return <span key={index}>{part.text}</span>
    })}
  </div>
)
```

---

## 6. Testing Strategy

### 6.1 E2E Test Pattern

**Test File:** `e2e/vector-search-workflow.spec.ts` (NEW)

**Test Tags:** `@live` (hits real OpenAI API, costs money)

**Purpose:** Validate complete RAG workflow end-to-end

**Test Scenario:**
```typescript
import { test, expect } from './fixtures/globalSetup'
import { DocumentPage } from './pages/DocumentPage'
import { ChatPage } from './pages/ChatPage'
import { PG_ESSAYS, PG_ESSAY_NAMES } from './fixtures/pg-essays'
import { loadTestApiKey } from './utils/env'

const EQUITY_FILENAME = PG_ESSAY_NAMES.EQUITY       // 078 (SHORT - 1,142 words)
const INEQUALITY_FILENAME = PG_ESSAY_NAMES.INEQUALITY // 049 (MEDIUM - 2,854 words)

test.describe('Vector Search & RAG Workflow @live', () => {
  let documentsPage: DocumentPage
  let chatPage: ChatPage
  let apiKey: string

  test.beforeAll(() => {
    apiKey = loadTestApiKey()
  })

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentPage(page)
    chatPage = new ChatPage(page)
    await documentsPage.setup(apiKey)
  })

  test('RAG workflow: upload → index → attach → search → cite → selective attachment', async ({ page }) => {
    // ─────────────────────────────────────────────────────────
    // PHASE 1: Upload & Index Two Essays
    // ─────────────────────────────────────────────────────────
    await documentsPage.expectEmptyState()

    // Upload 078_the_equity_equation.md
    await documentsPage.uploadFiles(PG_ESSAYS.EQUITY)
    await documentsPage.documentList.waitForFileToAppear(EQUITY_FILENAME)
    const equityFileId = await documentsPage.documentList.findFileByName(EQUITY_FILENAME)
    if (!equityFileId) throw new Error('Equity file not found after upload')

    // Upload 049_inequality_and_risk.md
    await documentsPage.uploadFiles(PG_ESSAYS.INEQUALITY)
    await documentsPage.documentList.waitForFileToAppear(INEQUALITY_FILENAME)
    const inequalityFileId = await documentsPage.documentList.findFileByName(INEQUALITY_FILENAME)
    if (!inequalityFileId) throw new Error('Inequality file not found after upload')

    // Wait for both files to complete indexing
    await documentsPage.documentList.waitForIndexingStatus(equityFileId, 'completed')
    await documentsPage.documentList.waitForIndexingStatus(inequalityFileId, 'completed')

    // Verify chunk counts > 0
    const equityChunkCount = await documentsPage.documentList.getChunkCount(equityFileId)
    const inequalityChunkCount = await documentsPage.documentList.getChunkCount(inequalityFileId)
    expect(equityChunkCount).toBeGreaterThan(0)
    expect(inequalityChunkCount).toBeGreaterThan(0)

    // ─────────────────────────────────────────────────────────
    // PHASE 2: Navigate to Chat & Attach Files
    // ─────────────────────────────────────────────────────────
    await chatPage.navigate()
    await chatPage.expectReady()

    // Click attach button
    await chatPage.clickAttachButton()

    // File selector modal should open
    await chatPage.fileSelector.expectOpen()

    // Verify both files appear in selector
    await chatPage.fileSelector.expectFileVisible(EQUITY_FILENAME)
    await chatPage.fileSelector.expectFileVisible(INEQUALITY_FILENAME)

    // Verify both files have "completed" status (indexed)
    await chatPage.fileSelector.expectFileIndexed(EQUITY_FILENAME, true)
    await chatPage.fileSelector.expectFileIndexed(INEQUALITY_FILENAME, true)

    // Select both files
    await chatPage.fileSelector.selectFile(EQUITY_FILENAME)
    await chatPage.fileSelector.selectFile(INEQUALITY_FILENAME)

    // Confirm selection
    await chatPage.fileSelector.confirmSelection()

    // Verify attachment badges appear (count=2)
    await chatPage.expectAttachmentBadges(2)
    await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME)
    await chatPage.expectAttachmentBadgeVisible(INEQUALITY_FILENAME)

    // ─────────────────────────────────────────────────────────
    // PHASE 3: Submit RAG Query
    // ─────────────────────────────────────────────────────────
    const ragQuery = 'What does Paul Graham say about equity and risk?'
    await chatPage.sendMessage(ragQuery)

    // Wait for response to complete
    await chatPage.waitForAssistantResponse()

    // Verify response contains citations
    const citationCount = await chatPage.getCitationCount()
    expect(citationCount).toBeGreaterThanOrEqual(1) // At least one citation

    // Verify sources displayed in footer
    const sourcesCount = await chatPage.getSourcesCount()
    expect(sourcesCount).toBeGreaterThanOrEqual(1)
    expect(sourcesCount).toBeLessThanOrEqual(10) // Max top-k

    // Verify sources reference both documents (may not always be true, but likely)
    const sourceFilenames = await chatPage.getSourceFilenames()
    // Note: Not asserting both files cited because query may only match one document well

    // ─────────────────────────────────────────────────────────
    // PHASE 4: Citation Interaction
    // ─────────────────────────────────────────────────────────
    // Hover over first citation marker
    await chatPage.hoverCitation(1)

    // Verify tooltip shows chunk preview
    await chatPage.expectCitationTooltipVisible()

    // ─────────────────────────────────────────────────────────
    // PHASE 5: Selective Attachment (Remove One File)
    // ─────────────────────────────────────────────────────────
    // Remove inequality file attachment
    await chatPage.removeAttachment(INEQUALITY_FILENAME)

    // Verify only one badge remains
    await chatPage.expectAttachmentBadges(1)
    await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME)

    // Submit query again (now only equity context)
    const selectiveQuery = 'What is the equity equation?'
    await chatPage.sendMessage(selectiveQuery)

    // Wait for response
    await chatPage.waitForAssistantResponse()

    // Verify response still contains citations
    const selectiveCitationCount = await chatPage.getCitationCount()
    expect(selectiveCitationCount).toBeGreaterThanOrEqual(1)

    // Verify sources only reference equity document
    const selectiveSourceFilenames = await chatPage.getSourceFilenames()
    expect(selectiveSourceFilenames).toContain(EQUITY_FILENAME)
    expect(selectiveSourceFilenames).not.toContain(INEQUALITY_FILENAME)

    // ─────────────────────────────────────────────────────────
    // PHASE 6: Remove All Attachments (Normal Chat)
    // ─────────────────────────────────────────────────────────
    await chatPage.removeAttachment(EQUITY_FILENAME)

    // Verify no badges remain
    await chatPage.expectAttachmentBadges(0)

    // Submit normal chat query (no RAG)
    const normalQuery = 'What is 2 + 2?'
    await chatPage.sendMessage(normalQuery)

    // Wait for response
    await chatPage.waitForAssistantResponse()

    // Verify response has no citations (normal chat)
    const normalCitationCount = await chatPage.getCitationCount()
    expect(normalCitationCount).toBe(0)

    // Verify no sources displayed
    const normalSourcesCount = await chatPage.getSourcesCount()
    expect(normalSourcesCount).toBe(0)
  })
})
```

**Cost Estimation:**
- Per test run: ~$0.001-0.002
  - 2 essays indexed: ~$0.0005
  - 3 RAG queries (2 files + 1 file + 0 files): ~$0.0005-0.001
- Total: Acceptable for live testing

**Test Execution:**
```bash
# Run only vector search test
npm run test:e2e:live -- e2e/vector-search-workflow.spec.ts

# Run all live tests (chat + indexing + vector search)
npm run test:e2e:live
```

### 6.2 Page Object Extensions

**ChatPage POM:**

**Location:** `e2e/pages/ChatPage.ts` (EXTEND)

**New Methods:**
```typescript
class ChatPage {
  // ... existing methods

  // Attach button
  async clickAttachButton() {
    await this.page.click('[data-testid="btn-attach-files"]')
  }

  // Attachment badges
  async expectAttachmentBadges(count: number) {
    const badges = this.page.locator('[data-testid^="attachment-badge-"]')
    await expect(badges).toHaveCount(count)
  }

  async expectAttachmentBadgeVisible(filename: string) {
    const badge = this.page.locator(`[data-testid^="attachment-badge-"][data-filename="${filename}"]`)
    await expect(badge).toBeVisible()
  }

  async removeAttachment(filename: string) {
    const badge = this.page.locator(`[data-testid^="attachment-badge-"][data-filename="${filename}"]`)
    const removeBtn = badge.locator('[data-testid^="btn-remove-attachment-"]')
    await removeBtn.click()
  }

  // Citations
  async getCitationCount(): Promise<number> {
    const citations = this.page.locator('[data-testid^="citation-marker-"]')
    return await citations.count()
  }

  async hoverCitation(index: number) {
    const citation = this.page.locator(`[data-testid="citation-marker-${index}"]`)
    await citation.hover()
  }

  async expectCitationTooltipVisible() {
    // Tooltip implementation-dependent (Radix UI Tooltip or custom)
    const tooltip = this.page.locator('[role="tooltip"]')
    await expect(tooltip).toBeVisible()
  }

  // Sources
  async getSourcesCount(): Promise<number> {
    const sources = this.page.locator('[data-testid^="source-entry-"]')
    return await sources.count()
  }

  async getSourceFilenames(): Promise<string[]> {
    const sources = this.page.locator('[data-testid^="source-entry-"]')
    const filenames = await sources.evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-filename') || '')
    )
    return filenames.filter(Boolean)
  }

  // File selector
  get fileSelector() {
    return new FileSelectorComponent(this.page)
  }
}
```

**FileSelectorComponent POM:**

**Location:** `e2e/pages/chat/FileSelectorComponent.ts` (NEW)

**Implementation:**
```typescript
import { Page, expect } from '@playwright/test'

export class FileSelectorComponent {
  constructor(private page: Page) {}

  async expectOpen() {
    const modal = this.page.locator('[data-testid="modal-file-selector"]')
    await expect(modal).toHaveAttribute('data-state', 'open')
  }

  async expectFileVisible(filename: string) {
    const fileItem = this.page.locator(`[data-testid^="file-selector-item-"]`).filter({ hasText: filename })
    await expect(fileItem).toBeVisible()
  }

  async expectFileIndexed(filename: string, isIndexed: boolean) {
    const fileItem = this.page.locator(`[data-testid^="file-selector-item-"]`).filter({ hasText: filename })
    const expectedStatus = isIndexed ? 'completed' : /pending|processing|failed/
    await expect(fileItem).toHaveAttribute('data-indexing-status', expectedStatus)
  }

  async searchFiles(query: string) {
    const searchInput = this.page.locator('[data-testid="input-file-search"]')
    await searchInput.fill(query)
  }

  async selectFile(filename: string) {
    const fileItem = this.page.locator(`[data-testid^="file-selector-item-"]`).filter({ hasText: filename })
    const checkbox = fileItem.locator('[data-testid^="checkbox-file-"]')
    await checkbox.check()
  }

  async confirmSelection() {
    const confirmBtn = this.page.locator('[data-testid="btn-confirm-file-selector"]')
    await confirmBtn.click()
  }
}
```

---

## 7. Incremental TDD Workflow (7 Phases)

**Vertical Slice Approach:**
Each phase builds a complete vertical slice: **DB/Worker + UI + Tests**. Every phase delivers independently testable value.

**Workflow per Phase:**
1. **Test-First (TDD):** Write/extend tests BEFORE implementation (where applicable)
2. **Build:** Implement database/worker changes, UI updates, logic to make tests pass
3. **Run All Tests:** Execute full test suite (unit + E2E, including @live tests)
4. **Investigate Failures:** NO timeouts in tests - investigate actual issues, write specific isolation tests if needed
5. **Update Spec:** Document actual implementation details retrospectively in this spec file
6. **Review Diff:** `git diff` to review all changes made during phase
7. **Clean Up:** Remove console.logs, commented code, temporary hacks
8. **Commit:** `git commit` with conventional message (e.g., `feat(vector-search): implement HNSW index creation`)
9. **Verify:** All tests still pass after commit

**Testing Philosophy:**
- **TDD:** Write tests first (E2E for features, unit for complex logic)
- **No Timeouts:** If test fails, investigate root cause - don't add `waitForTimeout()`
- **Failure Investigation:** Write isolated test to reproduce issue, fix root cause
- **Data Attributes:** All UI elements have `data-testid` for reliable selection
- **Playwright Auto-Wait:** Use `expect().toHaveAttribute()` pattern, let Playwright wait
- **Real APIs:** @live tests hit real OpenAI API (costs ~$0.001-0.002 per run)

**Example Investigation Workflow:**
```typescript
// ❌ BAD: Masking issue with timeout
test('search returns results', async ({ page }) => {
  await chatPage.sendMessage('query')
  await page.waitForTimeout(5000) // Why 5 seconds? What are we waiting for?
  const results = await chatPage.getSourcesCount()
  expect(results).toBeGreaterThan(0)
})

// ✅ GOOD: Use data attributes and Playwright auto-wait
test('search returns results', async ({ page }) => {
  await chatPage.sendMessage('query')
  await chatPage.waitForAssistantResponse() // Waits for data-test-state="ready"
  const results = await chatPage.getSourcesCount()
  expect(results).toBeGreaterThan(0)
})

// If test fails intermittently:
// 1. Run test with --debug to inspect actual state
// 2. Check browser console for errors
// 3. Verify data attributes are set correctly
// 4. Write isolated test to reproduce specific failure
// 5. Fix root cause (don't add timeout)
```

---

### **Phase hnsw-index**: HNSW Index Creation

**Goal:** Create HNSW index on chunks.embedding for fast vector search

**1. Test-First:**
No specific test for this phase (index creation verified by subsequent search tests).

**2. Build:**
- Add HNSW index creation to worker init sequence (after CREATE TABLE chunks)
- SQL: `CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
- Verify index exists after init

**3. Run All Tests:**
```bash
npm test                          # Unit tests
npm run test:e2e                  # E2E tests (no @live)
npm run test:e2e:live             # Live tests (with real API)
npm run lint                      # Linting
npm run build                     # TypeScript compilation
```

**4. Investigate Failures:**
- If existing indexing tests fail: Check if index creation blocks or slows down init
- If build fails: Check TypeScript types for pgvector operators
- If tests timeout: Verify index creation doesn't block indefinitely

**5. Update Spec:**
**ACTUAL IMPLEMENTATION:**
- ✅ Exact SQL: `CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
- ✅ Index parameters: m=16, ef_construction=64 (as specified)
- ✅ Init sequence: Index created immediately after chunks table creation (line 124-130 in pglite.worker.ts)
- ✅ Performance: No observable slowdown in init or existing tests (unit: 1.25s, E2E: 16.3s, live: 13.6s)
- ✅ Worker logs: Updated to indicate HNSW index creation

**6. Review Diff:**
```bash
git diff src/workers/pglite.worker.ts
# Verify: HNSW index creation added in correct location
# Verify: No unintended changes to other init code
```

**7. Clean Up:**
- Remove any console.logs added during development
- Remove commented-out alternative SQL
- Verify no temporary test code left

**8. Commit:**
```bash
git add src/workers/pglite.worker.ts ai-docs/plans/phase-vector-search-specs.md
git commit -m "feat(vector-search): create HNSW index on chunks.embedding

Add HNSW index creation to worker init sequence for fast vector
similarity search. Uses cosine distance operator (vector_cosine_ops)
optimized for normalized OpenAI embeddings.

Index parameters:
- m=16 (connections per layer)
- ef_construction=64 (build-time candidates)
- Builds incrementally, no training phase required

Performance: Sub-50ms queries for 10K chunks"
```

**9. Verify:**
```bash
# Run tests again after commit
npm run test:e2e:live -- e2e/indexing-workflow-basic.spec.ts
# Verify existing indexing test still passes (index doesn't break workflow)
```

**Pass Criteria:**
- ✅ HNSW index created on chunks.embedding
- ✅ Index uses vector_cosine_ops
- ✅ Worker init completes successfully
- ✅ All tests passing (9/9 E2E + 2/2 @live)
- ✅ No TypeScript errors
- ✅ Changes committed with descriptive message

**Checkpoint:** HNSW index ready for vector search

---

### **Phase ui-attach-button**: Attach Button UI

**Goal:** Add attach button to ChatPage that opens file selector modal

**Build:**
- ✅ Add attach button to ChatPage (left of input field)
- ✅ Use lucide-react `Paperclip` icon
- ✅ Add modal state: `isFileSelectorOpen`
- ✅ Button click: `setIsFileSelectorOpen(true)`
- ✅ Add data attributes: `data-testid="btn-attach-files"`, `data-state`

**ACTUAL IMPLEMENTATION:**
- ✅ Added Paperclip icon import from lucide-react
- ✅ Added state: `const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false)`
- ✅ Added attach button with proper data attributes (data-testid, data-state)
- ✅ Button positioned left of input field using flex layout
- ✅ Button disabled during loading (same as send button)
- ✅ Added placeholder modal with backdrop, close button, and proper data attributes
- ✅ Modal uses same pattern as DeleteModal (simple div with backdrop)
- ✅ All tests passing (unit: 14/14, E2E: 4/4)

**Test:** Manual verification (E2E test comes later)
- Navigate to /chat
- Click attach button
- Verify modal opens (placeholder modal OK for now)

**Pass Criteria:**
- ✅ Attach button visible on ChatPage (line 141-153 in ChatPage.tsx)
- ✅ Button opens file selector modal (placeholder implementation)
- ✅ Data attributes present (btn-attach-files, modal-file-selector)
- ✅ No TypeScript errors (build successful)

**Checkpoint:** Attach button functional, ready for file selector implementation

---

### **Phase ui-file-selector**: File Selector Modal

**Goal:** Build file selector modal with search, filter by indexed status, checkbox selection

**Build:**
- ✅ Create `src/components/FileSelector.tsx`
- ✅ Use simple modal pattern (same as DeleteModal, no Radix needed)
- ✅ Fetch documents from VectorDBContext
- ✅ Display file list:
  - ✅ Sort alphabetically by filename (localeCompare with case-insensitive)
  - ✅ Show indexing status badge (reuse IndexingStatusBadge)
  - ✅ Checkbox enabled only if `indexing_status = 'completed'`
  - ✅ Disable checkbox for non-indexed files
- ✅ Add search bar (client-side filter by filename)
- ✅ Add footer buttons: Cancel, Attach Selected (N)
- ✅ Add data attributes (all UI elements)

**ACTUAL IMPLEMENTATION:**
- ✅ Created FileSelector.tsx component with full functionality
- ✅ Local selection state management with Set<string> for efficiency
- ✅ useMemo for sorting (alphabetical) and filtering (search query)
- ✅ Checkbox click handler respects completed status
- ✅ Search bar with clear button (X icon)
- ✅ Empty state messages (no documents / no search results)
- ✅ Proper data attributes for testing:
  - modal-file-selector (data-state="open")
  - input-file-search
  - file-selector-item-{id} (data-indexing-status, data-selected)
  - checkbox-file-{id} (data-disabled)
  - btn-cancel-file-selector, btn-confirm-file-selector (data-selected-count)
- ✅ Integrated into ChatPage with VectorDBContext and attachedDocumentIds state
- ✅ Replaced placeholder modal from Phase ui-attach-button
- ✅ All tests passing (unit: 14/14, E2E: 4/4)

**Test:** Extend `e2e/vector-search-workflow.spec.ts` (partial test)
```typescript
test('file selector shows indexed files with enabled checkboxes', async ({ page }) => {
  // Upload & index 2 essays (reuse indexing setup)
  // ...

  // Navigate to chat
  await chatPage.navigate()

  // Click attach button
  await chatPage.clickAttachButton()

  // File selector modal opens
  await chatPage.fileSelector.expectOpen()

  // Verify both indexed files visible
  await chatPage.fileSelector.expectFileVisible(EQUITY_FILENAME)
  await chatPage.fileSelector.expectFileVisible(INEQUALITY_FILENAME)

  // Verify both files marked as indexed
  await chatPage.fileSelector.expectFileIndexed(EQUITY_FILENAME, true)
  await chatPage.fileSelector.expectFileIndexed(INEQUALITY_FILENAME, true)

  // Test search
  await chatPage.fileSelector.searchFiles('equity')
  await chatPage.fileSelector.expectFileVisible(EQUITY_FILENAME)
  // Note: inequality file should be hidden (not asserting for simplicity)
})
```

**Pass Criteria:**
- ✅ File selector modal displays all documents (from VectorDBContext)
- ✅ Files sorted alphabetically (case-insensitive localeCompare)
- ✅ Indexed files have enabled checkboxes (status === 'completed')
- ✅ Non-indexed files have disabled checkboxes (with opacity-60, cursor-not-allowed)
- ✅ Search bar filters by filename (client-side, case-insensitive includes)
- ✅ Cancel button closes modal (onClose callback)
- ✅ Confirm button closes modal and returns selection (onSelectionChange + onClose)
- ⏭️ E2E test skipped (will be implemented in comprehensive workflow test)

**Checkpoint:** File selector functional, ready for attachment badge display

---

### **Phase ui-attachments**: Attachment Badges Display

**Goal:** Display selected files as badges above chat input, allow removal

**Build:**
- Create `src/components/AttachmentBadges.tsx`
- Add state to ChatPage: `attachedDocumentIds` (string[])
- Display badges above chat input when `attachedDocumentIds.length > 0`
- Badge format: 📎 filename [x]
- Click [x]: Remove from `attachedDocumentIds`
- Add data attributes

**Test:** Extend `e2e/vector-search-workflow.spec.ts` (phases 2 & 5)
```typescript
test('attachment badges display and removal', async ({ page }) => {
  // ... file selector test setup

  // Select both files
  await chatPage.fileSelector.selectFile(EQUITY_FILENAME)
  await chatPage.fileSelector.selectFile(INEQUALITY_FILENAME)
  await chatPage.fileSelector.confirmSelection()

  // Verify badges appear
  await chatPage.expectAttachmentBadges(2)
  await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME)
  await chatPage.expectAttachmentBadgeVisible(INEQUALITY_FILENAME)

  // Remove one badge
  await chatPage.removeAttachment(INEQUALITY_FILENAME)

  // Verify only one badge remains
  await chatPage.expectAttachmentBadges(1)
  await chatPage.expectAttachmentBadgeVisible(EQUITY_FILENAME)

  // Remove last badge
  await chatPage.removeAttachment(EQUITY_FILENAME)

  // Verify no badges
  await chatPage.expectAttachmentBadges(0)
})
```

**Pass Criteria:**
- ✅ Attachment badges display above input
- ✅ Badges show filename with remove button
- ✅ Remove button removes attachment
- ✅ Badges disappear when all removed
- ✅ Data attributes present
- ✅ E2E test passing (phases 2 & 5)

**Checkpoint:** Attachment UI complete, ready for RAG backend

---

### **Phase search-api**: Vector Search Worker Method

**Goal:** Implement searchVectors worker method with HNSW query

**1. Test-First:**
Write integration test BEFORE implementation:
```typescript
// src/workers/pglite.worker.test.ts (NEW or EXTEND)
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Comlink from 'comlink'

describe('searchVectors', () => {
  beforeEach(async () => {
    // Setup: Create indexed documents with embeddings
    // Use mocked OpenAI API for embeddings generation
  })

  it('should return top-k chunks from selected documents', async () => {
    // Mock OpenAI embeddings API
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: mockEmbedding1536 }],
    })

    // Create test documents with chunks
    const doc1 = await worker.uploadDocument({
      filename: 'doc1.md',
      content: 'Equity is ownership...',
      mimeType: 'text/markdown'
    })
    const doc2 = await worker.uploadDocument({
      filename: 'doc2.md',
      content: 'Risk and reward...',
      mimeType: 'text/markdown'
    })

    // Wait for indexing to complete (or mock indexing)
    // ...

    // Search
    const results = await worker.searchVectors({
      query: 'equity ownership',
      documentIds: [doc1.id, doc2.id],
      topK: 5,
      similarityThreshold: 0.7,
    })

    // Assertions
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results[0].similarity).toBeGreaterThanOrEqual(0.7)
    expect(results[0]).toHaveProperty('chunkId')
    expect(results[0]).toHaveProperty('documentId')
    expect(results[0]).toHaveProperty('filename')
    expect(results[0]).toHaveProperty('content')
  })

  it('should filter by document IDs', async () => {
    // Test that only selected documents are searched
    const results = await worker.searchVectors({
      query: 'test',
      documentIds: [doc1.id], // Only doc1
      topK: 10,
    })

    // All results should be from doc1 only
    results.forEach(result => {
      expect(result.documentId).toBe(doc1.id)
    })
  })

  it('should respect similarity threshold', async () => {
    const results = await worker.searchVectors({
      query: 'test',
      documentIds: [doc1.id, doc2.id],
      topK: 10,
      similarityThreshold: 0.8, // High threshold
    })

    // All results should meet threshold
    results.forEach(result => {
      expect(result.similarity).toBeGreaterThanOrEqual(0.8)
    })
  })
})
```

**2. Build:**
- Add `searchVectors()` method to worker (Section 3.1)
- Validate OpenAI client initialized
- Generate query embedding using OpenAI API
- Execute HNSW search SQL query with document filtering
- Return search results with similarity scores
- Add to VectorDBContext: `searchVectors(query, documentIds)`
- Comlink export

**3. Run All Tests:**
```bash
npm test                          # Unit tests (including new integration test)
npm run test:e2e                  # E2E tests
npm run test:e2e:live             # Live tests (may not exercise search yet)
npm run lint
npm run build
```

**4. Investigate Failures:**
- If test fails with "index not found": Verify HNSW index created in Phase hnsw-index
- If test fails with wrong results: Check SQL query syntax, verify `<=>` operator
- If test fails with timeout: NO `waitForTimeout()` - check actual HNSW query execution time
- If embedding API fails: Verify mock setup, check API key in test environment

**5. Update Spec:**
Document actual implementation in this file (Section 3.1):
- Exact SQL query used
- Error handling approach
- Performance observations (query time)
- Any deviations from planned implementation

**6. Review Diff:**
```bash
git diff src/workers/pglite.worker.ts
git diff src/contexts/VectorDBContext.tsx
git diff src/workers/pglite.worker.test.ts
# Verify: searchVectors method added with correct signature
# Verify: VectorDBContext integration looks correct
# Verify: Tests are comprehensive
```

**7. Clean Up:**
- Remove console.logs from searchVectors method
- Remove any commented-out test code
- Verify error messages are user-friendly
- Remove temporary debugging code

**8. Commit:**
```bash
git add src/workers/pglite.worker.ts \
        src/contexts/VectorDBContext.tsx \
        src/workers/pglite.worker.test.ts \
        ai-docs/plans/phase-vector-search-specs.md

git commit -m "feat(vector-search): implement searchVectors worker method

Add vector similarity search using HNSW index with document filtering.
Generates query embeddings via OpenAI API and executes HNSW search
with configurable top-k and similarity threshold.

Features:
- HNSW search with cosine distance (<=>)
- Document ID filtering (WHERE document_id = ANY(...))
- Similarity threshold enforcement (>= 0.7 default)
- Top-k result limiting (10 default)

Integration tests:
- Mock OpenAI embeddings API
- Verify document filtering
- Verify similarity threshold
- Verify top-k limiting

Performance: Sub-50ms query time for indexed chunks"
```

**9. Verify:**
```bash
# Run tests again after commit
npm test
npm run test:e2e
# All tests should still pass
```

**Pass Criteria:**
- ✅ searchVectors worker method implemented
- ✅ HNSW query executes successfully
- ✅ Document filtering works (only selected docs)
- ✅ Top-k limit enforced
- ✅ Similarity threshold enforced
- ✅ Integration tests passing (3 test cases)
- ✅ All existing tests still passing
- ✅ No TypeScript errors
- ✅ Changes committed with descriptive message

**Checkpoint:** Vector search backend ready, ready for RAG integration

---

### **Phase rag-integration**: RAG Flow in useChat Hook

**Goal:** Integrate vector search into chat flow, inject context into LLM prompt

**Build:**
- Extend useChat hook (Section 4.1)
- Add state: `attachedDocumentIds`, `sources`, `isSearching`
- Modify sendMessage:
  - Check if attachments exist
  - If yes: searchVectors → formatContext → inject system message → send
  - If no: normal chat flow
- Implement formatContext helper (Section 4.1)
- Add loading state during search

**Test:** Extend `e2e/vector-search-workflow.spec.ts` (phase 3)
```typescript
test('RAG query retrieves context and generates response', async ({ page }) => {
  // ... setup: upload, index, attach files

  // Submit RAG query
  const ragQuery = 'What does Paul Graham say about equity?'
  await chatPage.sendMessage(ragQuery)

  // Wait for response
  await chatPage.waitForAssistantResponse()

  // Verify response received (basic check)
  const lastMessage = await chatPage.getLastMessage()
  expect(lastMessage.content.length).toBeGreaterThan(0)

  // Note: Citations tested in next phase
})
```

**Pass Criteria:**
- ✅ RAG flow executes on queries with attachments
- ✅ Vector search called with correct parameters
- ✅ Context formatted and injected into system prompt
- ✅ LLM response generated
- ✅ Normal chat flow still works (no attachments)
- ✅ E2E test passing (phase 3)

**Checkpoint:** RAG integration complete, ready for citation UI

---

### **Phase ui-citations**: Source Citations Display

**Goal:** Parse citations from LLM response, display with source metadata

**Build:**
- Create `src/components/SourceCitations.tsx`
- Implement citation parsing (Section 5.2)
- Replace `[N]` markers with clickable citations
- Add hover tooltip showing chunk preview
- Display sources footer with metadata (filename, heading, similarity)
- Add data attributes

**Test:** Complete `e2e/vector-search-workflow.spec.ts` (phases 3, 4, 6)
```typescript
test('RAG response includes citations and sources', async ({ page }) => {
  // ... RAG query test

  // Verify citations in response
  const citationCount = await chatPage.getCitationCount()
  expect(citationCount).toBeGreaterThanOrEqual(1)

  // Verify sources footer
  const sourcesCount = await chatPage.getSourcesCount()
  expect(sourcesCount).toBeGreaterThanOrEqual(1)

  // Hover over citation
  await chatPage.hoverCitation(1)
  await chatPage.expectCitationTooltipVisible()

  // ... selective attachment test (phase 5)

  // ... normal chat (no citations) test (phase 6)
})
```

**Pass Criteria:**
- ✅ Citations parsed and displayed as clickable markers
- ✅ Hover shows chunk preview in tooltip
- ✅ Sources footer displays metadata
- ✅ Citation numbers map to correct sources
- ✅ Full E2E test passing (all phases)
- ✅ Normal chat has no citations

**Checkpoint:** Citations complete, RAG fully functional

---

### **Final Verification**

```bash
# Run regular E2E tests (excludes @live)
npm run test:e2e
# Expected: 9/9 tests passing (no new non-live tests)

# Run live tests (hits real OpenAI API)
npm run test:e2e:live
# Expected: 3/3 tests passing
# - chat-real-api.spec.ts @live ✅
# - indexing-workflow-basic.spec.ts @live ✅
# - vector-search-workflow.spec.ts @live ✅ (NEW)

# Total: 12/12 tests passing

# Build verification
npm run build

# Manual browser testing
npm run dev
```

---

## 8. Implementation Checklist

### Phase hnsw-index ❌ PENDING
- [ ] Add HNSW index creation to worker init
- [ ] SQL: `CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`
- [ ] Verify index exists after init
- [ ] ✅ HNSW index created and functional

### Phase ui-attach-button ❌ PENDING
- [ ] Add attach button to ChatPage
- [ ] Use lucide-react Paperclip icon
- [ ] Add modal state management
- [ ] Add data attributes
- [ ] ✅ Attach button opens file selector

### Phase ui-file-selector ❌ PENDING
- [ ] Create FileSelector.tsx component
- [ ] Use Radix UI Dialog
- [ ] Display documents (alphabetical sort)
- [ ] Show indexing status badges
- [ ] Enable checkbox only for indexed files
- [ ] Add search bar (client-side filter)
- [ ] Add footer buttons
- [ ] Add data attributes
- [ ] Create FileSelectorComponent POM
- [ ] Write partial E2E test
- [ ] ✅ File selector functional

### Phase ui-attachments ❌ PENDING
- [ ] Create AttachmentBadges.tsx component
- [ ] Add attachedDocumentIds state
- [ ] Display badges above input
- [ ] Implement remove functionality
- [ ] Add data attributes
- [ ] Extend E2E test (phases 2 & 5)
- [ ] ✅ Attachment UI complete

### Phase search-api ❌ PENDING
- [ ] Implement searchVectors worker method
- [ ] Generate query embedding
- [ ] Execute HNSW search SQL
- [ ] Handle document filtering
- [ ] Return search results
- [ ] Add to VectorDBContext
- [ ] Write integration test
- [ ] ✅ Vector search backend functional

### Phase rag-integration ❌ PENDING
- [ ] Extend useChat hook state
- [ ] Modify sendMessage with RAG flow
- [ ] Implement formatContext helper
- [ ] Add isSearching loading state
- [ ] Extend E2E test (phase 3)
- [ ] ✅ RAG integration complete

### Phase ui-citations ❌ PENDING
- [ ] Create SourceCitations.tsx component
- [ ] Implement citation parsing
- [ ] Replace [N] with clickable markers
- [ ] Add hover tooltip
- [ ] Display sources footer
- [ ] Add data attributes
- [ ] Complete E2E test (phases 3, 4, 6)
- [ ] ✅ Full E2E test passing (@live)

### Final Verification ❌ PENDING
- [ ] Regular tests: `npm run test:e2e` (9/9 passing)
- [ ] Live tests: `npm run test:e2e:live` (3/3 passing)
- [ ] Total: 12/12 E2E tests passing
- [ ] TypeScript compilation passing
- [ ] Build successful (`npm run build`)
- [ ] No console errors (DEV logging wrapped in import.meta.env.DEV)
- [ ] Manual browser testing verified

---

## 9. Acceptance Criteria

### Database & Backend ✅
- ✅ HNSW index created on chunks.embedding
- ✅ searchVectors worker method implemented
- ✅ Vector search returns top-10 chunks (similarity >= 0.7)
- ✅ Document filtering works (only selected files searched)
- ✅ Query embedding generated via OpenAI API

### UI Components ✅
- ✅ Attach button visible on ChatPage
- ✅ File selector modal shows indexed documents
- ✅ Search bar filters files by name
- ✅ Checkboxes enabled only for indexed files
- ✅ Alphabetical sort (no other options)
- ✅ Attachment badges display above input
- ✅ Remove button works for attachments
- ✅ Citations displayed with [N] markers
- ✅ Hover shows chunk preview
- ✅ Sources footer shows metadata

### RAG Functionality ✅
- ✅ RAG flow activates when attachments exist
- ✅ Vector search executed on user query
- ✅ Context injected into system prompt
- ✅ LLM response includes citations
- ✅ Sources mapped to citation numbers
- ✅ Normal chat works without attachments

### Testing ✅
- ✅ E2E test passing (@live): `e2e/vector-search-workflow.spec.ts`
- ✅ Test covers: upload → index → attach → query → cite → selective attachment → normal chat
- ✅ Total tests: 12/12 passing (9 regular + 3 @live)

### Quality ✅
- ✅ TypeScript compilation passing
- ✅ Build successful
- ✅ No console errors (DEV logging wrapped)
- ✅ Manual testing verified in browser

---

## 10. Known Constraints & Trade-offs

**Decisions:**
- ✅ Fixed top-k=10 initially (configurable later via UI settings)
- ✅ Fixed threshold=0.7 initially (configurable later)
- ✅ Alphabetical sort ONLY (per user requirement, no other options)
- ✅ HNSW index adds ~10-20% storage overhead (acceptable for speed)
- ✅ Vector search latency: ~150-350ms (embedding API + HNSW query)
- ✅ Citations parsed client-side (LLM may not always use exact [N] format)
- ✅ Hover tooltips use Radix UI Tooltip (consistent with existing patterns)

**Performance Expectations:**
- HNSW query: <50ms for 10K chunks
- Embedding API: ~100-300ms
- Total RAG query: ~200-400ms (acceptable for UX)

**Cost Expectations:**
- Per RAG query: ~$0.0001-0.0002 (query embedding only, no additional indexing cost)
- Test run: ~$0.001-0.002 (2 essays + 3 queries)

**UI/UX Decisions:**
- ✅ Non-indexed files visible in selector but disabled (transparency)
- ✅ Search filters client-side (no server query, acceptable for <1000 documents)
- ✅ Attachment badges wrap if many files selected
- ✅ Remove attachment button inline (no confirmation modal)

**Future Enhancements (NOT in this phase):**
- Configurable top-k and threshold via UI
- Re-ranking retrieved chunks (semantic re-ranking)
- Hybrid search (vector + full-text)
- Document page navigation from citation click
- Citation link to specific chunk in document

---

## 11. Manual Testing Scenarios

While E2E test covers happy path, these scenarios require manual verification during development.

### Scenario 1: Non-Indexed File Selection (Disabled State)

**Setup:**
1. Upload 3 files
2. Wait for 2 to complete indexing
3. Leave 1 in "processing" or "pending" state (pause worker if needed)

**Test Steps:**
1. Navigate to /chat
2. Click attach button
3. Verify file selector shows all 3 files
4. Verify 2 indexed files have enabled checkboxes
5. Verify 1 non-indexed file has disabled checkbox (gray, unclickable)
6. Attempt to click disabled checkbox
7. Verify checkbox doesn't toggle

**Expected Behavior:**
- ✅ Non-indexed files visible but disabled
- ✅ Disabled checkbox has gray styling
- ✅ Clicking disabled checkbox does nothing
- ✅ Indexing status badge shows current state

---

### Scenario 2: Search Filtering in File Selector

**Setup:**
1. Upload 5 files with different names:
   - equity.md
   - inequality.md
   - startups.md
   - risk.md
   - wealth.md
2. Wait for all to complete indexing

**Test Steps:**
1. Navigate to /chat
2. Click attach button
3. Verify all 5 files visible
4. Type "eq" in search bar
5. Verify only "equity.md" and "inequality.md" visible
6. Clear search (or backspace)
7. Verify all 5 files visible again
8. Type "xyz" (no matches)
9. Verify empty state message

**Expected Behavior:**
- ✅ Search filters instantly (client-side)
- ✅ Case-insensitive matching
- ✅ Empty state when no matches
- ✅ Clear search restores full list

---

### Scenario 3: Citation Hover Interaction

**Setup:**
1. Upload & index 2 essays
2. Attach both files
3. Submit RAG query: "What does Paul Graham say about equity?"
4. Wait for response with citations

**Test Steps:**
1. Verify response contains [1] and [2] markers
2. Hover over [1] marker
3. Verify tooltip appears with chunk preview
4. Move cursor away
5. Verify tooltip disappears
6. Hover over [2] marker
7. Verify tooltip shows different chunk preview

**Expected Behavior:**
- ✅ Tooltip appears on hover
- ✅ Tooltip shows first 100 chars of chunk + "..."
- ✅ Tooltip disappears on mouse out
- ✅ Each citation shows correct chunk

---

### Scenario 4: Multi-Document RAG Query (Source Distribution)

**Setup:**
1. Upload & index 3 essays on different topics
2. Attach all 3 files

**Test Steps:**
1. Submit query related to only 1 document's content
2. Verify sources reference primarily that document
3. Submit query spanning 2 documents' content
4. Verify sources reference both documents
5. Submit generic query (all documents relevant)
6. Verify sources distributed across all documents

**Expected Behavior:**
- ✅ Vector search retrieves relevant chunks
- ✅ Sources reflect actual document matches
- ✅ Similarity scores correlate with relevance
- ✅ Top-10 limit enforced

---

### Scenario 5: Attachment Removal Mid-Conversation

**Setup:**
1. Upload & index 2 essays
2. Attach both files
3. Submit RAG query, receive response with citations

**Test Steps:**
1. Remove 1 attachment badge
2. Submit follow-up query
3. Verify sources only reference remaining document
4. Remove last attachment
5. Submit query
6. Verify normal chat response (no citations)

**Expected Behavior:**
- ✅ Attachment removal updates state immediately
- ✅ Subsequent queries reflect current attachments
- ✅ Removing all attachments reverts to normal chat
- ✅ No citations when no attachments

---

### Scenario 6: Large Number of Attachments (10+ Files)

**Setup:**
1. Upload & index 15 files

**Test Steps:**
1. Attach all 15 files
2. Verify attachment badges wrap to multiple lines
3. Verify badges readable and removable
4. Submit RAG query
5. Verify search executes across all 15 documents
6. Verify top-10 results returned (not 15*10)

**Expected Behavior:**
- ✅ Badges wrap cleanly
- ✅ All remove buttons accessible
- ✅ Vector search queries all documents
- ✅ Top-10 limit enforced globally

---

## 12. Next Steps After Completion

After Phase vector-search is complete, consider:

1. **Production Deployment**
   - Deploy to GitHub Pages or static hosting
   - Verify WASM loading in production
   - Test full RAG workflow in production

2. **Advanced Features (Future Phases)**
   - Configurable top-k and threshold UI
   - Re-ranking retrieved chunks
   - Hybrid search (vector + full-text)
   - Document page navigation from citations
   - Citation preview expansion
   - Multi-query conversations with context memory

3. **Performance Optimization (If Needed)**
   - Measure actual search latency with large datasets
   - Tune HNSW parameters (m, ef_construction, ef_search)
   - Consider caching embeddings for repeated queries

4. **User Experience Enhancements**
   - Attachment drag-and-drop reordering
   - Bulk file operations (attach all indexed, remove all)
   - Citation highlighting in source document
   - Source document preview in modal

---

## Appendix: SQL Queries

### Find Documents Without HNSW Index
```sql
-- Check if HNSW index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'chunks'
  AND indexname = 'idx_chunks_embedding_hnsw';
```

### Test Vector Search Query
```sql
-- Example vector search (replace embedding with actual vector)
SELECT
  c.id, c.document_id, c.content, c.heading,
  d.filename,
  1 - (c.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE c.document_id = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
  AND c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> '[0.1, 0.2, ...]'::vector) >= 0.7
ORDER BY c.embedding <=> '[0.1, 0.2, ...]'::vector ASC
LIMIT 10;
```

### Measure HNSW Index Size
```sql
SELECT
  pg_size_pretty(pg_relation_size('idx_chunks_embedding_hnsw')) as index_size,
  pg_size_pretty(pg_table_size('chunks')) as table_size;
```

### Find Documents by Topic (Vector Search)
```sql
-- Find chunks similar to a concept (requires embedding)
SELECT
  d.filename,
  COUNT(*) as matching_chunks,
  AVG(1 - (c.embedding <=> $1::vector)) as avg_similarity
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE 1 - (c.embedding <=> $1::vector) >= 0.7
GROUP BY d.id, d.filename
ORDER BY avg_similarity DESC
LIMIT 5;
```

---

## Summary

This specification provides a complete implementation roadmap for adding RAG functionality to the chat application using HNSW vector search. The architecture leverages:

- **HNSW Index** for fast approximate nearest neighbor search (<50ms queries)
- **Document Filtering** to search only selected files (user control)
- **Context Injection** to augment LLM prompts with retrieved chunks
- **Source Citations** to display references with similarity scores

The implementation is **incremental** (7 phases), **test-driven** (E2E-first), and **YAGNI** (fixed parameters initially, configurable later). All functionality is **fully client-side** with no backend required.

**Performance:** ~200-400ms per RAG query (embedding API + HNSW search)
**Cost:** ~$0.0001-0.0002 per query (embedding only)
**Test Coverage:** 1 comprehensive @live E2E test (12/12 total tests passing)
