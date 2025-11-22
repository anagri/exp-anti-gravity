# Knowledge Base Test Coverage

## Test Files

### `kb-workflow.spec.ts` (Fast, Indexing Disabled)
**Phases:** `crud → upload → filtering → persistence`

**Coverage:**
- ✅ KB CRUD operations
  - Create KB with name/description
  - Verify KB stats (doc count, chunk count)
  - Create multiple KBs
  - Validation: duplicate KB name error
  - Delete KB
- ✅ Upload to specific KBs
  - Upload single file to KB
  - Upload multiple files to KB
  - Verify file count per KB
  - Verify files isolated to their KBs
- ✅ KB expansion/collapse filtering
  - Expand KB to show documents
  - Collapse KB to hide documents
  - URL sync with `?kb={id}` query param
  - Only one KB expanded at a time
- ✅ Persistence across reloads
  - KB expansion state persists
  - URL query param preserved
  - Browser back/forward navigation
  - Deep linking with `?kb={id}`
- ✅ Switching between KBs
  - Expanding KB B collapses KB A
  - URL updates when switching KBs

**Not Covered** (requires indexing):
- ❌ Chat file selection with KB filtering
- ❌ Auto-filter on document selection
- ❌ Selection summary with KB context

---

### `kb-workflow-live.spec.ts` (@live, Indexing Enabled)
**Phases:** `upload-index → chat-kb-filter → auto-filter → selection-summary`

**Coverage:**
- ✅ Upload and wait for indexing completion
  - Create KBs
  - Upload documents
  - Wait for "Indexed" status (60s timeout)
- ✅ Chat FileSelector KB filtering
  - KB filter dropdown present
  - Default to "All Knowledge Bases"
  - Filter to specific KB shows only its docs
  - Switching KB filters updates visible docs
- ✅ Auto-filter on selection
  - Selecting doc in "All" view switches to its KB
  - Only that KB's docs remain visible
  - Selection state maintained
- ✅ Selection summary with KB context
  - Shows "X document(s) selected from KB Name"
  - Changing KB filter clears selection
  - Summary updates to "No documents selected"

**Why Separate:**
- Requires indexing enabled (feature flag)
- Depends on async indexing completion
- Tagged `@live` (excluded from default test run)

---

## Coverage Matrix

| Feature | kb-workflow.spec.ts | kb-workflow-live.spec.ts |
|---------|---------------------|--------------------------|
| KB Create/Delete | ✅ | - |
| KB Stats | ✅ | - |
| KB Validation | ✅ | - |
| Upload to KB | ✅ | ✅ |
| KB Expansion/Collapse | ✅ | - |
| URL Sync | ✅ | - |
| Browser Navigation | ✅ | - |
| Indexing Wait | - | ✅ |
| Chat KB Filter | - | ✅ |
| Auto-filter Selection | - | ✅ |
| Selection Summary | - | ✅ |

---

## Original Test Files (Deleted)

These 5 files were consolidated:

1. **01-kb-crud.spec.ts** (158 lines)
   - Coverage moved to: `kb-workflow.spec.ts` PHASE CRUD

2. **02-kb-upload.spec.ts** (195 lines)
   - Coverage moved to: `kb-workflow.spec.ts` PHASE UPLOAD

3. **03-kb-filtering.spec.ts** (263 lines)
   - Coverage moved to: `kb-workflow.spec.ts` PHASE FILTERING

4. **04-kb-selection-chat.spec.ts** (395 lines)
   - Coverage moved to: `kb-workflow-live.spec.ts` PHASE CHAT-KB-FILTER + AUTO-FILTER + SELECTION-SUMMARY

5. **05-kb-persistence.spec.ts** (264 lines)
   - Coverage moved to: `kb-workflow.spec.ts` PHASE PERSISTENCE

**Total:** 1,275 lines → 235 lines (81% reduction, 100% coverage preserved)

---

## Running Tests

```bash
# Fast tests only (excludes @live)
npm run test:e2e -- e2e/knowledge-bases/

# Only live tests (requires indexing)
npm run test:e2e:live -- e2e/knowledge-bases/

# All KB tests
npx playwright test e2e/knowledge-bases/
```
