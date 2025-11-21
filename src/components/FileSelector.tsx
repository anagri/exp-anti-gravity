import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import IndexingStatusBadge from '@/pages/documents/components/IndexingStatusBadge';

interface Document {
  id: string;
  filename: string;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  retry_count: number | null;
}

interface FileSelectorProps {
  documents: Document[];
  selectedDocumentIds: string[];
  onSelectionChange: (documentIds: string[]) => void;
  onClose: () => void;
}

export default function FileSelector({
  documents,
  selectedDocumentIds,
  onSelectionChange,
  onClose,
}: FileSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    new Set(selectedDocumentIds)
  );

  // Sort alphabetically by filename (ONLY sort option per spec)
  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    );
  }, [documents]);

  // Filter by search query (client-side, case-insensitive)
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return sortedDocuments;

    const query = searchQuery.toLowerCase();
    return sortedDocuments.filter((doc) =>
      doc.filename.toLowerCase().includes(query)
    );
  }, [sortedDocuments, searchQuery]);

  const handleToggle = (documentId: string, isCompleted: boolean) => {
    if (!isCompleted) return; // Disabled checkboxes do nothing

    setLocalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const completedDocumentIds = filteredDocuments
      .filter((doc) => doc.indexing_status === 'completed')
      .map((doc) => doc.id);
    setLocalSelection(new Set(completedDocumentIds));
  };

  const handleConfirm = () => {
    onSelectionChange(Array.from(localSelection));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-file-selector"
      data-state="open"
      onClick={onClose}
    >
      <div
        className="bg-white border rounded-lg max-w-2xl w-full mx-4 shadow-lg flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-semibold">Select Documents</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="btn-close-file-selector"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              data-testid="input-file-search"
              type="text"
              placeholder="Search by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredDocuments.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              {searchQuery
                ? 'No documents found matching your search'
                : 'No documents uploaded yet'}
            </div>
          )}

          <div className="space-y-2">
            {filteredDocuments.map((doc) => {
              const isCompleted = doc.indexing_status === 'completed';
              const isSelected = localSelection.has(doc.id);

              return (
                <div
                  key={doc.id}
                  data-testid={`file-selector-item-${doc.id}`}
                  data-filename={doc.filename}
                  data-indexing-status={doc.indexing_status || 'pending'}
                  data-selected={isSelected}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border
                    ${isCompleted ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}
                  `}
                  onClick={() => handleToggle(doc.id, isCompleted)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    data-testid={`checkbox-file-${doc.id}`}
                    data-disabled={!isCompleted}
                    checked={isSelected}
                    disabled={!isCompleted}
                    onChange={() => {}}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {/* Filename */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCompleted ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {doc.filename}
                    </p>
                  </div>

                  {/* Status Badge */}
                  {doc.indexing_status && (
                    <IndexingStatusBadge
                      status={doc.indexing_status}
                      retryCount={doc.retry_count || 0}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {localSelection.size === 0
                ? 'No documents selected'
                : `${localSelection.size} ${localSelection.size === 1 ? 'document' : 'documents'} selected`}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredDocuments.filter(d => d.indexing_status === 'completed').length === 0}
              data-testid="btn-select-all"
            >
              Select All
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="btn-cancel-file-selector"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={localSelection.size === 0}
              data-testid="btn-confirm-file-selector"
              data-selected-count={localSelection.size}
            >
              Attach Selected ({localSelection.size})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
