import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteKBModalProps {
  kbName: string
  documentCount: number
  chunkCount: number
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteKBModal({
  kbName,
  documentCount,
  chunkCount,
  onConfirm,
  onCancel,
}: DeleteKBModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-delete-kb">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Knowledge Base</h2>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete <span className="font-semibold" data-kb-name={kbName}>'{kbName}'</span>?
            </p>

            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-sm text-red-800 font-medium mb-2">This will permanently delete:</p>
              <ul className="text-sm text-red-700 space-y-1">
                <li data-doc-count={documentCount}>• {documentCount} {documentCount === 1 ? 'document' : 'documents'}</li>
                <li data-chunk-count={chunkCount}>• {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}</li>
                <li>• All embeddings</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 font-medium">
              This action cannot be undone.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              data-testid="btn-delete-kb-confirm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Knowledge Base
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
