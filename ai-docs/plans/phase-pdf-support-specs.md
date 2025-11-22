# Phase PDF Support: Implementation Specifications

**Status:** Planning
**Dependencies:** Phase indexing-pipeline ✅ COMPLETE
**Priority:** 🎯 LOW PRIORITY (Complex)
**Goal:** Enable PDF document upload with text extraction for browser-based RAG

---

## 🚨 Browser-Only Constraints

**Challenge:** PDF parsing in browser without backend

### Why This Is Complex

**No Server-Side Tools:**

- ❌ Can't use Python libraries (PyPDF2, pdfplumber, pdfminer)
- ❌ Can't use Node.js libraries (pdf-parse requires fs module)
- ❌ Can't shell out to `pdftotext` or similar CLI tools
- ✅ Must use browser-compatible JavaScript libraries

**Browser Limitations:**

- Binary file format (not plain text like .md/.txt)
- Large file sizes (typical PDFs: 500KB-50MB)
- Complex parsing (fonts, images, layout extraction)
- Memory constraints (large PDFs can OOM browser)
- Performance (PDF parsing is CPU-intensive, blocks main thread)

**Trade-offs:**

- **Accuracy vs Performance**: Fast extraction may miss content
- **Layout vs Simplicity**: Preserving layout adds complexity
- **Client-side vs Server**: Browser-only limits library choices

---

## 1. Current State Analysis

### 1.1 File Upload Flow (Text Files Only)

**Current Pipeline:**

```typescript
File Upload (Browser)
  ↓ file.text() // Works for .md/.txt, FAILS for PDFs
String Content
  ↓ VectorDBContext.uploadFiles()
INSERT INTO documents (content TEXT)
  ↓ [indexing enabled]
Chunking → Embedding → Storage
```

**Key Assumptions (Break for PDFs):**

1. ✅ `file.text()` extracts content → ❌ Returns gibberish for PDFs
2. ✅ Content is UTF-8 text → ❌ PDFs are binary format
3. ✅ Content has `\n\n` paragraph breaks → ❌ PDFs need layout extraction
4. ✅ No preprocessing needed → ❌ PDFs require parsing step
5. ✅ Fast extraction (<100ms) → ❌ PDFs take seconds to parse

### 1.2 Current Validation

**File Type Validation** (DocumentsPage.tsx lines 25-28):

```typescript
const validFiles = files.filter((file) => {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'txt'; // NO .pdf
});
```

**HTML Accept Attribute** (UploadZone.tsx line 78):

```typescript
<input type="file" accept=".md,.txt" multiple /> // NO .pdf
```

**MIME Type Assignment** (VectorDBContext.tsx lines 578-579):

```typescript
const mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain';
// NO 'application/pdf'
```

### 1.3 Current Chunking Logic

**Function:** `chunkDocument(content: string)` (VectorDBContext.tsx lines 135-219)

**Assumptions:**

- Input: Plain text string with `\n\n` separators
- Token-based splitting (2000 token chunks, 200 token overlap)
- Heading extraction via regex: `/^##?\s+(.+)$/m`
- Paragraph-boundary-aware splitting

**Impact:**

- ✅ Works perfectly for .md/.txt after extraction
- ⚠️ Needs PDF text preprocessing (page breaks, layout)
- ⚠️ May need PDF-specific heading extraction

---

## 2. Solution Approach: pdf.js

### 2.1 Library Selection

**Winner: Mozilla PDF.js**

**Why pdf.js:**

- ✅ Browser-native (powers Firefox PDF viewer)
- ✅ WASM-accelerated for performance
- ✅ Zero dependencies (no Node.js fs module)
- ✅ Actively maintained (Mozilla Foundation)
- ✅ Battle-tested (millions of users)
- ✅ Handles complex PDFs (fonts, encodings, images)
- ✅ Page-by-page extraction (progressive rendering)
- ✅ ~500KB bundle size (acceptable)

**Alternatives Rejected:**

- ❌ `pdf-parse`: Requires Node.js `fs` module (server-only)
- ❌ `react-pdf`: Rendering-focused, not text extraction
- ❌ `jsPDF`: PDF _generation_, not parsing
- ❌ `pdf2json`: Unmaintained, complex API

### 2.2 Architecture Overview

**PDF Extraction Pipeline:**

```typescript
PDF File (Binary)
  ↓ ArrayBuffer
pdf.js getDocument()
  ↓ PDFDocumentProxy
Extract Text Page-by-Page
  ↓ Progress Updates (10%, 20%, ...)
Concatenate Pages
  ↓ Add Page Markers
Plain Text String
  ↓ VectorDBContext.uploadFiles()
(Existing chunking pipeline)
```

**Key Phases:**

1. **Binary Loading**: Convert File to ArrayBuffer
2. **PDF Parsing**: Use pdf.js to load document structure
3. **Text Extraction**: Extract text from each page sequentially
4. **Page Metadata**: Preserve page numbers as markers
5. **Concatenation**: Combine pages with separators
6. **Existing Pipeline**: Feed to current chunking/embedding

### 2.3 Text Extraction Strategy

**Page Separator Format:**

```
[Page 1]

{Page 1 content here with original line breaks}

[Page 2]

{Page 2 content here...}
```

**Benefits:**

- Page numbers preserved for citations ("Found on page 3")
- Natural paragraph breaks between pages
- Compatible with existing chunking logic
- Human-readable debug format

**Chunking Implications:**

- Chunks may span page boundaries (natural for long sections)
- Page markers captured as heading-like metadata
- Citations can reference source page numbers

---

## 3. Incremental TDD Phases

### Phase pdf-library: Install & Verify pdf.js

**Goal:** Add pdf.js dependency and verify browser compatibility

**Dependencies:**

```bash
npm install pdfjs-dist@^4.0.379
```

**Worker Configuration** (Vite):

