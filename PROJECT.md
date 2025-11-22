# PROJECT.md

Technical architecture, implementation conventions, and deep implementation details for the RAG chat application with vector database.

## Overview

React 19 + TypeScript RAG application with in-browser vector database (PGlite + pgvector), hybrid search (vector + BM25), and OpenAI integration. Built with Vite, shadcn/ui, Tailwind v4.

**Code Metrics:**
- ~8,000+ LOC across 60+ files
- 34 passing unit tests (Vitest)
- 10 passing E2E tests (7 @live, 3 non-live)
- TypeScript strict mode enabled
- Zero ESLint errors

## Project Structure Philosophy

### Folder Organization Principles

**Page-Specific Component Colocation:**
Components used by only one page live in that page's folder. Benefits:
- **Locality of Behavior:** Related code grouped together
- **Easier Refactoring:** Move/delete page → move/delete all its components
- **Reduced Cognitive Load:** No guessing where components are used

```
src/pages/
├── chat/                    # ChatPage and its exclusive components
│   ├── index.tsx           # Main page component
│   ├── FileSelector.tsx    # Only used by ChatPage
│   ├── AttachmentBadges.tsx
│   └── SourceCitations.tsx
├── documents/              # DocumentsPage and its components
│   ├── index.tsx
│   ├── KBCard.tsx         # No nested components/ folder
│   ├── CreateKBModal.tsx  # Flattened structure
│   └── DocumentCard.tsx
└── welcome/
    └── index.tsx
```

**Why No Nested `components/` Folder:**
- Redundant nesting avoided
- Shorter import paths
- Clearer component ownership

**Shared Components:**
```
src/components/
├── ui/                     # shadcn/ui primitives (button, input, card)
├── ErrorBoundary.tsx      # Shared error handling
├── TopBar.tsx             # Shared navigation
└── SettingsDialog.tsx     # Used by all protected pages
```

Only components used by 2+ pages belong here.

### Centralized Architecture

**Types Centralization (`src/types/index.ts`):**
- Single source of truth for all TypeScript interfaces
- Prevents duplication and drift
- Change once, update everywhere

**Test ID Centralization (`src/lib/test-ids.ts`):**
- Constants instead of string literals: `DOCUMENTS_PAGE.BTN_CREATE_KB`
- Refactor-safe, discoverable via autocomplete
- Consistent naming across codebase

**Pure Function Extraction (`src/lib/`):**
- `chunking.ts` - Markdown-aware document chunking
- `embeddings.ts` - OpenAI embedding utilities (batch processing, retry logic)
- `utils.ts` - formatDate, formatFileSize, cn (shared utilities)
- Testable in isolation, reusable across contexts

### Import Conventions

**Absolute Imports with @/ Alias:**

All imports use path alias `@/` → `./src/`:

```typescript
// ✅ CORRECT - Always use @/ for cross-folder imports
import { formatDate } from '@/lib/utils'
import { Document } from '@/types'
import { useChat } from '@/hooks/useChat'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ✅ ACCEPTABLE - Same folder, relative import OK
import IndexingStatusBadge from './IndexingStatusBadge'

// ❌ WRONG - Never use relative imports across folders
import { formatDate } from '../../lib/utils'
```

**Configuration (vite.config.ts):**
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

## Type System Architecture

### Centralized Type Definitions

**Location:** `src/types/index.ts` (single source of truth)

**Core Domain Types:**

```typescript
// Document management
export interface Document {
  id: string;
  filename: string;
  content: string;
  knowledge_base_id: string | null;
  uploaded_at: string;
  indexed_at: string | null;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  chunk_count: number | null;
  file_size: number;
  mime_type: string;
  error_message: string | null;
  retry_count: number | null;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  embedding_model: string;              // e.g., "text-embedding-3-small"
  embedding_dimensions: number;         // e.g., 1536
  hnsw_m: number;                       // HNSW index parameter (4-64)
  hnsw_ef_construction: number;         // HNSW build parameter (16-256)
  document_count: number;
  chunk_count: number;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  heading: string | null;               // Markdown heading context
  chunk_index: number;
  start_offset: number;                 // Character position in original
  end_offset: number;
  embedding?: number[];                 // Optional - may not be loaded
}
```

