import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiKey } from '../contexts/ApiKeyContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Key } from 'lucide-react';

export default function WelcomePage() {
  const [inputKey, setInputKey] = useState('');
  const { setApiKey } = useApiKey();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim().startsWith('sk-')) {
      setApiKey(inputKey.trim());
      navigate('/chat');
    } else {
      alert('Please enter a valid OpenAI API key starting with sk-');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Key className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to AI Chat</CardTitle>
          <CardDescription>
            Enter your OpenAI API key to start chatting. Your key is stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Input
              type="password"
              placeholder="sk-..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full"
              required
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Start Chatting
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
