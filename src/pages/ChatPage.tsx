import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
// import { ScrollArea } from '../components/ui/scroll-area';
import { Card } from '../components/ui/card';
import { Send, LogOut, Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';

import { ModelSelector } from '../components/ModelSelector';
import { FileUpload } from '../components/FileUpload';
import { DocumentList } from '../components/DocumentList';

export default function ChatPage() {
  const navigate = useNavigate();
  const { apiKey, clearApiKey } = useApiKey();
  const { messages, isLoading, error, sendMessage, clearChat, models, selectedModel, setSelectedModel, fetchModels } = useChat(apiKey);
  const [inputValue, setInputValue] = useState('');
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
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          <h1 className="font-semibold text-lg hidden sm:block">AI Chat</h1>
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearChat} disabled={messages.length === 0}>
            Clear Chat
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden p-4 max-w-4xl mx-auto w-full flex flex-col">
        {/* Document Management Section */}
        <div className="mb-4 p-4 bg-white rounded-lg shadow-sm border">
          <FileUpload />
          <DocumentList />
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden shadow-md bg-white">
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
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
                  className={cn(
                    "flex max-w-[80%] rounded-lg p-3 text-sm",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted text-foreground"
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
                <div className="bg-muted rounded-lg p-3 text-sm flex items-center">
                  <Bot className="w-4 h-4 mr-2" />
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-destructive text-center text-sm p-2 bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t bg-gray-50/50">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                <Send className="w-4 h-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </Card>
      </main>
    </div>
  );
}
