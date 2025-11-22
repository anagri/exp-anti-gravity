import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSearchSetting,
  setSearchSetting,
  getAllSearchSettings,
  SEARCH_SETTINGS,
} from './feature-flags'

describe('Search Settings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('getSearchSetting', () => {
    it('returns default value when setting not set', () => {
      expect(getSearchSetting('VECTOR_TOP_K')).toBe(3)
      expect(getSearchSetting('SIMILARITY_THRESHOLD')).toBe(0.3)
      expect(getSearchSetting('BM25_LIMIT')).toBe(10)
    })

    it('returns stored value when setting exists', () => {
      localStorage.setItem('search-setting-VECTOR_TOP_K', '5')
      localStorage.setItem('search-setting-SIMILARITY_THRESHOLD', '0.7')

      expect(getSearchSetting('VECTOR_TOP_K')).toBe(5)
      expect(getSearchSetting('SIMILARITY_THRESHOLD')).toBe(0.7)
    })

    it('handles numeric values correctly', () => {
      localStorage.setItem('search-setting-BM25_LIMIT', '25')
      expect(getSearchSetting('BM25_LIMIT')).toBe(25)
      expect(typeof getSearchSetting('BM25_LIMIT')).toBe('number')
    })
  })

  describe('setSearchSetting', () => {
    it('stores setting value in localStorage', () => {
      setSearchSetting('VECTOR_TOP_K', 10)

      expect(localStorage.getItem('search-setting-VECTOR_TOP_K')).toBe('10')
    })

    it('dispatches searchSettingChanged event', () => {
      const eventListener = vi.fn()
      window.addEventListener('searchSettingChanged', eventListener)

      setSearchSetting('SIMILARITY_THRESHOLD', 0.5)

      expect(eventListener).toHaveBeenCalledTimes(1)
      const event = eventListener.mock.calls[0][0] as CustomEvent
      expect(event.detail).toEqual({
        setting: 'SIMILARITY_THRESHOLD',
        value: 0.5,
      })

      window.removeEventListener('searchSettingChanged', eventListener)
    })

    it('handles decimal values', () => {
      setSearchSetting('SIMILARITY_THRESHOLD', 0.85)
      expect(localStorage.getItem('search-setting-SIMILARITY_THRESHOLD')).toBe('0.85')
    })
  })

  describe('getAllSearchSettings', () => {
    it('returns all default values when nothing is set', () => {
      const settings = getAllSearchSettings()

      expect(settings).toEqual({
        VECTOR_TOP_K: 3,
        SIMILARITY_THRESHOLD: 0.3,
        BM25_LIMIT: 10,
        RRF_K: 0.6,
      })
    })

    it('returns mix of default and stored values', () => {
      localStorage.setItem('search-setting-VECTOR_TOP_K', '7')
      localStorage.setItem('search-setting-BM25_LIMIT', '20')

      const settings = getAllSearchSettings()

      expect(settings).toEqual({
        VECTOR_TOP_K: 7,
        SIMILARITY_THRESHOLD: 0.3,
        BM25_LIMIT: 20,
        RRF_K: 0.6,
      })
    })

    it('returns all stored values when all are set', () => {
      setSearchSetting('VECTOR_TOP_K', 5)
      setSearchSetting('SIMILARITY_THRESHOLD', 0.8)
      setSearchSetting('BM25_LIMIT', 15)
      setSearchSetting('RRF_K', 1.2)

      const settings = getAllSearchSettings()

      expect(settings).toEqual({
        VECTOR_TOP_K: 5,
        SIMILARITY_THRESHOLD: 0.8,
        BM25_LIMIT: 15,
        RRF_K: 1.2,
      })
    })
  })

  describe('SEARCH_SETTINGS constant', () => {
    it('exports all setting keys', () => {
      expect(SEARCH_SETTINGS.VECTOR_TOP_K).toBe('VECTOR_TOP_K')
      expect(SEARCH_SETTINGS.SIMILARITY_THRESHOLD).toBe('SIMILARITY_THRESHOLD')
      expect(SEARCH_SETTINGS.BM25_LIMIT).toBe('BM25_LIMIT')
    })
  })
})
