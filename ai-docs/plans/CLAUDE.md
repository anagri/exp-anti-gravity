# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Purpose

This directory (`ai-docs/plans/`) contains **implementation specifications** for features in the exp-anti-gravity project. Each spec documents the design, architecture, implementation phases, and test strategy for a feature.

---

## Spec Writing Philosophy

### Core Principles (Learned from Failures)

1. **Phase-Based Implementation** - Break features into 6-8 incremental phases, each independently testable
2. **Test-Driven** - Tests pass at end of each phase before proceeding
3. **Stop & Commit** - Commit only when phase tests pass (not after all phases)
4. **Breaking Changes Require Migration Strategy** - If page structure/workflows change, plan test migration upfront (10-20% of spec length)
5. **Post-Phase Retrospective** - Update spec with actual learnings after implementation

### What Makes a Good Spec

**Required Sections for Breaking Features:**

1. **Overview** - What's changing (before/after), why, key concepts
2. **Architectural Decisions** - Context → Problem → Alternatives → Decision → Rationale → Trade-offs
3. **Breaking Changes Inventory** - Dedicated section (not scattered), each with migration path
4. **Database Schema** - Tables, migrations, rollback plan
5. **Sequence Diagrams** - Complex workflows visualized (creation, upload, search)
6. **UI Design** - Components, interactions, data-testids for testing
7. **State Management** - Context changes, methods (new + modified), data flow
8. **Test Migration Strategy** - 10-20% of spec if breaking (see below)
9. **Implementation Phases** - Incremental delivery with pass criteria per phase
10. **Acceptance Criteria** - Checklist (database, UI, functionality, tests, quality)

**Test Migration Section Must Include:**

- Test impact matrix (which tests break, when, why)
- Page object method migration (old → new with context)
- Before/after code examples for affected tests
- Implementation order constraints with BLOCKER warnings
- Verification checklist (how to confirm tests pass)

### What Causes Spec Failures

**Red Flags That Predict Issues:**

1. **"We'll figure it out during implementation"** → Add sequence diagram or implementation details
2. **"Update tests as needed"** → Create test migration section with examples
3. **References to "global settings" in multiple sections with different meanings** → Architectural confusion, document decisions
4. **"Similar to existing feature X"** → Underspecified, add detailed comparison
5. **No mention of existing tests** → No breaking change analysis done, add test impact matrix

**Common Gaps:**

- Settings architecture contradictions (global vs entity-level)
- Implementation under-specified (pattern mentioned, not workflow)
- UX constraints not documented (emerge during coding)
- Test migration minimal (3 lines vs 10 pages needed)

### Spec Review Checklist

**Before implementation approval:**

#### Consistency

- [ ] No contradictions between sections
- [ ] All code references accurate (line numbers, method names)
- [ ] All "default values" clarified (global defaults vs settings)

#### Completeness

- [ ] Breaking changes section exists (dedicated, comprehensive)
- [ ] Test migration section exists if breaking (10-20% of spec)
- [ ] Test impact matrix identifies ALL affected tests
- [ ] Before/after code examples for test migration
- [ ] Sequence diagrams for 3+ most complex workflows
- [ ] Implementation order constraints with blockers

#### Technical Depth

- [ ] Database migrations detailed (not just schema)
- [ ] State management methods listed with updates required
- [ ] Search/indexing logic changes detailed
- [ ] UI component changes detailed (props/methods)

#### Risk Analysis

- [ ] Blocker identification: "Cannot proceed to Phase X without fixing Y"
- [ ] Rollback plan documented
- [ ] Performance impact analyzed
- [ ] Edge cases documented

---

## Phase-Based TDD Workflow

### Phase Completion Requirements

For **EVERY PHASE**:

1. **Write Tests First** (where applicable)
   - Unit tests for logic/functions
   - Integration tests for component interactions
   - E2E tests for user flows

2. **Implement Code**
   - Make tests pass
   - Follow existing patterns
   - Add TypeScript types

3. **Run All Tests**

   ```bash
   npm test              # Unit tests
   npm run test:e2e      # E2E tests (excludes @live)
   npm run test:e2e:live # Live tests only (costs money)
   npm run lint          # Check style
   npm run build         # TypeScript compilation
   ```

4. **Verify Tests Pass**
   - ALL existing tests pass
   - ALL new tests pass
   - NO test failures tolerated
   - Fix issues before proceeding

5. **Commit Changes**

   ```bash
   git add .
   git commit -m "<type>(scope): description"
   ```

   - Use conventional commits
   - Include test files
   - Commit only when tests pass

