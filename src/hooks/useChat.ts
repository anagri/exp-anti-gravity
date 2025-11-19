import { useState } from 'react';
import OpenAI from 'openai';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useChat(apiKey: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    if (!apiKey) {
      setError('API Key is missing');
      return;
    }

    const newMessage: Message = { role: 'user', content };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // Required for client-side only usage
      });

      const completion = await openai.chat.completions.create({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        model: 'gpt-3.5-turbo',
      });

      const assistantMessage = completion.choices[0].message;
      if (assistantMessage) {
        setMessages(prev => [...prev, { role: assistantMessage.role, content: assistantMessage.content || '' } as Message]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to send message. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };
}
