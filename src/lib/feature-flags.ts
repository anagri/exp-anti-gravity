const STORAGE_PREFIX = 'feature-flag-'
const SEARCH_SETTINGS_PREFIX = 'search-setting-'
const OPENAI_CONFIG_PREFIX = 'openai-config-'

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

// Search Settings
export const SEARCH_SETTINGS = {
  VECTOR_TOP_K: 'VECTOR_TOP_K',
  SIMILARITY_THRESHOLD: 'SIMILARITY_THRESHOLD',
  BM25_LIMIT: 'BM25_LIMIT',
  HNSW_M: 'HNSW_M',
  HNSW_EF_CONSTRUCTION: 'HNSW_EF_CONSTRUCTION'
} as const

export interface SearchSettings {
  VECTOR_TOP_K: number
  SIMILARITY_THRESHOLD: number
  BM25_LIMIT: number
  HNSW_M: number
  HNSW_EF_CONSTRUCTION: number
}

const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  VECTOR_TOP_K: 3,
  SIMILARITY_THRESHOLD: 0.3,
  BM25_LIMIT: 10,
  HNSW_M: 16,
  HNSW_EF_CONSTRUCTION: 64
}

/**
 * Get a search setting value with type safety
 * Returns default if not set
 */
export function getSearchSetting<T extends keyof SearchSettings>(
  key: T
): SearchSettings[T] {
  const storageKey = `${SEARCH_SETTINGS_PREFIX}${key}`
  const value = localStorage.getItem(storageKey)

  if (value === null) {
    return DEFAULT_SEARCH_SETTINGS[key]
  }

  return Number(value) as SearchSettings[T]
}

/**
 * Set a search setting value
 * Dispatches searchSettingChanged event for listeners
 */
export function setSearchSetting<T extends keyof SearchSettings>(
  key: T,
  value: number
): void {
  const storageKey = `${SEARCH_SETTINGS_PREFIX}${key}`
  localStorage.setItem(storageKey, value.toString())

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('searchSettingChanged', {
    detail: { setting: key, value }
  }))
}

/**
 * Get all search settings with current or default values
 */
export function getAllSearchSettings(): SearchSettings {
  return {
    VECTOR_TOP_K: getSearchSetting('VECTOR_TOP_K'),
    SIMILARITY_THRESHOLD: getSearchSetting('SIMILARITY_THRESHOLD'),
    BM25_LIMIT: getSearchSetting('BM25_LIMIT'),
    HNSW_M: getSearchSetting('HNSW_M'),
    HNSW_EF_CONSTRUCTION: getSearchSetting('HNSW_EF_CONSTRUCTION')
  }
}

// OpenAI Configuration
export const OPENAI_CONFIG = {
  BASE_URL: 'BASE_URL',
  CHAT_MODEL: 'CHAT_MODEL',
  EMBEDDING_MODEL: 'EMBEDDING_MODEL'
} as const

export interface OpenAIConfig {
  BASE_URL?: string
  CHAT_MODEL: string
  EMBEDDING_MODEL: string
}

const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  BASE_URL: undefined,
  CHAT_MODEL: 'gpt-3.5-turbo',
  EMBEDDING_MODEL: 'text-embedding-3-small'
}

/**
 * Get an OpenAI config value with type safety
 * Returns default if not set
 */
export function getOpenAIConfig<T extends keyof OpenAIConfig>(
  key: T
): OpenAIConfig[T] {
  const storageKey = `${OPENAI_CONFIG_PREFIX}${key}`
  const value = localStorage.getItem(storageKey)

  if (value === null || value === '') {
    return DEFAULT_OPENAI_CONFIG[key]
  }

  return value as OpenAIConfig[T]
}

/**
 * Set an OpenAI config value
 * Dispatches openaiConfigChanged event for listeners
 */
export function setOpenAIConfig<T extends keyof OpenAIConfig>(
  key: T,
  value: string | undefined
): void {
  const storageKey = `${OPENAI_CONFIG_PREFIX}${key}`

  if (value === undefined || value === '') {
    localStorage.removeItem(storageKey)
  } else {
    localStorage.setItem(storageKey, value)
  }

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('openaiConfigChanged', {
    detail: { config: key, value }
  }))
}

/**
 * Get all OpenAI config with current or default values
 */
export function getAllOpenAIConfig(): OpenAIConfig {
  return {
    BASE_URL: getOpenAIConfig('BASE_URL'),
    CHAT_MODEL: getOpenAIConfig('CHAT_MODEL'),
    EMBEDDING_MODEL: getOpenAIConfig('EMBEDDING_MODEL')
  }
}
