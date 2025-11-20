import { renderHook } from '@testing-library/react'
import { useVectorDB } from './VectorDBContext'
import { describe, it, expect } from 'vitest'

describe('VectorDBContext', () => {
  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useVectorDB())
    }).toThrow('useVectorDB must be used within a VectorDBProvider')
  })

  // Note: These tests are skipped because VectorDBContext depends on Worker
  // which is not supported in jsdom. Worker functionality tested via E2E tests
  it.skip('provides expected context values', () => {
    // Tested in E2E tests
  })

  it.skip('initializes with empty documents array', () => {
    // Tested in E2E tests
  })

  it.skip('initialized state starts as false', () => {
    // Tested in E2E tests
  })
})
