# Phase: Knowledge Base Organization - Test Migration Specification

**Parent Spec:** `phase-knowledge-base-specs.md`
**Purpose:** Document conceptual test migration patterns for breaking feature changes
**Status:** ✅ COMPLETE (Retrospectively documented as educational reference)

---

## Executive Summary

This spec documents the **conceptual patterns and strategies** for migrating tests when implementing breaking features like Knowledge Base organization. It focuses on **timeless lessons** rather than specific implementation details.

**Key Pattern:** When page structure fundamentally changes (flat list → organized hierarchy), all tests assuming old structure must be migrated **before proceeding with implementation**.

**Educational Value:** Use as template for future breaking features that restructure UI/workflows.

---

## 1. Conceptual Breaking Change Patterns

### Pattern 1: Page Structure Reorganization

**Concept:** Transforming flat list to hierarchical organization

**Generic Before:**

```
FlatListPage
├── Page-level actions (always visible)
├── Page-level toolbar (search/filter)
└── Flat item list (all items)
```

**Generic After:**

```
HierarchicalPage
├── Container cards (collapsed by default)
└── Container card (when expanded)
    ├── Container-scoped actions
    ├── Container-scoped toolbar
    └── Items within container only
```

**Conceptual Impact:**

- Page-level actions moved to container-scoped context
- Items only accessible within container context
- Actions require container selection/expansion first

**Test Migration Pattern:**

```typescript
// Before: Direct access to page-level actions
test.beforeEach(async () => {
  await page.setup();
  // Actions immediately available
});

test('perform action', async () => {
  await page.performAction(item); // ❌ Fails - no context
});

// After: Container context required
test.beforeEach(async () => {
  await page.setup();
  await page.createContainer('Test Container'); // NEW
  await page.expandContainer('Test Container'); // NEW
});

test('perform action', async () => {
  await page.performActionInContainer('Test Container', item); // ✅ Works
});
```

**Lesson:** Tests assuming flat structure need container context added to `beforeEach`.

---

### Pattern 2: Workflow Prerequisite Introduction

**Concept:** Adding required setup step before existing workflow can execute

**Generic Before:**

```
Workflow: Action → Result
No prerequisites
```

**Generic After:**

```
Workflow: Setup → Context Selection → Action → Result
Prerequisites required
```

**Conceptual Impact:**

- Workflows cannot execute without setup
- Tests fail if they skip new prerequisite
- Error: "Element not found" (because context not established)

**Test Migration Pattern:**

```typescript
// Before: Direct workflow execution
test('workflow executes', async () => {
  await page.executeAction();
  await page.expectResult();
});

// After: Prerequisites required
test('workflow executes', async () => {
  await page.setupPrerequisite(); // NEW: Required first
  await page.selectContext(); // NEW: Establish context
  await page.executeAction(); // SAME: But now in context
  await page.expectResult(); // SAME
});
```

**Lesson:** Identify which workflows gain prerequisites, add setup in `beforeEach` or test start.

---

### Pattern 3: Data Association Requirement

**Concept:** Entities that were independent now require association with parent entity

**Generic Before:**

```
Entity exists independently
No required relationships
```

**Generic After:**

```
Entity must belong to parent
Parent-child relationship enforced (FK constraint or logic)
```

**Conceptual Impact:**

- Cannot create entity without parent
- Tests must create parent first
- Database constraint or validation error if parent missing

**Test Migration Pattern:**

```typescript
// Before: Entity created independently
test('create entity', async () => {
  await page.createEntity(entityData);
  await page.expectEntityExists();
});

// After: Parent required
test('create entity', async () => {
  const parent = await page.createParent('Test Parent'); // NEW
  await page.createEntityInParent(parent.id, entityData); // CHANGED
  await page.expectEntityExistsInParent(parent.id); // CHANGED
});
```

**Lesson:** When data model adds required FK, tests need parent creation logic.

---

## 2. Test Impact Analysis Framework

### Framework: Identify Affected Tests

**Step 1: Categorize Breaking Changes**

