# Phase: Knowledge Base Isolation - Gap Coverage Specification

**Status:** 📝 PENDING IMPLEMENTATION
**Dependencies:** Phase knowledge-base-specs ✅ COMPLETE
**Goal:** Address isolation gaps identified in KB CRUD operations to ensure complete cleanup and robustness

**Created:** 2025-11-22
**Context:** Post-implementation analysis of KB isolation revealed 4 gaps requiring fixes

---

## 🎯 Incremental TDD Approach

**Key Principles:**

1. **Test-Driven** - E2E tests verify complete isolation and cleanup
2. **Progressive Enhancement** - Fix critical gaps first, then optimizations
3. **YAGNI** - Build only what's needed for isolation guarantees
4. **Incremental Phases** - Each phase delivers testable isolation improvement

**Implementation Order:**

1. **Phase reindex-implementation** - Automate KB re-indexing workflow (HIGH priority)
2. **Phase cleanup-robustness** - Verify and validate KB deletion cleanup (MEDIUM priority)
3. **Phase memory-management** - Optimize Lunr index memory usage (LOW priority)
4. **Phase migration-safety** - Improve orphaned document handling (LOW priority)
5. **Phase isolation-tests** - Add E2E tests verifying isolation guarantees

---

## Overview

Knowledge Base implementation (phase-knowledge-base-specs.md) achieved **9/10 isolation score** with strong per-KB separation:

**✅ Working Correctly:**

- Per-KB chunks tables (`kb_{kbId}_chunks`) with isolated vector spaces
- Per-KB HNSW indexes with independent tuning (m, ef_construction params)
- Per-KB Lunr indexes with separate search spaces
- Single-KB constraint enforcement preventing cross-contamination
- Foreign key cascades for document/chunk cleanup
- Upload requires KB assignment (no orphans)
- Cross-KB search blocked (throws error)

**⚠️ Identified Gaps:** 4 issues requiring fixes

This spec provides functional requirements to achieve **10/10 isolation score**.

---

## Gap 1: Re-Index Method Not Implemented

**Priority:** 🔴 HIGH
**Location:** `src/contexts/VectorDBContext.tsx:803-924`
**Impact:** Users cannot change KB embedding configuration without manual database operations

### Problem Statement

`updateKnowledgeBase()` correctly detects when configuration changes require re-indexing (embedding model/dimensions, chunk size, HNSW params), but no `reindexKnowledgeBase()` method exists to execute the re-index.

**User Experience Gap:**

1. User edits KB config (e.g., change from 768d to 1536d embeddings)
2. UI shows warning: "Configuration change requires re-indexing"
3. User confirms changes
4. ❌ Nothing happens - no re-index triggered
5. KB left in broken state (config updated but chunks use old embeddings)

### Functional Requirements

**Re-Index Workflow:**

1. **Validation Phase:**
   - Verify KB exists
   - Verify database initialized
   - Get current KB configuration

2. **Cleanup Phase:**
   - Drop existing KB-specific chunks table with CASCADE
   - Verify table dropped successfully (check information_schema.tables)
   - Throw error if verification fails

3. **Rebuild Phase:**
   - Create new chunks table using KB's updated config (dimensions, HNSW params)
   - Clear Lunr index for this KB (will rebuild during re-indexing)

4. **Queue Phase:**
   - Get all documents belonging to KB
   - Mark each document as 'pending' in indexing_queue
   - Reset retry counts and clear error states
   - Trigger indexing pipeline (processQueue)

5. **Logging:**
   - Log re-index start with KB ID and document count
   - Log each phase completion in development mode
   - Log errors with context for debugging

### UI Requirements

**Edit KB Modal Integration:**

**Current Behavior:** Shows warning but no action
**Required Behavior:** Show confirmation dialog and trigger re-index on user approval

**Confirmation Dialog Content:**

- Dialog title: "Configuration Change Requires Re-Indexing"
- Warning icon (⚠️)
- Message explaining what will happen:
  - Which config fields changed
  - Chunks table will be dropped and recreated
  - Number of documents affected
  - Estimated time ("may take several minutes")
- Impact list:
  - Existing chunks deleted immediately
  - Documents temporarily unsearchable
  - Sequential indexing queue processing
- Actions:
  - "Cancel" button (reverts config changes, closes modal)
  - "Save & Re-Index" button (applies changes and starts re-index)

**Post-Confirmation:**

- On confirm: Trigger re-index, show success toast with progress info
- On cancel: Revert KB config, show info toast, keep modal open

### VectorDBContext Changes

