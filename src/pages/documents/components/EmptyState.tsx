import { FileText } from 'lucide-react';

export default function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="div-doc-empty"
    >
      <FileText className="w-16 h-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No documents uploaded</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Drop .md or .txt files in the upload zone above to get started
      </p>
    </div>
  );
}
