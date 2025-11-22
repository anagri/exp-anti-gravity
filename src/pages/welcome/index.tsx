import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApiKey } from '@/contexts/ApiKeyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Key, Settings } from 'lucide-react';
import SettingsDialog from '@/components/SettingsDialog';

export default function WelcomePage() {
  const [inputKey, setInputKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { setApiKey } = useApiKey();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim().startsWith('sk-')) {
      setApiKey(inputKey.trim());
      navigate('/chat');
    } else {
      toast.error('Please enter a valid OpenAI API key starting with sk-');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
            <Key className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Welcome to AI Chat</CardTitle>
          <CardDescription>
            Enter your OpenAI API key to start chatting. Your key is stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <Input
              data-testid="inp-welcome-apikey"
              type="password"
              placeholder="sk-..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="w-full"
              required
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button data-testid="btn-welcome-start" type="submit" className="w-full">
              Start Chatting
            </Button>
            <Button
              data-testid="btn-welcome-settings"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Advanced Settings
            </Button>
          </CardFooter>
        </form>
      </Card>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
