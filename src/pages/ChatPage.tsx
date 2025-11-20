import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useVectorDB } from '../contexts/VectorDBContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
// import { ScrollArea } from '../components/ui/scroll-area';
import { Card } from '../components/ui/card';
import { Send, LogOut, Bot, User, FileText, Paperclip } from 'lucide-react';
import { cn } from '../lib/utils';

import { ModelSelector } from '../components/ModelSelector';
import FileSelector from '../components/FileSelector';
import AttachmentBadges from '../components/AttachmentBadges';

export default function ChatPage() {
  const navigate = useNavigate();
  const { apiKey, clearApiKey } = useApiKey();
  const { documents } = useVectorDB();
  const { messages, isLoading, error, sendMessage, clearChat, models, selectedModel, setSelectedModel, fetchModels } = useChat(apiKey);
  const [inputValue, setInputValue] = useState('');
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [attachedDocumentIds, setAttachedDocumentIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const content = inputValue;
    setInputValue('');
    await sendMessage(content);
  };

  const handleLogout = () => {
    clearApiKey();
    navigate('/');
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            <h1 className="font-semibold text-lg hidden sm:block">AI Chat</h1>
          </div>
          <nav className="flex items-center gap-2 border-l pl-4">
            <Link to="/chat">
              <Button variant="ghost" size="sm" className="font-medium">
                Chat
              </Button>
            </Link>
            <Link to="/documents">
              <Button variant="ghost" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Button>
            </Link>
          </nav>
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button data-testid="btn-chat-clear" variant="outline" size="sm" onClick={clearChat} disabled={messages.length === 0}>
            Clear Chat
          </Button>
          <Button data-testid="btn-chat-logout" variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden p-4 max-w-4xl mx-auto w-full flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden shadow-md bg-white" data-test-state={isLoading ? 'loading' : error ? 'error' : 'ready'}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                <Bot className="w-12 h-12 mb-2" />
                <p>Start a conversation...</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex w-full",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  data-testid={msg.role === 'user' ? 'div-chat-user-msg' : 'div-chat-assistant-msg'}
                  className={cn(
                    "flex max-w-[80%] rounded-lg p-3 text-sm",
                    msg.role === 'user'
                      ? "bg-blue-600 text-white ml-auto"
                      : "bg-gray-100 text-gray-900"
                  )}
                >
                  {msg.role !== 'user' && <Bot className="w-4 h-4 mr-2 mt-0.5 shrink-0" />}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.role === 'user' && <User className="w-4 h-4 ml-2 mt-0.5 shrink-0" />}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start w-full">
                <div data-testid="div-chat-loading" className="bg-gray-100 rounded-lg p-3 text-sm flex items-center">
                  <Bot className="w-4 h-4 mr-2" />
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}

            {error && (
              <div data-testid="div-chat-error" className="text-red-600 text-center text-sm p-2 bg-red-50 rounded-md">
                {error}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t bg-gray-50/50">
            {/* Attachment Badges (Phase ui-attachments) */}
            <AttachmentBadges
              attachedDocuments={attachedDocumentIds.map(id => {
                const doc = documents.find(d => d.id === id);
                return { id, filename: doc?.filename || 'Unknown' };
              })}
              onRemove={(documentId) => {
                setAttachedDocumentIds(prev => prev.filter(id => id !== documentId));
              }}
            />
            <form onSubmit={handleSend} className="flex gap-2">
              <Button
                data-testid="btn-attach-files"
                data-state={isLoading ? 'disabled' : 'enabled'}
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsFileSelectorOpen(true)}
                disabled={isLoading}
                title="Attach indexed documents"
              >
                <Paperclip className="w-4 h-4" />
                <span className="sr-only">Attach indexed documents</span>
              </Button>
              <Input
                data-testid="inp-chat-message"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button data-testid="btn-chat-send" type="submit" disabled={isLoading || !inputValue.trim()}>
                <Send className="w-4 h-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </Card>
      </main>

      {/* File Selector Modal (Phase ui-file-selector) */}
      {isFileSelectorOpen && (
        <FileSelector
          documents={documents}
          selectedDocumentIds={attachedDocumentIds}
          onSelectionChange={(ids) => {
            setAttachedDocumentIds(ids);
          }}
          onClose={() => setIsFileSelectorOpen(false)}
        />
      )}
    </div>
  );
}