**Search & RAG Types:**

```typescript
export interface SearchResult {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  heading: string | null;
  chunkIndex: number;
  // Vector search scores
  similarity?: number;                  // Cosine similarity (0-1)
  vectorScore?: number;
  vectorRank?: number;
  // BM25 scores
  bm25Score?: number;
  bm25Rank?: number;
  // Hybrid search
  fusedScore?: number;                  // Reciprocal rank fusion score
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[];             // RAG sources for this message
  metadata?: MessageMetadata;
}

export interface IndexingProgress {
  documentId: string;
  progress: number;                     // 0-100
  stage: 'chunking' | 'embedding' | 'storing' | 'indexing' | 'completed';
  message: string;
  error?: string;
}
```

### TypeScript Configuration

**Strict Mode (tsconfig.json):**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Type Safety Patterns

**No `any` - Use `unknown`:**
```typescript
// ✅ CORRECT
const data: unknown = JSON.parse(response);
if (isDocument(data)) {
  // Type guard narrows to Document
}

// ❌ WRONG
const data: any = JSON.parse(response);
```

**Const Assertions:**
```typescript
export const FEATURES = {
  INDEXING_ENABLED: 'FEATURE_INDEXING_ENABLED',
} as const;
// Type: { readonly INDEXING_ENABLED: "FEATURE_INDEXING_ENABLED" }
```

## State Management Architecture

### Context + Custom Hook Pattern

**Three-Layer Architecture:**

1. **Context Layer** - Global state
   - `ApiKeyContext` - API key with localStorage sync
   - `VectorDBContext` - Database, documents, indexing queue

2. **Hook Layer** - Reusable logic
   - `useChat` - Chat state, streaming, RAG integration
   - `useDebounce` - Input debouncing

3. **Component Layer** - UI rendering
   - Pages consume contexts via hooks
   - Components receive data via props

### Context Implementation Patterns

**Lazy localStorage Initialization:**

```typescript
// ✅ CORRECT - Read once on mount
const [apiKey, setApiKeyState] = useState<string | null>(() => {
  return localStorage.getItem('openai_api_key');
});

// ❌ WRONG - Reads on every render
const [apiKey, setApiKeyState] = useState<string | null>(
  localStorage.getItem('openai_api_key')
);
```

**One-Way Sync Pattern:**

```typescript
// State changes write to localStorage
useEffect(() => {
  if (apiKey) {
    localStorage.setItem('openai_api_key', apiKey);
  } else {
    localStorage.removeItem('openai_api_key');
  }
}, [apiKey]);
```

**Rationale:**
- Simple: unidirectional data flow
- Predictable: state drives storage
- Trade-off: Changes in one tab don't reflect in others

### Custom Hook Patterns

**useChat Hook Architecture:**

```typescript
export function useChat(props: UseChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    cancelMessage,
  };
}
```

**Hook Design Principles:**
1. Clean API: Return object with clear methods
2. Cancelation: Cleanup on unmount via useEffect return
3. Error State: Explicit error field, don't throw
4. Loading State: Explicit loading boolean

## Streaming Implementation

### OpenAI Streaming Architecture

**Core Mechanism (hooks/useChat.ts):**

```typescript
const sendMessage = async (content: string) => {
  // 1. Cancel previous request
  abortControllerRef.current?.abort();
  const abortController = new AbortController();
  abortControllerRef.current = abortController;

  // 2. Optimistic update - add user message immediately
  setMessages(prev => [...prev, { role: 'user', content }]);

  // 3. RAG: Search for relevant chunks
  let sources: SearchResult[] | undefined;
  if (attachedDocumentIds.length > 0) {
    sources = await searchHybrid(content, kbId, attachedDocumentIds);
  }

  // 4. Build context from sources
  const systemPrompt = sources ? buildRAGPrompt(sources) : undefined;

  // 5. Empty placeholder for assistant message
  setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

  // 6. Stream chunks
  let assistantContent = '';
  const stream = await openai.chat.completions.create({
    model,
    messages: [...conversationHistory, { role: 'user', content }],
    stream: true,
  }, { signal: abortController.signal });

  // 7. Accumulate and update
  for await (const chunk of stream) {
    const deltaContent = chunk.choices[0]?.delta?.content || '';
    assistantContent += deltaContent;

    // 8. Immutable update - replace last message
    setMessages(prev => {
      const newMessages = [...prev];
      newMessages[newMessages.length - 1] = {
        role: 'assistant',
        content: assistantContent,
        sources,
      };
      return newMessages;
    });
  }
};
```

