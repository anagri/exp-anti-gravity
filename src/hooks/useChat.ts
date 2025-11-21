import { useState } from 'react';
import OpenAI from 'openai';
import type { SearchResult } from '@/contexts/VectorDBContext';
import { getOpenAIConfig } from '@/lib/feature-flags';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResult[];
}

interface UseChatParams {
  apiKey: string | null;
  attachedDocumentIds?: string[];
  searchVectors?: (query: string, documentIds: string[]) => Promise<SearchResult[]>;
  searchHybrid?: (query: string, documentIds: string[]) => Promise<SearchResult[]>;
}

export function useChat(params: UseChatParams | string | null) {
  // Support both old API (string) and new API (object) for backwards compatibility
  const apiKey = typeof params === 'string' || params === null ? params : params.apiKey;
  const attachedDocumentIds = typeof params === 'object' && params !== null ? params.attachedDocumentIds || [] : [];
  const searchVectors = typeof params === 'object' && params !== null ? params.searchVectors : undefined;
  const searchHybrid = typeof params === 'object' && params !== null ? params.searchHybrid : undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get chat model from config
  const chatModel = getOpenAIConfig('CHAT_MODEL');

  // Format search results into context for LLM (Phase rag-integration)
  const formatContext = (results: SearchResult[]): string => {
    if (results.length === 0) {
      return 'No relevant context found in attached documents.';
    }

    return results
      .map((result, index) => {
        const sourceNumber = index + 1;
        const heading = result.heading ? ` - ${result.heading}` : '';

        return `[Source ${sourceNumber}] ${result.filename}${heading}
${result.content}
`;
      })
      .join('\n\n');
  };

  const sendMessage = async (content: string) => {
    if (!apiKey) {
      setError('API Key is missing');
      return;
    }

    const newMessage: Message = { role: 'user', content };
    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const baseURL = getOpenAIConfig('BASE_URL');
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL || undefined,
        dangerouslyAllowBrowser: true,
      });

      let messagesToSend: Message[] = [...messages, newMessage];
      let currentMessageSources: SearchResult[] | undefined = undefined;

      // RAG flow: Check if documents are attached (Phase rag-integration)
      if (attachedDocumentIds.length > 0 && (searchHybrid || searchVectors)) {
        setIsSearching(true);

        // Prefer hybrid search if available, fallback to vector search
        const searchFunction = searchHybrid || searchVectors!;
        const searchResults = await searchFunction(content, attachedDocumentIds);
        currentMessageSources = searchResults;
        setIsSearching(false);

        if (import.meta.env.DEV) {
          console.log('[useChat] Search results:', searchResults.length, 'chunks found');
        }

        // Format context from search results
        const context = formatContext(searchResults);

        // Inject context into system message
        const systemMessage: Message = {
          role: 'system',
          content: `You are a helpful assistant. Answer the user's question using ONLY the provided context below.

IMPORTANT INSTRUCTIONS:
- Use ONLY information from the CONTEXT section below
- If the context doesn't contain enough information to answer fully, say: "Based on the provided documents, I can only partially answer: [partial answer]. The documents don't contain information about [missing info]."
- Cite your sources using [1], [2], [3] format when referencing specific context
- Do not make up information not present in the context
- If the question is completely unrelated to the context, say: "I cannot answer this question based on the provided documents."

CONTEXT:
${context}

Now answer the user's question using the context above. Remember to cite sources with [1], [2], etc.`,
        };

        // Prepend system message to conversation
        messagesToSend = [systemMessage, ...messages, newMessage];
      }

      const stream = await openai.chat.completions.create({
        messages: messagesToSend.map(m => ({ role: m.role, content: m.content })),
        model: chatModel,
        stream: true,
      });

      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '', sources: currentMessageSources }]);

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        assistantContent += content;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'assistant', content: assistantContent, sources: currentMessageSources };
          return newMsgs;
        });
      }
    } catch (err) {
      console.error(err);
      setError('Failed to send message. Please check your API key.');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  // Get sources from the last assistant message for backward compatibility
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const sources = lastAssistantMessage?.sources || [];

  return {
    messages,
    isLoading,
    isSearching,
    error,
    sendMessage,
    clearChat,
    sources,
  };
}