```typescript
// vite.config.ts
export default defineConfig({
  // ...
  optimizeDeps: {
    exclude: ['@electric-sql/pglite', 'pdfjs-dist'], // Don't pre-bundle WASM
  },
});
```

**Test:** Unit test for pdf.js API availability

```typescript
// src/lib/pdf-parser.test.ts
import * as pdfjsLib from 'pdfjs-dist';

test('pdf.js library loads successfully', () => {
  expect(pdfjsLib.getDocument).toBeDefined();
  expect(pdfjsLib.version).toMatch(/^\d+\.\d+\.\d+$/);
});
```

**Checkpoint:** ✅ pdf.js installed, imports work, Vite builds successfully

---

### Phase pdf-parsing: Core Text Extraction

**Goal:** Extract text from PDF files using pdf.js

**Implementation:**

**File:** `src/lib/pdf-parser.ts` (NEW)

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker (required for pdf.js)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PDFParseProgress {
  currentPage: number;
  totalPages: number;
  percentage: number; // 0-100
  message: string;
}

export interface PDFParseResult {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
}

export async function parsePDF(
  file: File,
  onProgress?: (progress: PDFParseProgress) => void
): Promise<PDFParseResult> {
  // Step 1: Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Step 2: Load PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  // Step 3: Extract text from each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Combine text items with spacing
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();

    // Add page marker
    pageTexts.push(`[Page ${pageNum}]\n\n${pageText}`);

    // Emit progress
    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        percentage: Math.round((pageNum / totalPages) * 100),
        message: `Extracting text from page ${pageNum} of ${totalPages}...`,
      });
    }
  }

  // Step 4: Get metadata
  const metadata = await pdf.getMetadata();

  return {
    text: pageTexts.join('\n\n'),
    pageCount: totalPages,
    metadata: {
      title: metadata.info.Title,
      author: metadata.info.Author,
      subject: metadata.info.Subject,
      creator: metadata.info.Creator,
    },
  };
}
```

**Test:** Unit tests for PDF parsing

```typescript
// src/lib/pdf-parser.test.ts
import { parsePDF } from './pdf-parser'

test('parsePDF extracts text from simple PDF', async () => {
  // Use test fixture: e2e/fixtures/files/sample.pdf
  const file = new File([await fetch('/fixtures/sample.pdf').then(r => r.blob())], 'sample.pdf', {
    type: 'application/pdf'
  })

  const result = await parsePDF(file)

  expect(result.text).toContain('[Page 1]')
  expect(result.pageCount).toBeGreaterThan(0)
  expect(result.text.length).toBeGreaterThan(100) // Has content
})

test('parsePDF emits progress updates', async () => {
  const file = // ... load multi-page PDF
  const progressUpdates: number[] = []

  await parsePDF(file, (progress) => {
    progressUpdates.push(progress.percentage)
  })

  expect(progressUpdates.length).toBeGreaterThan(1)
  expect(progressUpdates[0]).toBeLessThan(progressUpdates[progressUpdates.length - 1])
})

test('parsePDF handles empty PDF gracefully', async () => {
  const file = // ... load empty PDF
  const result = await parsePDF(file)

  expect(result.text).toBe('')
  expect(result.pageCount).toBe(0)
})
```

**Checkpoint:** ✅ pdf.js extracts text from PDFs, progress tracking works, tests pass

---

### Phase pdf-validation: File Type Validation

**Goal:** Accept .pdf files in upload workflow

**Changes:**

**1. Update HTML Accept Attribute** (UploadZone.tsx line 78):

```typescript
// Before
<input type="file" accept=".md,.txt" multiple />

// After
<input type="file" accept=".md,.txt,.pdf" multiple />
```

**2. Update Client-side Validation** (DocumentsPage.tsx lines 25-28):

```typescript
// Before
const validFiles = files.filter((file) => {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'txt';
});

// After
const validFiles = files.filter((file) => {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'txt' || ext === 'pdf';
});
```

**3. Update MIME Type Mapping** (VectorDBContext.tsx lines 578-579):

```typescript
// Before
const mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain';

// After
const mimeType = file.name.endsWith('.md')
  ? 'text/markdown'
  : file.name.endsWith('.pdf')
    ? 'application/pdf'
    : 'text/plain';
```

**Test:** E2E test for PDF file acceptance

```typescript
// e2e/documents-upload.spec.ts (extend existing file)
test('accepts PDF files', async ({ page }) => {
  const documentsPage = new DocumentPage(page);
  await documentsPage.setup();

  // Upload sample.pdf
  await documentsPage.uploadFiles([{ name: 'sample.pdf', content: pdfBlob }]);

  // Verify file appears in list
  await documentsPage.documentList.waitForFileToAppear('sample.pdf');
  const fileId = await documentsPage.documentList.findFileByName('sample.pdf');
  expect(fileId).toBeTruthy();
});
```

**Checkpoint:** ✅ .pdf files accepted, validation passes, UI shows PDF uploads

---

### Phase pdf-integration: Integrate PDF Parser with Upload Flow

**Goal:** Extract text from PDFs before database insertion

**Changes:**

**Update VectorDBContext.uploadFiles()** (VectorDBContext.tsx lines 573-623):

```typescript
// Before (lines 577-579)
const content = await file.text();
const mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain';

// After
let content: string;
let mimeType: string;
let pdfMetadata: { pageCount?: number } = {};