**Key Patterns:**
1. Optimistic Updates: User message added before API call
2. Placeholder Pattern: Empty assistant message before streaming
3. Local Accumulation: Use local variable for chunks
4. Immutable Updates: Replace last message on each chunk
5. Cancelation: AbortController passed to OpenAI SDK
6. RAG Integration: Search → build context → inject as system message

### Abort Controller Pattern

**Why Ref Instead of State:**
- State updates trigger re-renders (unnecessary)
- AbortController is imperative API (not declarative)
- Ref persists across renders without causing them

## Vector Database Architecture

### PGlite + pgvector Stack

**In-Browser PostgreSQL:**
- PGlite: WASM-compiled PostgreSQL
- pgvector extension: Vector similarity search
- IndexedDB backend: Persistent storage

**Why In-Browser Database:**
1. No Backend Required: Fully client-side RAG
2. Privacy: Documents never leave browser
3. Speed: Local queries, no network latency
4. Cost: No server/database hosting fees

**Trade-offs:**
- Storage Limit: IndexedDB quota (~1GB typical)
- Performance: Slower than server Postgres
- Sharing: Can't share KBs across devices

### Database Schema

**Knowledge Bases:**
```sql
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Embedding configuration
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL,

  -- HNSW index parameters (immutable)
  hnsw_m INTEGER DEFAULT 16,
  hnsw_ef_construction INTEGER DEFAULT 64,

  -- Computed stats
  document_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0
);
```

**Documents:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  indexed_at TIMESTAMPTZ,
  indexing_status TEXT CHECK (indexing_status IN ('pending', 'processing', 'completed', 'failed')),
  chunk_count INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_documents_kb ON documents(knowledge_base_id);
CREATE INDEX idx_documents_status ON documents(indexing_status);
```

**Chunks:**
```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  heading TEXT,
  chunk_index INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  embedding vector(1536)
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### HNSW Index Parameters

**`m` (Max Connections per Layer):**
- Range: 4-64 (default: 16)
- Higher = Better recall, more memory, slower inserts
- Recommendation: 16 for general use, 32 for high accuracy

**`ef_construction` (Build-time Candidates):**
- Range: 16-256 (default: 64)
- Higher = Better index quality, slower build
- Recommendation: 64 for general use, 128+ for high accuracy

**Immutability:** Parameters set at index creation, require re-index to change.

## Hybrid Search Implementation

### Three-Stage Search Pipeline

**1. Vector Search (Cosine Similarity):**

```sql
SELECT
  c.id as chunk_id,
  c.content,
  c.heading,
  d.filename,
  1 - (c.embedding <=> $1::vector) as similarity
FROM chunks c
JOIN documents d ON c.document_id = d.id
WHERE d.knowledge_base_id = $2
  AND (c.embedding <=> $1::vector) < $3
ORDER BY c.embedding <=> $1::vector
LIMIT $4;
```

**Operator:** `<=>` is cosine distance (pgvector)
- Distance 0 = identical vectors
- Distance 2 = opposite vectors
- Similarity = 1 - distance

**2. BM25 Full-Text Search (Lunr.js):**

```typescript
const lunrIndex = lunr(function() {
  this.ref('id');
  this.field('content');
  this.field('heading');
  chunks.forEach(chunk => this.add(chunk));
});

const bm25Results = lunrIndex.search(query);
```

**Why Lunr.js:**
- Client-side full-text search (no server required)
- BM25 algorithm (proven for text ranking)
- Fast for <100k documents

