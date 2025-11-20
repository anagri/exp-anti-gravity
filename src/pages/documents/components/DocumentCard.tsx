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
      className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 group"
      data-testid={`div-doc-item-${document.id}`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start">
          <FileText className="w-8 h-8 text-gray-500 mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-gray-900 truncate"
              data-testid={`span-doc-filename-${document.id}`}
              title={document.filename}
            >
              {document.filename}
            </h3>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-mono">{formatFileSize(document.file_size)}</span>
          <span>{formatDate(document.uploaded_at)}</span>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
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
    </Card>
  );
}
