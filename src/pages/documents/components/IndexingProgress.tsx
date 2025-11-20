interface IndexingProgressProps {
  progress: number;
  stage: string;
  message: string;
}

export default function IndexingProgress({
  progress,
  stage,
  message,
}: IndexingProgressProps) {
  return (
    <div
      className="space-y-2"
      data-testid="indexing-progress"
      data-progress={progress}
      data-stage={stage}
      data-message={message}
    >
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">
        {message} ({progress}%)
      </p>
    </div>
  );
}
