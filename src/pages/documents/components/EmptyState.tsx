import { FileText } from 'lucide-react';

export default function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4"
      data-testid="div-doc-empty"
    >
      <div className="p-6 bg-muted rounded-full mb-6">
        <FileText className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No documents uploaded</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Drop .md or .txt files in the upload zone above to get started
      </p>
    </div>
  );
}
