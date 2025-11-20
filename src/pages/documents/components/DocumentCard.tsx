import { FileText, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Document {
  id: string;
  filename: string;
  content: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface DocumentCardProps {
  document: Document;
  onDelete: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const handleDownload = () => {
    const blob = new Blob([document.content], { type: document.mime_type });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = document.filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      className="p-4 hover:shadow-md transition-shadow"
      data-testid={`div-doc-item-${document.id}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start mb-3">
          <FileText className="w-8 h-8 text-muted-foreground mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-sm truncate"
              data-testid={`span-doc-filename-${document.id}`}
              title={document.filename}
            >
              {document.filename}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {formatFileSize(document.file_size)}
            </p>
          </div>
        </div>

        <div className="mt-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Uploaded {formatDate(document.uploaded_at)}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              data-testid={`btn-doc-download-${document.id}`}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              data-testid={`btn-doc-delete-${document.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
