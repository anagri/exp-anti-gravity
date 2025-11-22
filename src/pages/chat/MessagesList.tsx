import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { SourceCitations } from './SourceCitations';

interface MessagesListProps {
  messages: Message[];
}

export default function MessagesList({ messages }: MessagesListProps) {
  return (
    <>
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          <div
            data-testid={msg.role === 'user' ? 'div-chat-user-msg' : 'div-chat-assistant-msg'}
            className={cn(
              'flex max-w-[80%] rounded-lg p-3 text-sm',
              msg.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-100 text-gray-900'
            )}
          >
            {msg.role !== 'user' && <Bot className="w-4 h-4 mr-2 mt-0.5 shrink-0" />}
            <div className="flex-1">
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 ? (
                <SourceCitations content={msg.content} sources={msg.sources} />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              {msg.role === 'assistant' && msg.metadata && (
                <div data-test-metadata className="hidden" aria-hidden="true">
                  {JSON.stringify(msg.metadata)}
                </div>
              )}
              {msg.role === 'assistant' && msg.prompt && (
                <pre data-test-prompt className="hidden" aria-hidden="true">
                  {msg.prompt}
                </pre>
              )}
            </div>
            {msg.role === 'user' && <User className="w-4 h-4 ml-2 mt-0.5 shrink-0" />}
          </div>
        </div>
      ))}
    </>
  );
}
