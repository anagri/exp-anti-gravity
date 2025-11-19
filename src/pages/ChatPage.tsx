import React from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Button } from '../components/ui/button';

export default function ChatPage() {
  const { clearApiKey } = useApiKey();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Chat Page</h1>
      <p>Chat functionality coming in Phase 5.</p>
      <Button onClick={clearApiKey} variant="destructive" className="mt-4">
        Logout
      </Button>
    </div>
  );
}
