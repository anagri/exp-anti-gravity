import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApiKeyProvider, useApiKey } from './contexts/ApiKeyContext';
import WelcomePage from './pages/WelcomePage';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { apiKey } = useApiKey();
  if (!apiKey) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ApiKeyProvider>
        <AppRoutes />
      </ApiKeyProvider>
    </BrowserRouter>
  );
}

export default App;
