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

export const FEATURES = {
  INDEXING_ENABLED: 'FEATURE_INDEXING_ENABLED'
} as const

export function getAllFeatureFlags(): Record<string, boolean> {
  return {
    FEATURE_INDEXING_ENABLED: isFeatureEnabled(FEATURES.INDEXING_ENABLED)
  }
}
