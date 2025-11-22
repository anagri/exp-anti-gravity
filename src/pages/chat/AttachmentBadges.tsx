import { X, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttachmentBadgesProps {
  attachedDocuments: Array<{ id: string; filename: string }>;
  onRemove: (documentId: string) => void;
}

export default function AttachmentBadges({
  attachedDocuments,
  onRemove,
}: AttachmentBadgesProps) {
  if (attachedDocuments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {attachedDocuments.map((doc) => {
        // Truncate long filenames (max 20 chars)
        const displayName =
          doc.filename.length > 20
            ? doc.filename.substring(0, 17) + '...'
            : doc.filename;

        return (
          <div
            key={doc.id}
            data-testid={`attachment-badge-${doc.id}`}
            data-filename={doc.filename}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200 hover:bg-blue-100 transition-colors"
            title={doc.filename} // Show full filename on hover
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span className="font-medium">{displayName}</span>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`btn-remove-attachment-${doc.id}`}
              onClick={() => onRemove(doc.id)}
              className="h-auto p-0 hover:bg-transparent ml-1"
            >
              <X className="w-3.5 h-3.5 hover:text-blue-900" />
              <span className="sr-only">Remove {doc.filename}</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