**New Method:** `reindexKnowledgeBase(id: string): Promise<void>`

**Purpose:** Automate the complete re-index workflow when KB configuration changes

**Context Export:** Add to VectorDBContext provider value and TypeScript interface

**Error Handling:**

- Throw errors (don't swallow) so UI can display to user
- Include KB ID and context in error messages

### Testing Requirements

**E2E Test File:** `e2e/documents/kb-reindex.spec.ts`

**Test Scenarios:**

1. **Successful Re-Index:**
   - Create KB with 768d embeddings
   - Upload document and wait for indexing completion
   - Verify chunks exist in chunks table
   - Edit KB to change dimensions to 1536d
   - Confirm re-index in dialog
   - Wait for indexing completion (timeout: 60s)
   - Verify chunks recreated with new dimensions (query DB schema)
   - Verify chunk count same as before

2. **Cancelled Re-Index:**
   - Create KB and upload document
   - Edit KB config (change dimensions)
   - Cancel in re-index dialog
   - Verify KB config unchanged (dimensions still 768)
   - Verify chunks table unchanged

3. **Re-Index with Multiple Documents:**
   - Create KB, upload 3 documents
   - Change embedding model and dimensions
   - Confirm re-index
   - Verify all 3 documents re-indexed successfully

**Data Attributes for Testing:**

- Dialog: `data-testid="dialog-reindex-warning"`
- Confirm button: `data-testid="btn-confirm-reindex"`
- Cancel button: `data-testid="btn-cancel-reindex"`
- Indexing status: `data-testid="indexing-status-completed"`

### Acceptance Criteria

- ✅ Re-index method implemented and exported
- ✅ Method drops old chunks table and creates new one with updated config
- ✅ All documents queued for re-indexing with reset status
- ✅ Lunr index cleared (rebuilds automatically)
- ✅ Edit modal triggers re-index when needed
- ✅ Confirmation dialog shows impact and allows cancel
- ✅ User can cancel (reverts config changes)
- ✅ Error messages shown to user if re-index fails
- ✅ E2E tests pass for successful and cancelled re-index
- ✅ Development logging for debugging

---

## Gap 2: DROP TABLE Error Handling

**Priority:** 🟠 MEDIUM
**Location:** `src/contexts/VectorDBContext.tsx:937-940`
**Impact:** Failed cleanup may leave orphaned chunks tables, causing database bloat

### Problem Statement

Current implementation swallows errors during chunks table deletion. If DROP TABLE fails, error is logged but execution continues. Caller doesn't know cleanup failed, and orphaned chunks tables accumulate in database.

**Potential Failure Scenarios:**

- Table locked by another transaction
- Insufficient permissions
- Corrupted table metadata
- Foreign key constraint violations (if CASCADE missing)

### Functional Requirements

**Cleanup Verification Workflow:**

1. **Drop Table with CASCADE:**
   - Execute DROP TABLE with CASCADE to remove dependent objects
   - Include IF EXISTS clause for idempotency

2. **Verification:**
   - Query information_schema.tables to confirm table doesn't exist
   - Check table_schema = 'public' and table_name matches
   - Throw error if table still exists after DROP

3. **Error Propagation:**
   - Re-throw errors (don't swallow) so caller knows cleanup failed
   - Include table name and error context in error message
   - UI should catch error and display to user

4. **Additional Checks (Optional Helper):**
   - Verify no documents reference deleted KB
   - Verify no orphaned indexing queue entries
   - Log warnings for orphaned data (documents already deleted by CASCADE)

5. **Logging:**
   - Log successful cleanup in development mode
   - Log errors with full context before re-throwing
   - Include table name in all log messages

### UI Requirements

**Delete KB Modal Error Handling:**

**Current Behavior:** Assumes success, shows success toast even if cleanup failed
**Required Behavior:** Catch errors, show error toast, keep modal open for retry

**Error Toast Content:**

- Error icon
- Message: "Failed to delete knowledge base: [error message]"
- Keep modal open so user can retry or cancel
- Log error to console for debugging

### Testing Requirements

**E2E Test File:** `e2e/documents/kb-cleanup.spec.ts`

**Test Scenarios:**

1. **Complete Cleanup Verification:**
   - Create KB with document
   - Wait for indexing completion
   - Verify chunks table exists before delete
   - Delete KB
   - Verify chunks table dropped (query information_schema)
   - Verify no documents reference KB (count = 0)
   - Verify no orphaned queue entries (count = 0)

2. **Error Handling (Optional):**
   - Requires mocking DB failure or corrupted state
   - Verify error message shown to user
   - Verify modal stays open for retry

**Database Query Helpers Needed:**

- `checkTableExists(tableName)` - Query information_schema
- `queryDocCountForKB(kbId)` - Count documents with FK
- `queryQueueEntriesForKB(kbId)` - Count queue entries for KB's docs

### Acceptance Criteria

- ✅ DROP TABLE includes CASCADE keyword
- ✅ Verification query checks information_schema after DROP
- ✅ Error thrown if verification fails (not swallowed)
- ✅ Error propagated to UI with user-friendly message
- ✅ UI catches error and shows toast (keeps modal open)
- ✅ Optional cleanup verification helper checks all related data
- ✅ E2E test verifies complete cleanup
- ✅ Development logging for successful and failed cleanup

---

## Gap 3: Lunr Index Memory Cleanup

**Priority:** 🟢 LOW
**Location:** `src/contexts/VectorDBContext.tsx:943`
**Impact:** Potential memory leak in long-running sessions with frequent KB deletes

### Problem Statement

Current Lunr index cleanup uses `Map.delete()` which removes reference but doesn't guarantee immediate garbage collection. Large KBs can have 10-50MB Lunr indexes in memory. In long-running browser sessions with many KB creates/deletes, memory accumulates before garbage collection runs.

**Lunr Index Memory Profile:**

- Small KB (100 chunks): ~500KB Lunr index
- Medium KB (1000 chunks): ~5MB Lunr index
- Large KB (100K chunks): ~50MB Lunr index

### Functional Requirements

**Optimization Strategies:**

1. **Lazy Index Building (Recommended):**
   - Remove eager index building on database initialization
   - Build Lunr indexes on-demand during first BM25 search per KB
   - Reduces memory footprint by not loading unused indexes
   - Current `searchBM25` already supports this pattern

2. **Cleanup Logging:**
   - Log when Lunr index removed (development mode only)
   - Track active index count after removal
   - Helps monitor memory usage in development

3. **Optional Memory Monitoring:**
   - Track number of active Lunr indexes
   - Log index count periodically for debugging
   - No user-facing feature, development only

### Implementation Changes

**Database Initialization:**

- Remove eager `buildLunrIndex()` call that builds all KB indexes on startup
- Add log message: "Lunr indexes will build on-demand"
- Reduces initial memory footprint

**Delete KB Cleanup:**

- Check if Lunr index exists before removing
- Log removal with active index count (dev mode only)
- Remove reference from Map (existing behavior)

**BM25 Search:**

- No changes needed (already builds on-demand if missing)

### Testing Requirements

**Manual Memory Testing (Optional):**

Browser console testing workflow:

1. Check initial memory usage (performance.memory API)
2. Create KB with large document (10MB)
3. Trigger BM25 search (builds Lunr index)
4. Check memory increase (~1-2MB expected)
5. Delete KB
6. Check memory after delete (may not decrease immediately)
7. Force GC if available (Chrome with --js-flags=--expose-gc)
8. Verify memory eventually decreases

**E2E Test:** Not required (memory testing impractical in Playwright, relies on GC timing)

### Acceptance Criteria

- ✅ Lunr indexes built lazily on-demand (not on startup)
- ✅ Database initialization doesn't build all indexes eagerly
- ✅ Index cleanup logs removal in development mode
- ✅ Active index count logged after removal
- ✅ Optional memory monitoring for development debugging
- ✅ Documentation comment explaining memory management strategy

---

## Gap 4: Orphaned Document Handling

**Priority:** 🟢 LOW
**Location:** `src/contexts/VectorDBContext.tsx:476-492`
**Impact:** Silent data deletion during migration, potential confusion

### Problem Statement

Current migration code silently deletes orphaned documents (no KB assignment) without logging. Error handling swallows constraint verification failures. If migration runs on existing data, documents deleted without user awareness.

**Migration Risk:**

- User has existing documents (pre-KB implementation)
- Migration adds `knowledge_base_id` column (nullable)
- All existing documents have `knowledge_base_id = NULL`
- Migration deletes all orphaned documents silently
- No warning or logging about data loss

**Note:** Per original spec, this is intentional for clean start, but should be explicit with logging.

### Functional Requirements

**Orphaned Document Handling:**

1. **Count Before Delete:**
   - Query count of documents with `knowledge_base_id IS NULL`
   - Log warning with count before deletion
   - List first 10 orphaned documents (dev mode only)

2. **Deletion with Logging:**
   - Delete orphaned documents only if count > 0
   - Log confirmation after deletion with count
   - Log "No orphaned documents found" if count = 0

3. **NOT NULL Constraint Verification:**
   - Query information_schema to check if constraint exists
   - Only add constraint if not already present
   - Re-throw error if constraint addition fails (don't swallow)
   - Log success when constraint added

4. **Optional: Default KB Creation (Alternative Approach):**
   - Instead of deleting, create "Default Knowledge Base"
   - Assign all orphaned documents to default KB
   - Create KB-specific chunks table
   - Log warning that documents need re-indexing
   - Preserves existing data instead of deleting

5. **Migration Safety Validation (Optional Helper):**
   - Count total documents, total KBs, assigned docs
   - Log assignment status: "X/Y documents assigned to KBs"
   - Warn if orphaned docs exist with no KBs

### Implementation Approach

**Two Options:**

**Option A: Delete with Logging (Current Spec Intent)**

- Count orphaned documents
- Warn before deletion
- Delete if needed
- Add NOT NULL constraint

**Option B: Preserve with Default KB (Data-Safe Alternative)**

- Count orphaned documents
- Create default KB if orphaned docs exist
- Assign orphans to default KB
- Mark for re-indexing
- Add NOT NULL constraint

**Recommendation:** Option A matches original spec for clean start. Option B safer for existing deployments.

### Testing Requirements

**Unit Test File:** `src/contexts/VectorDBContext.test.ts`

**Test Scenarios:**

1. **Orphaned Document Logging:**
   - Create documents without KB assignment
   - Run migration
   - Verify count logged to console

2. **Default KB Creation (if Option B chosen):**
   - Create orphaned documents
   - Run migration
   - Verify default KB created
   - Verify documents assigned to default KB
   - Verify no documents deleted

3. **Constraint Verification:**
   - Run migration twice
   - Verify constraint only added once
   - Verify no errors on second run

### Acceptance Criteria

- ✅ Orphaned document count logged before action
- ✅ Orphaned document filenames listed in dev mode (first 10)
- ✅ Deletion logged with count (if deleting)
- ✅ OR default KB created and documents assigned (if preserving)
- ✅ NOT NULL constraint existence checked before adding
- ✅ Error re-thrown if constraint addition fails
- ✅ Migration safety validation logs assignment status
- ✅ Unit tests cover both migration paths

---

## Summary of Implementation Plan

### Phase Execution Order

1. **Phase reindex-implementation** (Priority 1 - HIGH)
   - Implement `reindexKnowledgeBase()` method
   - Add UI confirmation dialog
   - Integrate with edit modal
   - Add E2E tests

2. **Phase cleanup-robustness** (Priority 2 - MEDIUM)
   - Improve DROP TABLE error handling
   - Add cleanup verification helper
   - Propagate errors to UI
   - Add E2E cleanup tests

3. **Phase memory-management** (Priority 3 - LOW)
   - Switch to lazy Lunr index building
   - Add explicit cleanup logging
   - Optional memory monitoring

4. **Phase migration-safety** (Priority 4 - LOW)
   - Add orphaned document logging
   - Implement default KB creation for migration
   - Add migration safety validation
   - Add unit tests

5. **Phase isolation-tests** (All priorities)
   - Add E2E tests for chunk table isolation
   - Add E2E tests for cross-KB search prevention
   - Add E2E tests for cleanup verification
   - Add E2E tests for Lunr index isolation

### Success Metrics

**Before Fixes:**

- Isolation Score: 9/10
- Re-index: Not working
- Cleanup Verification: None
- Error Propagation: Swallowed
- Memory Management: Unmonitored

**After Fixes:**

- Isolation Score: 10/10
- Re-index: Fully automated
- Cleanup Verification: Complete
- Error Propagation: To UI
- Memory Management: Monitored + optimized

### Testing Coverage

**New E2E Tests:** 5 files

- `kb-reindex.spec.ts` - Re-index workflow
- `kb-cleanup.spec.ts` - Cleanup verification
- `kb-isolation.spec.ts` - Chunk table isolation
- `kb-cross-search.spec.ts` - Cross-KB search prevention
- `kb-memory.spec.ts` - (Optional) Memory monitoring

**New Unit Tests:** 1 file

- `VectorDBContext.test.ts` - Migration scenarios

**Total Test Addition:** ~15-20 test scenarios

---

## Conclusion

Addressing these 4 gaps will elevate KB isolation from **9/10 to 10/10**, ensuring:

- ✅ Complete re-index automation
- ✅ Robust cleanup verification
- ✅ Optimal memory usage
- ✅ Safe migrations with logging

All fixes are backward-compatible and improve UX without breaking existing functionality.
