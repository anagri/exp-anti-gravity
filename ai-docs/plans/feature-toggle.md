# Feature Toggle System: Implementation Specifications

**Status:** ✅ COMPLETE - Prerequisite for indexing pipeline
**Dependencies:** None
**Goal:** Runtime user-controlled feature toggles with localStorage persistence

---

## Overview

Runtime feature toggle system that allows users to enable/disable features through an interactive Settings UI. Toggles persist across page reloads using localStorage.

**Key Characteristics:**
- **Runtime:** Changes take effect immediately or after reload (no rebuild needed)
- **User-Controlled:** Managed via Settings modal UI
- **Persistent:** Stored in browser localStorage
- **Worker-Integrated:** Main thread communicates toggle state to Web Workers

---

## Architecture

### Storage Layer

**localStorage Schema:**
```
Key: "feature-flag-FEATURE_INDEXING_ENABLED"
Value: "true" | "false"
```

**Default Behavior:**
- If key not in localStorage → Enabled (true)
- If key = "false" → Disabled
- Any other value → Enabled

### Communication Pattern

```
┌─────────────────┐         ┌──────────────────┐
│   localStorage  │────────▶│  Main Thread     │
│                 │         │  (React App)     │
└─────────────────┘         └──────────────────┘
                                      │
                                      │ Comlink RPC
                                      ▼
                            ┌──────────────────┐
                            │   Web Worker     │
                            │  (PGlite/Vector) │
                            └──────────────────┘
```

**Flow:**
1. User toggles feature in Settings modal
2. UI calls `setFeatureFlag(flag, enabled)`
3. Value written to localStorage
4. Custom event `featureFlagChanged` dispatched
5. VectorDBContext listens to event
6. Context calls `worker.setIndexingEnabled(enabled)`
7. Worker updates internal flag state

---

## Implementation

### 1. Feature Flag Utility

**File:** `src/lib/feature-flags.ts`

```typescript
const STORAGE_PREFIX = 'feature-flag-'

export function isFeatureEnabled(flag: string): boolean {
  const key = `${STORAGE_PREFIX}${flag}`
  const value = localStorage.getItem(key)
  // Default to true (enabled) if not set
  return value !== 'false'
}

export function setFeatureFlag(flag: string, enabled: boolean): void {
  const key = `${STORAGE_PREFIX}${flag}`
  localStorage.setItem(key, enabled.toString())

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('featureFlagChanged', {
    detail: { flag, enabled }
  }))
}

export function getAllFeatureFlags(): Record<string, boolean> {
  return {
    FEATURE_INDEXING_ENABLED: isFeatureEnabled('FEATURE_INDEXING_ENABLED')
  }
}

export const FEATURES = {
  INDEXING_ENABLED: 'FEATURE_INDEXING_ENABLED'
} as const
```

### 2. Interactive Settings Modal

**File:** `src/pages/documents/components/SettingsModal.tsx`

**Features:**
- Toggle switch for each feature flag
- Real-time state update
- "Changes require page reload" warning
- "Reload Now" button

**UI Layout:**
```
┌──────────────────────────────────────────┐
│ Settings                            [X]  │
├──────────────────────────────────────────┤
│ Feature Flags                            │
│ ┌────────────────────────────────────┐   │
│ │ Feature Flag           │ Enabled   │   │
│ ├────────────────────────┼───────────┤   │
│ │ FEATURE_INDEXING_...   │ [●    ]   │   │ ← Toggle
│ └────────────────────────────────────┘   │
│                                          │
│ ⚠ Changes require page reload           │ ← Warning (if changed)
│                             [Reload Now] │ ← Reload button
│                                [Close]   │
└──────────────────────────────────────────┘
```

**Data Attributes:**
- `data-testid="toggle-{flagName}"` - Toggle switch
- `data-testid="reload-warning"` - Warning message
- `data-testid="btn-reload-now"` - Reload button

### 3. Worker Integration

**VectorDBContext (`src/contexts/VectorDBContext.tsx`):**
```typescript
useEffect(() => {
  // Send initial flag state to worker
  const enabled = isFeatureEnabled(FEATURES.INDEXING_ENABLED)
  worker.setIndexingEnabled(enabled)

  // Listen for flag changes
  const handleFlagChange = (event: CustomEvent) => {
    if (event.detail.flag === 'FEATURE_INDEXING_ENABLED') {
      worker.setIndexingEnabled(event.detail.enabled)
    }
  }

  window.addEventListener('featureFlagChanged', handleFlagChange as EventListener)
  return () => window.removeEventListener('featureFlagChanged', handleFlagChange as EventListener)
}, [worker])
```

