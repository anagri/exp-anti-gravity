import { useState, useEffect } from 'react';
import OpenAI from 'openai';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useChat(apiKey: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('openai_selected_model') || 'gpt-3.5-turbo';
  });

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('openai_selected_model', selectedModel);
    }
  }, [selectedModel]);

  const fetchModels = async () => {
    if (!apiKey) return;
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
      });
      const list = await openai.models.list();
      const modelIds = list.data.map(m => m.id).filter(id => id.startsWith('gpt')); // Filter for GPT models
      setModels(modelIds);
    } catch (err) {
      console.error('Failed to fetch models', err);
    }
  };

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
        dangerouslyAllowBrowser: true,
      });

      const stream = await openai.chat.completions.create({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        model: selectedModel,
        stream: true,
      });

      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        assistantContent += content;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'assistant', content: assistantContent };
          return newMsgs;
        });
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
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };
}
