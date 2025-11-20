import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeleteModalProps {
  filename: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({ filename, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="div-delete-modal"
    >
      <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
        <div className="flex items-start mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold mb-2">Delete Document</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{filename}</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="btn-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-testid="btn-delete-confirm"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
