import { useState } from 'react';
import { useVectorDB } from '@/contexts/VectorDBContext';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UploadZone from './components/UploadZone';
import DocumentCard from './components/DocumentCard';
import DeleteModal from './components/DeleteModal';
import DocumentToolbar from './components/DocumentToolbar';
import EmptyState from './components/EmptyState';
import TopBar from '@/components/TopBar';

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';
type FilterOption = 'all' | 'markdown' | 'text';

export default function DocumentsPage() {
  const { documents, uploadFiles, deleteDocument, initialized, initError, indexingProgress, retryFailed, retryInitialization } = useVectorDB();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; filename: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    const validFiles = files.filter(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      return ext === 'md' || ext === 'txt';
    });

    if (validFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      await uploadFiles(validFiles);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = (id: string, filename: string) => {
    setDocumentToDelete({ id, filename });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    await deleteDocument(documentToDelete.id);
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setDocumentToDelete(null);
  };

  const filteredDocuments = documents
    .filter(doc => {
      if (searchQuery) {
        return doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .filter(doc => {
      if (filterOption === 'all') return true;
      const ext = doc.filename.toLowerCase().split('.').pop();
      if (filterOption === 'markdown') return ext === 'md';
      if (filterOption === 'text') return ext === 'txt';
      return true;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        case 'date-asc':
          return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
        case 'name-asc':
          return a.filename.localeCompare(b.filename);
        case 'name-desc':
          return b.filename.localeCompare(a.filename);
        case 'size-asc':
          return a.file_size - b.file_size;
        case 'size-desc':
          return b.file_size - a.file_size;
        default:
          return 0;
      }
    });

  return (
    <div className="flex flex-col h-screen bg-gray-50" data-db-initialized={initialized} data-uploading={isUploading}>
      <TopBar title="Documents" icon={<FileText className="w-6 h-6 text-blue-600" />} />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {!initialized && !initError && (
            <p className="text-sm text-gray-500 mb-4" data-testid="div-doc-loading">
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
          {isUploading && (
            <p className="text-sm text-gray-500 mb-4" data-testid="div-doc-uploading">
              Uploading...
            </p>
          )}

        <UploadZone onFilesSelected={handleFilesSelected} disabled={isUploading || !initialized || !!initError} />

        <DocumentToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOption={sortOption}
          onSortChange={setSortOption}
          filterOption={filterOption}
          onFilterChange={setFilterOption}
        />

        {filteredDocuments.length === 0 && !searchQuery && !isUploading ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={() => handleDeleteClick(doc.id, doc.filename)}
                onRetry={() => retryFailed(doc.id)}
                indexingProgress={indexingProgress.get(doc.id)}
              />
            ))}
          </div>
        )}

        {deleteModalOpen && documentToDelete && (
          <DeleteModal
            filename={documentToDelete.filename}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
        </div>
      </div>
    </div>
  );
}