**3. Reciprocal Rank Fusion:**

```typescript
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  k: number = 60
): SearchResult[] {
  const fusedScores = new Map<string, number>();

  vectorResults.forEach((result, rank) => {
    const score = 1 / (rank + 1 + k);
    fusedScores.set(result.chunkId, score);
  });

  bm25Results.forEach((result, rank) => {
    const existingScore = fusedScores.get(result.chunkId) || 0;
    const score = 1 / (rank + 1 + k);
    fusedScores.set(result.chunkId, existingScore + score);
  });

  return Array.from(fusedScores.entries())
    .sort((a, b) => b[1] - a[1]);
}
```

**Why RRF:**
- Doesn't require score normalization (rank-based)
- Robust to different scoring scales
- Simple, no tuning parameters (just k=60)

### Configurable Search Parameters

**User Settings (localStorage):**

```typescript
// Vector search
VECTOR_TOP_K: 3              // How many vector results (1-20)
SIMILARITY_THRESHOLD: 0.3    // Min cosine similarity (0-1)

// BM25 search
BM25_LIMIT: 10              // How many BM25 results (1-50)

// HNSW index (requires re-index)
HNSW_M: 16                  // Max connections (4-64)
HNSW_EF_CONSTRUCTION: 64    // Build candidates (16-256)
```

**Access via Settings UI:**
- Basic settings: Apply immediately (no reload)
- HNSW settings: Require page reload + re-indexing

### RAG Context Construction

**Prompt Engineering:**

```typescript
function buildRAGPrompt(sources: SearchResult[]): string {
  const context = sources
    .map((source, i) => {
      const heading = source.heading ? `## ${source.heading}\n\n` : '';
      return `[${i + 1}] ${source.filename}\n${heading}${source.content}`;
    })
    .join('\n\n---\n\n');

  return `You are a helpful assistant. Use the following context to answer the user's question.
Cite sources using [N] notation where N is the source number.

Context:
${context}

If the context doesn't contain relevant information, say so.`;
}
```

**Citation Parsing:**

```typescript
function parseCitations(content: string): CitationPart[] {
  const regex = /\[(\d+)\]/g;
  const parts: CitationPart[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(regex)) {
    if (match.index! > lastIndex) {
      parts.push({ text: content.slice(lastIndex, match.index) });
    }
    parts.push({
      text: match[0],
      citationIndex: parseInt(match[1]) - 1
    });
    lastIndex = match.index! + match[0].length;
  }

  return parts;
}
```

## Chunking Strategy

### Markdown-Aware Chunking

**Algorithm (lib/chunking.ts):**

1. Parse Headings: Split on `#`, `##`, `###`
2. Create Sections: Each heading + content = potential chunk
3. Size Check: If section > target size, split on sentences
4. Preserve Context: Include heading in chunk metadata
5. Track Offsets: Maintain character positions

**Implementation:**
```typescript
export function chunkDocument(
  content: string,
  metadata: { filename: string; mimeType: string },
  options: ChunkingOptions = {}
): Chunk[] {
  const targetSize = options.targetChunkSize || 500;  // Tokens
  const sections = splitOnHeadings(content);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    if (section.content.length / 4 > targetSize) {
      // Split long sections on sentences
      const sentences = splitIntoSentences(section.content);
      // ... accumulate sentences into chunks
    } else {
      // Small section = one chunk
      chunks.push({ ...section });
    }
  }

  return chunks;
}
```

**Why Heading-Aware:**
- Better Context: Chunks know their section
- Semantic Boundaries: Headings mark topic changes
- Retrieval Quality: Can filter/boost by heading

**Limitations:**
- Token Estimation: `chars / 4` is rough
- No Overlap: Adjacent chunks don't share context
- Markdown Only: Plain text gets no special treatment

## Embedding Pipeline

### OpenAI Integration

**Batch Embedding (lib/embeddings.ts):**

