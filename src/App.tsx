import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApiKeyProvider, useApiKey } from './contexts/ApiKeyContext';
import { VectorDBProvider } from './contexts/VectorDBContext';
import WelcomePage from './pages/WelcomePage';
import ChatPage from './pages/ChatPage';
import DocumentsPage from './pages/documents';

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
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
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
          <AppRoutes />
        </VectorDBProvider>
      </ApiKeyProvider>
    </BrowserRouter>
  );
}

export default App;