- Page structure changes (UI reorganization)
- Workflow changes (new prerequisites)
- Data model changes (new required relationships)

**Step 2: Map Tests to Breaking Changes**

| Breaking Change Type                    | Test Impact                     | Severity                          |
| --------------------------------------- | ------------------------------- | --------------------------------- |
| Page structure: No page-level element X | Tests accessing X directly      | ❌ CRITICAL (fails immediately)   |
| Workflow: New prerequisite Y required   | Tests skipping Y                | ⚠️ HIGH (fails at workflow step)  |
| Data model: Entity needs parent Z       | Tests creating entity without Z | ❌ CRITICAL (DB constraint error) |

**Step 3: Predict Error Messages**

Helps identify tests that will break:

- "Element not found" → Page structure change
- "Validation error: X is required" → Workflow prerequisite missing
- "Foreign key constraint violation" → Data association missing

**Step 4: Estimate Migration Effort**

| Migration Type                              | Lines Changed          | Effort |
| ------------------------------------------- | ---------------------- | ------ |
| Add prerequisite in `beforeEach`            | 3-5 lines              | Low    |
| Update method calls (add context param)     | 1 line per call        | Low    |
| Refactor test structure (split into phases) | 20-50 lines            | Medium |
| Create new page object methods              | 10-30 lines per method | High   |

---

## 3. Page Object Migration Patterns

### Pattern 1: Add Context Parameter to Methods

**Concept:** Methods that operated globally now need context parameter

**Generic Migration:**

```typescript
// Before: Global operation
class PageObject {
  async performAction(item: string) {
    await this.page.click(`[data-item="${item}"]`);
  }
}

// After: Context-scoped operation
class PageObject {
  async performActionInContext(context: string, item: string) {
    // First ensure context is active
    await this.page.click(`[data-context="${context}"]`);
    // Then perform action within context
    await this.page.click(`[data-context="${context}"] [data-item="${item}"]`);
  }
}
```

**Pattern:** Old method → New method with context parameter, scoped selectors

---

### Pattern 2: Add Context Setup Methods

**Concept:** New methods for establishing context before actions

**Generic Pattern:**

```typescript
class PageObject {
  // NEW: Context lifecycle methods
  async createContext(name: string, options?: object) {
    await this.page.click('[data-testid="btn-create-context"]');
    await this.page.fill('[data-testid="input-context-name"]', name);
    if (options) {
      // Fill optional fields
    }
    await this.page.click('[data-testid="btn-submit"]');
    await this.expectContextVisible(name);
  }

  async expandContext(name: string) {
    await this.page.click(`[data-testid="context-${name}"] [data-testid="btn-expand"]`);
    await this.page.waitForSelector(`[data-testid="context-${name}"][data-expanded="true"]`);
  }

  async expectContextVisible(name: string) {
    await expect(this.page.locator(`[data-context-name="${name}"]`)).toBeVisible();
  }
}
```

**Pattern:** Add lifecycle methods: `create`, `expand`, `collapse`, `expect` variants

---

### Pattern 3: Split Assertions (Global → Context-Scoped)

**Concept:** Assertions that checked page-level state now check context-scoped state

**Generic Migration:**

```typescript
// Before: Page-level assertion
class PageObject {
  async expectEmptyState() {
    await expect(this.page.locator('[data-testid="empty-state"]')).toBeVisible();
  }
}

// After: Context-scoped assertion
class PageObject {
  async expectEmptyStateInContext(contextName: string) {
    const context = this.page.locator(`[data-context="${contextName}"]`);
    await expect(context.locator('[data-testid="empty-state"]')).toBeVisible();
  }
}
```

**Pattern:** Scope locators to context container, keep assertion logic same

---

## 4. Test Migration Strategies

### Strategy 1: Proactive Migration (Recommended)

**Approach:** Migrate all affected tests immediately when breaking change introduced

**Steps:**

1. Implement breaking change (page structure, workflow, data model)
2. **STOP** - do not continue to next phase
3. Update page objects (add new methods, update existing)
4. Migrate all affected tests (update `beforeEach`, method calls)
5. Verify all tests passing
6. **THEN** continue to next phase

