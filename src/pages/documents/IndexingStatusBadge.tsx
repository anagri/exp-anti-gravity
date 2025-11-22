import { Clock, Zap, CheckCircle, XCircle } from 'lucide-react';

type IndexingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface IndexingStatusBadgeProps {
  status: IndexingStatus;
  retryCount?: number;
}

export default function IndexingStatusBadge({ status, retryCount = 0 }: IndexingStatusBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    processing: {
      icon: Zap,
      label: 'Processing',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
    completed: {
      icon: CheckCircle,
      label: 'Indexed',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    failed: {
      icon: XCircle,
      label: `Failed${retryCount > 0 ? ` (${retryCount})` : ''}`,
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
  };

  const { icon: Icon, label, bgColor, textColor, iconColor } = config[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      data-testid="badge-indexing-status"
      data-status={status}
      data-retry-count={retryCount}
    >
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      <span>{label}</span>
    </div>
  );
}
