import { useState } from 'react';
import { BookOpen, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface KBCardProps {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  isExpanded?: boolean;
  onClick?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function KBCard({
  id,
  name,
  description,
  documentCount,
  chunkCount,
  createdAt,
  isExpanded = false,
  onClick,
  onEdit,
  onDelete,
}: KBCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg border p-6 transition-all relative ${
        isExpanded ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:shadow-md cursor-pointer'
      }`}
      data-testid={`kb-card-${id}`}
      data-kb-name={name}
      data-expanded={isExpanded}
      onClick={(e) => {
        // Don't trigger expand when clicking menu buttons
        if (
          e.target instanceof HTMLElement &&
          (e.target.closest('button') || e.target.closest('[role="button"]'))
        ) {
          return;
        }
        onClick?.();
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`btn-kb-menu-${id}`}
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8 p-0"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                <button
                  data-testid={`btn-edit-kb-${id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  data-testid={`btn-delete-kb-${id}`}
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{description}</p>}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span data-doc-count={documentCount}>
          {documentCount} {documentCount === 1 ? 'document' : 'documents'}
        </span>
        <span>•</span>
        <span data-chunk-count={chunkCount}>
          {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}
        </span>
        <span>•</span>
        <span>Created {formatDate(createdAt)}</span>
      </div>
    </div>
  );
}
