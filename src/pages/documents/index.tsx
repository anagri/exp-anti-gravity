import { useState } from 'react';
import { useVectorDB } from '@/contexts/VectorDBContext';
import UploadZone from './components/UploadZone';
import DocumentCard from './components/DocumentCard';
import DeleteModal from './components/DeleteModal';
import DocumentToolbar from './components/DocumentToolbar';
import EmptyState from './components/EmptyState';

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc';
type FilterOption = 'all' | 'markdown' | 'text';

export default function DocumentsPage() {
  const { documents, uploadFiles, deleteDocument, initialized } = useVectorDB();
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
    <div className="min-h-screen bg-background p-6" data-db-initialized={initialized} data-uploading={isUploading}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Document Library</h1>
          <p className="text-muted-foreground">
            Upload and manage your markdown and text files
          </p>
          {!initialized && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="div-doc-loading">
              Initializing database...
            </p>
          )}
          {isUploading && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="div-doc-uploading">
              Uploading...
            </p>
          )}
        </div>

        <UploadZone onFilesSelected={handleFilesSelected} disabled={isUploading || !initialized} />

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={() => handleDeleteClick(doc.id, doc.filename)}
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
  );
}
