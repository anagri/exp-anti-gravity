import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReindexKBModalProps {
  kbName: string;
  documentCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReindexKBModal({
  kbName,
  documentCount,
  onConfirm,
  onCancel,
}: ReindexKBModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="modal-reindex-kb"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Re-index Knowledge Base</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to re-index <strong>{kbName}</strong>?
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <p className="text-sm text-amber-900 font-medium mb-2">Re-indexing will:</p>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Drop and recreate the vector index</li>
              <li>
                • Re-process all {documentCount} {documentCount === 1 ? 'document' : 'documents'}
              </li>
              <li>• Documents will be temporarily unsearchable</li>
              <li>• This may take several minutes</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            data-testid="btn-cancel-reindex-modal"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="btn-confirm-reindex-modal"
          >
            Re-index Now
          </Button>
        </div>
      </div>
    </div>
  );
}