if (file.name.toLowerCase().endsWith('.pdf')) {
  // PDF extraction
  mimeType = 'application/pdf';

  try {
    const parseResult = await parsePDF(file, (progress) => {
      // Emit progress update (optional: show "Parsing PDF..." in UI)
      console.log(
        `PDF parsing: ${progress.percentage}% (${progress.currentPage}/${progress.totalPages})`
      );
    });

    content = parseResult.text;
    pdfMetadata.pageCount = parseResult.pageCount;

    // Validate extracted text
    if (!content || content.trim().length === 0) {
      throw new Error('PDF parsing produced empty text. File may be image-only or corrupted.');
    }
  } catch (error) {
    console.error('PDF parsing failed:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
} else {
  // Text file extraction (existing logic)
  content = await file.text();
  mimeType = file.name.endsWith('.md') ? 'text/markdown' : 'text/plain';
}
```

**Error Handling:**

- Empty PDF text: Throw error with user-friendly message
- Corrupted PDF: Catch pdf.js errors and display message
- Unsupported PDF features: Log warning, proceed with partial text

**Test:** Integration test for PDF text extraction

```typescript
// src/contexts/VectorDBContext.test.tsx
test('uploadFiles extracts text from PDF', async () => {
  const { result } = renderHook(() => useVectorDB(), { wrapper: VectorDBProvider });

  const pdfFile = new File([pdfBlob], 'test.pdf', { type: 'application/pdf' });

  await act(async () => {
    await result.current.uploadFiles([pdfFile]);
  });

  // Verify document inserted
  const docs = result.current.documents;
  expect(docs).toHaveLength(1);
  expect(docs[0].filename).toBe('test.pdf');
  expect(docs[0].mime_type).toBe('application/pdf');
  expect(docs[0].content).toContain('[Page 1]');
  expect(docs[0].content.length).toBeGreaterThan(100);
});
```

**Checkpoint:** ✅ PDFs parsed on upload, text stored in database, existing chunking works

---

### Phase pdf-progress: PDF Parsing Progress UI

**Goal:** Show PDF parsing progress during upload

**UI Requirements:**

**Upload Progress States:**

1. **Text files (.md/.txt)**: "Uploading..." (fast, <100ms)
2. **PDF files**: "Parsing PDF... 45%" (slower, 1-10 seconds)

**Implementation:**

**1. Add Parsing State** (VectorDBContext.tsx):

```typescript
interface UploadProgress {
  filename: string;
  stage: 'uploading' | 'parsing' | 'storing' | 'completed';
  percentage: number;
  message: string;
}

const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
```

**2. Update uploadFiles()** (emit progress):

```typescript
if (file.name.toLowerCase().endsWith('.pdf')) {
  // Emit initial progress
  setUploadProgress((prev) =>
    new Map(prev).set(file.name, {
      filename: file.name,
      stage: 'parsing',
      percentage: 0,
      message: 'Starting PDF parsing...',
    })
  );

  const parseResult = await parsePDF(file, (progress) => {
    // Emit real-time progress
    setUploadProgress((prev) =>
      new Map(prev).set(file.name, {
        filename: file.name,
        stage: 'parsing',
        percentage: progress.percentage,
        message: progress.message,
      })
    );
  });

  // Clear progress on completion
  setUploadProgress((prev) => {
    const next = new Map(prev);
    next.delete(file.name);
    return next;
  });
}
```

**3. UI Component** (DocumentCard.tsx):

```typescript
// Show parsing progress for PDFs
{document.mime_type === 'application/pdf' && uploadProgress && (
  <div className="text-sm text-gray-600">
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${uploadProgress.percentage}%` }}
        />
      </div>
      <span>{uploadProgress.percentage}%</span>
    </div>
    <p className="mt-1">{uploadProgress.message}</p>
  </div>
)}
```

**Test:** E2E test for PDF parsing progress

```typescript
// e2e/indexing-workflow-pdf.spec.ts
test('shows parsing progress for PDF upload', async ({ page }) => {
  const documentsPage = new DocumentPage(page);
  await documentsPage.setup(apiKey);

  // Upload medium PDF (5-10 pages)
  await documentsPage.uploadFiles([{ name: 'medium.pdf', content: pdfBlob }]);

  // Wait for parsing to start
  const progressBar = page.locator('[data-testid="pdf-parsing-progress"]');
  await expect(progressBar).toBeVisible();

  // Verify progress increases
  const initialProgress = await progressBar.getAttribute('data-progress');
  await page.waitForTimeout(1000);
  const laterProgress = await progressBar.getAttribute('data-progress');
  expect(Number(laterProgress)).toBeGreaterThan(Number(initialProgress));

  // Wait for completion
  await expect(progressBar).not.toBeVisible({ timeout: 30000 });
});
```

**Checkpoint:** ✅ PDF parsing progress visible in UI, percentage updates, completes successfully

---

### Phase pdf-size-limits: File Size Validation

**Goal:** Prevent large PDFs from causing browser OOM

**Size Limits:**

- **Small PDFs**: < 5 MB (acceptable, fast parsing)
- **Medium PDFs**: 5-20 MB (acceptable, slower parsing)
- **Large PDFs**: > 20 MB (warning, may be slow)
- **Huge PDFs**: > 50 MB (reject, likely to OOM)

**Implementation:**

**1. Validation Function** (VectorDBContext.tsx):

```typescript
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB
const WARN_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

function validatePDFSize(file: File): { valid: boolean; warning?: string; error?: string } {
  if (file.size > MAX_PDF_SIZE) {
    return {
      valid: false,
      error: `PDF file too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size: 50 MB.`,
    };
  }

  if (file.size > WARN_PDF_SIZE) {
    return {
      valid: true,
      warning: `Large PDF (${(file.size / 1024 / 1024).toFixed(1)} MB). Parsing may take 10-30 seconds.`,
    };
  }

  return { valid: true };
}
```

**2. Apply Validation** (uploadFiles()):

```typescript
const validFiles = files.filter((file) => {
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    const validation = validatePDFSize(file);
    if (!validation.valid) {
      console.error(`Rejected ${file.name}: ${validation.error}`);
      // Show toast notification (optional)
      return false;
    }
    if (validation.warning) {
      console.warn(`${file.name}: ${validation.warning}`);
    }
  }

  return ext === 'md' || ext === 'txt' || ext === 'pdf';
});
```

**3. UI Feedback** (optional toast):

```typescript
// Show error toast for rejected files
if (validation.error) {
  toast.error(validation.error, {
    duration: 5000,
    position: 'top-right',
  });
}
```

**Test:** Unit test for size validation

```typescript
test('rejects PDFs larger than 50MB', async () => {
  const largeBlob = new Blob([new ArrayBuffer(51 * 1024 * 1024)]); // 51 MB
  const largeFile = new File([largeBlob], 'large.pdf', { type: 'application/pdf' });

  const { result } = renderHook(() => useVectorDB(), { wrapper: VectorDBProvider });

  await act(async () => {
    await result.current.uploadFiles([largeFile]);
  });

  // Verify file NOT uploaded
  expect(result.current.documents).toHaveLength(0);
});

test('accepts PDFs smaller than 50MB', async () => {
  const smallBlob = new Blob([new ArrayBuffer(5 * 1024 * 1024)]); // 5 MB
  const smallFile = new File([smallBlob], 'small.pdf', { type: 'application/pdf' });

  const { result } = renderHook(() => useVectorDB(), { wrapper: VectorDBProvider });

  await act(async () => {
    await result.current.uploadFiles([smallFile]);
  });

  // Verify file uploaded
  expect(result.current.documents).toHaveLength(1);
});
```

**Checkpoint:** ✅ Large PDFs rejected, warnings shown, tests pass

---

### Phase pdf-chunking: PDF-Aware Chunking

**Goal:** Optimize chunking for PDF-extracted text

**Current Chunking:** (VectorDBContext.tsx lines 135-219)

- Token-based splitting (2000 tokens, 200 overlap)
- Paragraph-boundary-aware (`\n\n` splits)
- Heading extraction: `/^##?\s+(.+)$/m`

**PDF-Specific Enhancements:**

**1. Page Marker Handling:**

```typescript
// Detect page markers in extracted text
const pageMarkerRegex = /^\[Page (\d+)\]$/m;

function chunkDocument(content: string, filename: string): Chunk[] {
  const isPDF = filename.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    // Extract page markers for metadata
    const pageMarkers = Array.from(content.matchAll(/^\[Page (\d+)\]$/gm));

    // Split on page boundaries FIRST, then apply token-based chunking within pages
    const pages = content.split(/^\[Page \d+\]$/m).filter((p) => p.trim());

    const chunks: Chunk[] = [];
    pages.forEach((pageContent, pageIndex) => {
      const pageChunks = chunkPage(pageContent, 2000, 200); // Existing logic
      pageChunks.forEach((chunk) => {
        chunks.push({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            page: pageIndex + 1, // Preserve page number
          },
        });
      });
    });

    return chunks;
  }

  // Existing chunking for .md/.txt
  return chunkMarkdown(content);
}
```

**2. Citation Format:**

```typescript
// Store page number with each chunk
interface Chunk {
  content: string;
  heading?: string;
  metadata?: {
    page?: number; // For PDFs
    filename: string;
  };
}

// Later, during RAG search, include page in citation:
// "Source: document.pdf (Page 5)"
```

**Test:** Unit test for PDF chunking

```typescript
test('chunks PDF text with page markers', () => {
  const pdfText = `[Page 1]\n\nFirst page content here with some text.\n\n[Page 2]\n\nSecond page content here.`;

  const chunks = chunkDocument(pdfText, 'test.pdf');

  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0].metadata?.page).toBe(1);
  expect(chunks[chunks.length - 1].metadata?.page).toBeGreaterThanOrEqual(1);
});

test('preserves page numbers across chunk boundaries', () => {
  const longPdfText = `[Page 1]\n\n${'Long content '.repeat(1000)}\n\n[Page 2]\n\n${'More content '.repeat(1000)}`;

  const chunks = chunkDocument(longPdfText, 'test.pdf');

  // Verify some chunks have page=1, others have page=2
  const page1Chunks = chunks.filter((c) => c.metadata?.page === 1);
  const page2Chunks = chunks.filter((c) => c.metadata?.page === 2);
  expect(page1Chunks.length).toBeGreaterThan(0);
  expect(page2Chunks.length).toBeGreaterThan(0);
});
```

**Checkpoint:** ✅ PDF chunks preserve page numbers, citations reference pages, tests pass

---

### Phase pdf-citations: Display PDF Page Numbers in Search Results

**Goal:** Show page numbers in source citations for PDFs

**UI Changes:**

**SourceCitations Component** (src/components/SourceCitations.tsx):

**Current Display:**

```
[1] document.md (Heading: Introduction)
Similarity: 0.85
```

**Enhanced Display (for PDFs):**

```
[1] document.pdf (Page 5)
Similarity: 0.85
```

**Implementation:**

```typescript
// SearchResult interface extension
interface SearchResult {
  content: string
  heading?: string
  filename: string
  similarity: number
  page?: number // NEW for PDFs
}

// Citation rendering
{sources.map((source, index) => (
  <div key={index} className="citation">
    <strong>[{index + 1}]</strong> {source.filename}
    {source.page && ` (Page ${source.page})`}
    {source.heading && ` (${source.heading})`}
    <span className="text-gray-500">Similarity: {(source.similarity * 100).toFixed(0)}%</span>
  </div>
))}
```

**Database Query Update:**

```sql
-- Include page number in vector search results
SELECT
  c.content,
  c.heading,
  d.filename,
  d.mime_type,
  c.metadata->>'page' as page,  -- Extract page from JSON metadata
  1 - (c.embedding <=> $1::vector) as similarity
FROM chunks c
JOIN documents d ON c.document_id = d.id
ORDER BY c.embedding <=> $1::vector
LIMIT $2
```

**Test:** E2E test for PDF citations with page numbers

```typescript
// e2e/search-pdf-citations.spec.ts
test('displays page numbers in PDF citations', async ({ page }) => {
  const chatPage = new ChatPage(page);
  await chatPage.setup(apiKey);

  // Upload PDF with multiple pages
  await chatPage.uploadDocument('multi-page.pdf', pdfBlob);
  await chatPage.waitForIndexingComplete('multi-page.pdf');

  // Search for content from specific page
  await chatPage.sendMessage('What does page 3 discuss?');
  await chatPage.waitForResponse();

  // Verify citation shows page number
  const citation = page.locator('[data-testid="source-citation-1"]');
  await expect(citation).toContainText('Page');
  await expect(citation).toContainText('multi-page.pdf');
});
```

**Checkpoint:** ✅ PDF citations show page numbers, UI displays correctly, E2E test passes

---

### Phase pdf-metadata: Store PDF Metadata

**Goal:** Capture PDF metadata (title, author, page count) for display

**Database Schema Extension:**

**documents table:**

```sql
-- Add metadata column (JSONB for flexible storage)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Store PDF metadata as JSON:
{
  "pageCount": 42,
  "title": "Machine Learning Handbook",
  "author": "John Doe",
  "subject": "AI/ML",
  "creator": "LaTeX with hyperref"
}
```

**Update uploadFiles():**

```typescript
if (file.name.toLowerCase().endsWith('.pdf')) {
  const parseResult = await parsePDF(file);

  // Store metadata in database
  const metadata = {
    pageCount: parseResult.pageCount,
    title: parseResult.metadata.title,
    author: parseResult.metadata.author,
    subject: parseResult.metadata.subject,
    creator: parseResult.metadata.creator,
  };

  await db.query(
    `INSERT INTO documents (id, filename, content, file_size, mime_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, filename, content, fileSize, mimeType, JSON.stringify(metadata)]
  );
}
```

**UI Display** (DocumentCard.tsx):

```typescript
{document.mime_type === 'application/pdf' && document.metadata?.pageCount && (
  <div className="text-sm text-gray-500">
    {document.metadata.pageCount} pages
    {document.metadata.author && ` • Author: ${document.metadata.author}`}
  </div>
)}
```

**Checkpoint:** ✅ PDF metadata stored, page count displayed, author shown

---

### Phase pdf-e2e: Comprehensive E2E Testing

**Goal:** End-to-end tests for full PDF workflow

**Test File:** `e2e/indexing-workflow-pdf.spec.ts` (NEW)

**Test Fixtures:**

```typescript
// e2e/fixtures/pdf-samples.ts
export const PDF_SAMPLES = {
  SMALL: {
    filename: 'sample-small.pdf',
    path: './fixtures/files/sample-small.pdf',
    pages: 2,
    sizeKB: 50,
    expectedChunks: 3,
  },
  MEDIUM: {
    filename: 'sample-medium.pdf',
    path: './fixtures/files/sample-medium.pdf',
    pages: 10,
    sizeKB: 500,
    expectedChunks: 15,
  },
  LARGE: {
    filename: 'sample-large.pdf',
    path: './fixtures/files/sample-large.pdf',
    pages: 50,
    sizeKB: 5000,
    expectedChunks: 80,
  },
};
```

**Test Cases:**

```typescript
import { test, expect } from './fixtures/globalSetup';
import { DocumentPage } from './pages/DocumentPage';
import { ChatPage } from './pages/ChatPage';
import { PDF_SAMPLES } from './fixtures/pdf-samples';
import { loadTestApiKey } from './utils/env';

test.describe('PDF Support @live', () => {
  let apiKey: string;

  test.beforeAll(() => {
    apiKey = loadTestApiKey();
  });

  test('Phase pdf-integration: upload PDF → parse → store', async ({ page }) => {
    const documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);

    // Upload small PDF
    await documentsPage.uploadFiles([
      {
        name: PDF_SAMPLES.SMALL.filename,
        path: PDF_SAMPLES.SMALL.path,
      },
    ]);

    // Wait for file to appear
    await documentsPage.documentList.waitForFileToAppear(PDF_SAMPLES.SMALL.filename);
    const fileId = await documentsPage.documentList.findFileByName(PDF_SAMPLES.SMALL.filename);
    expect(fileId).toBeTruthy();

    // Wait for indexing to complete
    await documentsPage.documentList.waitForIndexingStatus(fileId!, 'completed');

    // Verify chunk count
    const chunkCount = await documentsPage.documentList.getChunkCount(fileId!);
    expect(chunkCount).toBeGreaterThanOrEqual(PDF_SAMPLES.SMALL.expectedChunks - 2);
    expect(chunkCount).toBeLessThanOrEqual(PDF_SAMPLES.SMALL.expectedChunks + 2);
  });

  test('Phase pdf-progress: parsing progress visible', async ({ page }) => {
    const documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);

    // Upload medium PDF (slower parsing)
    await documentsPage.uploadFiles([
      {
        name: PDF_SAMPLES.MEDIUM.filename,
        path: PDF_SAMPLES.MEDIUM.path,
      },
    ]);

    // Verify parsing progress shown
    const progressBar = page.locator('[data-testid="pdf-parsing-progress"]');
    await expect(progressBar).toBeVisible({ timeout: 5000 });

    // Wait for completion
    const fileId = await documentsPage.documentList.findFileByName(PDF_SAMPLES.MEDIUM.filename);
    await documentsPage.documentList.waitForIndexingStatus(fileId!, 'completed', {
      timeout: 60000,
    });
  });

  test('Phase pdf-size-limits: rejects huge PDFs', async ({ page }) => {
    const documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);

    // Attempt to upload 60MB PDF (exceeds 50MB limit)
    const hugeBlob = new Blob([new ArrayBuffer(60 * 1024 * 1024)]);
    const hugeFile = new File([hugeBlob], 'huge.pdf', { type: 'application/pdf' });

    await documentsPage.uploadFiles([hugeFile]);

    // Verify file NOT uploaded
    await page.waitForTimeout(1000);
    const fileId = await documentsPage.documentList.findFileByName('huge.pdf');
    expect(fileId).toBeNull();
  });

  test('Phase pdf-citations: RAG with PDF shows page numbers', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.setup(apiKey);

    // Upload PDF
    await chatPage.uploadDocument(PDF_SAMPLES.SMALL.filename, PDF_SAMPLES.SMALL.path);
    await chatPage.waitForIndexingComplete(PDF_SAMPLES.SMALL.filename);

    // Attach PDF to chat
    await chatPage.attachDocument(PDF_SAMPLES.SMALL.filename);

    // Ask question
    await chatPage.sendMessage('Summarize the main points from this PDF');
    await chatPage.waitForResponse();

    // Verify citation includes page number
    const citation = page.locator('[data-testid="source-citation"]').first();
    await expect(citation).toContainText('Page');
    await expect(citation).toContainText(PDF_SAMPLES.SMALL.filename);
  });

  test('Phase pdf-metadata: displays page count', async ({ page }) => {
    const documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);

    // Upload medium PDF
    await documentsPage.uploadFiles([
      {
        name: PDF_SAMPLES.MEDIUM.filename,
        path: PDF_SAMPLES.MEDIUM.path,
      },
    ]);

    const fileId = await documentsPage.documentList.findFileByName(PDF_SAMPLES.MEDIUM.filename);
    await documentsPage.documentList.waitForIndexingStatus(fileId!, 'completed');

    // Verify page count displayed
    const card = page.locator(`[data-testid="div-doc-item-${fileId}"]`);
    await expect(card).toContainText(`${PDF_SAMPLES.MEDIUM.pages} pages`);
  });

  test('Phase pdf-persistence: state survives reload', async ({ page }) => {
    const documentsPage = new DocumentPage(page);
    await documentsPage.setup(apiKey);

    // Upload and index PDF
    await documentsPage.uploadFiles([
      {
        name: PDF_SAMPLES.SMALL.filename,
        path: PDF_SAMPLES.SMALL.path,
      },
    ]);

    const fileId = await documentsPage.documentList.findFileByName(PDF_SAMPLES.SMALL.filename);
    await documentsPage.documentList.waitForIndexingStatus(fileId!, 'completed');

    const preReloadChunks = await documentsPage.documentList.getChunkCount(fileId!);

    // Reload page
    await page.reload();
    await documentsPage.waitForDBInitialized();

    // Verify state persisted
    await documentsPage.documentList.waitForFileToAppear(PDF_SAMPLES.SMALL.filename);
    const postReloadChunks = await documentsPage.documentList.getChunkCount(fileId!);
    expect(postReloadChunks).toBe(preReloadChunks);
  });
});
```

**Test Execution:**

```bash
# Run PDF tests (hits real OpenAI API, costs ~$0.01)
npm run test:e2e -- indexing-workflow-pdf.spec.ts