6. **Update Spec** (if deviations occurred)
   - Document what changed and why
   - Update implementation notes
   - Add to retrospective section

7. **Proceed to Next Phase**
   - Only when ALL tests pass
   - Phase checklist 100% complete

### Implementation Order Pattern

```
Phase X: Implement Feature
↓
Tests Break (if breaking change)
↓
STOP - Do Not Continue
↓
Update Page Objects (add new methods)
↓
Migrate Affected Tests
↓
Verify All Tests Pass
↓
Commit: "feat(scope): implement phase X"
Commit: "test(scope): migrate tests for phase X"
↓
Proceed to Phase X+1
```

**Key:** Breaking changes in prerequisite phases = test migration blockers. Fix tests immediately.

---

## Test Migration Patterns

### When Tests Need Migration

**Breaking Change Types:**

- Page structure reorganization (flat → hierarchical)
- Workflow prerequisite introduction (direct → multi-step)
- Data association requirement (optional → required FK)

**Symptoms:**

- "Element not found" → Page structure change
- "Validation error: X is required" → Workflow prerequisite missing
- "Foreign key constraint violation" → Data association missing

### Migration Strategies

**Proactive (Recommended):**

1. Implement breaking change
2. STOP - do not continue
3. Update page objects
4. Migrate affected tests
5. Verify tests pass
6. THEN continue

**Reactive (Discouraged):**

1. Implement all phases
2. Tests accumulate failures
3. Fix all at end

- **Result:** Compound complexity, harder debugging

### Common Pitfalls

1. **Forgetting prerequisite in beforeEach** → Add container/context creation
2. **Using old method instead of new** → Replace with context-aware version
3. **Accessing elements without context** → Expand container before accessing
4. **Using timing instead of state checks** → Replace `waitForTimeout()` with `expectReady()`

---

## Commit Conventions

**Format:** `<type>(scope): <description>`

**Types:**

- `feat(scope)` - New feature
- `fix(scope)` - Bug fix
- `test(scope)` - Test changes
- `refactor(scope)` - Code refactoring
- `docs(scope)` - Documentation
- `chore(scope)` - Maintenance

**Scopes:**

- Phase identifiers (e.g., `kb-schema`, `kb-upload`, `indexing-pipeline`)
- Feature areas (e.g., `worker`, `rag`, `ui`, `state`)

**Examples:**

```bash
git commit -m "feat(kb-schema): add knowledge_bases table and FK"
git commit -m "test(kb-upload): migrate documents-upload.spec.ts for KB workflow"
git commit -m "fix(indexing): handle rate limit with exponential backoff"
```

---

## Testing Strategy

### E2E-First Approach

- Write 2-3 comprehensive tests per phase covering complete workflows
- Each test has multiple steps and assertions
- Avoid 10+ granular tests - combine related actions
- Example: Single "CRUD workflow" covers upload → verify → delete → verify

### Unit Tests - Selective

- Only for complex logic/algorithms/state updates
- NOT for: TypeScript types, schemas, third-party libraries
- NOT for: Worker internals (use E2E due to Comlink compatibility)
- Focus on behavior, not implementation

### Live Tests

- Tests tagged `@live` hit real OpenAI API (cost money)
- Regular `test:e2e` excludes via `--grep-invert @live`
- Use `test:e2e:live` to run only live tests via `--grep @live`
- Pattern: `test.describe('Feature @live', () => { ... })`

---

## Architectural Patterns (From Successful Specs)

### Pattern: Per-Entity Configuration Tables

**When:** Different instances need different settings (e.g., per-KB HNSW params)

**Design:**

- Store settings at entity level (not global)
- Dynamic table/index creation with entity-specific config
- Example: `kb_{kbId}_chunks` with KB-specific dimensions/HNSW

**Spec Must Include:**

- Architectural decision: Why per-entity vs global
- Sequence diagram: Entity creation → config table creation
- Breaking change: Remove global settings

### Pattern: Hierarchical Organization

**When:** Transforming flat list to grouped/nested structure

**Design:**

- Container cards (collapsed by default)
- Container-scoped actions (upload, toolbar, list)
- URL query param for deep linking

**Spec Must Include:**

- Before/after page structure diagrams
- Test migration: Add container creation in beforeEach
- Page object methods: `createContainer()`, `expandContainer()`, `performActionInContainer()`

### Pattern: Background Job Queue

**When:** Long-running async operations (indexing, processing)

**Design:**

