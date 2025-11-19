import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should send message and receive response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { role: 'assistant', content: 'Hi there!' },
        },
      ],
    });

    const { result } = renderHook(() => useChat('test-key'));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result.current.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should handle API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    const { result } = renderHook(() => useChat('test-key'));

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(result.current.error).toContain('Failed to send message');
    expect(result.current.isLoading).toBe(false);
  });
});