**Benefit:** Tests remain green throughout, no accumulated technical debt

---

### Strategy 2: Test-First Migration (Ideal)

**Approach:** Update tests before implementing breaking change

**Steps:**

1. Identify breaking change to be implemented
2. Update page objects (add stub methods with TODOs)
3. Update tests to use new methods (tests will fail - expected)
4. Implement breaking change (feature code)
5. Implement page object methods (replace stubs)
6. Verify tests pass

**Benefit:** Tests guide implementation, TDD for breaking changes

---

### Strategy 3: Reactive Migration (Discouraged)

**Approach:** Continue implementing, fix tests later

**Steps:**

1. Implement breaking changes (all phases)
2. Tests break (accumulate failures)
3. Fix all tests at end

**Drawback:** Compound complexity, harder debugging, loss of test safety net

---

## 5. Implementation Order Patterns

### Pattern: Identify Test Blockers

**Concept:** Some breaking changes **block** further implementation if tests not fixed

**Detection:**

```
Phase X introduces breaking change Y
Tests T1, T2, T3 depend on behavior Y
Phase X+1 builds on Phase X

If tests T1, T2, T3 not fixed:
→ Cannot verify Phase X works
→ Cannot safely proceed to Phase X+1
→ BLOCKER
```

**Resolution:**

```
Phase X implementation complete
↓
STOP
↓
Fix tests T1, T2, T3
↓
Verify Phase X tests pass
↓
Proceed to Phase X+1
```

**Pattern:** Breaking changes in prerequisite phases = test migration blockers

---

### Pattern: Parallel vs Sequential Migration

**Parallel Migration:**

- Multiple independent tests affected
- Can update in any order
- No dependencies between test fixes
- Example: 5 upload tests all need same pattern (add KB context)

**Sequential Migration:**

- Tests build on each other
- Must fix in dependency order
- Example: Unit tests → Integration tests → E2E tests

**Strategy:** Identify dependencies, create migration sequence, execute in order

---

## 6. Common Test Migration Pitfalls

### Pitfall 1: Forgetting Prerequisite in Setup

**Symptom:** Test fails with "Element not found"

**Root Cause:** Missing context setup in `beforeEach`

**Generic Fix:**

```typescript
// Add missing prerequisite
test.beforeEach(async () => {
  await page.setup();
  await page.createPrerequisite(); // ← MISSING
  await page.establishContext(); // ← MISSING
});
```

---

### Pitfall 2: Using Old Method Instead of New

**Symptom:** Test fails with "Element not found" or wrong element accessed

**Root Cause:** Old method doesn't account for context

**Generic Fix:**

```typescript
// Replace old method with context-aware version
-(await page.performAction(item));
+(await page.performActionInContext(contextName, item));
```

---

### Pitfall 3: Accessing Elements Without Context

**Symptom:** Elements visible but test can't interact with them

**Root Cause:** Elements exist within collapsed/hidden context

**Generic Fix:**

```typescript
// Expand context before accessing elements
await page.expandContext(contextName); // ← MISSING
await page.performAction(item);
```

---

### Pitfall 4: Using Timing Instead of State Checks

**Symptom:** Flaky tests (sometimes pass, sometimes fail)

**Root Cause:** Using arbitrary timeouts instead of waiting for state

**Generic Fix:**

```typescript
// Replace timing with state checks
-(await page.waitForTimeout(5000));
+(await page.expectElementReady(item));
```

---

## 7. Test Migration Checklist Template

Use for any breaking feature implementation:

### Pre-Implementation

- [ ] Identify all breaking changes (page structure, workflow, data model)
- [ ] Create test impact matrix (which tests affected, when, why)
- [ ] Estimate migration effort per test
- [ ] Identify blocker phases (tests must be fixed before continuing)

### During Implementation

- [ ] Stop at first breaking change phase
- [ ] Update page objects (add new methods)
- [ ] Migrate affected tests (update all method calls)
- [ ] Verify tests pass before continuing

### Post-Implementation

