import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useChat', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat('test-key'));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle missing api key', async () => {
    const { result } = renderHook(() => useChat(null));
    await act(async () => {
      await result.current.sendMessage('hello');
    });
    expect(result.current.error).toBe('API Key is missing');
  });

  it('should fetch models', async () => {
    const { result } = renderHook(() => useChat('test-key'));

    await act(async () => {
      await result.current.fetchModels();
    });

    expect(result.current.models).toEqual(['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']);
  });

  it('should persist selected model', () => {
    const { result } = renderHook(() => useChat('test-key'));

    act(() => {
      result.current.setSelectedModel('gpt-4');
    });

    expect(localStorage.getItem('openai_selected_model')).toBe('gpt-4');
  });

  it('should initialize selected model from localStorage', () => {
    localStorage.setItem('openai_selected_model', 'gpt-4');
    const { result } = renderHook(() => useChat('test-key'));
    expect(result.current.selectedModel).toBe('gpt-4');
  });

  it('should send message and receive streaming response', async () => {
    const { result } = renderHook(() => useChat('test-key'));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toContain('gpt-3.5-turbo');
  });

});

