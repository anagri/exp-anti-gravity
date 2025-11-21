import { useState, useEffect } from 'react';
import { useVectorDB } from '@/contexts/VectorDBContext';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KBCard from './components/KBCard';
import CreateKBModal from './components/CreateKBModal';
import DeleteKBModal from './components/DeleteKBModal';
import DocumentCard from './components/DocumentCard';
import UploadZone from './components/UploadZone';
import TopBar from '@/components/TopBar';
import { useSearchParams } from 'react-router-dom';

export default function DocumentsPage() {
  const {
    knowledgeBases,
    documents,
    deleteKnowledgeBase,
    refreshKnowledgeBases,
    refreshDocuments,
    deleteDocument,
    uploadFiles,
    retryFailed,
    indexingProgress,
    initialized,
    initError,
    retryInitialization,
  } = useVectorDB();

  const [searchParams, setSearchParams] = useSearchParams();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [kbToDelete, setKbToDelete] = useState<{ id: string; name: string; documentCount: number; chunkCount: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Expanded KB state synced with URL
  const expandedKBId = searchParams.get('kb') || null;

  // Load KBs on mount and after initialization
  useEffect(() => {
    if (initialized) {
      refreshKnowledgeBases();
    }
  }, [initialized]);

  // Load documents when KB is expanded
  useEffect(() => {
    if (initialized && expandedKBId) {
      refreshDocuments();
    }
  }, [initialized, expandedKBId]);

  const handleDeleteClick = (kb: { id: string; name: string; document_count: number; chunk_count: number }) => {
    setKbToDelete({
      id: kb.id,
      name: kb.name,
      documentCount: kb.document_count,
      chunkCount: kb.chunk_count,
    });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!kbToDelete) return;

    await deleteKnowledgeBase(kbToDelete.id);
    setDeleteModalOpen(false);
    setKbToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setKbToDelete(null);
  };

  const handleKBClick = (kbId: string) => {
    if (expandedKBId === kbId) {
      // Collapse if already expanded
      searchParams.delete('kb');
      setSearchParams(searchParams);
    } else {
      // Expand new KB (collapses previous)
      setSearchParams({ kb: kbId });
    }
  };

  // Filter documents to only show those in expanded KB
  const visibleDocuments = expandedKBId
    ? documents.filter((doc) => doc.knowledge_base_id === expandedKBId)
    : [];

  const handleFilesSelected = async (files: File[]) => {
    if (!expandedKBId) {
      console.error('[DocumentsPage] Cannot upload without expanded KB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadFiles(files, expandedKBId);
      // refreshDocuments is called inside uploadFiles
    } catch (error) {
      console.error('[DocumentsPage] Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50" data-testid="page-knowledge-bases" data-db-initialized={initialized}>
      <TopBar title="Knowledge Bases" icon={<BookOpen className="w-6 h-6 text-blue-600" />}>
        <Button
          onClick={() => setCreateModalOpen(true)}
          disabled={!initialized || !!initError}
          data-testid="btn-create-kb"
        >
          New Knowledge Base
        </Button>
      </TopBar>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {!initialized && !initError && (
            <p className="text-sm text-gray-500 mb-4">
              Initializing database...
            </p>
          )}
          {initError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6" data-testid="div-init-error">
              <h3 className="text-red-800 font-semibold text-lg mb-2">Database Initialization Failed</h3>
              <p className="text-red-700 text-sm mb-4">{initError.message}</p>
              <div className="bg-red-100 border border-red-300 rounded p-4 mb-4">
                <p className="text-red-800 font-semibold text-sm mb-2">Troubleshooting Steps:</p>
                <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                  <li>Clear browser cache and reload (Cmd+Shift+R or Ctrl+Shift+R)</li>
                  <li>Open DevTools → Application → Storage → IndexedDB → Delete "rag-vectors" database</li>
                  <li>Try a different browser or incognito/private window</li>
                  <li>Restart your browser completely</li>
                </ul>
              </div>
              {initError.canRetry && (
                <Button
                  onClick={retryInitialization}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-retry-init"
                >
                  Retry Initialization
                </Button>
              )}
            </div>
          )}

          {/* Knowledge Bases Grid */}
          {knowledgeBases.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No knowledge bases yet</h3>
              <p className="text-gray-600 mb-6">Create your first knowledge base to get started</p>
              <Button
                onClick={() => setCreateModalOpen(true)}
                disabled={!initialized || !!initError}
              >
                Create Knowledge Base
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {knowledgeBases.map(kb => {
                const isExpanded = expandedKBId === kb.id;
                return (
                  <div key={kb.id}>
                    <KBCard
                      id={kb.id}
                      name={kb.name}
                      description={kb.description}
                      documentCount={kb.document_count}
                      chunkCount={kb.chunk_count}
                      createdAt={kb.created_at}
                      isExpanded={isExpanded}
                      onClick={() => handleKBClick(kb.id)}
                      onEdit={() => {
                        // TODO: Implement edit in next iteration
                        console.log('Edit KB:', kb.id);
                      }}
                      onDelete={() => handleDeleteClick(kb)}
                    />

                    {/* Show upload zone and documents when KB is expanded */}
                    {isExpanded && (
                      <div className="mt-4 ml-4 border-l-4 border-blue-500 pl-6">
                        {/* Upload Zone */}
                        <div className="mb-6" data-uploading={isUploading}>
                          <div className="mb-2">
                            <p className="text-sm font-medium text-gray-700">
                              Upload documents to: <span className="text-blue-600">{kb.name}</span>
                            </p>
                          </div>
                          <UploadZone
                            onFilesSelected={handleFilesSelected}
                            disabled={!initialized || isUploading}
                          />
                        </div>

                        {/* Documents List */}
                        {visibleDocuments.length === 0 ? (
                          <p className="text-gray-500 text-sm py-4">
                            No documents in this knowledge base yet
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visibleDocuments.map(doc => (
                              <DocumentCard
                                key={doc.id}
                                document={doc}
                                onDelete={() => {
                                  deleteDocument(doc.id);
                                }}
                                onRetry={
                                  doc.indexing_status === 'failed'
                                    ? () => retryFailed(doc.id)
                                    : undefined
                                }
                                indexingProgress={indexingProgress.get(doc.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Modals */}
          {createModalOpen && (
            <CreateKBModal
              onClose={() => setCreateModalOpen(false)}
              onSuccess={() => refreshKnowledgeBases()}
            />
          )}

          {deleteModalOpen && kbToDelete && (
            <DeleteKBModal
              kbName={kbToDelete.name}
              documentCount={kbToDelete.documentCount}
              chunkCount={kbToDelete.chunkCount}
              onConfirm={handleDeleteConfirm}
              onCancel={handleDeleteCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