# Expected: 6/6 tests passing
```

**Checkpoint:** ✅ All PDF E2E tests passing, full workflow validated

---

## 4. Database Schema Changes

**No schema changes required** - existing schema handles PDFs:

**documents table:**

- `content TEXT` - stores extracted text (works for PDFs)
- `mime_type TEXT` - stores `'application/pdf'` (existing column)
- `metadata JSONB` - stores PDF metadata (OPTIONAL, Phase pdf-metadata)

**chunks table:**

- `heading TEXT` - can store page markers like `[Page 5]`
- `embedding vector(1536)` - works same as .md/.txt
- NO new columns needed

**Metadata JSON Structure (Phase pdf-metadata):**

```json
{
  "pageCount": 42,
  "title": "Document Title",
  "author": "Author Name",
  "subject": "Subject",
  "creator": "PDF Creator"
}
```

---

## 5. Performance Considerations

### 5.1 Parsing Performance

**Expected Times (Browser, Single-threaded):**

- **Small PDF (1-5 pages)**: 500ms - 2 seconds
- **Medium PDF (10-20 pages)**: 2-5 seconds
- **Large PDF (50+ pages)**: 5-15 seconds
- **Huge PDF (100+ pages)**: 15-60 seconds (not recommended)

**Factors:**

- Page count (linear scaling)
- PDF complexity (fonts, images slow parsing)
- Browser performance (Chrome faster than Safari)
- Device CPU (mobile slower than desktop)

### 5.2 Memory Usage

**PDF Parsing Memory:**

- ArrayBuffer: ~1.2x file size (e.g., 10MB PDF = 12MB RAM)
- Intermediate text: ~2-3x file size
- pdf.js overhead: ~5-10 MB
- Total: ~3-4x file size during parsing

**Chunking/Embedding Memory:**

- Same as .md/.txt (depends on text size, not original PDF size)

**Recommendations:**

- Limit PDF size to 50MB (enforced in Phase pdf-size-limits)
- Warn users for 20MB+ PDFs
- Consider mobile devices (less RAM, slower CPU)

### 5.3 Cost Estimation (OpenAI Embeddings)

**PDF Text Length:**

- Average: ~500 words/page
- 10-page PDF: ~5,000 words = ~6,500 tokens
- 50-page PDF: ~25,000 words = ~33,000 tokens

**Embedding Costs:**

- 10-page PDF: ~$0.005
- 50-page PDF: ~$0.025
- 100-page PDF: ~$0.05

**Test Suite Costs:**

- Small PDF (2 pages): ~$0.001
- Medium PDF (10 pages): ~$0.005
- Large PDF (50 pages): ~$0.025
- **Total per test run**: ~$0.03

---

## 6. Browser Compatibility

### 6.1 pdf.js Compatibility

**Supported Browsers:**

- ✅ Chrome 90+ (excellent)
- ✅ Firefox 88+ (excellent)
- ✅ Safari 14+ (good)
- ✅ Edge 90+ (excellent)
- ⚠️ Mobile browsers (slower, memory-constrained)

**WASM Requirements:**

- All modern browsers support WebAssembly
- pdf.js uses WASM for performance
- Fallback to JavaScript (slower, not recommended)

### 6.2 Known Issues

**Safari:**

- Slightly slower PDF parsing than Chrome
- Stricter memory limits (may OOM on large PDFs)
- Works well for < 20MB PDFs

**Mobile:**

- Significantly slower parsing (2-3x desktop time)
- Lower memory limits (crash on large PDFs)
- Recommend 10MB limit for mobile

**Workarounds:**

- Enforce 50MB limit globally
- Show device-specific warnings
- Consider offloading to Web Worker (future enhancement)

---

## 7. Implementation Checklist

### Phase pdf-library ✅

- [ ] Install `pdfjs-dist@^4.0.379`
- [ ] Configure Vite to exclude from optimizeDeps
- [ ] Unit test for library availability
- [ ] Verify build succeeds

### Phase pdf-parsing ✅

- [ ] Create `src/lib/pdf-parser.ts`
- [ ] Implement `parsePDF()` function
- [ ] Configure pdf.js worker
- [ ] Add progress tracking
- [ ] Unit tests for text extraction
- [ ] Handle parsing errors

### Phase pdf-validation ✅

- [ ] Update HTML accept attribute (`.pdf`)
- [ ] Update client-side validation (allow `.pdf`)
- [ ] Update MIME type mapping (`application/pdf`)
- [ ] E2E test for PDF acceptance

### Phase pdf-integration ✅

- [ ] Update `VectorDBContext.uploadFiles()`
- [ ] Call `parsePDF()` for PDF files
- [ ] Validate extracted text (not empty)
- [ ] Error handling for corrupted PDFs
- [ ] Integration tests

### Phase pdf-progress ✅

- [ ] Add upload progress state
- [ ] Emit parsing progress updates
- [ ] Update DocumentCard to show progress
- [ ] E2E test for progress visibility

### Phase pdf-size-limits ✅

- [ ] Implement size validation (50MB limit)
- [ ] Show warnings for 20MB+ PDFs
- [ ] Reject oversized PDFs
- [ ] Unit tests for size limits

### Phase pdf-chunking ✅

- [ ] Detect page markers in text
- [ ] Preserve page numbers in chunks
- [ ] Store page metadata
- [ ] Unit tests for PDF chunking

### Phase pdf-citations ✅

- [ ] Update SearchResult interface (add `page?`)
- [ ] Update SourceCitations component
- [ ] Display page numbers in citations
- [ ] E2E test for PDF citations

### Phase pdf-metadata (OPTIONAL) ⚠️

- [ ] Add `metadata JSONB` column
- [ ] Store PDF metadata (title, author, pages)
- [ ] Display metadata in DocumentCard
- [ ] Unit tests

### Phase pdf-e2e ✅

- [ ] Create test fixtures (3 PDFs: small, medium, large)
- [ ] Create `e2e/indexing-workflow-pdf.spec.ts`
- [ ] Write 6 comprehensive E2E tests
- [ ] Verify all tests pass

---

## 8. Acceptance Criteria

**Phase PDF Support complete when:**

### Functional ✅

- ✅ Users can upload .pdf files via drag-and-drop or browse
- ✅ PDFs parsed and text extracted automatically
- ✅ Extracted text stored in database
- ✅ PDFs chunked and embedded like .md/.txt
- ✅ PDF chunks searchable in RAG queries
- ✅ Citations show page numbers for PDFs
- ✅ Large PDFs (>50MB) rejected with clear error
- ✅ Parsing progress visible during upload
- ✅ PDF metadata (page count, author) displayed

### Testing ✅

- ✅ Unit tests passing (pdf-parser, size validation, chunking)
- ✅ Integration tests passing (upload flow, extraction)
- ✅ E2E tests passing (6/6 in `indexing-workflow-pdf.spec.ts`)
- ✅ All existing tests still pass (no regressions)

### Quality ✅

- ✅ TypeScript compilation passing
- ✅ Build succeeds (`npm run build`)
- ✅ No console errors (DEV logging wrapped)
- ✅ Performance acceptable (<10s for 10-page PDF)
- ✅ Memory usage reasonable (no OOM on 20MB PDFs)

### User Experience ✅

- ✅ Clear feedback during PDF parsing
- ✅ Progress percentage visible
- ✅ Error messages user-friendly
- ✅ Size warnings for large PDFs
- ✅ Page numbers shown in search results

---

## 9. Known Limitations

**Not Implemented:**

- ❌ Image extraction from PDFs (text-only)
- ❌ Table structure preservation (linearized)
- ❌ Form field extraction (ignored)
- ❌ Annotations/comments (not extracted)
- ❌ Scanned PDFs (OCR not included)
- ❌ Password-protected PDFs (rejected)

**Future Enhancements:**

- Web Worker for PDF parsing (non-blocking UI)
- OCR integration for scanned PDFs (Tesseract.js)
- Better table extraction (maintain structure)
- PDF thumbnail generation
- Multi-column layout handling

---

## 10. Manual Testing Scenarios

### Scenario 1: Upload Small PDF

**Steps:**

1. Navigate to Documents page
2. Upload 2-page PDF (< 500 KB)
3. Observe parsing progress (should be fast, < 2 seconds)
4. Wait for indexing completion

**Expected:**

- ✅ File appears in list immediately
- ✅ Parsing progress shown briefly
- ✅ Indexing completes within 10 seconds
- ✅ Chunk count displayed
- ✅ Page count shown (e.g., "2 pages")

---

### Scenario 2: Upload Large PDF (20MB+)

**Steps:**

1. Upload 50-page PDF (~20MB)
2. Observe parsing progress (slower, 5-10 seconds)
3. Note warning message for large file

**Expected:**

- ✅ Warning shown: "Large PDF (20.5 MB). Parsing may take 10-30 seconds."
- ✅ Progress updates slowly (not instant)
- ✅ Eventually completes successfully
- ✅ No browser OOM

---

### Scenario 3: PDF RAG Query with Citations

**Steps:**

1. Upload 10-page PDF
2. Wait for indexing
3. Navigate to Chat page
4. Attach PDF document
5. Ask: "Summarize page 3"
6. Observe response and citations

**Expected:**

- ✅ AI response references PDF content
- ✅ Citation shows: `document.pdf (Page 3)`
- ✅ Similarity score displayed
- ✅ Citation clickable (shows chunk text)

---

### Scenario 4: Reject Oversized PDF

**Steps:**

1. Attempt to upload 60MB PDF
2. Observe rejection

**Expected:**

- ✅ Error message: "PDF file too large (60.0 MB). Maximum size: 50 MB."
- ✅ File NOT uploaded
- ✅ UI shows error toast
- ✅ Other files in batch still upload

---

### Scenario 5: Corrupted PDF Handling

**Steps:**

1. Upload corrupted/invalid PDF
2. Observe error handling

**Expected:**

- ✅ Error during parsing caught
- ✅ Indexing status: "Failed"
- ✅ Error message: "Failed to parse PDF: Invalid PDF structure"
- ✅ Retry button shown
- ✅ No browser crash

---

## 11. Migration & Rollout

### 11.1 Rollout Strategy

**Phase 1: Deploy with Feature Flag (Optional)**

```typescript
// Feature flag: FEATURE_PDF_SUPPORT_ENABLED
if (isFeatureEnabled(FEATURES.PDF_SUPPORT_ENABLED)) {
  // Show PDF upload option
} else {
  // Hide PDF upload, show only .md/.txt
}
```

**Phase 2: Gradual Rollout**

- Enable for internal testing (10% users)
- Monitor performance metrics (parse times, errors)
- Enable for all users after 1 week

**Phase 3: Full Deployment**

- Remove feature flag
- PDF support always enabled
- Update documentation

### 11.2 Monitoring Metrics

**Track:**

- PDF upload count (vs .md/.txt)
- Average parse time by PDF size
- Parse failure rate
- Memory usage (peak during parsing)
- Embedding cost increase

**Alerts:**

- Parse failure rate > 5%
- Average parse time > 30 seconds
- Browser OOM errors

---

## 12. Cost Impact Analysis

### 12.1 Embedding Cost Increase

**Assumptions:**

- Average PDF: 20 pages = 10,000 words = 13,000 tokens
- Average .md: 2,000 words = 2,600 tokens
- PDF : .md ratio = 5:1

**Cost Impact:**

- If 20% of uploads become PDFs:
  - Before: 100 docs/month × $0.002 = $0.20/month
  - After: 80 .md × $0.002 + 20 PDF × $0.01 = $0.36/month
  - **Increase**: +80% embedding costs

**Mitigation:**

- Monitor actual upload patterns
- Consider batching for large PDFs
- User awareness (show estimated cost)

### 12.2 Storage Impact

**IndexedDB Storage:**

- PDFs store text only (not binary)
- 20-page PDF: ~10,000 words = ~60 KB text
- 100 PDFs: ~6 MB text storage
- Embeddings: 100 PDFs × 30 chunks × 1536 dims × 4 bytes = ~18 MB
- **Total**: ~25 MB for 100 PDFs (acceptable)

---

## 13. Next Steps After Completion

After Phase PDF Support is complete, consider:

**Immediate:**

- Monitor usage patterns (PDF upload rate)
- Gather user feedback (parsing speed, accuracy)
- Fix any edge cases discovered

**Short-term:**

- Web Worker for PDF parsing (non-blocking)
- Better table extraction
- PDF thumbnail generation

**Long-term:**

- OCR for scanned PDFs (Tesseract.js)
- Multi-column layout handling
- Image extraction and indexing
- Enhanced metadata extraction

---

## 14. References & Resources

**pdf.js Documentation:**

- Official docs: https://mozilla.github.io/pdf.js/
- API reference: https://github.com/mozilla/pdf.js/wiki/API-Overview
- Examples: https://mozilla.github.io/pdf.js/examples/

**Text Extraction Guides:**

- Parsing strategies: https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs
- Browser usage: https://github.com/mozilla/pdf.js/blob/master/examples/learning/helloworld.html

**Performance Benchmarks:**

- WASM performance: https://mozilla.github.io/pdf.js/test/performance/

**Alternative Libraries (for reference):**

- pdf-parse: https://www.npmjs.com/package/pdf-parse (server-only)
- pdfjs-dist: https://www.npmjs.com/package/pdfjs-dist (browser-compatible)

---

## Summary

This specification provides a complete implementation roadmap for adding PDF support to the browser-based RAG application. The phased approach uses incremental TDD with:

- **pdf.js**: Browser-native PDF parsing (WASM-accelerated)
- **Progressive extraction**: Page-by-page with real-time progress
- **Existing pipeline**: Reuses chunking, embedding, storage
- **Page-aware citations**: References source page numbers
- **Size limits**: Prevents browser OOM (50MB max)
- **Comprehensive testing**: Unit, integration, E2E tests

**Bundle Impact:** +500KB (pdf.js WASM)
**Cost Impact:** +80% embedding costs (if 20% PDFs)
**Performance:** 2-10 seconds for typical PDFs

The implementation maintains browser-only architecture while delivering production-ready PDF support with excellent UX and test coverage.