```typescript
export async function generateEmbeddings(
  chunks: Chunk[],
  openai: OpenAI,
  model: string
): Promise<number[][]> {
  const BATCH_SIZE = 100;  // OpenAI limit: 2048 inputs
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    const response = await openai.embeddings.create({
      model,
      input: batch.map(c => c.content),
    });

    embeddings.push(...response.data.map(d => d.embedding));
  }

  return embeddings;
}
```

**Why Batch:**
- Cost: Each API call has overhead
- Speed: Parallel processing on OpenAI side
- Rate Limits: Fewer requests = less likely to hit limits

**Error Handling:**
- 429 (Rate Limit): Exponential backoff, retry
- 401 (Auth): Bubble to user (invalid API key)
- Network Errors: Retry with backoff

### Indexing Queue

**Queue Pattern (VectorDBContext.tsx):**

```typescript
const indexingQueue: IndexingQueueItem[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (indexingQueue.length > 0) {
    const item = indexingQueue.shift()!;

    try {
      await indexDocument(item);
    } catch (error) {
      if (item.retryCount < 3) {
        item.retryCount++;
        indexingQueue.push(item);  // Re-queue
      } else {
        await markIndexingFailed(item.documentId, error.message);
      }
    }
  }

  isProcessing = false;
}
```

**Progress Tracking:**
- Stages: chunking → embedding → storing → completed
- Real-time UI updates with progress bars
- Error display with retry button

## Error Handling Architecture

### Error Boundary Pattern

**Implementation (components/ErrorBoundary.tsx):**

```typescript
export class ErrorBoundary extends Component<Props, State> {
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <FallbackUI error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
```

**Where Used:** Wraps each route in App.tsx

**Caught Errors:**
- Rendering errors in component tree
- Errors in lifecycle methods

**Not Caught:**
- Async errors (use try-catch)
- Errors outside React

### Toast Notification Pattern

**Library:** sonner (lightweight, accessible)

**Usage:**
```typescript
import { toast } from 'sonner';

toast.success('File uploaded successfully');
toast.error('Failed to connect to database');

toast.promise(
  uploadFile(file),
  {
    loading: 'Uploading...',
    success: 'Upload complete!',
    error: 'Upload failed'
  }
);
```

**Migration from alert():** Replace blocking alert() with non-blocking toast.

## Security Implementation

### XSS Protection

**DOMPurify Sanitization:**

```typescript
import DOMPurify from 'dompurify';

// ✅ CORRECT
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userContent)
}} />

// ❌ WRONG
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**Why Necessary:**
- User documents can contain malicious scripts
- Search highlighting injects HTML
- OpenAI responses are untrusted

### API Key Security

**Client-Side Limitations:**

```typescript
new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true  // Exposes key in browser
});
```

**Security Implications:**
- API key visible in DevTools
- Acceptable for personal use
- Production needs backend proxy

## Performance Optimizations

### Debouncing Pattern

```typescript
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

**Usage:** Search inputs (300ms), expensive operations (500ms)

### Memoization Patterns

```typescript
// Expensive computations
const filteredDocuments = useMemo(() => {
  return documents
    .filter(doc => doc.filename.includes(searchQuery))
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}, [documents, searchQuery]);

// Component optimization
const MessageComponent = React.memo(({ message }) => {
  return <div>{message.content}</div>;
});
```

## Testing Architecture

### Test Infrastructure

**Unit Tests (Vitest):**
- Setup: `src/tests/setup.ts`
- Mock Service Worker: `src/tests/mocks/`
- Environment: jsdom
- Coverage: 34 tests passing

**E2E Tests (Playwright):**
- Tests: `e2e/**/*.spec.ts`
- Page Objects: `e2e/pages/`
- Coverage: 10 tests (7 @live, 3 mocked)

### Test Conventions

**Test ID Pattern (src/lib/test-ids.ts):**

```typescript
// Convention: <element-type>-<component>-<action>
export const CHAT_PAGE = {
  INPUT_MESSAGE: 'input-chat-message',
  BTN_SEND: 'btn-chat-send',
  BTN_ATTACH: 'btn-chat-attach',
} as const;

// Dynamic IDs with functions
export const DOC_CARD = {
  card: (docId: string) => `doc-card-${docId}`,
  btnDelete: (docId: string) => `btn-delete-doc-${docId}`,
} as const;
```

