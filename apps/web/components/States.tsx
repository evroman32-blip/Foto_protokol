interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Загрузка…' }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-gray-500">{label}</div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="alert-error flex flex-wrap items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary">
          Повторить
        </button>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <p className="text-sm text-gray-600">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
