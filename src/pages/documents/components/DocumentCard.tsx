import { FileText, Download, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import IndexingStatusBadge from './IndexingStatusBadge';
import IndexingProgress from './IndexingProgress';

interface Document {
  id: string;
  filename: string;
  content: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  chunk_count: number | null;
  indexed_at: string | null;
  indexing_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  error_message: string | null;
  retry_count: number | null;
}

interface DocumentCardProps {
  document: Document;
  onDelete: () => void;
  onRetry?: () => void;
  indexingProgress?: {
    progress: number;
    stage: string;
    message: string;
  };
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

export default function DocumentCard({
  document,
  onDelete,
  onRetry,
  indexingProgress,
}: DocumentCardProps) {
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
      data-indexing-status={document.indexing_status}
      data-indexing-progress={indexingProgress?.progress ?? 0}
      data-indexing-stage={indexingProgress?.stage ?? document.indexing_status ?? ''}
      data-chunk-count={document.chunk_count ?? 0}
      data-error-message={document.error_message ?? ''}
      data-retry-count={document.retry_count ?? 0}
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

        {/* Indexing Status Section */}
        {document.indexing_status && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <IndexingStatusBadge
              status={document.indexing_status}
              retryCount={document.retry_count ?? 0}
            />

            {/* Progress Bar (only when processing) */}
            {document.indexing_status === 'processing' && indexingProgress && (
              <IndexingProgress
                progress={indexingProgress.progress}
                stage={indexingProgress.stage}
                message={indexingProgress.message}
              />
            )}

            {/* Chunk Count (when completed) */}
            {document.indexing_status === 'completed' && document.chunk_count && (
              <p className="text-xs text-gray-600">
                {document.chunk_count} chunks indexed
              </p>
            )}

            {/* Error Message (when failed) */}
            {document.indexing_status === 'failed' && document.error_message && (
              <div className="space-y-2">
                <p className="text-xs text-red-600 break-words">
                  ✗ Error: {document.error_message}
                </p>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    data-testid={`btn-retry-${document.id}`}
                    className="w-full"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry (Attempt {(document.retry_count ?? 0) + 1})
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

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