**Usage in Components:**
```typescript
<button data-testid={CHAT_PAGE.BTN_SEND}>Send</button>
```

**Usage in Tests:**
```typescript
await page.getByTestId(CHAT_PAGE.BTN_SEND).click();
```

**E2E Conventions:** See `e2e/CLAUDE.md`
- Page Object Pattern: All interactions through page objects
- State-Based Waiting: Use data attributes, not timeouts
- Deterministic: No if-else, try-catch
- Phase-Based: Organize tests with kebab-case phases

## Styling System

### Tailwind CSS v4

**Configuration:**
- NO `@apply` directives (removed from v4)
- Theme in CSS custom properties (HSL values)
- Import via `@import "tailwindcss"`

**Theme (src/index.css):**
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;
    --primary: 222.2 47.4% 11.2%;
  }

  .dark {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
  }
}
```

### Class Utility (cn)

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage:**
```typescript
<div className={cn(
  'base-class',
  isActive && 'active-class',
  error && 'error-class'
)} />
```

### Component Variant Architecture (CVA)

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

## Build Configuration

### Vite Configuration

```typescript
export default defineConfig({
  base: '/exp-anti-gravity/',  // GitHub Pages

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  worker: {
    format: 'es',  // PGlite web worker
  },

  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],  // WASM, can't pre-bundle
  },
});
```

## Known Issues & Future Improvements

### Current Limitations

**Database:**
- IndexedDB quota ~1GB
- No cross-device sync
- No backup/export

**Search:**
- No query expansion
- No stopword removal
- Fixed RRF k=60

**Chunking:**
- Rough token estimate (chars/4)
- No overlap between chunks

**UI/UX:**
- No message persistence
- Auto-scroll always on
- No conversation search

### Planned Improvements

**High Priority:**
- Message persistence (localStorage/IndexedDB)
- Stop generation button
- Smart auto-scroll
- Dark mode toggle

**Medium Priority:**
- Export/import knowledge bases
- Query expansion
- Actual token counting (tiktoken)
- Result caching

## Development Workflow

### Git Commit Convention

**Format:** `type(scope): description`

**Types:** feat, fix, refactor, test, docs, chore
**Scopes:** chat, documents, search, vector-db, test, build, security

**Examples:**
```
feat(search): add hybrid search with reciprocal rank fusion
fix(chat): prevent auto-scroll when user reading history
refactor(types): centralize TypeScript interfaces
```

### Code Review Checklist

**Before PR:**
- All tests pass (`npm test && npm run test:e2e`)
- No TypeScript errors (`tsc --noEmit`)
- @/ imports used consistently
- Types imported from `@/types`
- Test IDs from `@/lib/test-ids`
- DOMPurify for HTML rendering
- Toast not alert()

### Commands

```bash
npm run dev       # Dev server
npm test          # Unit tests
npm run test:e2e  # E2E (non-live)
npm run test:e2e:live # E2E (@live, costs money)
tsc --noEmit      # Type check
npm run lint      # ESLint
npm run build     # Production build
```

## Dependencies

**Core:** React 19, TypeScript 5.7, Vite 6, OpenAI SDK 6.9.1
**DB:** PGlite 0.2.13, pgvector extension
**Search:** Lunr.js 2.3.9 (BM25)
**UI:** Radix UI, shadcn/ui, Tailwind 4.1, Lucide icons, CVA
**Testing:** Vitest 4.0, Playwright 1.56, MSW 2.12
**Utils:** sonner (toast), DOMPurify (XSS), clsx, tailwind-merge

## Conclusion

**Key Takeaways:**
- Page-specific component colocation improves maintainability
- Centralized types eliminate duplication and drift
- Pure function extraction enables testing and reuse
- @/ imports are refactor-safe and readable
- Vector DB + hybrid search enables powerful client-side RAG
- Type safety catches bugs at compile time
- Test IDs as constants prevent E2E test brittleness

**References:** See `CLAUDE.md` for daily development, `e2e/CLAUDE.md` for E2E testing conventions.
