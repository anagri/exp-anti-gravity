import { useVectorDB } from '@/contexts/VectorDBContext'

/**
 * Minimal document list component
 * Displays uploaded documents with delete functionality
 */
export function DocumentList() {
  const { documents, deleteDocument } = useVectorDB()

  const handleDelete = async (id: string, filename: string) => {
    if (confirm(`Delete "${filename}"?`)) {
      try {
        await deleteDocument(id)
      } catch (error) {
        console.error('Error deleting document:', error)
        alert('Failed to delete document. Please try again.')
      }
    }
  }

  return (
    <div className="mb-6" data-testid="document-list">
      <h3 className="text-lg font-medium mb-3">Document Library</h3>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="no-documents">
          No documents uploaded yet
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              data-testid={`document-${doc.id}`}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex-1">
                <p
                  className="font-medium text-sm"
                  data-testid="document-filename"
                >
                  {doc.filename}
                </p>
                <p className="text-xs text-gray-500">
                  {(doc.file_size / 1024).toFixed(1)} KB •{' '}
                  {new Date(doc.uploaded_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                data-testid={`delete-${doc.id}`}
                className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