- Database queue table (id, status, created_at, retries)
- Status transitions (pending → processing → completed/failed)
- Progress tracking with real-time UI updates

**Spec Must Include:**

- State machine diagram (status transitions)
- Error handling: Retry logic with exponential backoff
- UI components: Status badges, progress bars (with data-testids)

---

## Common Implementation Issues & Solutions

### Issue 1: Tests Break Unexpectedly

**Cause:** Spec lacked test migration section
**Solution:** Always include test impact matrix predicting which tests break, when, and why

### Issue 2: Architectural Contradictions

**Cause:** Spec says "global" in one section, "per-entity" in another
**Solution:** Add Architectural Decisions section documenting choices upfront

### Issue 3: Implementation Details Missing

**Cause:** Spec mentions pattern (e.g., "kb\_{id}\_chunks") but not workflow
**Solution:** Add sequence diagrams showing step-by-step creation/usage/deletion

### Issue 4: UX Constraints Emerge During Coding

**Cause:** Spec describes feature but not constraints (e.g., single-KB selection)
**Solution:** Document constraints with technical rationale (e.g., "different embeddings incompatible")

---

## Retrospective Documentation

### After Each Feature Implementation

1. **Document Deviations**
   - What changed from spec
   - Why it changed
   - Ad-hoc fixes required

2. **Update Spec**
   - Reflect actual implementation (source of truth)
   - Add "Implementation Notes" section
   - Note settings architecture, data model changes

3. **Create Retrospective**
   - What went wrong
   - Root causes (spec gaps)
   - How to prevent similar issues
   - Templates for future specs

4. **Extract Patterns**
   - Timeless lessons (not implementation details)
   - Generic migration patterns
   - Reusable checklists

---

## File Naming Conventions

**Specs:** `phase-<feature-name>-specs.md`

- Example: `phase-knowledge-base-specs.md`
- Example: `phase-indexing-pipeline-specs.md`

**Test Migration:** `phase-<feature-name>-test-migration-spec.md`

- Created if breaking feature
- Documents conceptual migration patterns

**Retrospectives:** `<feature-name>-retrospective.md`

- Created after implementation
- Documents learnings and improvements

**Planning:** `<feature-name>-<purpose>.md`

- Example: `pglite-rag-pipeline.md` (initial exploration)

---

## Success Metrics

**Good Spec Results In:**

- 0-1 ad-hoc fix commits (not 3+)
- 0 unexpected test breaks (all predicted)
- Smooth implementation (no blockers)
- All 10 required sections present
- Test migration 10-20% of spec length

**Bad Spec Results In:**

- 3+ ad-hoc fix commits
- 6+ tests break unexpectedly
- Implementation paused for debugging
- Missing sections (Arch Decisions, Breaking Changes, Test Migration)
- Test updates mentioned in 3 lines

---

## Reference Specs

**Well-Structured Examples:**

- `phase-indexing-pipeline-specs.md` - Good phasing, test strategy
- `pglite-rag-pipeline.md` - Good TDD workflow documentation

**With Retrospective Learnings:**

- `phase-knowledge-base-specs.md` - Feature spec (corrected)
- `phase-knowledge-base-test-migration-spec.md` - Test migration patterns
- `kb-retrospective.md` - Comprehensive failure analysis and lessons

**Use these as templates for future specs.**

---

## Quick Start for New Specs

1. **Copy structure from reference spec** (e.g., `phase-indexing-pipeline-specs.md`)
2. **Use spec review checklist** (ensure all 10 sections present)
3. **Document architectural decisions** (not just implementation)
4. **Identify breaking changes upfront** (dedicated section with migration)
5. **Plan test migration** (10-20% of spec if breaking)
6. **Get review approval** (consistency, completeness, technical depth, risk)
7. **Implement phase-by-phase** (commit when tests pass)
8. **Update spec with actuals** (deviations documented)
9. **Create retrospective** (lessons for next feature)

---

## Key Takeaways

1. **Test migration is 10-20% of implementation effort** (not 3 lines)
2. **Breaking changes require migration strategy** (test impact matrix, before/after, blockers)
3. **Proactive > Reactive** (fix tests at each breaking phase, not at end)
4. **Specs are living documents** (update with actuals, retrospective sections)
5. **Patterns > Details** (document timeless lessons, not stale code references)
6. **Phase completion = tests pass** (never proceed with broken tests)
7. **Architectural contradictions = implementation bugs** (review for consistency)

---

**See retrospective docs for detailed failure analysis and prevention strategies.**