- [ ] All tests passing (unit + integration + E2E)
- [ ] No arbitrary timeouts remaining
- [ ] Page objects documented
- [ ] Test patterns consistent across test suite

---

## 8. Generic Migration Patterns Summary

### Pattern: Flat → Hierarchical

**When:** Reorganizing flat list into grouped/nested structure

**Test Changes:**

- Add container creation in `beforeEach`
- Add container expansion in `beforeEach` or test start
- Add context parameter to all methods
- Scope assertions to container context

**Example Use Cases:**

- Documents → Knowledge Bases (this implementation)
- Tasks → Projects
- Contacts → Groups
- Files → Folders

---

### Pattern: Optional → Required

**When:** Making previously optional field/relationship required

**Test Changes:**

- Add parent/prerequisite creation in `beforeEach`
- Update entity creation to include required field
- Update assertions to verify association exists

**Example Use Cases:**

- Document + optional KB → Document requires KB
- User + optional organization → User requires organization
- Item + optional category → Item requires category

---

### Pattern: Page-Level → Scoped

**When:** Moving page-level UI element into context-specific location

**Test Changes:**

- Change selectors from page-level to context-scoped
- Add context parameter to methods accessing element
- Update assertions to check within context

**Example Use Cases:**

- Page-level upload → Container-scoped upload
- Page-level search → Container-scoped search
- Global toolbar → Context toolbar

---

## 9. Success Criteria for Test Migration

### Criteria 1: Predictability

- [ ] All test failures predicted in test impact matrix
- [ ] No unexpected test breaks
- [ ] Error messages match predictions

### Criteria 2: Completeness

- [ ] All affected tests updated
- [ ] No tests skipped or marked as "TODO"
- [ ] All page objects updated consistently

### Criteria 3: Quality

- [ ] No arbitrary timeouts (replaced with state checks)
- [ ] Tests deterministic (no flakiness)
- [ ] Assertion messages clear and specific

### Criteria 4: Maintainability

- [ ] Page object patterns consistent
- [ ] Test setup patterns consistent
- [ ] Migration documented in commits

---

## 10. Lessons for Future Implementations

### Lesson 1: Test Migration is 10-20% of Implementation Effort

**Not:**

- 3 lines in spec mentioning "update tests"
- Ad-hoc fixes after implementation complete

**Instead:**

- Dedicated test migration section in spec
- Test impact analysis upfront
- Migration patterns documented
- Implementation blockers identified

---

### Lesson 2: Breaking Changes Require Test Migration Strategy

**Components:**

1. Test impact matrix (which tests, when, why)
2. Page object migration patterns (old → new)
3. Before/after examples (concrete code)
4. Implementation constraints (blockers)
5. Verification checklist (done when...)

---

### Lesson 3: Proactive > Reactive

**Proactive:** Fix tests immediately when breaking change introduced
**Reactive:** Continue implementing, fix tests later

**Result:** Proactive saves time, maintains safety net, prevents compound bugs

---

## 11. Application to Future Features

Use these patterns when implementing:

- **Any hierarchical organization:** Lists → Groups/Categories/Folders
- **Any required relationship:** Optional FK → Required FK
- **Any workflow restructuring:** Direct action → Multi-step workflow
- **Any page structure change:** Flat → Nested, Single view → Multi-view
- **Any scope narrowing:** Global → Context-specific, Page-level → Component-level

**Key:** If feature changes how users **navigate** or **access** existing functionality, tests need migration.

---

## Summary

**Core Concept:** Breaking features require breaking tests → Plan test migration upfront

**Key Patterns:**

1. Flat → Hierarchical (add container context)
2. Optional → Required (add prerequisites)
3. Page-Level → Scoped (add context parameters)

**Strategy:** Proactive migration at each breaking change phase

**Success:** All tests predicted, all tests migrated, all tests passing

**Use This Spec:** As template for future breaking features, focusing on **patterns** not implementation details.

---

**See Also:**

- `phase-knowledge-base-specs.md` - Feature specification (implementation details)
- `kb-retrospective.md` - Lessons learned from actual implementation
