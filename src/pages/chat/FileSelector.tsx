import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import IndexingStatusBadge from '@/pages/documents/IndexingStatusBadge';

interface Document {
  id: string;
  filename: string;
  knowledge_base_id: string | null;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  retry_count: number | null;
}

interface KnowledgeBase {
  id: string;
  name: string;
}

interface FileSelectorProps {
  documents: Document[];
  knowledgeBases: KnowledgeBase[];
  selectedDocumentIds: string[];
  onSelectionChange: (documentIds: string[]) => void;
  onClose: () => void;
}

export default function FileSelector({
  documents,
  knowledgeBases,
  selectedDocumentIds,
  onSelectionChange,
  onClose,
}: FileSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKBId, setSelectedKBId] = useState<string>('all');
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set(selectedDocumentIds));
  const isAutoFilterRef = useRef(false);

  // Track which KB is "locked" based on current selection
  const lockedKBId = useMemo(() => {
    if (localSelection.size === 0) return null;
    const firstSelectedDoc = documents.find((doc) => localSelection.has(doc.id));
    return firstSelectedDoc?.knowledge_base_id || null;
  }, [localSelection, documents]);

  // Clear selection when KB filter changes manually (not via auto-filter)
  useEffect(() => {
    // Skip clearing if this was triggered by auto-filter
    if (isAutoFilterRef.current) {
      isAutoFilterRef.current = false;
      return;
    }

    // Clear selection on manual KB filter change
    // Prevents cross-KB selection and confusion
    setLocalSelection(new Set());
  }, [selectedKBId]);

  // Filter by KB first
  const kbFilteredDocuments = useMemo(() => {
    if (selectedKBId === 'all') return documents;
    return documents.filter((doc) => doc.knowledge_base_id === selectedKBId);
  }, [documents, selectedKBId]);

  // Sort alphabetically by filename
  const sortedDocuments = useMemo(() => {
    return [...kbFilteredDocuments].sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    );
  }, [kbFilteredDocuments]);

  // Filter by search query (client-side, case-insensitive)
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return sortedDocuments;

    const query = searchQuery.toLowerCase();
    return sortedDocuments.filter((doc) => doc.filename.toLowerCase().includes(query));
  }, [sortedDocuments, searchQuery]);

  // Get KB name for selection summary
  const selectedKBName = useMemo(() => {
    if (selectedKBId === 'all') return null;
    return knowledgeBases.find((kb) => kb.id === selectedKBId)?.name || null;
  }, [selectedKBId, knowledgeBases]);

  const handleToggle = (documentId: string, isCompleted: boolean, docKBId: string | null) => {
    if (!isCompleted) return; // Disabled checkboxes do nothing

    // Prevent cross-KB selection
    if (lockedKBId && docKBId !== lockedKBId) {
      return; // Silently ignore - checkbox is already disabled in UI
    }

    setLocalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
        // If last selection removed and "all" was selected, keep "all"
        // Otherwise stay on the KB filter
      } else {
        next.add(documentId);
        // Auto-filter to the KB of the selected document
        if (docKBId && selectedKBId === 'all') {
          isAutoFilterRef.current = true;
          setSelectedKBId(docKBId);
        }
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
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="btn-close-file-selector">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* KB Filter */}
        {knowledgeBases.length > 0 && (
          <div className="p-4 border-b bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">Knowledge Base</label>
            <select
              data-testid="select-kb-filter-fileselector"
              value={selectedKBId}
              onChange={(e) => setSelectedKBId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Knowledge Bases</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
              const isFromDifferentKB = lockedKBId && doc.knowledge_base_id !== lockedKBId;
              const isSelectable = isCompleted && !isFromDifferentKB;
              const isSelected = localSelection.has(doc.id);

              return (
                <div
                  key={doc.id}
                  data-testid={`file-selector-item-${doc.id}`}
                  data-filename={doc.filename}
                  data-indexing-status={doc.indexing_status || 'pending'}
                  data-selected={isSelected}
                  data-from-different-kb={isFromDifferentKB || false}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border
                    ${isSelectable ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}
                  `}
                  onClick={() => handleToggle(doc.id, isSelectable, doc.knowledge_base_id)}
                  title={
                    isFromDifferentKB
                      ? 'Cannot mix documents from different Knowledge Bases'
                      : undefined
                  }
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    data-testid={`checkbox-file-${doc.id}`}
                    data-disabled={!isSelectable}
                    checked={isSelected}
                    disabled={!isSelectable}
                    onChange={() => {}}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {/* Filename */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelectable ? 'text-gray-900' : 'text-gray-500'
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
                : selectedKBName
                  ? `${localSelection.size} ${localSelection.size === 1 ? 'document' : 'documents'} selected from ${selectedKBName}`
                  : `${localSelection.size} ${localSelection.size === 1 ? 'document' : 'documents'} selected`}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={
                filteredDocuments.filter((d) => d.indexing_status === 'completed').length === 0
              }
              data-testid="btn-select-all"
            >
              Select All
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} data-testid="btn-cancel-file-selector">
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
