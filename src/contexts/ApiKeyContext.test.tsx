import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyProvider, useApiKey } from './ApiKeyContext';

describe('ApiKeyContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should provide default value from localStorage', () => {
    localStorage.setItem('openai_api_key', 'test-key');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiKeyProvider>{children}</ApiKeyProvider>
    );
    const { result } = renderHook(() => useApiKey(), { wrapper });
    expect(result.current.apiKey).toBe('test-key');
  });

  it('should update apiKey and localStorage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiKeyProvider>{children}</ApiKeyProvider>
    );
    const { result } = renderHook(() => useApiKey(), { wrapper });

    act(() => {
      result.current.setApiKey('new-key');
    });

    expect(result.current.apiKey).toBe('new-key');
    expect(localStorage.getItem('openai_api_key')).toBe('new-key');
  });

  it('should clear apiKey and localStorage', () => {
    localStorage.setItem('openai_api_key', 'test-key');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiKeyProvider>{children}</ApiKeyProvider>
    );
    const { result } = renderHook(() => useApiKey(), { wrapper });

    act(() => {
      result.current.clearApiKey();
    });

    expect(result.current.apiKey).toBeNull();
    expect(localStorage.getItem('openai_api_key')).toBeNull();
  });
});