**Worker (`src/workers/pglite.worker.ts`):**
```typescript
let indexingEnabled = true // default

function setIndexingEnabled(enabled: boolean): void {
  indexingEnabled = enabled
}

// In uploadDocument():
async function uploadDocument(params: UploadDocumentParams): Promise<{ id: string }> {
  const id = uuidv4()

  await db.query(
    `INSERT INTO documents (id, filename, content, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, params.filename, params.content, fileSize, params.mimeType]
  )

  // ONLY create indexing job if feature enabled
  if (indexingEnabled) {
    await db.query(
      `INSERT INTO indexing_queue (id, document_id, status)
       VALUES ($1, $2, 'pending')`,
      [uuidv4(), id]
    )
  }

  return { id }
}

// Expose via Comlink:
Comlink.expose({
  // ... existing methods
  setIndexingEnabled,
})
```

---

## Testing Strategy

### Test Isolation via localStorage

**Problem:** Tests need to control feature toggle state

**Solution:** Use Playwright's `page.addInitScript()` to set localStorage BEFORE app loads

**Pattern:**
```typescript
test.beforeEach(async ({ page }) => {
  // Disable indexing for existing tests
  await page.addInitScript(() => {
    localStorage.setItem('feature-flag-FEATURE_INDEXING_ENABLED', 'false')
  })

  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()
})
```

### E2E Test Files

```
e2e/documents/
├── 00-01-feature-flags-enabled.spec.ts    ✅ Verify enabled state (default)
├── 00-02-feature-flags-disabled.spec.ts   ✅ Verify disabled state (set via addInitScript)
├── 00-03-feature-toggle-interaction.spec.ts ✅ Toggle → Reload → Persist
├── 01-document-lifecycle.spec.ts          ✅ Disable indexing in beforeEach
├── 02-multi-document-operations.spec.ts   ✅ Disable indexing in beforeEach
├── 03-file-validation.spec.ts             ✅ Disable indexing in beforeEach
└── 04-persistence.spec.ts                 ✅ Disable indexing in beforeEach
```

### Test 00-03: Toggle Interaction

```typescript
test('user can toggle feature flag and verify persistence', async ({ page }) => {
  documentsPage = new DocumentPage(page)
  await documentsPage.clearDatabase()
  await documentsPage.setup()

  // Initially enabled (default)
  await documentsPage.openSettings()
  let enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED')
  expect(enabled).toBe(true)

  // Toggle to disabled
  await documentsPage.toggleFeatureFlag('FEATURE_INDEXING_ENABLED')
  await documentsPage.expectReloadWarning()

  // Reload page
  await documentsPage.reloadToApplyChanges()

  // Verify persisted as disabled
  await documentsPage.openSettings()
  enabled = await documentsPage.getFeatureFlagValue('FEATURE_INDEXING_ENABLED')
  expect(enabled).toBe(false)

  await documentsPage.closeSettings()
})
```

---

## Page Object Model Extensions

**File:** `e2e/pages/DocumentPage.ts`

**New Methods:**
```typescript
async toggleFeatureFlag(flagName: string) {
  await this.page.click(`[data-testid="toggle-${flagName}"]`)
}

async expectReloadWarning() {
  await this.page.waitForSelector('[data-testid="reload-warning"]', { state: 'visible' })
}

async reloadToApplyChanges() {
  await this.page.click('[data-testid="btn-reload-now"]')
  await this.waitForDBInitialized()
}
```

---

## Acceptance Criteria

### UI & Functionality
✅ Settings modal displays feature toggles as interactive switches
✅ User can toggle features on/off
✅ Changes persist across page reload (localStorage)
✅ Warning message shows when changes pending
✅ Reload button applies changes immediately

### Worker Integration
✅ Main thread communicates toggle state to worker on init
✅ Worker respects toggle state in conditional logic
✅ Real-time updates when toggle changed (via custom event)

### Testing
✅ Test 00-01: Enabled state (default) ✅
✅ Test 00-02: Disabled state (addInitScript) ✅
✅ Test 00-03: Toggle interaction & persistence ✅
✅ Tests 01-04: Disable indexing via addInitScript ✅

### Quality
✅ No env files needed
✅ Build-time independent (runtime only)
✅ TypeScript compilation passing
✅ All 7 tests passing (3 feature + 4 existing)
✅ Settings UI fully interactive

---

## Future Enhancements

- **Multi-Feature Support:** Easy to add more toggles to `FEATURES` constant
- **Reset to Defaults:** Button to clear all localStorage flags
- **Export/Import:** Save/load toggle configurations
- **Per-Document Toggles:** Future: enable/disable per document vs global
- **Remote Config:** Future: sync toggles across devices (requires backend)

---

## Related Specs

- **`phase-indexing-pipeline-specs.md`** - Uses this toggle system in Section 3 for test isolation
