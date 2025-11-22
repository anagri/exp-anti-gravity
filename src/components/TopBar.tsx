import React, { useState } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useApiKey } from '@/contexts/ApiKeyContext';
import SettingsDialog from './SettingsDialog';
import { Button } from './ui/button';

interface TopBarProps {
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export default function TopBar({ title, icon, children }: TopBarProps) {
  const navigate = useNavigate();
  const { clearApiKey } = useApiKey();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = () => {
    clearApiKey();
    navigate('/');
  };

  return (
    <>
      <header className="bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {icon}
            <h1 className="font-semibold text-lg hidden sm:block">{title}</h1>
          </div>
          <nav className="flex items-center gap-2 border-l pl-4">
            <Link to="/chat">
              <Button variant="ghost" size="sm" className="font-medium">
                Chat
              </Button>
            </Link>
            <Link to="/documents">
              <Button variant="ghost" size="sm">
                Documents
              </Button>
            </Link>
          </nav>
        </div>
        <div className="flex gap-2 items-center">
          {children}
          <Button
            data-testid="btn-settings"
            variant="ghost"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button data-testid="btn-logout" variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
