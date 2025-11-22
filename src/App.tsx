import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApiKeyProvider, useApiKey } from '@/contexts/ApiKeyContext';
import { VectorDBProvider } from '@/contexts/VectorDBContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import WelcomePage from '@/pages/welcome';
import ChatPage from '@/pages/chat';
import DocumentsPage from '@/pages/documents';
import SearchPage from '@/pages/SearchPage';

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
      <Route path="/" element={<ErrorBoundary><WelcomePage /></ErrorBoundary>} />
      <Route
        path="/chat"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />
      <Route
        path="/documents"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />
      <Route
        path="/search"
        element={
          <ErrorBoundary>
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          </ErrorBoundary>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename="/exp-anti-gravity">
      <ApiKeyProvider>
        <VectorDBProvider>
          <Toaster position="top-right" richColors />
          <AppRoutes />
        </VectorDBProvider>
      </ApiKeyProvider>
    </BrowserRouter>
  );
}

export default App;
